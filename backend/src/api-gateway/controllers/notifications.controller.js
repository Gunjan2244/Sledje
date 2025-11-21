
import { db } from "../../config/postgres.js";
import { notifications, retailers, distributors } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import NotificationsService from "../../modules/notifications/notifications.service.js";

export async function getNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const data = await NotificationsService.getNotifications(userId, page, limit);
    res.json(data);
  } catch (err) { next(err); }
}

export async function getUnreadCount(req, res, next) {
  try {
    const userId = req.user.id;
    const count = await NotificationsService.getUnreadCount(userId);
    res.json({ unread: count });
  } catch (err) { next(err); }
}

export async function markAsRead(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    await NotificationsService.markAsRead(userId, id);
    res.json({ message: "Marked as read" });
  } catch (err) { next(err); }
}

export async function markAllRead(req, res, next) {
  try {
    const userId = req.user.id;
    await NotificationsService.markAllRead(userId);
    res.json({ message: "All notifications marked as read" });
  } catch (err) { next(err); }
}
