// Budgets page summary card: no budgets, Overall budget, and category-only budgets.
import test from "node:test";
import assert from "node:assert/strict";
const { summarizeBudgets } = await import("../client/src/utils/budgetSummary.js");

test("no budgets: no utilisation or exceeded figures", () => {
  assert.deepEqual(summarizeBudgets({ budgets: [], totalSpentPaise: 495000, totalBudgetedPaise: 0 }), { mode: "none", totalSpentPaise: 495000 });
  assert.equal(summarizeBudgets(undefined).mode, "none");
});

test("only category budgets: unbudgeted spending isn't overspending", () => {
  const s = summarizeBudgets({ budgets: [{ category: "food", limitPaise: 300000, spentPaise: 50000 }], totalSpentPaise: 495000 });
  assert.equal(s.mode, "categories");
  assert.equal(s.spentPaise, 50000); assert.equal(s.limitPaise, 300000);
  assert.equal(s.unbudgetedPaise, 445000);
  assert.equal(s.utilisation, 16.7); assert.equal(s.exceededByPaise, 0); assert.equal(s.remainingPaise, 250000);
});

test("overall plus category budgets: no double counting", () => {
  const s = summarizeBudgets({
    budgets: [{ category: "overall", limitPaise: 1000000, spentPaise: 495000 }, { category: "food", limitPaise: 300000, spentPaise: 50000 }],
    totalSpentPaise: 495000, totalBudgetedPaise: 1300000,
  });
  assert.equal(s.mode, "overall"); assert.equal(s.limitPaise, 1000000); assert.equal(s.spentPaise, 495000);
  assert.equal(s.utilisation, 49.5); assert.equal(s.unbudgetedPaise, 0);
});

test("genuinely exceeded budgets still say so", () => {
  const cat = summarizeBudgets({ budgets: [{ category: "food", limitPaise: 100000, spentPaise: 160000 }], totalSpentPaise: 200000 });
  assert.equal(cat.exceededByPaise, 60000); assert.equal(cat.utilisation, 160);
  const all = summarizeBudgets({ budgets: [{ category: "overall", limitPaise: 400000, spentPaise: 495000 }], totalSpentPaise: 495000 });
  assert.equal(all.exceededByPaise, 95000); assert.equal(all.remainingPaise, 0);
});
