import express from "express";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead
} from "../controllers/notifications.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", requireAuth, getNotifications); // ?page & ?limit
router.get("/unread-count", requireAuth, getUnreadCount);
router.put("/:id/read", requireAuth, markAsRead);
router.put("/mark-all-read", requireAuth, markAllRead);

export default router;
