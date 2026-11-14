// Monthly bills: due dates, setting bills aside in the runway, and the bills API.
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
const { calculateRunway, getBillsDue, getNextUnpaidOccurrence, buildRunwayMessage } = await import(R + "src/utils/runway.js");
const { describePurchase } = await import(R + "client/src/utils/runwayFormat.js");

const today = { year: 2026, month: 11, day: 12 };
const dayNum = (key) => Date.parse(key) / 864e5;
const bill = (o) => ({ id: o.name, amountPaise: 10000, category: "Other", lastPaidPeriod: null, createdDate: "2026-10-01", ...o });

const rent = bill({ name: "Rent", amountPaise: 400000, dueDay: 1, lastPaidPeriod: "2026-11" });
const netflix = bill({ name: "Netflix", amountPaise: 19900, dueDay: 15 });
const phone = bill({ name: "Phone", amountPaise: 30000, dueDay: 5, lastPaidPeriod: "2026-10" });

test("bills due before the next allowance (4 Dec)", () => {
  const due = getBillsDue([rent, netflix, phone], today, dayNum("2026-12-04"));
  assert.deepEqual(due.map((b) => [b.name, b.dueDate, b.overdue]), [
    ["Phone", "2026-11-05", true],
    ["Netflix", "2026-11-15", false],
    ["Rent", "2026-12-01", false],
  ]);
});

test("a bill added today doesn't count this month's past due date", () => {
  const fresh = bill({ name: "Gym", dueDay: 1, createdDate: "2026-11-12" });
  assert.deepEqual(getBillsDue([fresh], today, dayNum("2026-12-04")).map((b) => b.dueDate), ["2026-12-01"]);
  assert.equal(getNextUnpaidOccurrence(fresh, today).dueDate, "2026-12-01");
});

test("31st falls on the last day of short months; paid-ahead bills skip to the next month", () => {
  assert.equal(getBillsDue([bill({ name: "Wifi", dueDay: 31 })], today, dayNum("2026-12-04"))[0].dueDate, "2026-11-30");
  assert.deepEqual(getNextUnpaidOccurrence({ ...rent, lastPaidPeriod: "2026-12" }, today), { dueDate: "2027-01-01", period: "2027-01", overdue: false });
  assert.deepEqual(getNextUnpaidOccurrence(phone, today), { dueDate: "2026-11-05", period: "2026-11", overdue: true });
});

const key = (back) => new Date(Date.UTC(2026, 10, 12 - back)).toISOString().slice(0, 10);
const daily = Array.from({ length: 10 }, (_, i) => ({ date: key(i + 1), totalPaise: 17050 }));
const runway = (balancePaise, bills, goal = 200000, allowanceDay = 4) =>
  calculateRunway({ balancePaise, dailyExpenses: daily, firstExpenseDate: key(10), today, allowanceDay, savingsGoalPaise: goal, bills });

test("bills are set aside before the savings goal", () => {
  const r = runway(985000, [rent, netflix, phone]);
  assert.equal(r.billsDuePaise, 449900); assert.equal(r.billsReservedPaise, 449900); assert.equal(r.billsCovered, true);
  assert.equal(r.reservedPaise, 200000); assert.equal(r.spendablePaise, 985000 - 449900 - 200000);
  assert.equal(r.upcomingBills.length, 3);
  assert.match(buildRunwayMessage(r), /while keeping ₹4,499 aside for bills and ₹2,000 for savings/);
});

test("balance that doesn't cover the bills", () => {
  const r = runway(300000, [rent, netflix, phone]);
  assert.equal(r.billsCovered, false); assert.equal(r.billsReservedPaise, 300000); assert.equal(r.reservedPaise, 0); assert.equal(r.spendablePaise, 0);
  assert.equal(buildRunwayMessage(r), "Your balance of ₹3,000 doesn't cover the ₹4,499 in bills due before your next allowance. You're ₹1,499 short.");
});

test("no allowance day: bills in the next 30 days", () => {
  const r = runway(985000, [rent, netflix, phone], 0, null);
  assert.deepEqual(r.upcomingBills.map((b) => [b.name, b.dueDate]), [["Phone", "2026-11-05"], ["Netflix", "2026-11-15"], ["Rent", "2026-12-01"], ["Phone", "2026-12-05"]]);
});

test("no bills keeps the old forecast", () => {
  const r = runway(485000, []);
  assert.equal(r.billsDuePaise, 0); assert.equal(r.runOutDate, "2026-11-28"); assert.equal(r.safeDailyPaise, 12954);
});

test("affordability preview warns when a purchase leaves bills unpaid", () => {
  const before = runway(985000, [rent, netflix, phone]);
  const after = runway(985000 - 700000, [rent, netflix, phone]);
  const d = describePurchase(before, after, 700000);
  assert.equal(d.tone, "warn");
  assert.deepEqual(d.lines, ["This would leave you ₹1,649 short for the ₹4,499 in bills due before your next allowance."]);
});

