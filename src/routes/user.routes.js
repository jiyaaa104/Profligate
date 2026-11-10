import { Router } from "express";
import {
  getCurrentUser,
  updateAccountDetails,
} from "../controllers/user.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

router.use(verifyJWT);

router.route("/me").get(getCurrentUser).patch(updateAccountDetails);

export default router;
