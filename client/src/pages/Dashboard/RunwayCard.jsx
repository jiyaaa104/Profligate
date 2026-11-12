import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Hourglass } from "lucide-react";
import api from "../../services/api";

// Dates arrive as calendar-day strings ("2026-11-22"), so format them in UTC
// to stop the browser's timezone shifting them by a day.
const formatDay = (dateKey) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(new Date(dateKey));

const formatRupees = (paise) =>
  `₹${Math.floor(paise / 100).toLocaleString("en-IN")}`;

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

const getCopy = (runway) => {
  const isOut = runway.balancePaise <= 0;
  const hasAllowance = runway.nextAllowanceDate !== null;
  const hasGoal = runway.savingsGoalPaise > 0;
  const goal = formatRupees(runway.savingsGoalPaise);
  // Nothing left to spend once the savings goal is set aside.
  const goalUsesEverything = hasGoal && !isOut && runway.spendablePaise <= 0;

  let headline;
  if (isOut) {
    headline = "You've run out of recorded money.";
  } else if (goalUsesEverything) {
    headline = `You can save ${formatRupees(runway.reservedPaise)} of your ${goal} goal if you spend nothing else.`;
  } else if (runway.daysLeft > 365) {
    headline = hasGoal
      ? `Your money lasts over a year at this pace, even after saving ${goal}.`
      : "Your money lasts over a year at this pace.";
  } else {
    headline = hasGoal
      ? `Your money lasts until ${formatDay(runway.runOutDate)} while keeping ${goal} aside for savings.`
      : `Your money lasts until ${formatDay(runway.runOutDate)}.`;
  }

  // What the savings goal costs, in days.
  let note = null;
  if (hasGoal && runway.spendablePaise > 0 && runway.daysLeft <= 365) {
    note =
      runway.daysLeftWithoutSavings > 365
        ? "Without the savings goal, it would last over a year."
        : `Without the savings goal, it would last until ${formatDay(runway.runOutDateWithoutSavings)}.`;
  }

  if (!hasAllowance) return { headline, detail: null, action: null, note };

  if (runway.daysUntilAllowance === 0) {
    return {
      headline,
      detail: "Your allowance is due today.",
      action: "Add it as income when it arrives.",
      note,
    };
  }

  const canAfford =
    runway.safeDailyPaise >= 100
      ? formatRupees(runway.safeDailyPaise)
      : null;

  if (runway.willRunShort) {
    return {
      headline,
      detail: isOut || goalUsesEverything
        ? `Your next allowance is ${plural(runway.daysUntilAllowance, "day")} away.`
        : `That's ${plural(runway.daysShort, "day")} short of your next allowance.`,
      action: canAfford
        ? `Keep spending under ${canAfford} a day to make it.`
        : null,
      note,
    };
  }

  return {
    headline,
    detail: `That covers you until your next allowance on ${formatDay(runway.nextAllowanceDate)}.`,
    action: canAfford ? `You can spend up to ${canAfford} a day.` : null,
    note,
  };
};

export default function RunwayCard() {
  // Nested under "dashboard-summary" so anything that refreshes the dashboard
  // (adding a transaction, saving the profile) refreshes the runway too.
  const { data: runway, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-summary", "runway"],
    queryFn: async () => {
      const response = await api.get("/dashboard/runway");
      return response.data?.data;
    },
  });

  const shell = (tone, children) => (
    <section className={`glass-panel rounded-2xl p-6 border ${tone}`}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <Hourglass className="w-5 h-5 text-brand-emerald-light" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Money Runway
          </span>
          {children}
        </div>
      </div>
    </section>
  );

  if (isLoading) {
    return shell(
      "border-white/5",
      <div className="h-7 w-64 max-w-full bg-white/5 animate-pulse rounded-lg mt-2" />,
    );
  }

  if (isError || !runway) {
    return shell(
      "border-white/5",
      <p className="text-sm text-slate-400 mt-1">
        Couldn't work out your runway right now.{" "}
        <button
          onClick={() => refetch()}
          className="font-semibold underline hover:text-white"
        >
          Try again
        </button>
      </p>,
    );
  }

  if (runway.status === "insufficient_data") {
    return shell(
      "border-white/5",
      <>
        <h2 className="text-lg font-bold text-white mt-1">
          Add a week of spending to see your runway
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Once you have a week of history, including at least 3 days with
          expenses, you'll see when your money is likely to run out.
        </p>
      </>,
    );
  }

  const { headline, detail, action, note } = getCopy(runway);

  return shell(
    runway.willRunShort ? "border-amber-500/40" : "border-brand-emerald/25",
    <>
      <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1">
        {headline}
      </h2>
      {detail && (
        <p
          className={`text-sm mt-1 ${
            runway.willRunShort ? "text-amber-300" : "text-slate-300"
          }`}
        >
          {detail}
        </p>
      )}
      {action && <p className="text-sm text-white font-semibold mt-1">{action}</p>}
      {note && <p className="text-sm text-slate-400 italic mt-1">{note}</p>}
      <p className="text-xs text-slate-400 mt-3">
        Based on your typical spending of about{" "}
        {formatRupees(runway.dailyPacePaise)} a day over the last{" "}
        {plural(runway.windowDays, "day")}.
        {runway.nextAllowanceDate === null && (
          <>
            {" "}
            <Link
              to="/profile"
              className="font-semibold text-brand-emerald hover:text-brand-emerald-light"
            >
              Set your allowance day
            </Link>{" "}
            to see if it will last.
          </>
        )}
      </p>
    </>,
  );
}
