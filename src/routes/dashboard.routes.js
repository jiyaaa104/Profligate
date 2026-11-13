import { Router } from "express";
import {
  getDashboardSummary,
  getDashboardRunway,
  getDashboardCharts,
} from "../controllers/dashboard.controller.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

router.use(verifyJWT); // Protect the dashboard

router.route("/summary").get(getDashboardSummary);
router.route("/runway").get(getDashboardRunway);
router.route("/charts").get(getDashboardCharts);

export default router;
