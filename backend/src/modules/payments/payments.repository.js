import { db } from "../../config/postgres.js";
import {
  productBills,
  productBillTransactions,
  productDeliveryLog,
  productVariants,
  productDeliveryLog as deliveryLog,
  outbox
} from "../../db/schema.js";
import { eq } from "drizzle-orm";

export default {
  async findBillByVariant(retailerId, distributorId, variantId) {
    const [row] = await db.select().from(productBills)
      .where(
        eq(productBills.retailerId, retailerId)
      ).and(eq(productBills.distributorId, distributorId))
      .and(eq(productBills.variantId, variantId));
    return row || null;
  },

  async createBill({ retailerId, distributorId, variantId, unitCost }) {
    const [row] = await db.insert(productBills).values({
      retailerId,
      distributorId,
      variantId,
      currentUnitCost: unitCost,
      outstandingBalance: "0",
      totalAmountPaid: "0",
      totalAmountDue: "0",
      totalQuantityDelivered: 0
    }).returning();
    return row;
  },

  async upsertDeliveryAndTransaction(tx, { productBillId, orderId, variantId, qty, unitCost }) {
    // update productBills totals
    // increase totalQuantityDelivered, totalAmountDue and outstandingBalance
    const amount = Number(qty) * Number(unitCost || 0);

    // increment numeric fields carefully using SQL arithmetic for safety
    await tx.execute(`UPDATE product_bills SET
      total_quantity_delivered = total_quantity_delivered + ${qty},
      total_amount_due = (total_amount_due::numeric + ${amount})::numeric,
      outstanding_balance = (outstanding_balance::numeric + ${amount})::numeric,
      current_unit_cost = ${unitCost},
      updated_at = now()
      WHERE id = ${productBillId}
    `);

    // insert transaction row
    await tx.insert(productBillTransactions).values({
      productBillId,
      date: new Date(),
      quantity: qty,
      unitPrice: unitCost,
      amount,
      type: "delivery",
      metadata: { orderId }
    });

    // insert delivery log
    await tx.insert(productDeliveryLog).values({
      orderId,
      productBillId,
      variantId,
      quantityDelivered: qty,
      unitCost
    });
  },

  async createPaymentTxAndUpdateBill(tx, { productBillId, amount, metadata }) {
    // insert payment transaction and decrement outstandingBalance and increment totalAmountPaid
    await tx.insert(productBillTransactions).values({
      productBillId,
      date: new Date(),
      quantity: 0,
      unitPrice: 0,
      amount,
      type: "payment",
      metadata
    });

    await tx.execute(`UPDATE product_bills SET
      total_amount_paid = (total_amount_paid::numeric + ${amount})::numeric,
      outstanding_balance = (outstanding_balance::numeric - ${amount})::numeric,
      updated_at = now()
      WHERE id = ${productBillId}
    `);
  },
// in modules/payments/payments.repository.js
async getBillsForRetailer(
  retailerId,
  { variantId, distributorId, page = 1, limit = 20 } = {}
) {
  const offset = (page - 1) * limit;
  let q = db
    .select()
    .from(productBills)
    .where(eq(productBills.retailerId, retailerId));

  if (variantId) q = q.where(eq(productBills.variantId, variantId));
  if (distributorId) q = q.where(eq(productBills.distributorId, distributorId));

  q = q
    .orderBy(productBills.updatedAt, "desc")
    .limit(limit)
    .offset(offset);

  const rows = await q;
  return rows;
}

};
