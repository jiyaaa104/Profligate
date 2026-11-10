import { Router } from "express";
import {
  createBudget,
  getBudgets,
  updateBudget,
  deleteBudget,
} from "../controllers/budget.controller.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

// All budget routes require an authenticated user
router.use(verifyJWT);

// Create budget & fetch budgets for current month
router.route("/").post(createBudget).get(getBudgets);

// Update & delete budget by ID
router.route("/:id").patch(updateBudget).delete(deleteBudget);

export default router;
