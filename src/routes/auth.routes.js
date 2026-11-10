import { Router } from "express";
import {
  registerUser,
  verifyEmail,
  login,
  logoutUser,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/auth.controllers.js";
import { validate } from "../middlewares/validator.middleware.js";
import {
  userRegisterValidator,
  userLoginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
} from "../validators/index.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

// Public routes
router.route("/register").post(userRegisterValidator(), validate, registerUser);
router.route("/verify-email").get(verifyEmail).post(verifyEmail);
router.route("/login").post(userLoginValidator(), validate, login);
router.route("/refresh").post(refreshAccessToken);
router.route("/forgot-password").post(forgotPasswordValidator(), validate, forgotPassword);
router.route("/reset-password").post(resetPasswordValidator(), validate, resetPassword);

// Protected routes (require valid access token)
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/change-password").post(verifyJWT, changePasswordValidator(), validate, changePassword);

export default router;
