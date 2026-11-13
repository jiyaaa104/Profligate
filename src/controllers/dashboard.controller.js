import { User } from "../models/user.models.js";
import { Transaction } from "../models/transaction.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getRunwayForUser } from "../utils/runway.js";
import { getChartDataForUser } from "../utils/charts.js";

const getDashboardSummary = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // 1. Fetch user's opening balance
  const user = await User.findById(userId).select("openingBalancePaise").lean();

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // 2. Aggregate income and expense totals
  const totals = await Transaction.aggregate([
    {
      $match: {
        userId,
        type: { $in: ["income", "expense"] },
      },
    },
    {
      $group: {
        _id: "$type",
        total: { $sum: "$amountPaise" },
      },
    },
  ]);

  // 3. Extract totals
  const totalIncome = totals.find((t) => t._id === "income")?.total ?? 0;

  const totalExpense = totals.find((t) => t._id === "expense")?.total ?? 0;

  // 4. Calculate current balance
  const openingBalance = user.openingBalancePaise ?? 0;

  const currentBalance = openingBalance + totalIncome - totalExpense;

  // 5. Fetch five most recent transactions
  const recentTransactions = await Transaction.find({ userId })
    .select(
      "type amountPaise category description transactionDate paymentMethod",
    )
    .sort({ transactionDate: -1, _id: -1 })
    .limit(5)
    .lean();

  // 6. Return dashboard response
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        summary: {
          openingBalancePaise: openingBalance,
          totalIncomePaise: totalIncome,
          totalExpensePaise: totalExpense,
          currentBalancePaise: currentBalance,
        },
        recentTransactions,
      },
      "Dashboard summary fetched successfully.",
    ),
  );
});

// Largest amount accepted for a "Can I afford this?" preview: ₹1 crore.
const MAX_PURCHASE_PREVIEW_PAISE = 1_000_000_000;

const getDashboardRunway = asyncHandler(async (req, res) => {
  let purchasePaise = 0;

  if (req.query.purchasePaise !== undefined) {
    purchasePaise = Number(req.query.purchasePaise);

    if (
      !Number.isSafeInteger(purchasePaise) ||
      purchasePaise < 1 ||
      purchasePaise > MAX_PURCHASE_PREVIEW_PAISE
    ) {
      throw new ApiError(
        400,
        "Purchase amount must be a whole number of paise between 1 and 1,000,000,000.",
      );
    }
  }

  const runway = await getRunwayForUser(req.user._id, { purchasePaise });

  if (!runway) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, runway, "Runway calculated successfully."));
});

// Daily spending (30 days), this month's categories, income vs expenses (6 months)
const getDashboardCharts = asyncHandler(async (req, res) => {
  const charts = await getChartDataForUser(req.user._id);

  if (!charts) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, charts, "Chart data fetched successfully."));
});

export { getDashboardSummary, getDashboardRunway, getDashboardCharts };
