// Authentication: sign-up, email verification, login, lockout, sessions
// (refresh, logout) and password reset, through the real Express app.
// The database is an in-memory store, but the User model's own methods run
// for real: bcrypt hashing on save, password checks and JWT signing.
// Emails to Brevo are intercepted so the verification link can be followed.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
// Freeze "now" so token expiry and lockout timing are predictable.
mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-12T06:30:00Z") });
const require = createRequire(import.meta.url);
const mongoose = require("mongoose");

process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";
process.env.MONGO_URI = "mongodb://stub.invalid/test";
process.env.BREVO_API_KEY = "test-brevo-key";
process.env.MAIL_FROM_EMAIL = "noreply@profligate.test";
process.env.CLIENT_URL = "http://localhost:5173";
mongoose.connect = async () => mongoose;

const R = new URL("../", import.meta.url).href;
const { User } = await import(R + "src/models/user.models.js");
const { RefreshToken } = await import(R + "src/models/refreshToken.model.js");
const { PasswordAttempt } = await import(R + "src/models/passwordAttempt.model.js");

// ── In-memory database ──────────────────────────────────────────────
const db = { users: [], refreshTokens: [], attempts: new Map() };

// A query that can be awaited directly or after `.select(...)`.
const query = (doc) => ({
  select(projection = "") {
    if (!doc) return query(null);
    const hidden = projection.split(/\s+/).filter((p) => p.startsWith("-")).map((p) => p.slice(1));
    if (hidden.length === 0) return query(doc);
    const plain = doc.toObject();
    for (const field of hidden) delete plain[field];
    return query(plain);
  },
  then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
});

// Saving runs the schema's real pre-save hook (which hashes a changed password).
const persist = (doc) => {
  doc.save = async function () {
    await User.schema.s.hooks.execPre("save", this, [{}]);
    this.unmarkModified("password");
    return this;
  };
  return doc;
};

const notExpired = (value) => value && +value > Date.now();

User.findOne = (q) => {
  let found = null;
  if (q.email) found = db.users.find((u) => u.email === q.email);
  else if (q.emailVerificationToken) {
    found = db.users.find((u) => u.emailVerificationToken === q.emailVerificationToken && notExpired(u.emailVerificationExpiry));
  } else if (q.forgotPasswordToken) {
    found = db.users.find((u) => u.forgotPasswordToken === q.forgotPasswordToken && notExpired(u.forgotPasswordExpiry));
  }
  return query(found ?? null);
};
User.findById = (id) => query(db.users.find((u) => String(u._id) === String(id)) ?? null);
User.create = async (data) => {
  const doc = persist(new User(data));
  await doc.save();
  db.users.push(doc);
  return doc;
};

// Mirrors the unique index on RefreshToken.token in MongoDB.
RefreshToken.create = async (doc) => {
  if (db.refreshTokens.some((t) => t.token === doc.token)) {
    throw Object.assign(new Error("E11000 duplicate key error"), { code: 11000 });
  }
  db.refreshTokens.push({ ...doc });
  return doc;
};
RefreshToken.findOneAndDelete = async ({ token }) => {
  const i = db.refreshTokens.findIndex((t) => t.token === token);
  return i === -1 ? null : db.refreshTokens.splice(i, 1)[0];
};
RefreshToken.deleteOne = async ({ token }) => { db.refreshTokens = db.refreshTokens.filter((t) => t.token !== token); };
RefreshToken.deleteMany = async ({ userId }) => {
  db.refreshTokens = db.refreshTokens.filter((t) => String(t.userId) !== String(userId));
};

const attemptKey = ({ userId, attemptType }) => `${userId}:${attemptType}`;
PasswordAttempt.findOne = async (q) => {
  const a = db.attempts.get(attemptKey(q));
  return a ? { ...a, save: async function () { db.attempts.set(attemptKey(q), { failedCount: this.failedCount, lockedUntil: this.lockedUntil }); } } : null;
};
PasswordAttempt.findOneAndUpdate = async (q, update) => {
  const a = db.attempts.get(attemptKey(q)) ?? { failedCount: 0, lockedUntil: null };
  a.failedCount += update.$inc.failedCount;
  db.attempts.set(attemptKey(q), a);
  return { ...a };
};
PasswordAttempt.updateOne = async (q, update) => {
  const a = db.attempts.get(attemptKey(q));
  if (a && a.lockedUntil === null) a.lockedUntil = update.$set.lockedUntil;
};
PasswordAttempt.deleteOne = async (q) => { db.attempts.delete(attemptKey(q)); };

