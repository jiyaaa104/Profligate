// Dashboard charts: data shaping, summaries, and GET /api/v1/dashboard/charts.
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
const { buildChartSeries } = await import(R + "src/utils/charts.js");
const { summarizeDaily, rankCategories, summarizeMonthly, formatShortDate, formatMonth } = await import(R + "client/src/utils/chartData.js");

const today = { year: 2026, month: 1, day: 3 }; // crosses a year boundary on purpose

test("series fill gaps with zeros and cross month/year boundaries", () => {
  const s = buildChartSeries({
    today,
    dailyRows: [{ _id: "2025-12-31", totalPaise: 50000 }, { _id: "2026-01-03", totalPaise: 1000 }],
    monthlyRows: [{ _id: { period: "2025-12", type: "expense" }, totalPaise: 900000 }, { _id: { period: "2026-01", type: "income" }, totalPaise: 1000000 }],
    categoryRows: [{ _id: "food", label: "Food", totalPaise: 300 }, { _id: "rent", label: "Accommodation", totalPaise: 4000 }],
  });
  assert.equal(s.daily.length, 30);
  assert.equal(s.daily[0].date, "2025-12-05"); assert.equal(s.daily.at(-1).date, "2026-01-03");
  assert.equal(s.daily.find((d) => d.date === "2025-12-31").totalPaise, 50000);
  assert.equal(s.daily.find((d) => d.date === "2025-12-20").totalPaise, 0);
  assert.deepEqual(s.monthly.map((m) => m.period), ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"]);
  assert.deepEqual(s.monthly.at(-2), { period: "2025-12", incomePaise: 0, expensePaise: 900000 });
  assert.deepEqual(s.categories.map((c) => c.category), ["Accommodation", "Food"]);
});

test("daily summary skips today for the peak", () => {
  const daily = Array.from({ length: 30 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, "0")}`, totalPaise: i === 2 ? 120000 : i === 29 ? 999999 : 10000 }));
  const s = summarizeDaily(daily, "2026-11-30");
  assert.match(s.summary, /^₹[\d,]+ spent in the last 30 days, about ₹[\d,]+ a day\. Highest: ₹1,200 on 3 Nov\.$/);
  assert.equal(summarizeDaily(daily.map((d) => ({ ...d, totalPaise: 0 })), "2026-11-30").summary, null);
});

test("categories: ranked, shares, and folding past 6", () => {
  const cats = ["A", "B", "C", "D", "E", "F", "G", "H"].map((c, i) => ({ category: c, totalPaise: (8 - i) * 10000 }));
  const r = rankCategories(cats);
  assert.equal(r.rows.length, 6);
  assert.deepEqual(r.rows.at(-1), { category: "Other", totalPaise: 60000, share: 17 });
  assert.equal(r.rows[0].share, 22);
  assert.equal(r.summary, "A is your biggest category this month: ₹800, 22% of ₹3,600.");
  assert.equal(r.rows.reduce((s, x) => s + x.totalPaise, 0), 360000, "Other keeps the total intact");
});

test("monthly summary and labels", () => {
  const s = summarizeMonthly([{ period: "2026-10", incomePaise: 0, expensePaise: 0 }, { period: "2026-11", incomePaise: 1000000, expensePaise: 515000 }]);
  assert.equal(s.summary, "Nov 2026 so far: ₹10,000 in, ₹5,150 out (net +₹4,850).");
  assert.equal(summarizeMonthly([{ period: "2026-11", incomePaise: 0, expensePaise: 0 }]).empty, true);
  assert.equal(formatShortDate("2026-11-03"), "3 Nov"); assert.equal(formatMonth("2026-11", true), "Nov 2026");
});

test("API: /dashboard/charts uses the user's timezone", async (t) => {
  process.env.ACCESS_TOKEN_SECRET = "test-secret";
  process.env.MONGO_URI = "mongodb://stub.invalid/test";
  mongoose.connect = async () => mongoose;
  const { User } = await import(R + "src/models/user.models.js");
  const { Transaction } = await import(R + "src/models/transaction.model.js");
  const userId = new mongoose.Types.ObjectId();
  const chain = (v) => ({ select() { return this; }, lean: async () => v, then: (res, rej) => Promise.resolve(v).then(res, rej) });
  User.findById = () => chain({ _id: userId, timezone: "Asia/Kolkata" });
  const pipelines = [];
  Transaction.aggregate = async (p) => { pipelines.push(p); return []; };

  const { default: app } = await import(R + "src/app.js");
  const server = app.listen(0);
  t.after(() => server.close());
  const token = jwt.sign({ _id: userId.toString() }, "test-secret");
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/dashboard/charts`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.equal(body.data.daily.length, 30); assert.equal(body.data.monthly.length, 6);
  assert.equal(pipelines.length, 3);
  for (const p of pipelines) {
    const range = p[0].$match.transactionDate;
    // Day boundaries are IST midnights (18:30 UTC the previous day)
    assert.equal(range.$gte.toISOString().slice(11, 16), "18:30");
  }
  assert.equal(pipelines[0][1].$group._id.$dateToString.timezone, "Asia/Kolkata");
  const unauth = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/dashboard/charts`);
  assert.equal(unauth.status, 401);
});
