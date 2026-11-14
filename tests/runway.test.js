// Money Runway forecast: pace, allowance dates, savings goal, alerts and data loading.
// These tests never touch a real database: Mongoose model methods are
// replaced with in-memory stubs.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
// Freeze "now" so results that depend on today's date are the same every run.
mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-12T06:30:00Z") });
const require = createRequire(import.meta.url);
const mongoose = require("mongoose");
const R = new URL("../src/", import.meta.url).href;
const { calculateRunway, getRunwayForUser, checkRunwayAlert, buildRunwayMessage } = await import(R + "utils/runway.js");
const { User } = await import(R + "models/user.models.js");
const { Transaction } = await import(R + "models/transaction.model.js");
const { Notification } = await import(R + "models/notification.model.js");
const { FixedCost } = await import(R + "models/fixedCost.model.js");
FixedCost.find = () => ({ select() { return this; }, lean: async () => [] });

const today = { year: 2026, month: 11, day: 14 };
const key = (back, t = today) => new Date(Date.UTC(t.year, t.month - 1, t.day - back)).toISOString().slice(0, 10);
const days = (amts, t = today) => amts.map((a, i) => ({ date: key(i + 1, t), totalPaise: a }));
const flat14 = days(Array(14).fill(30000));
const base = { balancePaise: 240000, dailyExpenses: flat14, firstExpenseDate: key(30), today };

test("insufficient data", () => {
  assert.equal(calculateRunway({ ...base, firstExpenseDate: null, dailyExpenses: [] }).status, "insufficient_data");
  assert.equal(calculateRunway({ ...base, firstExpenseDate: key(6) }).status, "insufficient_data");
  assert.equal(calculateRunway({ ...base, dailyExpenses: days([100, 200]) }).status, "insufficient_data");
});
test("run-out date without allowance", () => {
  const r = calculateRunway(base);
  assert.equal(r.dailyPacePaise, 30000); assert.equal(r.daysLeft, 8); assert.equal(r.runOutDate, "2026-11-22");
  assert.equal(r.willRunShort, false); assert.equal(r.safeDailyPaise, null); assert.equal(r.nextAllowanceDate, null);
});
test("short of allowance", () => {
  const r = calculateRunway({ ...base, allowanceDay: 1 });
  assert.equal(r.nextAllowanceDate, "2026-12-01"); assert.equal(r.daysUntilAllowance, 17);
  assert.equal(r.willRunShort, true); assert.equal(r.daysShort, 9); assert.equal(r.safeDailyPaise, Math.floor(240000 / 17));
  assert.equal(buildRunwayMessage(r), "At this pace your money lasts until 22 Nov, 9 days short of your next allowance. Keep spending under ₹141 a day to make it.");
});
test("on track", () => {
  const r = calculateRunway({ ...base, balancePaise: 900000, allowanceDay: 1 });
  assert.equal(r.willRunShort, false); assert.equal(r.daysShort, 0); assert.equal(r.daysLeft, 30);
});
test("one-off fee barely moves the pace", () => {
  const r = calculateRunway({ ...base, dailyExpenses: days([800000, ...Array(13).fill(30000)]) });
  assert.equal(r.dailyPacePaise, Math.round((13 * 30000 + 90000) / 14));
});
test("zero-spend days lower the pace", () => {
  const r = calculateRunway({ ...base, dailyExpenses: days([30000, 0, 30000, 0, 30000, 0, 30000]) });
  assert.equal(r.dailyPacePaise, Math.round(120000 / 14));
});
test("short history uses its own window, ignores today and older", () => {
  const r = calculateRunway({ ...base, firstExpenseDate: key(8), dailyExpenses: [...days(Array(8).fill(10000)), { date: key(0), totalPaise: 999999 }, { date: key(20), totalPaise: 999999 }] });
  assert.equal(r.windowDays, 8); assert.equal(r.dailyPacePaise, 10000);
});
test("allowance date edges", () => {
  const nov = calculateRunway({ ...base, allowanceDay: 31 });
  assert.equal(nov.nextAllowanceDate, "2026-11-30");
  const t = { year: 2028, month: 1, day: 31 };
  const leap = calculateRunway({ ...base, today: t, dailyExpenses: days(Array(14).fill(30000), t), firstExpenseDate: key(30, t), allowanceDay: 31, incomeToday: true });
  assert.equal(leap.nextAllowanceDate, "2028-02-29");
  const d = { year: 2026, month: 12, day: 20 };
  assert.equal(calculateRunway({ ...base, today: d, dailyExpenses: days(Array(14).fill(30000), d), firstExpenseDate: key(30, d), allowanceDay: 5 }).nextAllowanceDate, "2027-01-05");
});
test("allowance due today", () => {
  const due = calculateRunway({ ...base, balancePaise: 0, allowanceDay: 14 });
  assert.equal(due.daysUntilAllowance, 0); assert.equal(due.willRunShort, false); assert.equal(due.safeDailyPaise, null);
  const got = calculateRunway({ ...base, allowanceDay: 14, incomeToday: true });
  assert.equal(got.nextAllowanceDate, "2026-12-14");
});
test("negative balance", () => {
  const r = calculateRunway({ ...base, balancePaise: -5000, allowanceDay: 1 });
  assert.equal(r.daysLeft, 0); assert.equal(r.willRunShort, true); assert.equal(r.safeDailyPaise, 0);
  assert.equal(buildRunwayMessage(r), "Your recorded balance has run out, 17 days before your next allowance.");
});

