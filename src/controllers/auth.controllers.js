import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
import { RefreshToken } from "../models/refreshToken.model.js";
import { PasswordAttempt } from "../models/passwordAttempt.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../utils/mail.js";

/* ═══════════════════════════════════════════════════════════════════
   Constants
═══════════════════════════════════════════════════════════════════ */

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

const MAX_PASSWORD_CHANGE_ATTEMPTS = 3;
const PASSWORD_CHANGE_LOCKOUT_MS = 3 * 60 * 1000;

const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/* ═══════════════════════════════════════════════════════════════════
   Helpers
═══════════════════════════════════════════════════════════════════ */

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  ...(maxAge !== undefined && { maxAge }),
});
const assertNotLockedOut = async (userId, attemptType) => {
  const attempt = await PasswordAttempt.findOne({
    userId,
    attemptType,
  });

  if (!attempt) return;

  const now = new Date();

  // User is currently locked out.
  if (attempt.lockedUntil && attempt.lockedUntil > now) {
    throw new ApiError(
      429,
      "Too many failed attempts. Please try again later.",
    );
  }

  // Lockout has expired. Reset the counter.
  if (attempt.lockedUntil && attempt.lockedUntil <= now) {
    attempt.failedCount = 0;
    attempt.lockedUntil = null;
    await attempt.save();
  }
};