// ── API with stubbed models ─────────────────────────────────────────
test("API: validation, mark paid, undo by deleting the expense, pace excludes bills", async (t) => {
  process.env.ACCESS_TOKEN_SECRET = "test-secret";
  process.env.MONGO_URI = "mongodb://stub.invalid/test";
  mongoose.connect = async () => mongoose;
  const { User } = await import(R + "src/models/user.models.js");
  const { Transaction } = await import(R + "src/models/transaction.model.js");
  const { FixedCost } = await import(R + "src/models/fixedCost.model.js");

  const userId = new mongoose.Types.ObjectId();
  const billId = new mongoose.Types.ObjectId();
  const chain = (v) => ({ select() { return this; }, sort() { return this; }, lean: async () => v, then: (res, rej) => Promise.resolve(v).then(res, rej) });
  const store = { bill: { _id: billId, userId, name: "Rent", amountPaise: 400000, dueDay: 1, category: "Accommodation", lastPaidPeriod: "2026-10", previousPaidPeriod: null, lastPaidTransactionId: null, createdAt: new Date("2026-10-01") }, txs: [], aggs: [] };

  User.findById = () => chain({ _id: userId, timezone: "Asia/Kolkata", openingBalancePaise: 0, preferences: { alertEnabled: false } });
  FixedCost.countDocuments = async () => 0;
  FixedCost.create = async (doc) => ({ ...doc, _id: new mongoose.Types.ObjectId(), createdAt: new Date(), toObject() { return this; } });
  FixedCost.findOne = (q) => {
    if (q.lastPaidTransactionId && String(q.lastPaidTransactionId) !== String(store.bill.lastPaidTransactionId)) return chain(null);
    const doc = { ...store.bill, save: async function () { Object.assign(store.bill, this); delete store.bill.save; } };
    return chain(doc);
  };
  FixedCost.findOneAndUpdate = (q, u) => {
    if ("lastPaidPeriod" in q && q.lastPaidPeriod !== store.bill.lastPaidPeriod) return chain(null);
    Object.assign(store.bill, u.$set);
    return chain({ ...store.bill });
  };
  Transaction.create = async (doc) => { const tx = { ...doc, _id: new mongoose.Types.ObjectId(), transactionDate: new Date() }; store.txs.push(tx); return tx; };
  Transaction.findOneAndDelete = async ({ _id }) => store.txs.find((tx) => String(tx._id) === String(_id)) ?? null;
  Transaction.deleteOne = async () => ({});
  Transaction.aggregate = async (p) => { store.aggs.push(p); return []; };
  Transaction.exists = async () => null;
  const { Notification } = await import(R + "src/models/notification.model.js");
  Notification.deleteOne = async () => ({});
  FixedCost.find = () => chain([]);
  Transaction.findOne = () => chain(null);

  const { default: app } = await import(R + "src/app.js");
  const server = app.listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const token = jwt.sign({ _id: userId.toString() }, "test-secret");
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };

  for (const bad of [{}, { name: "Rent", amountPaise: 0, dueDay: 1 }, { name: "Rent", amountPaise: 100, dueDay: 32 }, { name: "Rent", amountPaise: 1.5, dueDay: 1 }, { name: " ", amountPaise: 100, dueDay: 1 }]) {
    assert.equal((await call("POST", "/fixed-costs", bad)).status, 400, JSON.stringify(bad));
  }
  const created = await call("POST", "/fixed-costs", { name: "Netflix", amountPaise: 19900, dueDay: 15, category: "Subscriptions" });
  assert.equal(created.status, 201); assert.ok(created.body.data.nextDue);

  // Rent paid through October, so marking it paid pays November (overdue since 1 Nov).
  const paid = await call("POST", `/fixed-costs/${billId}/pay`, {});
  assert.equal(paid.status, 201, JSON.stringify(paid.body));
  assert.equal(store.txs.length, 1);
  assert.equal(store.txs[0].fixedCostId.toString(), billId.toString());
  assert.equal(store.txs[0].amountPaise, 400000); assert.equal(store.txs[0].category, "Accommodation");
  const nowIst = new Date(Date.now() + 5.5 * 36e5);
  const thisPeriod = nowIst.toISOString().slice(0, 7);
  assert.equal(store.bill.lastPaidPeriod, thisPeriod >= "2026-11" ? "2026-11" : thisPeriod);
  assert.equal(store.bill.previousPaidPeriod, "2026-10");

  assert.equal((await call("POST", `/fixed-costs/${billId}/pay`, { paymentMethod: "bitcoin" })).status, 400);

  const del = await call("DELETE", `/transactions/${store.txs[0]._id}`);
  assert.equal(del.status, 200);
  assert.equal(store.bill.lastPaidPeriod, "2026-10"); assert.equal(store.bill.lastPaidTransactionId, null);

  await call("GET", "/dashboard/runway");
  const paceMatch = store.aggs.find((p) => p[0].$match.type === "expense")[0].$match;
  assert.deepEqual(paceMatch.fixedCostId, { $exists: false });
});
