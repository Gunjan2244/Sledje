import { BaseModel } from "./base.js";
export class Notification extends BaseModel {
  constructor() {
    super('notifications');
  }

  async createNotification(data) {
    const query = `
      INSERT INTO notifications (recipient_id, recipient_type, type, order_id, message, data)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await this.query(query, [
      data.recipient_id,
      data.recipient_type,
      data.type,
      data.order_id,
      data.message,
      JSON.stringify(data.data || {})
    ]);
    return result.rows[0];
  }

  async getUserNotifications(userId, options = {}) {
    let query = `
      SELECT n.*, o.order_number
      FROM notifications n
      LEFT JOIN orders o ON n.order_id = o.id
      WHERE n.recipient_id = $1
    `;

    const params = [userId];

    if (options.read !== undefined) {
      query += ` AND n.read = ${params.length + 1}`;
      params.push(options.read);
    }

    query += ` ORDER BY n.created_at DESC`;

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    const result = await this.query(query, params);
    return result.rows;
  }

  async markAsRead(notificationId, userId) {
    const query = `
      UPDATE notifications 
      SET read = true, read_at = NOW()
      WHERE id = $1 AND recipient_id = $2
      RETURNING *
    `;
    const result = await this.query(query, [notificationId, userId]);
    return result.rows[0];
  }

  async getUnreadCount(userId) {
    const query = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE recipient_id = $1 AND read = false
    `;
    const result = await this.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }
}