// ── Intercept emails sent through Brevo ─────────────────────────────
const sentEmails = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes("api.brevo.com")) {
    const body = JSON.parse(init.body);
    sentEmails.push({ to: body.to[0].email, subject: body.subject, html: body.htmlContent });
    return new Response(JSON.stringify({ messageId: "test" }), { status: 201, headers: { "content-type": "application/json" } });
  }
  return realFetch(url, init);
};
const tokenFromLastEmail = (to) => {
  const email = sentEmails.filter((e) => e.to === to).at(-1);
  return email?.html.match(/token=([a-f0-9]+)/)?.[1];
};

// ── HTTP helpers ────────────────────────────────────────────────────
const { default: app } = await import(R + "src/app.js");
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}/api/v1`;
test.after(() => server.close());

const cookiesFrom = (res) =>
  Object.fromEntries(res.headers.getSetCookie().map((c) => { const [pair] = c.split(";"); const i = pair.indexOf("="); return [pair.slice(0, i), pair.slice(i + 1)]; }));
const cookieHeader = (cookies) => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");

const call = async (method, path, { body, cookies } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (cookies) headers.Cookie = cookieHeader(cookies);
  const res = await realFetch(base + path, { method, headers, body: body && JSON.stringify(body) });
  const setCookie = res.headers.getSetCookie();
  return { status: res.status, body: await res.json(), cookies: cookiesFrom(res), setCookie };
};

const loginAs = (email, password) => call("POST", "/auth/login", { body: { email, password } });

const signUpAndVerify = async (email, password = "correct-horse-1") => {
  await call("POST", "/auth/register", { body: { name: "Test Student", email, password } });
  await call("GET", `/auth/verify-email?token=${tokenFromLastEmail(email)}`);
  return { email, password };
};

// ── Sign-up ─────────────────────────────────────────────────────────
test("sign-up rejects invalid input with field-level messages", async () => {
  const cases = [
    [{ email: "a@b.co", password: "longenough" }, "name", "Name is required"],
    [{ name: "A", email: "a@b.co", password: "longenough" }, "name", "Name must be at least 2 characters"],
    [{ name: "Asha", email: "not-an-email", password: "longenough" }, "email", "Email is not a valid email address"],
    [{ name: "Asha", email: "a@b.co", password: "short" }, "password", "Password must be at least 8 characters"],
  ];
  for (const [body, field, message] of cases) {
    const res = await call("POST", "/auth/register", { body });
    assert.equal(res.status, 422, JSON.stringify(body));
    assert.ok(res.body.errors.some((e) => e[field] === message), `${field}: ${JSON.stringify(res.body.errors)}`);
  }
  assert.equal(db.users.length, 0, "nothing saved for invalid input");
});

test("sign-up stores a hashed password and emails a verification link", async () => {
  const res = await call("POST", "/auth/register", { body: { name: "  Asha  ", email: "Asha@Example.com", password: "correct-horse-1" } });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.user.email, "asha@example.com", "email is lowercased");
  assert.equal(res.body.data.user.name, "Asha", "name is trimmed");
  assert.equal(res.body.data.user.password, undefined, "password never returned");
  assert.equal(res.body.data.user.isEmailVerified, false);

  const stored = db.users.find((u) => u.email === "asha@example.com");
  assert.match(stored.password, /^\$2[aby]\$10\$/, "bcrypt hash, not the plain password");
  assert.equal(await stored.isPasswordCorrect("correct-horse-1"), true);

  const token = tokenFromLastEmail("asha@example.com");
  assert.ok(token, "verification email sent with a token link");
  assert.equal(stored.emailVerificationToken, crypto.createHash("sha256").update(token).digest("hex"), "only the hash is stored");
  assert.equal(res.setCookie.length, 0, "no session until the email is verified");
});

test("sign-up refuses an email that already exists, whatever its case", async () => {
  const res = await call("POST", "/auth/register", { body: { name: "Asha", email: "ASHA@example.com", password: "another-pass-2" } });
  assert.equal(res.status, 409);
  assert.equal(db.users.filter((u) => u.email === "asha@example.com").length, 1);
});

// ── Email verification ──────────────────────────────────────────────
test("login is blocked until the email is verified", async () => {
  const res = await call("POST", "/auth/login", { body: { email: "asha@example.com", password: "correct-horse-1" } });
  assert.equal(res.status, 403);
  assert.match(res.body.message, /verify your email/i);
});

test("verification needs a valid token, logs the user in, and works only once", async () => {
  assert.equal((await call("GET", "/auth/verify-email")).status, 400, "missing token");
  assert.equal((await call("GET", "/auth/verify-email?token=deadbeef")).status, 400, "unknown token");

  const token = tokenFromLastEmail("asha@example.com");
  const res = await call("GET", `/auth/verify-email?token=${token}`);
  assert.equal(res.status, 200);
  assert.ok(res.cookies.accessToken && res.cookies.refreshToken, "session cookies set");
  assert.equal(db.users.find((u) => u.email === "asha@example.com").isEmailVerified, true);

  assert.equal((await call("GET", `/auth/verify-email?token=${token}`)).status, 400, "token can't be reused");
});

test("a verification link expires after 20 minutes", async () => {
  await call("POST", "/auth/register", { body: { name: "Late Larry", email: "late@example.com", password: "correct-horse-1" } });
  const token = tokenFromLastEmail("late@example.com");
  mock.timers.tick(21 * 60 * 1000);
  const res = await call("GET", `/auth/verify-email?token=${token}`);
  assert.equal(res.status, 400);
  assert.match(res.body.message, /invalid or has expired/);
});

// ── Login ───────────────────────────────────────────────────────────
test("login sets HttpOnly session cookies and never returns the password", async () => {
  const res = await loginAs("ASHA@example.com", "correct-horse-1");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.email, "asha@example.com");
  assert.equal(res.body.data.user.password, undefined);
  for (const name of ["accessToken", "refreshToken"]) {
    const cookie = res.setCookie.find((c) => c.startsWith(`${name}=`));
    assert.ok(cookie, `${name} cookie set`);
    assert.match(cookie, /HttpOnly/i, `${name} is HttpOnly`);
    assert.match(cookie, /SameSite=Lax/i);
  }
  assert.ok(db.refreshTokens.some((t) => t.token === res.cookies.refreshToken), "refresh token stored server-side");
});

test("a wrong password and an unknown email get the same answer", async () => {
  const wrong = await call("POST", "/auth/login", { body: { email: "asha@example.com", password: "wrong-password" } });
  const unknown = await call("POST", "/auth/login", { body: { email: "nobody@example.com", password: "wrong-password" } });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.body.message, unknown.body.message, "no hint about which emails have accounts");
  assert.equal(wrong.setCookie.length, 0);
});

test("login rejects missing fields before checking the database", async () => {
  const res = await call("POST", "/auth/login", { body: { email: "asha@example.com" } });
  assert.equal(res.status, 422);
  assert.ok(res.body.errors.some((e) => e.password === "Password is required"));
});

test("5 wrong passwords lock the account for 15 minutes, then it unlocks", async () => {
  const user = await signUpAndVerify("lockme@example.com");
  for (let i = 0; i < 5; i++) {
    assert.equal((await call("POST", "/auth/login", { body: { email: user.email, password: "wrong" } })).status, 401);
  }
  const locked = await loginAs(user.email, user.password);
  assert.equal(locked.status, 429, "even the right password is refused while locked");

  mock.timers.tick(14 * 60 * 1000);
  assert.equal((await loginAs(user.email, user.password)).status, 429, "still locked after 14 minutes");

  mock.timers.tick(2 * 60 * 1000);
  const unlocked = await loginAs(user.email, user.password);
  assert.equal(unlocked.status, 200, "unlocked after 15 minutes");
});

test("a successful login resets the failed-attempt count", async () => {
  const user = await signUpAndVerify("reset-count@example.com");
  for (let i = 0; i < 4; i++) await call("POST", "/auth/login", { body: { email: user.email, password: "wrong" } });
  assert.equal((await loginAs(user.email, user.password)).status, 200);
  for (let i = 0; i < 4; i++) await call("POST", "/auth/login", { body: { email: user.email, password: "wrong" } });
  assert.equal((await loginAs(user.email, user.password)).status, 200, "4 + 4 failures never reach the limit of 5");
});

// ── Sessions ────────────────────────────────────────────────────────
test("protected routes need a valid access token", async () => {
  const login = await loginAs("asha@example.com", "correct-horse-1");
  const me = await call("GET", "/users/me", { cookies: { accessToken: login.cookies.accessToken } });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.email, "asha@example.com");
  assert.equal(me.body.data.password, undefined);

  assert.equal((await call("GET", "/users/me")).status, 401, "no token");
  const tampered = login.cookies.accessToken.slice(0, -2) + "xx";
  assert.equal((await call("GET", "/users/me", { cookies: { accessToken: tampered } })).status, 401, "tampered token");
});

test("refresh tokens are single-use: each refresh rotates the pair", async () => {
  const login = await loginAs("asha@example.com", "correct-horse-1");
  const first = login.cookies.refreshToken;

  const refreshed = await call("POST", "/auth/refresh", { cookies: { refreshToken: first } });
  assert.equal(refreshed.status, 200);
  assert.ok(refreshed.cookies.refreshToken && refreshed.cookies.refreshToken !== first, "a new refresh token is issued");

  const reused = await call("POST", "/auth/refresh", { cookies: { refreshToken: first } });
  assert.equal(reused.status, 401, "the old refresh token no longer works");

  assert.equal((await call("POST", "/auth/refresh", { cookies: { refreshToken: refreshed.cookies.refreshToken } })).status, 200);
  assert.equal((await call("POST", "/auth/refresh")).status, 401, "no token");
});

test("logout ends the session and clears the cookies", async () => {
  const login = await loginAs("asha@example.com", "correct-horse-1");
  const res = await call("POST", "/auth/logout", { cookies: login.cookies });
  assert.equal(res.status, 200);
  assert.ok(res.setCookie.some((c) => c.startsWith("refreshToken=;")), "refresh cookie cleared");
  assert.equal((await call("POST", "/auth/refresh", { cookies: { refreshToken: login.cookies.refreshToken } })).status, 401);
});

// ── Password reset ──────────────────────────────────────────────────
test("forgot password gives the same answer for unknown emails and sends nothing", async () => {
  const before = sentEmails.length;
  const unknown = await call("POST", "/auth/forgot-password", { body: { email: "nobody@example.com" } });
  const known = await call("POST", "/auth/forgot-password", { body: { email: "asha@example.com" } });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.body.message, known.body.message, "no hint about which emails have accounts");
  assert.equal(sentEmails.length, before + 1, "only the real account gets an email");
});

test("password reset changes the password, signs out every session, and works once", async () => {
  const session = await loginAs("asha@example.com", "correct-horse-1");
  await call("POST", "/auth/forgot-password", { body: { email: "asha@example.com" } });
  const token = tokenFromLastEmail("asha@example.com");

  assert.equal((await call("POST", "/auth/reset-password", { body: { token, newPassword: "short" } })).status, 422);
  const reset = await call("POST", "/auth/reset-password", { body: { token, newPassword: "brand-new-pass-3" } });
  assert.equal(reset.status, 200);

  assert.equal((await call("POST", "/auth/refresh", { cookies: { refreshToken: session.cookies.refreshToken } })).status, 401, "old sessions revoked");
  assert.equal((await call("POST", "/auth/login", { body: { email: "asha@example.com", password: "correct-horse-1" } })).status, 401, "old password rejected");
  assert.equal((await loginAs("asha@example.com", "brand-new-pass-3")).status, 200, "new password works");
  assert.equal((await call("POST", "/auth/reset-password", { body: { token, newPassword: "another-pass-4" } })).status, 400, "reset link can't be reused");
});

// ── Regression: logins in the same second ───────────────────────────
// Refresh tokens used to contain only the user id and the current second, so
// two logins in the same second (a double-click, two devices) produced the
// same token and the unique index rejected the second with a 500. Each token
// now carries a random id (jwtid). The clock is frozen here, so both logins
// really do happen in the same second.
test("two logins in the same second both succeed with different tokens", async () => {
  const user = await signUpAndVerify("double-click@example.com");
  const first = await call("POST", "/auth/login", { body: user });
  const second = await call("POST", "/auth/login", { body: user });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.notEqual(first.cookies.refreshToken, second.cookies.refreshToken);
  assert.equal((await call("POST", "/auth/refresh", { cookies: { refreshToken: first.cookies.refreshToken } })).status, 200, "both sessions work");
  assert.equal((await call("POST", "/auth/refresh", { cookies: { refreshToken: second.cookies.refreshToken } })).status, 200);
});
