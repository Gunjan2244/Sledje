import { db } from "../../config/postgres.js";
import { notifications } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export default {
  async getNotifications(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const rows = await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(notifications.createdAt, "desc").limit(limit).offset(offset);
    return { data: rows, page, limit };
  },

  async getUnreadCount(userId) {
    const rows = await db.select().from(notifications).where(eq(notifications.userId, userId)).and(eq(notifications.read, false));
    return rows.length;
  },

  async markAsRead(userId, id) {
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId)).and(eq(notifications.id, id));
  },

  async markAllRead(userId) {
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
  }
};
