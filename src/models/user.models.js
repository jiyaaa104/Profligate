import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";

/**
 * User schema — Profligate PRD §6.1
 *
 * Changes applied in this revision:
 *  - Decision C: `username` + `fullName` removed → replaced with `name` (required).
 *    Authentication is email-based only. No username-based login.
 *  - Decision D: `openingBalance` (float) → `openingBalancePaise` (integer).
 *    All monetary amounts are stored as integer paise to avoid
 *    floating-point precision errors (PRD §6, Database Rules).
 *  - `refreshToken` removed from this document — refresh tokens are
 *    now persisted in the dedicated RefreshToken collection, enabling
 *    multi-device sessions and true token rotation.
 *  - Preferences aligned with PRD §6.1 schema.
 */

const userSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },

    // ── Email verification ─────────────────────────────────────────
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false, // never accidentally leak this in queries
    },
    emailVerificationExpiry: {
      type: Date,
      select: false,
    },

    // ── Password reset ─────────────────────────────────────────────
    forgotPasswordToken: {
      type: String,
      select: false,
    },
    forgotPasswordExpiry: {
      type: Date,
      select: false,
    },

    // ── Financial configuration (PRD §6.1) ────────────────────────
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata",
      trim: true,
      validate: {
        validator: (timezone) => {
          try {
            Intl.DateTimeFormat("en-US", {
              timeZone: timezone,
            });
            return true;
          } catch {
            return false;
          }
        },
        message: "Invalid timezone.",
      },
    },

    // Opening balance recorded by the user as a starting point.
    // Stored as integer paise (₹1 = 100 paise) — PRD §7.1.
    // This is the user-reported balance, NOT a verified bank balance.
    openingBalancePaise: {
      type: Number,
      default: 0,
      min: [0, "Opening balance cannot be negative"],
    },
    openingBalanceDate: {
      type: Date,
    },

    // ── Preferences (PRD §6.1) ─────────────────────────────────────
    preferences: {
      // Daily discretionary limit in paise (0 = not set)
      dailyLimitPaise: {
        type: Number,
        default: 0,
        min: [0, "Daily limit cannot be negative"],
        validate: {
          validator: Number.isSafeInteger,
          message: "Daily limit must be a valid integer in paise.",
        },
      },
      // Day of the month the student receives money (1-31, null = not set)
      allowanceDay: {
        type: Number,
        default: null,
        min: [1, "Allowance day must be between 1 and 31"],
        max: [31, "Allowance day must be between 1 and 31"],
        validate: {
          validator: (day) => day === null || Number.isInteger(day),
          message: "Allowance day must be a whole number.",
        },
      },
      alertEnabled: {
        type: Boolean,
        default: true,
      },
      aiInsightsEnabled: {
        type: Boolean,
        default: true,
      },
    },
  },
  { timestamps: true },
);

// ── Hooks ──────────────────────────────────────────────────────────

userSchema.pre("save", async function () {
  // Only re-hash when the password field has actually changed
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// ── Instance methods ───────────────────────────────────────────────

userSchema.methods.isPasswordCorrect = async function (password) {
  return bcrypt.compare(password, this.password);
};

/**
 * Short-lived access token (default 15 m, configured via ACCESS_TOKEN_EXPIRY).
 * Payload is kept minimal — _id and email are sufficient for server-side
 * lookups; no sensitive data lives in the JWT.
 */
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { _id: this._id, email: this.email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m" },
  );
};

/**
 * Long-lived refresh token (default 7 d, configured via REFRESH_TOKEN_EXPIRY).
 * Contains only _id — the RefreshToken collection validates existence and
 * expiry before trusting this payload.
 */
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { _id: this._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d" },
  );
};

/**
 * Returns a { unHashedToken, hashedToken, tokenExpiry } triple.
 *
 * unHashedToken — sent to the user (email link / response body).
 * hashedToken   — stored in the database (never expose raw token in DB).
 * tokenExpiry   — 20-minute window (timestamp in ms).
 *
 * Usage: email verification, password reset.
 */
userSchema.methods.generateTemporaryToken = function () {
  const unHashedToken = crypto.randomBytes(20).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(unHashedToken)
    .digest("hex");
  const tokenExpiry = Date.now() + 20 * 60 * 1000; // 20 minutes
  return { unHashedToken, hashedToken, tokenExpiry };
};

export const User = mongoose.model("User", userSchema);
