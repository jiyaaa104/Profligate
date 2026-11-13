import { Router } from "express";
import {
  getFixedCosts,
  createFixedCost,
  updateFixedCost,
  deleteFixedCost,
  payFixedCost,
} from "../controllers/fixedCost.controller.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

router.use(verifyJWT);

router.route("/").get(getFixedCosts).post(createFixedCost);
router.route("/:id").patch(updateFixedCost).delete(deleteFixedCost);
router.route("/:id/pay").post(payFixedCost);

export default router;
