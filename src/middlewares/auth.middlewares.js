import { User } from "../models/user.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import jwt from "jsonwebtoken";

/**
 * verifyJWT — authentication guard middleware.
 *
 * Reads the access token from (in priority order):
 *   1. `accessToken` HttpOnly cookie  (browser clients)
 *   2. Authorization: Bearer <token>  (API / mobile clients)
 *
 * On success, attaches the full (safe) user document to `req.user`.
 * Sensitive fields (password, tokens) are excluded at the query level
 * via Mongoose `select: false` on the schema + the .select() override below.
 */
export const verifyJWT = asyncHandler(async (req, _res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new ApiError(401, "Unauthorized: no access token provided.");
  }

  let decodedToken;
  try {
    decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch {
    // Covers both TokenExpiredError and JsonWebTokenError
    throw new ApiError(401, "Access token is invalid or has expired.");
  }

  // Fetch the user and exclude all security-sensitive fields.
  // `select: false` on the schema fields already excludes them by default;
  // the explicit .select() here acts as a belt-and-suspenders guard.
  const user = await User.findById(decodedToken._id).select(
    "-password -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry",
  );

  if (!user) {
    throw new ApiError(401, "Access token references a user that no longer exists.");
  }

  req.user = user;
  next();
});
