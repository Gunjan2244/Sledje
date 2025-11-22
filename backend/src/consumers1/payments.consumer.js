import PaymentsRepo from "./payments.repository.js";
import { db } from "../../config/postgres.js";
import OrdersRepo from "../orders/orders.repository.js";
import { productVariants } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { publishEvent } from "../../events/jetstream.js";

export default {
  // list bills for logged-in retailer (or distributor)
  async listBills(user, filters = {}) {
    if (user.role === "retailer") {
      // retailerId is the retailer record id, not user id; resolve via OrdersRepo helper or query
      const retailer = await OrdersRepo.findRetailerByUserId(user.id);
      if (!retailer) throw new Error("Retailer not found");
      return PaymentsRepo.getBillsForRetailer(retailer.id, filters);
    }

    // for distributor, show bills for its distributors
    if (user.role === "distributor") {
      const dist = await OrdersRepo.findDistributorByUserId(user.id);
      if (!dist) throw new Error("Distributor not found");
      // simple query: all bills for this distributor
      // reuse repo but use db select directly
      return db.select().from(PaymentsRepo.productBills || "product_bills").where(eq("distributor_id", dist.id));
    }

    throw new Error("Unauthorized");
  },

  async getBill(user, billId) {
    const bill = await PaymentsRepo.getBillById(billId);
    if (!bill) throw new Error("Bill not found");

    // permission check: retailer or distributor must own the bill
    if (user.role === "retailer") {
      const retailer = await OrdersRepo.findRetailerByUserId(user.id);
      if (!retailer || bill.retailerId !== retailer.id) throw new Error("Forbidden");
    }
    if (user.role === "distributor") {
      const dist = await OrdersRepo.findDistributorByUserId(user.id);
      if (!dist || bill.distributorId !== dist.id) throw new Error("Forbidden");
    }

    // enrich with transactions
    const txs = await PaymentsRepo.listTransactionsForBill(bill.id);
    return { bill, transactions: txs };
  },

  async getTransactions(user, billId) {
    // same permission logic as getBill
    const bill = await PaymentsRepo.getBillById(billId);
    if (!bill) throw new Error("Bill not found");

    if (user.role === "retailer") {
      const retailer = await OrdersRepo.findRetailerByUserId(user.id);
      if (!retailer || bill.retailerId !== retailer.id) throw new Error("Forbidden");
    }
    if (user.role === "distributor") {
      const dist = await OrdersRepo.findDistributorByUserId(user.id);
      if (!dist || bill.distributorId !== dist.id) throw new Error("Forbidden");
    }

    return PaymentsRepo.listTransactionsForBill(bill.id);
  },

  // apply payment against a bill
  async payBill(user, billId, { amount, paymentMethod, note }) {
    // Only retailer should initiate payment for their bills
    if (user.role !== "retailer") throw new Error("Only retailers can make payments");

    const bill = await PaymentsRepo.getBillById(billId);
    if (!bill) throw new Error("Bill not found");

    // permission check
    const retailer = await OrdersRepo.findRetailerByUserId(user.id);
    if (!retailer || bill.retailerId !== retailer.id) throw new Error("Forbidden");

    // Create payment inside tx and write outbox
    const result = await db.transaction(async (tx) => {
      await PaymentsRepo.createPaymentTxAndUpdateBill(tx, {
        productBillId: bill.id,
        amount,
        metadata: { paymentMethod, note, paidByUserId: user.id }
      });

      // outbox event
      await PaymentsRepo.insertOutbox(tx, "product_bills.payment", { billId: bill.id, amount, paymentMethod, note });
    });

    // publish best-effort
    publishEvent("product_bills.payment", { billId: bill.id, amount, paymentMethod, note }).catch(e => console.warn("publish payment failed", e.message));

    return { success: true };
  }
};
