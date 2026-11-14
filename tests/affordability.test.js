// "Can I afford this?" preview: wording and the purchasePaise API parameter.
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
const { calculateRunway } = await import(R + "src/utils/runway.js");
const { describePurchase } = await import(R + "client/src/utils/runwayFormat.js");

// Same situation as the user's dashboard on 12 Nov: ₹4,850 balance,
// ₹2,000 goal, allowance on the 4th, ~₹170/day.
const today = { year: 2026, month: 11, day: 12 };
const key = (back) => new Date(Date.UTC(2026, 10, 12 - back)).toISOString().slice(0, 10);
const daily = Array.from({ length: 10 }, (_, i) => ({ date: key(i + 1), totalPaise: 17050 }));
const runwayAt = (balancePaise, goal = 200000) =>
  calculateRunway({ balancePaise, dailyExpenses: daily, firstExpenseDate: key(10), today, allowanceDay: 4, savingsGoalPaise: goal });

test("matches the live dashboard before any purchase", () => {
  const r = runwayAt(485000);
  assert.equal(r.runOutDate, "2026-11-28"); assert.equal(r.daysShort, 6); assert.equal(r.safeDailyPaise, 12954);
});

test("purchase that fits within spendable money", () => {
  const before = runwayAt(485000);
  const after = runwayAt(485000 - 120000);
  const d = describePurchase(before, after, 120000);
  assert.equal(d.tone, "warn");
  assert.deepEqual(d.lines, [
    "After this, your money lasts until 21 Nov instead of 28 Nov.",
    "Your daily budget drops from ₹129 to ₹75.",
    "You'd be 13 days short of your next allowance instead of 6.",
  ]);
});

test("purchase that eats into the savings goal", () => {
  const before = runwayAt(485000);
  const after = runwayAt(485000 - 350000);
  const d = describePurchase(before, after, 350000);
  assert.equal(d.tone, "warn");
  assert.deepEqual(d.lines, [
    "This would use ₹650 of the money set aside for your ₹2,000 savings goal.",
    "You could still save ₹1,350 this month if you spend nothing else.",
  ]);
});

test("purchase bigger than the balance", () => {
  const d = describePurchase(runwayAt(485000), runwayAt(485000 - 600000), 600000);
  assert.equal(d.tone, "no");
  assert.deepEqual(d.lines, ["You don't have enough recorded money for ₹6,000. You're ₹1,150 short."]);
});

test("still on track after a small purchase", () => {
  const before = runwayAt(1500000, 0);
  const after = runwayAt(1500000 - 50000, 0);
  const d = describePurchase(before, after, 50000);
  assert.equal(d.tone, "ok");
  assert.equal(d.lines.at(-1), "You'd still make it to your next allowance.");
});

// API: real Express app, models stubbed, no database.
test("API validates purchasePaise and subtracts it from the balance", async (t) => {
  process.env.ACCESS_TOKEN_SECRET = "test-secret";
  process.env.MONGO_URI = "mongodb://stub.invalid/test";
  mongoose.connect = async () => mongoose;
  const { User } = await import(R + "src/models/user.models.js");
  const { Transaction } = await import(R + "src/models/transaction.model.js");
  const userId = new mongoose.Types.ObjectId();
  const chain = (v) => ({ select() { return this; }, sort() { return this; }, lean: async () => v, then: (res) => res(v) });
  User.findById = () => chain({ _id: userId, openingBalancePaise: 0, timezone: "Asia/Kolkata", preferences: { allowanceDay: 4, monthlySavingsGoalPaise: 200000 } });
  Transaction.aggregate = async (p) => p[0].$match.type === "expense"
    ? Array.from({ length: 10 }, (_, i) => ({ _id: new Date(Date.now() + 5.5 * 36e5 - (i + 1) * 864e5).toISOString().slice(0, 10), totalPaise: 17050 }))
    : [{ _id: "income", total: 1000000 }, { _id: "expense", total: 515000 }];
  Transaction.findOne = () => chain({ transactionDate: new Date(Date.now() - 10 * 864e5) });
  Transaction.exists = async () => null;
  const { FixedCost } = await import(R + "src/models/fixedCost.model.js");
  FixedCost.find = () => ({ select() { return this; }, lean: async () => [] });

  const { default: app } = await import(R + "src/app.js");
  const server = app.listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/v1/dashboard/runway`;
  const token = jwt.sign({ _id: userId.toString() }, "test-secret");
  const get = async (qs) => {
    const res = await fetch(base + qs, { headers: { Authorization: `Bearer ${token}` } });
    return { status: res.status, body: await res.json() };
  };

  const plain = await get("");
  assert.equal(plain.status, 200); assert.equal(plain.body.data.balancePaise, 485000);
  const preview = await get("?purchasePaise=120000");
  assert.equal(preview.status, 200); assert.equal(preview.body.data.balancePaise, 365000);
  for (const bad of ["0", "-5", "12.5", "abc", "1000000001"]) {
    const r = await get(`?purchasePaise=${bad}`);
    assert.equal(r.status, 400, `expected 400 for ${bad}`);
  }
  server.close();
});
