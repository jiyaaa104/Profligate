import { Router } from "express";
import {
  getMyNotifications,
  markAsRead,
} from "../controllers/notification.controller.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

// Get logged-in user's notifications
router.get("/", verifyJWT, getMyNotifications);

// Mark all unread notifications as read
router.patch("/read", verifyJWT, markAsRead);

export default router;
