import mongoose from "mongoose";
import { Budget } from "../models/budget.model.js";
import { Transaction } from "../models/transaction.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Get current month in UTC (YYYY-MM)
const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
};

// Validate YYYY-MM format
const isValidMonth = (month) => {
  return typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
};

// Normalize budget categories
const normalizeCategory = (category) => {
  return category.trim().toLowerCase();
};

// Check MongoDB duplicate key error
const isDuplicateKeyError = (error) => {
  return error.code === 11000;
};

/**
 * Create a new budget
 * POST /api/v1/budgets
 */
const createBudget = asyncHandler(async (req, res) => {
  const { category, limitPaise } = req.body;
  let { month } = req.body;

  // Validate required fields
  if (
    typeof category !== "string" ||
    !category.trim() ||
    limitPaise === undefined ||
    limitPaise === null
  ) {
    throw new ApiError(400, "Category and budget limit are required.");
  }

  // Validate budget limit
  const parsedLimit = Number(limitPaise);

  if (!Number.isSafeInteger(parsedLimit) || parsedLimit <= 0) {
    throw new ApiError(
      400,
      "Budget limit must be a positive safe integer in paise.",
    );
  }

  // Default to current month
  if (month === undefined || month === null || month === "") {
    month = getCurrentMonth();
  }

  if (typeof month === "string") {
    month = month.trim();
  }

  // Validate month
  if (!isValidMonth(month)) {
    throw new ApiError(400, "Month must be in YYYY-MM format.");
  }

  const normalizedCategory = normalizeCategory(category);

  // Check if budget already exists
  const existingBudget = await Budget.findOne({
    userId: req.user._id,
    category: normalizedCategory,
    month,
  });

  if (existingBudget) {
    throw new ApiError(
      409,
      `A budget for '${normalizedCategory}' in ${month} already exists. Please update the existing budget instead.`,
    );
  }

  // Create budget
  let budget;

  try {
    budget = await Budget.create({
      userId: req.user._id,
      category: normalizedCategory,
      limitPaise: parsedLimit,
      month,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(
        409,
        "A budget for this category and month already exists.",
      );
    }

    throw error;
  }

  return res
    .status(201)
    .json(new ApiResponse(201, budget, "Budget created successfully."));
});

/**
 * Get budgets with dynamic spending calculation
 * GET /api/v1/budgets?month=YYYY-MM
 */

const getBudgets = asyncHandler(async (req, res) => {
  let month = req.query.month ?? getCurrentMonth();

  // 1. Validate requested month
  if (typeof month === "string") {
    month = month.trim();
  }

  if (!isValidMonth(month)) {
    throw new ApiError(400, "Month must be in YYYY-MM format.");
  }

  // 2. Fetch user's budgets for the selected month
  const budgets = await Budget.find({
    userId: req.user._id,
    month,
  })
    .sort({ createdAt: -1 })
    .lean();

  // 3. Calculate UTC date boundaries for the selected month
  const [year, monthNumber] = month.split("-").map(Number);

  const startDate = new Date(Date.UTC(year, monthNumber - 1, 1));

  const endDate = new Date(Date.UTC(year, monthNumber, 1));

  // 4. Aggregate all expense transactions for this user and month
  const expenses = await Transaction.aggregate([
    {
      $match: {
        userId: req.user._id,
        type: "expense",
        transactionDate: {
          $gte: startDate,
          $lt: endDate,
        },
      },
    },
    {
      $group: {
        _id: {
          $toLower: {
            $trim: {
              input: "$category",
            },
          },
        },
        totalSpentPaise: {
          $sum: "$amountPaise",
        },
      },
    },
  ]);

  // 5. Build category-wise spending map
  const spendingMap = new Map();

  let totalOverallExpensePaise = 0;

  for (const expense of expenses) {
    spendingMap.set(expense._id, expense.totalSpentPaise);

    totalOverallExpensePaise += expense.totalSpentPaise;
  }

  // 6. Calculate spending metrics for every budget
  const enrichedBudgets = budgets.map((budget) => {
    const spentPaise =
      budget.category === "overall"
        ? totalOverallExpensePaise
        : spendingMap.get(budget.category) || 0;

    const remainingPaise = Math.max(0, budget.limitPaise - spentPaise);

    const exceededPaise = Math.max(0, spentPaise - budget.limitPaise);

    const utilisationPercentage = Number(
      ((spentPaise / budget.limitPaise) * 100).toFixed(1),
    );

    const isExceeded = spentPaise > budget.limitPaise;

    return {
      ...budget,
      spentPaise,
      remainingPaise,
      exceededPaise,
      utilisationPercentage,
      isExceeded,
    };
  });

  // 7. Calculate total budgeted amount
  const totalBudgetedPaise = budgets.reduce(
    (total, budget) => total + budget.limitPaise,
    0,
  );

  // 8. Send response
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        month,
        budgets: enrichedBudgets,
        totalBudgetedPaise,
        totalSpentPaise: totalOverallExpensePaise,
      },
      "Budgets fetched successfully.",
    ),
  );
});


/**
 * Update an existing budget
 * PATCH /api/v1/budgets/:id
 */
const updateBudget = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limitPaise, category } = req.body;

  // Validate budget ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid budget ID.");
  }

  // Find budget belonging to authenticated user
  const budget = await Budget.findOne({
    _id: id,
    userId: req.user._id,
  });

  if (!budget) {
    throw new ApiError(404, "Budget not found or unauthorized.");
  }

  // Update budget limit
  if (limitPaise !== undefined) {
    const parsedLimit = Number(limitPaise);

    if (!Number.isSafeInteger(parsedLimit) || parsedLimit <= 0) {
      throw new ApiError(
        400,
        "Budget limit must be a positive safe integer in paise.",
      );
    }

    budget.limitPaise = parsedLimit;
  }

  // Update category
  if (category !== undefined) {
    if (typeof category !== "string" || !category.trim()) {
      throw new ApiError(400, "Category must be a non-empty string.");
    }

    budget.category = normalizeCategory(category);
  }

  // Save changes
  try {
    await budget.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(
        409,
        "A budget for this category and month already exists.",
      );
    }

    throw error;
  }

  return res
    .status(200)
    .json(new ApiResponse(200, budget, "Budget updated successfully."));
});

/**
 * Delete a budget
 * DELETE /api/v1/budgets/:id
 */
const deleteBudget = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validate budget ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid budget ID.");
  }

  // Delete only if budget belongs to authenticated user
  const budget = await Budget.findOneAndDelete({
    _id: id,
    userId: req.user._id,
  });

  if (!budget) {
    throw new ApiError(404, "Budget not found or unauthorized.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Budget deleted successfully."));
});

export { createBudget, getBudgets, updateBudget, deleteBudget };
