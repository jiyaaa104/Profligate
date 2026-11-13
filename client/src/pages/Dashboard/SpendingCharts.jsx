import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  LabelList,
  Cell,
} from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import api from "../../services/api";
import { formatRupees } from "../../utils/runwayFormat";
import {
  summarizeDaily,
  rankCategories,
  summarizeMonthly,
  formatShortDate,
  formatMonth,
} from "../../utils/chartData";

// Validated for the dark card surface (#0d121b) with the dataviz palette
// checks: both pass the lightness band, chroma floor, 3:1 contrast and
// colour-blind separation (ΔE 10.2 for the pair).
const COLORS = {
  spend: "#059669", // brand emerald (darker step; #10b981 is too light here)
  spendHover: "#10b981",
  income: "#059669",
  expense: "#d95926",
  grid: "rgba(255,255,255,0.06)",
  axis: "rgba(255,255,255,0.14)",
  tick: "#94a3b8",
  reference: "#cbd5e1",
};

const TICK = { fill: COLORS.tick, fontSize: 11 };

// Axis ticks: ₹0 / ₹500 / ₹1K / ₹10.5K (never rounded to a different value)
const formatAxisRupees = (rupees) =>
  rupees >= 1000 ? `₹${Number((rupees / 1000).toFixed(1))}K` : `₹${rupees}`;

const fetchCharts = async () => (await api.get("/dashboard/charts")).data?.data;
const fetchRunway = async () => (await api.get("/dashboard/runway")).data?.data;

/** Tooltip: the value leads, the label follows. */
function ChartTooltip({ active, payload, label, labelFormatter, rows }) {
  if (!active || !payload?.length) return null;
  const items = rows ? rows(payload[0].payload) : payload.map((p) => ({ name: p.name, value: p.value, color: p.color }));
  return (
    <div className="rounded-lg border border-white/10 bg-navy-900/95 px-3 py-2 text-xs shadow-glass-sm">
      <p className="text-slate-400 mb-1">{labelFormatter ? labelFormatter(label, payload[0].payload) : label}</p>
      {items.map((item) => (
        <p key={item.name} className="flex items-center gap-2">
          {item.color && <span className="inline-block w-3 h-0.5 rounded" style={{ background: item.color }} />}
          <span className="font-semibold text-white">{item.value}</span>
          <span className="text-slate-400">{item.name}</span>
        </p>
      ))}
    </div>
  );
}

/** Card with a title, a one-line summary, and a chart/table toggle. */
function ChartCard({ title, summary, table, children, className = "", isFetching }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`glass-panel rounded-2xl border border-white/5 p-5 sm:p-6 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-base font-bold text-white">{title}</h3>
        {table && (
          <button
            onClick={() => setShowTable((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 shrink-0"
            aria-pressed={showTable}
          >
            {showTable ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
            {showTable ? "View as chart" : "View as table"}
          </button>
        )}
      </div>
      {summary && <p className="text-sm text-slate-300 mb-4">{summary}</p>}
      <div className={`transition-opacity ${isFetching ? "opacity-60" : ""}`}>
        {showTable ? table : children}
      </div>
    </section>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border border-white/5">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-navy-900 text-xs uppercase tracking-wider text-slate-400">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2 font-semibold ${c.numeric ? "text-right" : "text-left"}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-1.5 ${c.numeric ? "text-right tabular-nums text-slate-100" : "text-slate-300"}`}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const EmptyChart = ({ children }) => (
  <p className="text-sm text-slate-400 py-10 text-center">{children}</p>
);

