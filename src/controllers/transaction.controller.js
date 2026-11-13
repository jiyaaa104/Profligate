import mongoose from "mongoose";

import { Transaction } from "../models/transaction.model.js";
import { FixedCost } from "../models/fixedCost.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { checkDailyLimit } from "../utils/alertEngine.js";
import { checkRunwayAlert } from "../utils/runway.js";

// Create a new transaction
const createTransaction = asyncHandler(async (req, res) => {
  const {
    amountPaise,
    type,
    category,
    description,
    transactionDate,
    paymentMethod,
  } = req.body;

  // 1. Validate required fields.
  if (
    amountPaise === undefined ||
    !type ||
    !category ||
    !paymentMethod
  ) {
    throw new ApiError(400, "Required transaction fields are missing.");
  }

  // 2. Validate amount.
  if (
    !Number.isSafeInteger(amountPaise) ||
    amountPaise <= 0
  ) {
    throw new ApiError(
      400,
      "Transaction amount must be a positive integer in paise."
    );
  }

  // 3. Validate transaction type.
  const allowedTypes = ["income", "expense"];

  if (!allowedTypes.includes(type)) {
    throw new ApiError(400, "Invalid transaction type.");
  }

  // 4. Validate category and payment method.
  if (
    typeof category !== "string" ||
    !category.trim() ||
    typeof paymentMethod !== "string" ||
    !paymentMethod.trim()
  ) {
    throw new ApiError(
      400,
      "Category and payment method must be valid strings."
    );
  }

  // 5. Validate transaction date if provided.
  let parsedTransactionDate;

  if (transactionDate !== undefined) {
    parsedTransactionDate = new Date(transactionDate);

    if (Number.isNaN(parsedTransactionDate.getTime())) {
      throw new ApiError(400, "Invalid transaction date.");
    }
  }

  // 6. Create transaction.
  const transaction = await Transaction.create({
    userId: req.user._id,
    amountPaise,
    type,
    category: category.trim(),
    description:
      typeof description === "string" ? description.trim() : description,
    transactionDate: parsedTransactionDate,
    paymentMethod: paymentMethod.trim(),
  });

  // 7. Check daily spending limit for expense transactions.
  // Notification failures should not affect transaction creation.
  if (transaction.type === "expense") {
    try {
      await checkDailyLimit(req.user._id, transaction);
    } catch (error) {
      console.error("Daily limit alert error:", error);
    }

    try {
      await checkRunwayAlert(req.user._id);
    } catch (error) {
      console.error("Runway alert error:", error);
    }
  }

  // 8. Return successful response.
  return res.status(201).json(
    new ApiResponse(
      201,
      transaction,
      "Transaction created successfully."
    )
  );
});


// Get transactions (pagination + filters)
const getTransactions = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;

  // 1. Validate pagination.
  if (
    !Number.isInteger(page) ||
    !Number.isInteger(limit) ||
    page < 1 ||
    limit < 1 ||
    limit > 100
  ) {
    throw new ApiError(400, "Invalid pagination parameters.");
  }

  const skip = (page - 1) * limit;

  // 2. Base filter: Users can only access their own transactions.
  const filter = {
    userId: req.user._id,
  };

  // 3. Validate transaction type.
  const allowedTypes = ["income", "expense"];

  if (req.query.type) {
    if (!allowedTypes.includes(req.query.type)) {
      throw new ApiError(400, "Invalid transaction type.");
    }

    filter.type = req.query.type;
  }

  // 4. Category filter.
  if (req.query.category) {
    filter.category = req.query.category;
  }

  // 5. Date-range filtering.
  if (req.query.startDate || req.query.endDate) {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : null;

    const endDate = req.query.endDate
      ? new Date(req.query.endDate)
      : null;

    if (
      (startDate && Number.isNaN(startDate.getTime())) ||
      (endDate && Number.isNaN(endDate.getTime()))
    ) {
      throw new ApiError(400, "Invalid date format.");
    }

    if (startDate && endDate && startDate > endDate) {
      throw new ApiError(
        400,
        "Start date cannot be after end date."
      );
    }

    filter.transactionDate = {};

    if (startDate) {
      filter.transactionDate.$gte = startDate;
    }

    if (endDate) {
      // Include the entire selected day for YYYY-MM-DD inputs.
      if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.endDate)) {
        endDate.setUTCHours(23, 59, 59, 999);
      }

      filter.transactionDate.$lte = endDate;
    }
  }

  // 6. Fetch transactions and total count.
  const [transactions, totalTransactions] = await Promise.all([
    Transaction.find(filter)
      .sort({ transactionDate: -1, _id: -1 })
      .skip(skip)
      .limit(limit),

    Transaction.countDocuments(filter),
  ]);

  // 7. Return response.
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        transactions,
        pagination: {
          total: totalTransactions,
          page,
          limit,
          totalPages: Math.ceil(totalTransactions / limit),
        },
      },
      "Transactions fetched successfully."
    )
  );
});


