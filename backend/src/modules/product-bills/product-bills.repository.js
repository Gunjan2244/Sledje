// src/modules/product-bills/product-bills.repository.js
import { db } from "../../config/postgres.js";
import {
  productBills,
  productBillTransactions,
  productDeliveryLog,
  outbox,
} from "../../db/schema.js";
import { and, eq } from "drizzle-orm";

const ProductBillsRepo = {
  async findBillByVariant(retailerId, distributorId, variantId) {
    const [row] = await db
      .select()
      .from(productBills)
      .where(
        and(
          eq(productBills.retailerId, retailerId),
          eq(productBills.distributorId, distributorId),
          eq(productBills.variantId, variantId)
        )
      );

    return row || null;
  },

  async createBill({ retailerId, distributorId, variantId, unitCost }) {
    const [row] = await db
      .insert(productBills)
      .values({
        retailerId,
        distributorId,
        variantId,
        currentUnitCost: unitCost,
        outstandingBalance: "0",
        totalAmountPaid: "0",
        totalAmountDue: "0",
        totalQuantityDelivered: 0,
      })
      .returning();

    return row;
  },

  /**
   * Used by inventory/order consumer
   * - increments quantity delivered
   * - increments totalAmountDue and outstandingBalance
   * - writes productBillTransactions row
   * - writes productDeliveryLog row
   */
  async upsertDeliveryAndTransaction(tx, { productBillId, orderId, variantId, qty, unitCost }) {
    const amount = Number(qty) * Number(unitCost || 0);

    // Update bill totals (using raw SQL for arithmetic)
    await tx.execute(`
      UPDATE product_bills SET
        total_quantity_delivered = total_quantity_delivered + ${qty},
        total_amount_due = (total_amount_due::numeric + ${amount})::numeric,
        outstanding_balance = (outstanding_balance::numeric + ${amount})::numeric,
        current_unit_cost = ${unitCost},
        updated_at = now()
      WHERE id = '${productBillId}'
    `);

    // Insert transaction row
    await tx.insert(productBillTransactions).values({
      productBillId,
      date: new Date(),
      quantity: qty,
      unitPrice: unitCost,
      amount,
      type: "delivery",
      metadata: { orderId },
    });

    // Delivery log (for debugging / reconciliation)
    await tx.insert(productDeliveryLog).values({
      orderId,
      productBillId,
      variantId,
      quantityDelivered: qty,
      unitCost,
    });
  },

  /**
   * Payment against bill
   */
  async createPaymentTxAndUpdateBill(tx, { productBillId, amount, metadata }) {
    await tx.insert(productBillTransactions).values({
      productBillId,
      date: new Date(),
      quantity: 0,
      unitPrice: 0,
      amount,
      type: "payment",
      metadata,
    });

    await tx.execute(`
      UPDATE product_bills SET
        total_amount_paid = (total_amount_paid::numeric + ${amount})::numeric,
        outstanding_balance = (outstanding_balance::numeric - ${amount})::numeric,
        updated_at = now()
      WHERE id = '${productBillId}'
    `);
  },

  async getBillsForRetailer(retailerId, { variantId, distributorId, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    let conditions = [eq(productBills.retailerId, retailerId)];
    if (variantId) conditions.push(eq(productBills.variantId, variantId));
    if (distributorId) conditions.push(eq(productBills.distributorId, distributorId));

    const rows = await db
      .select()
      .from(productBills)
      .where(and(...conditions))
      .orderBy(productBills.updatedAt)
      .limit(limit)
      .offset(offset);

    return rows;
  },

  async getBillsForDistributor(distributorId, { retailerId, variantId, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    let conditions = [eq(productBills.distributorId, distributorId)];
    if (retailerId) conditions.push(eq(productBills.retailerId, retailerId));
    if (variantId) conditions.push(eq(productBills.variantId, variantId));

    const rows = await db
      .select()
      .from(productBills)
      .where(and(...conditions))
      .orderBy(productBills.updatedAt)
      .limit(limit)
      .offset(offset);

    return rows;
  },

  async getBillById(billId) {
    const [row] = await db
      .select()
      .from(productBills)
      .where(eq(productBills.id, billId));

    return row || null;
  },

  async listTransactionsForBill(productBillId) {
    const rows = await db
      .select()
      .from(productBillTransactions)
      .where(eq(productBillTransactions.productBillId, productBillId))
      .orderBy(productBillTransactions.date);

    return rows;
  },

  async insertOutbox(tx, eventType, payload) {
    await tx.insert(outbox).values({
      eventType,
      payload,
    });
  },
};

export default ProductBillsRepo;
