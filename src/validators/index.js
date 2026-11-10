import { body } from "express-validator";

/* ═══════════════════════════════════════════════════════════════════
   Auth validators
═══════════════════════════════════════════════════════════════════ */

/**
 * Registration validator.
 *
 * Changes from original:
 *  - `username` removed (Decision C). Auth is email-based.
 *  - `name` added (required, minimum 2 chars).
 *  - Password minimum raised from 5 → 8 characters.
 */
const userRegisterValidator = () => [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Email is not a valid email address"),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
];

/**
 * Login validator.
 *
 * Both fields are required — email-only auth (no username login).
 */
const userLoginValidator = () => [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Email is not a valid email address"),

  body("password")
    .notEmpty()
    .withMessage("Password is required"),
];

/**
 * Forgot-password validator.
 * Just validates that a valid email address was supplied.
 */
const forgotPasswordValidator = () => [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Email is not a valid email address"),
];

/**
 * Reset-password validator.
 * Token comes from the query string on the client side;
 * the POST body carries both the token and the new password.
 */
const resetPasswordValidator = () => [
  body("token")
    .trim()
    .notEmpty()
    .withMessage("Reset token is required"),

  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters"),
];

/**
 * Change-password validator (authenticated endpoint).
 * Ensures the new password is different from the current one to avoid
 * a pointless "change" that leaves security unchanged.
 */
const changePasswordValidator = () => [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters")
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error(
          "New password must be different from the current password",
        );
      }
      return true;
    }),
];

export {
  userRegisterValidator,
  userLoginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
};
