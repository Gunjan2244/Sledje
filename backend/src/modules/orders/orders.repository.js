import { db } from "../../config/postgres.js";
import {
  orders,
  orderItems,
  productVariants,
  products,
  retailers,
  distributors,
  users,
  outbox
} from "../../db/schema.js";
import { eq, and } from "drizzle-orm";

/**
 * Repository contains low-level DB operations. Services orchestrate transactions and business rules.
 */

export default {
  async createOrderRow(tx, orderPayload) {
    // tx is a transaction object from drizzle
    const [row] = await tx.insert(orders).values(orderPayload).returning();
    return row;
  },

  async insertOrderItems(tx, items) {
    if (!items.length) return [];
    const rows = await tx.insert(orderItems).values(items).returning();
    return rows;
  },

  async findOrderById(orderId) {
    const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
    return row || null;
  },

  async findOrderWithItems(orderId) {
    const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!o) return null;
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    return { ...o, items };
  },

  async findOrdersByRetailerId(retailerId) {
    const rows = await db.select().from(orders).where(eq(orders.retailerId, retailerId)).orderBy(orders.createdAt, "desc");
    return rows;
  },

  async findOrdersByDistributorId(distributorId) {
    const rows = await db.select().from(orders).where(eq(orders.distributorId, distributorId)).orderBy(orders.createdAt, "desc");
    return rows;
  },

  async updateOrder(txOrDb, orderId, patch) {
    // txOrDb can be tx or db
    const [row] = await txOrDb.update(orders).set(patch).where(eq(orders.id, orderId)).returning();
    return row;
  },

  async updateOrderItem(txOrDb, itemId, patch) {
    const [row] = await txOrDb.update(orderItems).set(patch).where(eq(orderItems.id, itemId)).returning();
    return row;
  },

  async deleteOrderItemsByOrderId(txOrDb, orderId) {
    await txOrDb.delete(orderItems).where(eq(orderItems.orderId, orderId));
  },

  async insertOutbox(tx, eventType, payload) {
    await tx.insert(outbox).values({
      eventType,
      payload
    });
  },

  // helper lookups
  async findRetailerByUserId(userId) {
    const [r] = await db.select().from(retailers).where(eq(retailers.userId, userId));
    return r || null;
  },

  async findDistributorByUserId(userId) {
    const [d] = await db.select().from(distributors).where(eq(distributors.userId, userId));
    return d || null;
  },

  async getOrderItems(orderId) {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }
};
