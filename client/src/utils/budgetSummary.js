/**
 * Numbers for the Budgets page summary card, from GET /budgets.
 *
 * Three cases, so totals are never compared against the wrong limit:
 * - "none":       no budgets this month, so no utilisation or "exceeded".
 * - "overall":    an Overall budget exists, so all spending vs the Overall
 *                 limit only (category limits are already part of it).
 * - "categories": only category budgets, so spending in those categories vs
 *                 their combined limit; other spending is shown separately.
 */
export const summarizeBudgets = (data) => {
  const budgets = data?.budgets ?? [];
  const totalSpentPaise = data?.totalSpentPaise ?? 0;

  if (budgets.length === 0) {
    return { mode: "none", totalSpentPaise };
  }

  const overall = budgets.find((b) => b.category === "overall");
  let spentPaise;
  let limitPaise;
  let unbudgetedPaise = 0;

  if (overall) {
    spentPaise = totalSpentPaise;
    limitPaise = overall.limitPaise;
  } else {
    spentPaise = budgets.reduce((sum, b) => sum + (b.spentPaise ?? 0), 0);
    limitPaise = budgets.reduce((sum, b) => sum + b.limitPaise, 0);
    unbudgetedPaise = Math.max(0, totalSpentPaise - spentPaise);
  }

  return {
    mode: overall ? "overall" : "categories",
    totalSpentPaise,
    spentPaise,
    limitPaise,
    unbudgetedPaise,
    utilisation: Number(((spentPaise / limitPaise) * 100).toFixed(1)),
    remainingPaise: Math.max(0, limitPaise - spentPaise),
    exceededByPaise: Math.max(0, spentPaise - limitPaise),
  };
};
