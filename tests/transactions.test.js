// Editing transactions: PATCH /api/v1/transactions/:id.
// These tests never touch a real database: Mongoose model methods are
// replaced with in-memory stubs.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
// Freeze "now" so results that depend on today's date are the same every run.
mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-12T06:30:00Z") });
const require = createRequire(import.meta.url);
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const R = new URL("../", import.meta.url).href;

test("PATCH /transactions/:id", async (t) => {
  process.env.ACCESS_TOKEN_SECRET = "test-secret";
  process.env.MONGO_URI = "mongodb://stub.invalid/test";
  mongoose.connect = async () => mongoose;
  const { User } = await import(R + "src/models/user.models.js");
  const { Transaction } = await import(R + "src/models/transaction.model.js");
  const { Notification } = await import(R + "src/models/notification.model.js");
  const { FixedCost } = await import(R + "src/models/fixedCost.model.js");

  const userId = new mongoose.Types.ObjectId();
  const chain = (v) => ({ select() { return this; }, sort() { return this; }, lean: async () => v, then: (res, rej) => Promise.resolve(v).then(res, rej) });
  // Alerts enabled with a daily limit, so the daily-limit check runs for real (on stubs).
  User.findById = () => chain({ _id: userId, timezone: "Asia/Kolkata", openingBalancePaise: 0, preferences: { alertEnabled: true, dailyLimitPaise: 50000 } });

  const normalId = new mongoose.Types.ObjectId();
  const billTxId = new mongoose.Types.ObjectId();
  const docs = {
    [normalId]: { _id: normalId, userId, amountPaise: 20000, type: "expense", category: "Food", description: "zomato", paymentMethod: "upi", transactionDate: new Date("2026-11-02T06:30:00Z") },
    [billTxId]: { _id: billTxId, userId, amountPaise: 400000, type: "expense", category: "Accommodation", description: "Rent (bill)", paymentMethod: "upi", transactionDate: new Date("2026-11-01T06:30:00Z"), fixedCostId: new mongoose.Types.ObjectId() },
  };
  const saved = [];
  Transaction.findOne = (q) => {
    const d = docs[q._id];
    if (!d || String(d.userId) !== String(q.userId)) return chain(null);
    const doc = { ...d, toObject() { const { toObject, save, ...rest } = this; return { ...rest }; }, async save() { const { toObject, save, ...rest } = this; docs[d._id] = rest; saved.push(rest); } };
    return chain(doc);
  };
  // Daily-limit check internals
  const dayChecks = [];
  Transaction.aggregate = async (p) => { if (p[0].$match.transactionDate?.$gte && !p[0].$match.fixedCostId) dayChecks.push(p[0].$match.transactionDate.$gte.toISOString()); return []; };
  Transaction.exists = async () => null;
  Notification.deleteOne = async () => ({});
  Notification.exists = async () => null;
  FixedCost.find = () => chain([]);

  const { default: app } = await import(R + "src/app.js");
  const server = app.listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/v1/transactions`;
  const token = jwt.sign({ _id: userId.toString() }, "test-secret");
  const patch = async (id, body) => {
    const res = await fetch(`${base}/${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };

  // Validation
  for (const [body, why] of [[{}, "empty"], [{ amountPaise: 0 }, "zero"], [{ amountPaise: 12.5 }, "decimal"], [{ type: "gift" }, "type"], [{ category: " " }, "category"], [{ paymentMethod: "bitcoin" }, "method"], [{ transactionDate: "nope" }, "date"], [{ description: "x".repeat(201) }, "long description"]]) {
    assert.equal((await patch(normalId, body)).status, 400, why);
  }
  assert.equal((await patch("not-an-id", { amountPaise: 100 })).status, 400);
  assert.equal((await patch(new mongoose.Types.ObjectId(), { amountPaise: 100 })).status, 404, "someone else's or missing");

  // Bill payments can't become income, but other edits are fine
  const billIncome = await patch(billTxId, { type: "income" });
  assert.equal(billIncome.status, 400);
  assert.match(billIncome.body.message, /Bill payments can't be changed to income/);
  assert.equal((await patch(billTxId, { amountPaise: 410000 })).status, 200);

  // Normal edit: amount, description, and moving it to another day
  dayChecks.length = 0;
  const ok = await patch(normalId, { amountPaise: 35000, description: "  dinner  ", transactionDate: "2026-11-05T06:30:00Z" });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.data.amountPaise, 35000);
  assert.equal(ok.body.data.description, "dinner");
  assert.equal(ok.body.data.category, "Food", "untouched fields are kept");
  assert.equal(new Date(ok.body.data.transactionDate).toISOString(), "2026-11-05T06:30:00.000Z");
  // Daily limit rechecked for both the old day (2 Nov) and the new day (5 Nov), IST midnights
  assert.deepEqual(dayChecks.filter((d) => d.endsWith("18:30:00.000Z")).sort(), ["2026-11-01T18:30:00.000Z", "2026-11-04T18:30:00.000Z"]);
});