const recordFailedAttempt = async (
  userId,
  attemptType,
  maxAttempts,
  lockoutMs,
) => {
  const attempt = await PasswordAttempt.findOneAndUpdate(
    { userId, attemptType },
    {
      $inc: { failedCount: 1 },
      $setOnInsert: { userId, attemptType },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  // Lock the account after reaching the threshold.
  if (attempt.failedCount >= maxAttempts) {
    await PasswordAttempt.updateOne(
      {
        userId,
        attemptType,
        lockedUntil: null,
      },
      {
        $set: {
          lockedUntil: new Date(Date.now() + lockoutMs),
        },
      },
    );
  }
};

const clearAttempts = async (userId, attemptType) => {
  await PasswordAttempt.deleteOne({
    userId,
    attemptType,
  });
};


const issueAuthTokens = async (user) => {
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  await RefreshToken.create({
    token: refreshToken,
    userId: user._id,
    expiresAt: new Date(Date.now() + REFRESH_COOKIE_MAX_AGE_MS),
  });

  return { accessToken, refreshToken };
};

const safeUserProjection =
  "-password -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry";

/* ═══════════════════════════════════════════════════════════════════
   Controllers
═══════════════════════════════════════════════════════════════════ */

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, timezone, currency } = req.body;

  const existedUser = await User.findOne({ email: email.toLowerCase() });
  if (existedUser) {
    throw new ApiError(409, "An account with this email already exists.");
  }

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase(),
    password,
    isEmailVerified: false,
    ...(timezone && { timezone }),
    ...(currency && { currency: currency.toUpperCase() }),
  });

  const { unHashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken();

  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpiry = tokenExpiry;
  await user.save({ validateBeforeSave: false });

  const verificationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/verify-email?token=${unHashedToken}`;

  await sendVerificationEmail({
    to: user.email,
    name: user.name,
    verificationUrl,
  }).catch((err) => console.error("Email failed:", err));

  const createdUser = await User.findById(user._id).select(safeUserProjection);
  if (!createdUser) {
    throw new ApiError(
      500,
      "Something went wrong while creating your account.",
    );
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { user: createdUser },
        "Account created successfully. A verification email has been sent — please verify before logging in.",
      ),
    );
});

const verifyEmail = asyncHandler(async (req, res) => {
  const token = req.query.token || req.body?.token;

  if (!token) {
    throw new ApiError(400, "Verification token is required.");
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpiry: { $gt: Date.now() },
  }).select("+emailVerificationToken +emailVerificationExpiry");

  if (!user) {
    throw new ApiError(400, "Verification link is invalid or has expired.");
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpiry = undefined;
  await user.save({ validateBeforeSave: false });

  const { accessToken, refreshToken } = await issueAuthTokens(user);

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions())
    .cookie(
      "refreshToken",
      refreshToken,
      cookieOptions(REFRESH_COOKIE_MAX_AGE_MS),
    )
    .json(
      new ApiResponse(
        200,
        {
          accessToken,
          refreshToken,
          user: {
            _id: user._id,
            email: user.email,
            name: user.name,
            currency: user.currency,
            isEmailVerified: true,
          },
        },
        "Email verified successfully. You are now logged in.",
      ),
    );
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw new ApiError(401, "Invalid email or password.");
  }

  await assertNotLockedOut(user._id, "login");

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    await recordFailedAttempt(
      user._id,
      "login",
      MAX_FAILED_LOGIN_ATTEMPTS,
      LOGIN_LOCKOUT_MS,
    );
    throw new ApiError(401, "Invalid email or password.");
  }

  await clearAttempts(user._id, "login");

  if (!user.isEmailVerified) {
    throw new ApiError(
      403,
      "Please verify your email address before logging in. Check your inbox for the verification link.",
    );
  }

  const { accessToken, refreshToken } = await issueAuthTokens(user);
  const loggedInUser = await User.findById(user._id).select(safeUserProjection);

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions())
    .cookie(
      "refreshToken",
      refreshToken,
      cookieOptions(REFRESH_COOKIE_MAX_AGE_MS),
    )
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "Logged in successfully.",
      ),
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  if (incomingRefreshToken) {
    await RefreshToken.deleteOne({ token: incomingRefreshToken });
  }

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions())
    .clearCookie("refreshToken", cookieOptions())
    .json(new ApiResponse(200, {}, "Logged out successfully."));
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const genericResponse = new ApiResponse(
    200,
    {},
    "If that email is registered, a password reset link has been sent.",
  );

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(200).json(genericResponse);
  }

  const { unHashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken();

  user.forgotPasswordToken = hashedToken;
  user.forgotPasswordExpiry = new Date(tokenExpiry);
  await user.save({ validateBeforeSave: false });

  const passwordResetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password?token=${unHashedToken}`;

  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    passwordResetUrl,
  });

  return res.status(200).json(genericResponse);
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  await assertNotLockedOut(user._id, "changePassword");

  const isCurrentPasswordValid = await user.isPasswordCorrect(currentPassword);
  if (!isCurrentPasswordValid) {
    await recordFailedAttempt(
      user._id,
      "changePassword",
      MAX_PASSWORD_CHANGE_ATTEMPTS,
      PASSWORD_CHANGE_LOCKOUT_MS,
    );
    throw new ApiError(403, "Current password is incorrect.");
  }

  await clearAttempts(user._id, "changePassword");
  user.password = newPassword;
  await user.save();

  await RefreshToken.deleteMany({ userId: user._id });

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions())
    .clearCookie("refreshToken", cookieOptions())
    .json(
      new ApiResponse(
        200,
        {},
        "Password changed successfully. Please log in again.",
      ),
    );
});
// ── UPDATED refreshAccessToken (Fixes Race Condition) ──

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is required.");
  }

  // Atomic operation: find AND delete in one step. 
  // This prevents race conditions if multiple requests hit at once.
  const storedToken = await RefreshToken.findOneAndDelete({
    token: incomingRefreshToken,
  });

  if (!storedToken) {
    throw new ApiError(401, "Refresh token is invalid or has already been used.");
  }

  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch {
    // If it's expired/tampered, the token is already deleted above, so just throw
    throw new ApiError(401, "Refresh token has expired. Please log in again.");
  }

  const user = await User.findById(decoded._id);
  if (!user) {
    throw new ApiError(401, "User belonging to this token no longer exists.");
  }

  // Issue the new pair
  const { accessToken, refreshToken: newRefreshToken } =
    await issueAuthTokens(user);

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions())
    .cookie(
      "refreshToken",
      newRefreshToken,
      cookieOptions(REFRESH_COOKIE_MAX_AGE_MS),
    )
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken: newRefreshToken },
        "Tokens refreshed successfully.",
      ),
    );
});

// ── UPDATED resetPassword (Clears lockouts) ──

const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    forgotPasswordToken: hashedToken,
    forgotPasswordExpiry: { $gt: Date.now() },
  }).select("+forgotPasswordToken +forgotPasswordExpiry");

  if (!user) {
    throw new ApiError(400, "Password reset link is invalid or has expired.");
  }

  user.password = newPassword;
  user.forgotPasswordToken = undefined;
  user.forgotPasswordExpiry = undefined;
  await user.save();

  // Revoke all sessions
  await RefreshToken.deleteMany({ userId: user._id });

  // THE FIX: Clear all login/change-password lockouts so they can log in immediately
  await clearAttempts(user._id, "login");
  await clearAttempts(user._id, "changePassword");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {},
        "Password reset successfully. Please log in with your new password.",
      ),
    );
});
export {
  registerUser,
  verifyEmail,
  login,
  logoutUser,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  changePassword,
};
