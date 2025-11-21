import OrdersRepo from "./orders.repository.js";
import { db } from "../../config/postgres.js";
import { v4 as uuidv4 } from "uuid";
import {
  publishOrderCreated,
  publishOrderModified,
  publishOrderCancelled,
  publishOrderAccepted,
  publishOrderStatusUpdated,
  publishOrderCompleted
} from "./orders.events.js";

import { productVariants, inventory } from "../../db/schema.js";
import { eq } from "drizzle-orm";

/**
 * Business logic:
 * - createOrder: validate distributor ownership, compute totals, write order + items inside tx and outbox.
 * - modifyOrder: allowed when status pending; updates items and status -> modified
 * - cancelOrder: allowed by retailer before processing
 * - completeOrder: retailer confirms delivery with code
 * - approveModifiedOrder: retailer approves or rejects modifications
 * - distributor flows: get orders, accept/reject/modify (processDistributorOrder)
 *
 * NOTE: All writes that must produce events insert a row into outbox inside the same transaction.
 */

function computeTotals(items) {
  // items: [{ variantId, quantity, unit }]
  // we expect calling code to fetch variant sellingPrice
  let total = 0;
  const computed = items.map((it) => {
    const price = Number(it.sellingPrice || 0);
    const qty = Number(it.quantity || 0);
    const line = price * qty;
    total += line;
    return { ...it, lineAmount: line };
  });
  return { total, items: computed };
}

