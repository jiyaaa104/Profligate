import { Router } from "express";

import {
  createTransaction,
  getTransactions,
  deleteTransaction,
} from "../controllers/transaction.controller.js";

import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

// All transaction routes require authentication
router.use(verifyJWT);

// Create a new transaction
router.route("/").post(createTransaction);

// Get all transactions (supports pagination and filters)
router.route("/").get(getTransactions);

// Delete a transaction by ID
router.route("/:id").delete(deleteTransaction);

export default router;