// Delete a transaction
const deleteTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 1. Validate MongoDB ObjectId.
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid transaction ID.");
  }

  // 2. Delete only if the transaction belongs to the authenticated user.
  const transaction = await Transaction.findOneAndDelete({
    _id: id,
    userId: req.user._id,
  });

  if (!transaction) {
    throw new ApiError(404, "Transaction not found or unauthorized.");
  }

  // 3. Deleting the expense that paid a bill marks that bill unpaid again.
  if (transaction.fixedCostId) {
    const bill = await FixedCost.findOne({
      _id: transaction.fixedCostId,
      userId: req.user._id,
      lastPaidTransactionId: transaction._id,
    });

    if (bill) {
      bill.lastPaidPeriod = bill.previousPaidPeriod;
      bill.previousPaidPeriod = null;
      bill.lastPaidTransactionId = null;
      await bill.save();
    }
  }

  // 4. Return response.
  return res.status(200).json(
    new ApiResponse(
      200,
      {},
      "Transaction deleted successfully."
    )
  );
});

// Update a transaction (any subset of its fields)
// PATCH /api/v1/transactions/:id
const PAYMENT_METHODS = ["cash", "card", "upi", "netbanking", "other"];

const updateTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 1. Validate MongoDB ObjectId.
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid transaction ID.");
  }

  const body = req.body ?? {};
  const has = (field) => Object.prototype.hasOwnProperty.call(body, field);
  const updates = {};

  // 2. Validate each field that was sent.
  if (has("amountPaise")) {
    if (!Number.isSafeInteger(body.amountPaise) || body.amountPaise <= 0) {
      throw new ApiError(
        400,
        "Transaction amount must be a positive integer in paise.",
      );
    }
    updates.amountPaise = body.amountPaise;
  }

  if (has("type")) {
    if (!["income", "expense"].includes(body.type)) {
      throw new ApiError(400, "Invalid transaction type.");
    }
    updates.type = body.type;
  }

  if (has("category")) {
    if (typeof body.category !== "string" || !body.category.trim()) {
      throw new ApiError(400, "Category must be a valid string.");
    }
    updates.category = body.category.trim();
  }

  if (has("description")) {
    if (body.description !== null && typeof body.description !== "string") {
      throw new ApiError(400, "Description must be a string.");
    }
    const description = (body.description ?? "").trim();
    if (description.length > 200) {
      throw new ApiError(400, "Description cannot exceed 200 characters.");
    }
    updates.description = description;
  }

  if (has("paymentMethod")) {
    if (!PAYMENT_METHODS.includes(body.paymentMethod)) {
      throw new ApiError(400, "Invalid payment method.");
    }
    updates.paymentMethod = body.paymentMethod;
  }

  if (has("transactionDate")) {
    const date = new Date(body.transactionDate);
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(400, "Invalid transaction date.");
    }
    updates.transactionDate = date;
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "Provide at least one field to update.");
  }

  // 3. Only the owner can edit it.
  const existing = await Transaction.findOne({ _id: id, userId: req.user._id });

  if (!existing) {
    throw new ApiError(404, "Transaction not found or unauthorized.");
  }

  // A bill payment has to stay an expense, or the bill would look paid
  // without any money having gone out.
  if (existing.fixedCostId && updates.type === "income") {
    throw new ApiError(
      400,
      "Bill payments can't be changed to income. Delete it instead to mark the bill unpaid.",
    );
  }

  const before = existing.toObject();
  Object.assign(existing, updates);
  await existing.save();

  // 4. Recheck alerts for the old and the new day. Alert failures must not
  // fail the update.
  try {
    if (before.type === "expense") await checkDailyLimit(req.user._id, before);
    if (existing.type === "expense") await checkDailyLimit(req.user._id, existing);
  } catch (error) {
    console.error("Daily limit alert error:", error);
  }

  try {
    await checkRunwayAlert(req.user._id);
  } catch (error) {
    console.error("Runway alert error:", error);
  }

  // 5. Return the updated transaction.
  return res
    .status(200)
    .json(
      new ApiResponse(200, existing, "Transaction updated successfully."),
    );
});

export {
  createTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
};