// ── 1. Daily spending, last 30 days ──────────────────────────────────
function DailySpendingChart({ charts, runway, isFetching }) {
  const s = summarizeDaily(charts.daily, charts.today);

  // Reference line from the Money Runway: the safe daily amount when an
  // allowance day is set, otherwise the typical daily pace.
  let reference = null;
  if (runway?.status === "ready") {
    if (runway.safeDailyPaise >= 100) {
      reference = { rupees: Math.floor(runway.safeDailyPaise / 100), label: `Safe daily budget ${formatRupees(runway.safeDailyPaise)}` };
    } else if (!runway.nextAllowanceDate) {
      reference = { rupees: Math.round(runway.dailyPacePaise / 100), label: `Typical day ${formatRupees(runway.dailyPacePaise)}` };
    }
  }

  const data = charts.daily.map((d) => ({ ...d, rupees: d.totalPaise / 100 }));

  return (
    <ChartCard
      title="Daily spending · last 30 days"
      summary={s.summary}
      isFetching={isFetching}
      className="lg:col-span-2"
      table={
        <DataTable
          columns={[
            { key: "date", label: "Date", render: (r) => formatShortDate(r.date) + (r.date === charts.today ? " (today so far)" : "") },
            { key: "amount", label: "Spent", numeric: true, render: (r) => formatRupees(r.totalPaise) },
          ]}
          rows={[...charts.daily].reverse()}
        />
      }
    >
      {s.total === 0 ? (
        <EmptyChart>No spending recorded in the last 30 days.</EmptyChart>
      ) : (
        <>
        {/* Key for the reference line, kept off the plot so it never covers bars. */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 mb-2">
          {reference && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-px" style={{ background: COLORS.reference }} />
              {reference.label}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm opacity-50" style={{ background: COLORS.spend }} />
            Today so far
          </span>
        </div>
        <div className="h-64" role="img" aria-label={`Bar chart of daily spending. ${s.summary}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barCategoryGap="18%">
              <CartesianGrid vertical={false} stroke={COLORS.grid} />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={TICK}
                tickLine={false}
                axisLine={{ stroke: COLORS.axis }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tickFormatter={formatAxisRupees}
                tick={TICK}
                tickLine={false}
                axisLine={false}
                width={52}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={
                  <ChartTooltip
                    labelFormatter={(date) => formatShortDate(date) + (date === charts.today ? " · today so far" : "")}
                    rows={(p) => [{ name: "spent", value: formatRupees(p.totalPaise) }]}
                  />
                }
              />
              {reference && (
                <ReferenceLine
                  y={reference.rupees}
                  stroke={COLORS.reference}
                  strokeWidth={1}
                  ifOverflow="extendDomain"
                />
              )}
              <Bar
                dataKey="rupees"
                name="spent"
                maxBarSize={24}
                radius={[4, 4, 0, 0]}
                activeBar={{ fill: COLORS.spendHover }}
              >
                {data.map((d) => (
                  // Today is still in progress, so it's drawn lighter.
                  <Cell key={d.date} fill={COLORS.spend} fillOpacity={d.date === charts.today ? 0.5 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        </>
      )}
    </ChartCard>
  );
}

// ── 2. Where your money went this month ──────────────────────────────
function CategoryChart({ charts, isFetching }) {
  const { rows, total, summary } = rankCategories(charts.categories);
  const data = rows.map((r) => ({ ...r, rupees: r.totalPaise / 100 }));
  const height = Math.max(120, data.length * 40 + 16);

  return (
    <ChartCard
      title="Where your money went · this month"
      summary={summary}
      isFetching={isFetching}
      table={
        <DataTable
          columns={[
            { key: "c", label: "Category", render: (r) => r.category },
            { key: "a", label: "Spent", numeric: true, render: (r) => formatRupees(r.totalPaise) },
            { key: "s", label: "Share", numeric: true, render: (r) => `${r.share}%` },
          ]}
          rows={rows}
        />
      }
    >
      {total === 0 ? (
        <EmptyChart>No spending recorded this month yet.</EmptyChart>
      ) : (
        <div style={{ height }} role="img" aria-label={`Bar chart of spending by category. ${summary}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 96, left: 0, bottom: 0 }} barCategoryGap="28%">
              <XAxis type="number" hide domain={[0, "dataMax"]} />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ ...TICK, fill: "#cbd5e1", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={104}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={
                  <ChartTooltip
                    rows={(p) => [{ name: `${p.share}% of this month's spending`, value: formatRupees(p.totalPaise) }]}
                  />
                }
              />
              <Bar dataKey="rupees" name="spent" fill={COLORS.spend} maxBarSize={24} radius={[0, 4, 4, 0]} activeBar={{ fill: COLORS.spendHover }}>
                <LabelList
                  dataKey="totalPaise"
                  position="right"
                  formatter={(v) => formatRupees(v)}
                  style={{ fill: "#e2e8f0", fontSize: 12, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

// ── 3. Income vs expenses, last 6 months ─────────────────────────────
function MonthlyChart({ charts, isFetching }) {
  const s = summarizeMonthly(charts.monthly);
  const data = charts.monthly.map((m) => ({ ...m, income: m.incomePaise / 100, expenses: m.expensePaise / 100 }));

  return (
    <ChartCard
      title="Income vs expenses · last 6 months"
      summary={s.summary}
      isFetching={isFetching}
      table={
        <DataTable
          columns={[
            { key: "m", label: "Month", render: (r) => formatMonth(r.period, true) },
            { key: "i", label: "Income", numeric: true, render: (r) => formatRupees(r.incomePaise) },
            { key: "e", label: "Expenses", numeric: true, render: (r) => formatRupees(r.expensePaise) },
            { key: "n", label: "Net", numeric: true, render: (r) => `${r.incomePaise >= r.expensePaise ? "+" : "−"}${formatRupees(Math.abs(r.incomePaise - r.expensePaise))}` },
          ]}
          rows={[...charts.monthly].reverse()}
        />
      }
    >
      {s.empty ? (
        <EmptyChart>No income or expenses in the last 6 months.</EmptyChart>
      ) : (
        <>
          {/* Legend: swatches mirror the bars; the text stays in text colours. */}
          <div className="flex items-center gap-4 text-xs text-slate-300 mb-2" aria-hidden="true">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.income }} />Income</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.expense }} />Expenses</span>
          </div>
          <div className="h-56" role="img" aria-label={`Bar chart of monthly income and expenses. ${s.summary}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="24%">
                <CartesianGrid vertical={false} stroke={COLORS.grid} />
                <XAxis dataKey="period" tickFormatter={(p) => formatMonth(p)} tick={TICK} tickLine={false} axisLine={{ stroke: COLORS.axis }} />
                <YAxis tickFormatter={formatAxisRupees} tick={TICK} tickLine={false} axisLine={false} width={52} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  content={
                    <ChartTooltip
                      labelFormatter={(p) => formatMonth(p, true)}
                      rows={(p) => [
                        { name: "income", value: formatRupees(p.incomePaise), color: COLORS.income },
                        { name: "expenses", value: formatRupees(p.expensePaise), color: COLORS.expense },
                        { name: "net", value: `${p.incomePaise >= p.expensePaise ? "+" : "−"}${formatRupees(Math.abs(p.incomePaise - p.expensePaise))}` },
                      ]}
                    />
                  }
                />
                <Bar dataKey="income" name="Income" fill={COLORS.income} maxBarSize={24} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill={COLORS.expense} maxBarSize={24} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </ChartCard>
  );
}

export default function SpendingCharts() {
  // Nested under "dashboard-summary" so adding/editing transactions refreshes them.
  const charts = useQuery({ queryKey: ["dashboard-summary", "charts"], queryFn: fetchCharts });
  const runway = useQuery({ queryKey: ["dashboard-summary", "runway"], queryFn: fetchRunway });

  if (charts.isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="lg:col-span-2 h-80 glass-panel rounded-2xl animate-pulse" />
        <div className="h-64 glass-panel rounded-2xl animate-pulse" />
        <div className="h-64 glass-panel rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (charts.isError || !charts.data) {
    return (
      <div className="glass-panel rounded-2xl border border-white/5 p-5 text-sm text-slate-400">
        Couldn't load your charts.{" "}
        <button onClick={() => charts.refetch()} className="font-semibold underline hover:text-white">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <DailySpendingChart charts={charts.data} runway={runway.data} isFetching={charts.isFetching} />
      <CategoryChart charts={charts.data} isFetching={charts.isFetching} />
      <MonthlyChart charts={charts.data} isFetching={charts.isFetching} />
    </div>
  );
}