// DB wiring with stubbed models: never connects to a database.
const chain = (v) => ({ select() { return this; }, sort() { return this; }, lean: async () => v });
function stub(obj, name, fn) { const o = obj[name]; obj[name] = fn; return () => { obj[name] = o; }; }
const uid = new mongoose.Types.ObjectId().toString();
const istToday = () => new Date(Date.now() + 5.5 * 36e5);
function stubDb(pref = { allowanceDay: 1, alertEnabled: true }, recent = null) {
  const calls = { created: [], agg: [] };
  const undo = [
    stub(User, "findById", () => chain({ openingBalancePaise: 100000, timezone: "Asia/Kolkata", preferences: pref })),
    stub(Transaction, "aggregate", async (p) => {
      calls.agg.push(p);
      if (p[0].$match.type === "expense") {
        const out = [];
        for (let i = 1; i <= 14; i++) out.push({ _id: new Date(istToday().getTime() - i * 864e5).toISOString().slice(0, 10), totalPaise: 30000 });
        return out;
      }
      return [{ _id: "income", total: 500000 }, { _id: "expense", total: 420000 }];
    }),
    stub(Transaction, "findOne", () => chain({ transactionDate: new Date(Date.now() - 30 * 864e5) })),
    stub(Transaction, "exists", async () => null),
    stub(Notification, "exists", async () => recent),
    stub(Notification, "create", async (d) => { calls.created.push(d); }),
  ];
  return { calls, restore: () => undo.forEach((u) => u()) };
}
test("getRunwayForUser wires balance and IST day boundaries", async () => {
  const { calls, restore } = stubDb();
  const r = await getRunwayForUser(uid); restore();
  assert.equal(r.status, "ready"); assert.equal(r.balancePaise, 180000); assert.equal(r.dailyPacePaise, 30000); assert.equal(r.daysLeft, 6);
  const range = calls.agg.find((p) => p[0].$match.type === "expense")[0].$match.transactionDate;
  assert.equal(range.$lt.getTime() - range.$gte.getTime(), 14 * 864e5);
  assert.equal(new Date(range.$lt.getTime() + 5.5 * 36e5).toISOString().slice(11, 19), "00:00:00");
});
test("alert sends when short and passes the schema", async () => {
  const { calls, restore } = stubDb(); await checkRunwayAlert(uid); restore();
  const n = istToday();
  const until = (Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1) - Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())) / 864e5;
  assert.ok(until > 6, "test assumes a date early enough in the month");
  assert.equal(calls.created.length, 1);
  assert.equal(calls.created[0].type, "runway_alert");
  assert.equal(new Notification({ ...calls.created[0] }).validateSync(), undefined);
});
test("alert respects cooldown, opt-out, and needs allowance", async () => {
  for (const [p, rec] of [[{ allowanceDay: 1, alertEnabled: true }, { _id: 1 }], [{ allowanceDay: 1, alertEnabled: false }, null], [{ allowanceDay: null, alertEnabled: true }, null]]) {
    const { calls, restore } = stubDb(p, rec); await checkRunwayAlert(uid); restore();
    assert.equal(calls.created.length, 0);
  }
});
test("user schema validates allowanceDay", () => {
  const f = (d) => new User({ name: "a", email: "a@b.co", password: "x", preferences: { allowanceDay: d } }).validateSync()?.errors?.["preferences.allowanceDay"];
  assert.ok(f(0)); assert.ok(f(32)); assert.ok(f(1.5)); assert.equal(f(31), undefined); assert.equal(f(null), undefined);
});

test("savings goal is set aside before forecasting", () => {
  const r = calculateRunway({ ...base, balancePaise: 440000, allowanceDay: 1, savingsGoalPaise: 200000 });
  assert.equal(r.spendablePaise, 240000); assert.equal(r.reservedPaise, 200000); assert.equal(r.goalFits, true);
  assert.equal(r.daysLeft, 8); assert.equal(r.runOutDate, "2026-11-22");
  assert.equal(r.daysLeftWithoutSavings, 14); assert.equal(r.runOutDateWithoutSavings, "2026-11-28");
  assert.equal(r.willRunShort, true); assert.equal(r.daysShort, 9); assert.equal(r.safeDailyPaise, Math.floor(240000 / 17));
  assert.equal(buildRunwayMessage(r), "At this pace your money lasts until 22 Nov while keeping ₹2,000 aside for savings, 9 days short of your next allowance. Keep spending under ₹141 a day to make it.");
});
test("goal bigger than balance", () => {
  const r = calculateRunway({ ...base, balancePaise: 150000, allowanceDay: 1, savingsGoalPaise: 200000 });
  assert.equal(r.reservedPaise, 150000); assert.equal(r.spendablePaise, 0); assert.equal(r.goalFits, false);
  assert.equal(r.daysLeft, 0); assert.equal(r.willRunShort, true); assert.equal(r.safeDailyPaise, 0);
  assert.equal(buildRunwayMessage(r), "Your balance of ₹1,500 doesn't cover your ₹2,000 savings goal, so anything you spend before your next allowance comes out of your savings.");
});
test("no goal leaves the forecast unchanged", () => {
  const r = calculateRunway({ ...base, allowanceDay: 1 });
  assert.equal(r.savingsGoalPaise, 0); assert.equal(r.runOutDateWithoutSavings, null); assert.equal(r.spendablePaise, 240000); assert.equal(r.daysLeft, 8);
});
test("profile schema validates the goal", () => {
  const f = (v) => new User({ name: "a", email: "a@b.co", password: "x", preferences: { monthlySavingsGoalPaise: v } }).validateSync()?.errors?.["preferences.monthlySavingsGoalPaise"];
  assert.ok(f(-1)); assert.ok(f(1.5)); assert.equal(f(0), undefined); assert.equal(f(200000), undefined);
});