export default {
  async createOrder(user, payload) {
    // user is { id, role }
    if (user.role !== "retailer") throw new Error("Only retailers can create orders");

    // find retailer row
    const retailer = await OrdersRepo.findRetailerByUserId(user.id);
    if (!retailer) throw new Error("Retailer not found");

    // validate distributorId in payload
    const distributorId = payload.distributorId;
    if (!distributorId) throw new Error("distributorId required");

    // Resolve each variant price by querying productVariants
    const variantIds = (payload.items || []).map(i => i.variantId);
    if (!variantIds.length) throw new Error("No items provided");

    const variants = await db.select().from(productVariants).where(productVariants.id.in(variantIds));
    // map variants by id
    const variantMap = Object.fromEntries(variants.map(v => [v.id, v]));

    // enrich incoming items with price, name
    const enriched = payload.items.map(it => {
      const v = variantMap[it.variantId];
      if (!v) throw new Error(`Variant not found: ${it.variantId}`);
      return {
        variantId: it.variantId,
        productId: v.productId,
        sku: v.sku,
        productName: null,
        variantName: v.name,
        quantity: Number(it.quantity || 0),
        unit: it.unit || v.unit,
        sellingPrice: Number(it.sellingPrice ?? v.sellingPrice),
      };
    });

    const { total, items: computedItems } = computeTotals(enriched);

    // Build order payload
    const orderNumber = `ORD-${Date.now()}`; // simple; replace with better generator if needed
    const orderRow = {
      orderNumber,
      retailerId: retailer.id,
      distributorId,
      status: "pending",
      totalAmount: total,
      notes: payload.notes || null,
      expectedDelivery: payload.expectedDelivery || null
    };

    // Start transaction: insert order, items, and outbox
    const result = await db.transaction(async (tx) => {
      const createdOrder = await OrdersRepo.createOrderRow(tx, orderRow);

      // prepare order items array for insertion
      const itemsToInsert = computedItems.map(it => ({
        orderId: createdOrder.id,
        variantId: it.variantId,
        productName: it.productName,
        variantName: it.variantName,
        sku: it.sku,
        quantity: it.quantity,
        unit: it.unit,
        variantSellingPrice: it.sellingPrice
      }));

      const insertedItems = await OrdersRepo.insertOrderItems(tx, itemsToInsert);

      // write outbox entry for guaranteed publish
      await OrdersRepo.insertOutbox(tx, "orders.created", {
        order: createdOrder,
        items: insertedItems
      });

      return { order: createdOrder, items: insertedItems };
    });

    // try immediate publish (best-effort)
    publishOrderCreated({ order: result.order, items: result.items }).catch((e) => console.warn("publishOrderCreated failed", e.message));

    return { ...result.order, items: result.items };
  },

  async getRetailerOrders(user) {
    if (user.role !== "retailer") throw new Error("Only retailers allowed");
    const retailer = await OrdersRepo.findRetailerByUserId(user.id);
    if (!retailer) throw new Error("Retailer not found");
    const rows = await OrdersRepo.findOrdersByRetailerId(retailer.id);
    // Optionally join items
    const results = [];
    for (const r of rows) {
      const items = await OrdersRepo.getOrderItems(r.id);
      results.push({ ...r, items });
    }
    return results;
  },

  async getRetailerOrder(user, orderId) {
    if (user.role !== "retailer") throw new Error("Only retailers allowed");
    const retailer = await OrdersRepo.findRetailerByUserId(user.id);
    const order = await OrdersRepo.findOrderWithItems(orderId);
    if (!order) throw new Error("Order not found");
    if (order.retailerId !== retailer.id) throw new Error("Not owner of order");
    return order;
  },

  async modifyOrder(user, orderId, payload) {
    // allowed if status === 'pending'
    if (user.role !== "retailer") throw new Error("Only retailers allowed");
    const retailer = await OrdersRepo.findRetailerByUserId(user.id);
    const order = await OrdersRepo.findOrderWithItems(orderId);
    if (!order) throw new Error("Order not found");
    if (order.retailerId !== retailer.id) throw new Error("Not owner");

    if (order.status !== "pending") throw new Error("Order not modifiable");

    // compute new items & totals (similar to create)
    const variantIds = (payload.items || []).map(i => i.variantId);
    const variants = await db.select().from(productVariants).where(productVariants.id.in(variantIds));
    const variantMap = Object.fromEntries(variants.map(v=>[v.id, v]));

    const enriched = payload.items.map(it => {
      const v = variantMap[it.variantId];
      if (!v) throw new Error(`Variant not found: ${it.variantId}`);
      return {
        variantId: it.variantId,
        productId: v.productId,
        sku: v.sku,
        variantName: v.name,
        quantity: Number(it.quantity || 0),
        unit: it.unit || v.unit,
        sellingPrice: Number(it.sellingPrice ?? v.sellingPrice),
      };
    });

    const { total, items: computedItems } = computeTotals(enriched);

    const result = await db.transaction(async (tx) => {
      // update order: status -> modified, totalAmount
      const updatedOrder = await OrdersRepo.updateOrder(tx, orderId, { status: "modified", totalAmount: total, notes: payload.notes || order.notes });

      // delete existing items and insert new
      await OrdersRepo.deleteOrderItemsByOrderId(tx, orderId);
      const itemsToInsert = computedItems.map(it => ({
        orderId,
        variantId: it.variantId,
        productName: it.productName,
        variantName: it.variantName,
        sku: it.sku,
        quantity: it.quantity,
        unit: it.unit,
        variantSellingPrice: it.sellingPrice
      }));
      const inserted = await OrdersRepo.insertOrderItems(tx, itemsToInsert);

      // outbox entry
      await OrdersRepo.insertOutbox(tx, "orders.modified", { order: updatedOrder, items: inserted });

      return { order: updatedOrder, items: inserted };
    });

    publishOrderModified({ order: result.order, items: result.items }).catch(e => console.warn("publishOrderModified failed", e.message));
    return result;
  },

  async cancelOrder(user, orderId, reason) {
    if (user.role !== "retailer") throw new Error("Only retailers allowed");
    const retailer = await OrdersRepo.findRetailerByUserId(user.id);
    const order = await OrdersRepo.findOrderById(orderId);
    if (!order) throw new Error("Order not found");
    if (order.retailerId !== retailer.id) throw new Error("Not owner");

    // allowed if pending/modified
    if (!["pending", "modified"].includes(order.status)) throw new Error("Cannot cancel at this stage");

    const result = await db.transaction(async (tx) => {
      const updated = await OrdersRepo.updateOrder(tx, orderId, { status: "cancelled", notes: `${order.notes || ""}\nCANCEL_REASON:${reason || ""}` });
      await OrdersRepo.insertOutbox(tx, "orders.cancelled", { order: updated });
      return updated;
    });

    publishOrderCancelled({ order: result }).catch(e => console.warn("publishOrderCancelled failed", e.message));
    return result;
  },

  async completeOrder(user, orderId, code) {
    // Retailer confirms delivery via code (simple check placeholder)
    if (user.role !== "retailer") throw new Error("Only retailers allowed");
    const retailer = await OrdersRepo.findRetailerByUserId(user.id);
    const order = await OrdersRepo.findOrderById(orderId);
    if (!order) throw new Error("Order not found");
    if (order.retailerId !== retailer.id) throw new Error("Not owner");
    if (order.status !== "processing") throw new Error("Order not in processing state");

    // You should validate the 'code' matches distributor's delivery code if applicable.
    // For now, assume code matches.

    const result = await db.transaction(async (tx) => {
      const updated = await OrdersRepo.updateOrder(tx, orderId, { status: "completed" });
      await OrdersRepo.insertOutbox(tx, "orders.completed", { order: updated });
      return updated;
    });

    publishOrderCompleted({ order: result }).catch(e => console.warn("publishOrderCompleted failed", e.message));
    return result;
  },

  async approveModifiedOrder(user, orderId, approved) {
    // retailer approves or rejects modifications proposed by distributor
    if (user.role !== "retailer") throw new Error("Only retailers allowed");
    const retailer = await OrdersRepo.findRetailerByUserId(user.id);
    const order = await OrdersRepo.findOrderById(orderId);
    if (!order) throw new Error("Order not found");
    if (order.retailerId !== retailer.id) throw new Error("Not owner");
    if (order.status !== "modified") throw new Error("Order is not in modified state");

    const status = approved ? "processing" : "cancelled"; // or 'pending' depending on your flow
    const updated = await db.transaction(async (tx) => {
      const u = await OrdersRepo.updateOrder(tx, orderId, { status });
      await OrdersRepo.insertOutbox(tx, "orders.modified.approval", { order: u, approved });
      return u;
    });

    publishOrderModified({ order: updated }).catch(e => console.warn("publishOrderModified failed", e.message));
    return updated;
  },

  /* Distributor flows */

  async getDistributorOrders(user) {
    if (user.role !== "distributor") throw new Error("Only distributors allowed");
    const dist = await OrdersRepo.findDistributorByUserId(user.id);
    const rows = await OrdersRepo.findOrdersByDistributorId(dist.id);
    const results = [];
    for (const r of rows) {
      const items = await OrdersRepo.getOrderItems(r.id);
      results.push({ ...r, items });
    }
    return results;
  },

  async getDistributorOrder(user, orderId) {
    if (user.role !== "distributor") throw new Error("Only distributors allowed");
    const dist = await OrdersRepo.findDistributorByUserId(user.id);
    const order = await OrdersRepo.findOrderWithItems(orderId);
    if (!order) throw new Error("Order not found");
    if (order.distributorId !== dist.id) throw new Error("Not owner");
    return order;
  },

  async processDistributorOrder(user, orderId, payload) {
    // payload.action = accept/reject/modify
    if (user.role !== "distributor") throw new Error("Only distributors allowed");
    const dist = await OrdersRepo.findDistributorByUserId(user.id);
    const order = await OrdersRepo.findOrderWithItems(orderId);
    if (!order) throw new Error("Order not found");
    if (order.distributorId !== dist.id) throw new Error("Not owner");

    if (payload.action === "accept") {
      // set status to processing
      const result = await db.transaction(async (tx) => {
        const updated = await OrdersRepo.updateOrder(tx, orderId, { status: "processing" });
        await OrdersRepo.insertOutbox(tx, "orders.accepted", { order: updated });
        return updated;
      });
      publishOrderAccepted({ order: result }).catch(e => console.warn("publishOrderAccepted failed", e.message));
      return result;
    }

    if (payload.action === "reject") {
      const result = await db.transaction(async (tx) => {
        const updated = await OrdersRepo.updateOrder(tx, orderId, { status: "cancelled", notes: payload.rejectionReason || null });
        await OrdersRepo.insertOutbox(tx, "orders.rejected", { order: updated });
        return updated;
      });
      publishOrderCancelled({ order: result }).catch(e => console.warn("publishOrderCancelled failed", e.message));
      return result;
    }

    if (payload.action === "modify") {
      // Distributor suggests modifications: modify items but keep status 'modified' then retailer must approve
      // Validate modifications
      const variants = payload.modifications?.items || [];
      if (!variants.length) throw new Error("No modifications provided");

      const variantIds = variants.map(i => i.variantId);
      const dbVariants = await db.select().from(productVariants).where(productVariants.id.in(variantIds));
      const map = Object.fromEntries(dbVariants.map(v => [v.id, v]));

      const enriched = variants.map(it => {
        const v = map[it.variantId];
        if (!v) throw new Error(`Variant not found: ${it.variantId}`);
        return {
          variantId: it.variantId,
          sku: v.sku,
          variantName: v.name,
          quantity: Number(it.newQuantity || it.quantity || 0),
          unit: it.unit || v.unit,
          sellingPrice: Number(it.sellingPrice ?? v.sellingPrice)
        };
      });

      const { total, items: computedItems } = computeTotals(enriched);

      const result = await db.transaction(async (tx) => {
        // update order to modified status and replace items
        const updatedOrder = await OrdersRepo.updateOrder(tx, orderId, { status: "modified", totalAmount: total, notes: payload.modifications?.notes || order.notes });
        await OrdersRepo.deleteOrderItemsByOrderId(tx, orderId);

        const itemsToInsert = computedItems.map(it => ({
          orderId,
          variantId: it.variantId,
          productName: null,
          variantName: it.variantName,
          sku: it.sku,
          quantity: it.quantity,
          unit: it.unit,
          variantSellingPrice: it.sellingPrice
        }));

        const inserted = await OrdersRepo.insertOrderItems(tx, itemsToInsert);

        await OrdersRepo.insertOutbox(tx, "orders.modified.by_distributor", { order: updatedOrder, items: inserted });

        return { order: updatedOrder, items: inserted };
      });

      publishOrderModified({ order: result.order, items: result.items }).catch(e => console.warn("publishOrderModified failed", e.message));
      return result;
    }

    throw new Error("Invalid action");
  },

  async updateOrderStatus(user, orderId, status) {
    // only distributor may update status to things like 'sent', 'delivered' depending on your allowed statuses
    if (user.role !== "distributor") throw new Error("Only distributors allowed");
    const dist = await OrdersRepo.findDistributorByUserId(user.id);
    const order = await OrdersRepo.findOrderById(orderId);
    if (!order) throw new Error("Order not found");
    if (order.distributorId !== dist.id) throw new Error("Not owner");

    const allowed = ["processing", "sent", "delivered", "completed", "cancelled"];
    if (!allowed.includes(status)) throw new Error("Invalid status");

    const updated = await db.transaction(async (tx) => {
      const u = await OrdersRepo.updateOrder(tx, orderId, { status });
      await OrdersRepo.insertOutbox(tx, "orders.status.updated", { order: u });
      return u;
    });

    publishOrderStatusUpdated({ order: updated }).catch(e => console.warn("publishOrderStatusUpdated failed", e.message));
    return updated;
  }
};
