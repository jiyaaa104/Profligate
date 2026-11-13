// Shared wording helpers for the Money Runway card and the
// "Can I afford this?" preview.

// Dates arrive as calendar-day strings ("2026-11-22"), so format them in UTC
// to stop the browser's timezone shifting them by a day.
export const formatDay = (dateKey) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(new Date(dateKey));

export const formatRupees = (paise) =>
  `₹${Math.floor(paise / 100).toLocaleString("en-IN")}`;

export const plural = (count, word) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

const lastsUntil = (runway) =>
  runway.daysLeft > 365 ? "over a year" : formatDay(runway.runOutDate);

/**
 * Compare the runway now (`before`) with the runway if `amountPaise` were
 * spent today (`after`, from GET /dashboard/runway?purchasePaise=...).
 * Returns a tone ("ok" | "warn" | "no") and the lines to show.
 */
export const describePurchase = (before, after, amountPaise) => {
  const amount = formatRupees(amountPaise);

  if (after.balancePaise < 0) {
    return {
      tone: "no",
      lines: [
        `You don't have enough recorded money for ${amount}. You're ${formatRupees(-after.balancePaise)} short.`,
      ],
    };
  }

  const billsShortfall = (after.billsDuePaise ?? 0) - (after.billsReservedPaise ?? 0);
  if (billsShortfall > 0) {
    return {
      tone: "warn",
      lines: [
        `This would leave you ${formatRupees(billsShortfall)} short for the ${formatRupees(after.billsDuePaise)} in bills due before your next allowance.`,
      ],
    };
  }

  const savingsUsed = before.reservedPaise - after.reservedPaise;
  if (before.savingsGoalPaise > 0 && savingsUsed > 0) {
    return {
      tone: "warn",
      lines: [
        `This would use ${formatRupees(savingsUsed)} of the money set aside for your ${formatRupees(before.savingsGoalPaise)} savings goal.`,
        `You could still save ${formatRupees(after.reservedPaise)} this month if you spend nothing else.`,
      ],
    };
  }

  const lines = [
    after.runOutDate === before.runOutDate
      ? `Your money still lasts until ${lastsUntil(after)}.`
      : `After this, your money lasts until ${lastsUntil(after)} instead of ${lastsUntil(before)}.`,
  ];

  const hasAllowance = after.nextAllowanceDate !== null;
  if (hasAllowance && after.daysUntilAllowance > 0) {
    if (before.safeDailyPaise >= 100 && after.safeDailyPaise !== before.safeDailyPaise) {
      lines.push(
        `Your daily budget drops from ${formatRupees(before.safeDailyPaise)} to ${formatRupees(after.safeDailyPaise)}.`,
      );
    }

    if (!after.willRunShort) {
      lines.push("You'd still make it to your next allowance.");
    } else if (before.willRunShort) {
      lines.push(
        `You'd be ${plural(after.daysShort, "day")} short of your next allowance instead of ${before.daysShort}.`,
      );
    } else {
      lines.push(
        `You'd fall ${plural(after.daysShort, "day")} short of your next allowance.`,
      );
    }
  }

  return { tone: after.willRunShort ? "warn" : "ok", lines };
};
