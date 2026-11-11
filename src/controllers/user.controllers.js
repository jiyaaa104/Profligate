import { User } from "../models/user.models.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Fields that must never be exposed in API responses
const SAFE_USER_PROJECTION =
  "-password -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry";

// Validate IANA timezone identifiers
const isValidTimezone = (timezone) => {
  if (typeof timezone !== "string" || !timezone.trim()) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone.trim(),
    });

    return true;
  } catch {
    return false;
  }
};

// Validate nonnegative integer monetary values stored in paise
const isValidPaise = (amount) => {
  return Number.isSafeInteger(amount) && amount >= 0;
};

// Get current logged-in user profile
const getCurrentUser = asyncHandler(async (req, res) => {
  // verifyJWT already attaches the authenticated user
  // with sensitive fields excluded.
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User profile fetched successfully."));
});

// Update user profile
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { name, timezone, currency, openingBalancePaise, preferences } =
    req.body;

  const hasField = (field) =>
    Object.prototype.hasOwnProperty.call(req.body, field);

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  let hasUpdates = false;

  // 1. Update name
  if (hasField("name")) {
    if (typeof name !== "string" || !name.trim()) {
      throw new ApiError(400, "Name cannot be empty.");
    }

    user.name = name.trim();
    hasUpdates = true;
  }

  // 2. Update timezone
  if (hasField("timezone")) {
    if (!isValidTimezone(timezone)) {
      throw new ApiError(400, "Please provide a valid timezone.");
    }

    user.timezone = timezone.trim();
    hasUpdates = true;
  }

  // 3. Update currency
  if (hasField("currency")) {
    if (typeof currency !== "string") {
      throw new ApiError(400, "Currency must be a valid string.");
    }

    const normalizedCurrency = currency.trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      throw new ApiError(
        400,
        "Currency must be a valid three-letter currency code.",
      );
    }

    user.currency = normalizedCurrency;
    hasUpdates = true;
  }

  // 4. Update opening balance
  if (hasField("openingBalancePaise")) {
    if (!isValidPaise(openingBalancePaise)) {
      throw new ApiError(
        400,
        "Opening balance must be a nonnegative safe integer in paise.",
      );
    }

    user.openingBalancePaise = openingBalancePaise;
    hasUpdates = true;
  }

  // 5. Update user preferences
  if (hasField("preferences")) {
    if (
      !preferences ||
      typeof preferences !== "object" ||
      Array.isArray(preferences)
    ) {
      throw new ApiError(400, "Preferences must be a valid object.");
    }

    const allowedPreferenceFields = [
      "dailyLimitPaise",
      "allowanceDay",
      "alertEnabled",
      "aiInsightsEnabled",
    ];

    const suppliedFields = Object.keys(preferences);

    const invalidFields = suppliedFields.filter(
      (field) => !allowedPreferenceFields.includes(field),
    );

    if (invalidFields.length > 0) {
      throw new ApiError(
        400,
        `Invalid preference fields: ${invalidFields.join(", ")}.`,
      );
    }

    // Update daily spending limit
    if (Object.prototype.hasOwnProperty.call(preferences, "dailyLimitPaise")) {
      if (!isValidPaise(preferences.dailyLimitPaise)) {
        throw new ApiError(
          400,
          "Daily limit must be a nonnegative safe integer in paise.",
        );
      }

      user.preferences.dailyLimitPaise = preferences.dailyLimitPaise;

      hasUpdates = true;
    }

    // Update allowance day (null clears it)
    if (Object.prototype.hasOwnProperty.call(preferences, "allowanceDay")) {
      const { allowanceDay } = preferences;

      if (
        allowanceDay !== null &&
        (!Number.isInteger(allowanceDay) ||
          allowanceDay < 1 ||
          allowanceDay > 31)
      ) {
        throw new ApiError(
          400,
          "Allowance day must be a whole number between 1 and 31.",
        );
      }

      user.preferences.allowanceDay = allowanceDay;

      hasUpdates = true;
    }

    // Update spending alerts
    if (Object.prototype.hasOwnProperty.call(preferences, "alertEnabled")) {
      if (typeof preferences.alertEnabled !== "boolean") {
        throw new ApiError(400, "alertEnabled must be a boolean.");
      }

      user.preferences.alertEnabled = preferences.alertEnabled;

      hasUpdates = true;
    }

    // Update AI insights preference
    if (
      Object.prototype.hasOwnProperty.call(preferences, "aiInsightsEnabled")
    ) {
      if (typeof preferences.aiInsightsEnabled !== "boolean") {
        throw new ApiError(400, "aiInsightsEnabled must be a boolean.");
      }

      user.preferences.aiInsightsEnabled = preferences.aiInsightsEnabled;

      hasUpdates = true;
    }
  }

  if (!hasUpdates) {
    throw new ApiError(
      400,
      "Please provide at least one valid field to update.",
    );
  }

  // Save with normal Mongoose validation enabled
  await user.save();

  // Fetch updated user without sensitive fields
  const updatedUser = await User.findById(user._id).select(
    SAFE_USER_PROJECTION,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Profile updated successfully."));
});

export { getCurrentUser, updateAccountDetails };
