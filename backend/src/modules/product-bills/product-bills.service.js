// src/modules/product-bills/product-bills.service.js
import { db } from "../../config/postgres.js";
import ProductBillsRepo from "./product-bills.repository.js";
import OrdersRepo from "../orders/orders.repository.js";
import { publishEvent } from "../../events/jetstream.js"; // or ../config/nats-streams.js

const ProductBillsService = {
  /**
   * List bills for logged-in user:
   * - retailer: their own bills
   * - distributor: bills where they are the distributor
   */
  async listBills(user, filters = {}) {
    if (user.role === "retailer") {
      const retailer = await OrdersRepo.findRetailerByUserId(user.id);
      if (!retailer) throw new Error("Retailer not found");

      return ProductBillsRepo.getBillsForRetailer(retailer.id, filters);
    }

    if (user.role === "distributor") {
      const dist = await OrdersRepo.findDistributorByUserId(user.id);
      if (!dist) throw new Error("Distributor not found");

      return ProductBillsRepo.getBillsForDistributor(dist.id, filters);
    }

    throw new Error("Unauthorized");
  },

  async getBill(user, billId) {
    const bill = await ProductBillsRepo.getBillById(billId);
    if (!bill) throw new Error("Bill not found");

    // permission check
    if (user.role === "retailer") {
      const retailer = await OrdersRepo.findRetailerByUserId(user.id);
      if (!retailer || bill.retailerId !== retailer.id) {
        throw new Error("Forbidden");
      }
    }

    if (user.role === "distributor") {
      const dist = await OrdersRepo.findDistributorByUserId(user.id);
      if (!dist || bill.distributorId !== dist.id) {
        throw new Error("Forbidden");
      }
    }

    const txs = await ProductBillsRepo.listTransactionsForBill(bill.id);
    return { bill, transactions: txs };
  },

  async getTransactions(user, billId) {
    const bill = await ProductBillsRepo.getBillById(billId);
    if (!bill) throw new Error("Bill not found");

    if (user.role === "retailer") {
      const retailer = await OrdersRepo.findRetailerByUserId(user.id);
      if (!retailer || bill.retailerId !== retailer.id) throw new Error("Forbidden");
    }
    if (user.role === "distributor") {
      const dist = await OrdersRepo.findDistributorByUserId(user.id);
      if (!dist || bill.distributorId !== dist.id) throw new Error("Forbidden");
    }

    return ProductBillsRepo.listTransactionsForBill(bill.id);
  },

  /**
   * Retailer pays against a specific bill
   */
  async payBill(user, billId, { amount, paymentMethod, note }) {
    if (user.role !== "retailer") throw new Error("Only retailers can make payments");

    const bill = await ProductBillsRepo.getBillById(billId);
    if (!bill) throw new Error("Bill not found");

    const retailer = await OrdersRepo.findRetailerByUserId(user.id);
    if (!retailer || bill.retailerId !== retailer.id) {
      throw new Error("Forbidden");
    }

    await db.transaction(async (tx) => {
      await ProductBillsRepo.createPaymentTxAndUpdateBill(tx, {
        productBillId: bill.id,
        amount,
        metadata: {
          paymentMethod,
          note,
          paidByUserId: user.id,
        },
      });

      await ProductBillsRepo.insertOutbox(tx, "product_bills.payment", {
        billId: bill.id,
        amount,
        paymentMethod,
        note,
        retailerId: bill.retailerId,
        distributorId: bill.distributorId,
      });
    });

    // best-effort publish now (outbox consumer is the reliable one)
    publishEvent("product_bills.payment", {
      billId: bill.id,
      amount,
      paymentMethod,
      note,
      retailerId: bill.retailerId,
      distributorId: bill.distributorId,
    }).catch((e) => console.warn("publish product_bills.payment failed:", e.message));

    return { success: true };
  },
};

export default ProductBillsService;
