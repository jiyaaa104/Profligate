import { Router } from "express";
import { getAIInsights } from "../controllers/ai.controller.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

router.use(verifyJWT);
router.route("/insights").get(getAIInsights);

export default router;
