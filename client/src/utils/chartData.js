// Summaries and shaping for the dashboard charts. Pure functions, so the
// wording and maths can be tested without a browser.
import { formatRupees } from "./runwayFormat.js";

// "2026-11-03" -> "3 Nov"
export const formatShortDate = (dateKey) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short" }).format(
    new Date(`${dateKey}T00:00:00Z`),
  );

// "2026-11" -> "Nov", or "Nov 2026" with `withYear`
export const formatMonth = (period, withYear = false) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    month: "short",
    ...(withYear && { year: "numeric" }),
  }).format(new Date(`${period}-01T00:00:00Z`));

export const summarizeDaily = (daily, today) => {
  const total = daily.reduce((sum, d) => sum + d.totalPaise, 0);
  if (total === 0) return { total, summary: null };

  // The highest complete day; today is still in progress.
  const peak = daily
    .filter((d) => d.date !== today)
    .reduce((best, d) => (d.totalPaise > (best?.totalPaise ?? 0) ? d : best), null);
  const average = Math.round(total / daily.length);

  const parts = [`${formatRupees(total)} spent in the last ${daily.length} days, about ${formatRupees(average)} a day.`];
  if (peak) parts.push(`Highest: ${formatRupees(peak.totalPaise)} on ${formatShortDate(peak.date)}.`);
  return { total, summary: parts.join(" ") };
};

// Largest first; past 6 categories the rest fold into "Other".
export const MAX_CATEGORY_BARS = 6;

export const rankCategories = (categories) => {
  const total = categories.reduce((sum, c) => sum + c.totalPaise, 0);
  if (total === 0) return { rows: [], total, summary: null };

  const sorted = [...categories].sort((a, b) => b.totalPaise - a.totalPaise);
  let shown = sorted;
  if (sorted.length > MAX_CATEGORY_BARS) {
    const head = sorted.slice(0, MAX_CATEGORY_BARS - 1);
    const otherPaise = sorted.slice(MAX_CATEGORY_BARS - 1).reduce((sum, c) => sum + c.totalPaise, 0);
    shown = [...head, { category: "Other", totalPaise: otherPaise }];
  }

  const rows = shown.map((c) => ({
    ...c,
    share: Number(((c.totalPaise / total) * 100).toFixed(c.totalPaise / total < 0.1 ? 1 : 0)),
  }));
  const top = rows[0];
  return {
    rows,
    total,
    summary: `${top.category} is your biggest category this month: ${formatRupees(top.totalPaise)}, ${top.share}% of ${formatRupees(total)}.`,
  };
};

export const summarizeMonthly = (monthly) => {
  const empty = monthly.every((m) => m.incomePaise === 0 && m.expensePaise === 0);
  if (empty) return { empty, summary: null };

  const current = monthly[monthly.length - 1];
  const net = current.incomePaise - current.expensePaise;
  const sign = net >= 0 ? "+" : "−";
  return {
    empty,
    summary: `${formatMonth(current.period, true)} so far: ${formatRupees(current.incomePaise)} in, ${formatRupees(current.expensePaise)} out (net ${sign}${formatRupees(Math.abs(net))}).`,
  };
};
