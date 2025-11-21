// modules/payments/payments.service.js
import { db } from "../../config/postgres.js";
import PaymentsRepo from "./payments.repository.js";
import OrdersRepo from "../orders/orders.repository.js";
import {
  productBills,
  invoices,
  ledger,
  outbox,
} from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { publishEvent } from "../../events/jetstream.js";

const PaymentsService = {
  // -----------------------------
  // List bills for logged-in user
  // -----------------------------
  async listBills(user, filters = {}) {
    if (user.role === "retailer") {
      const retailer = await OrdersRepo.findRetailerByUserId(user.id);
      if (!retailer) throw new Error("Retailer not found");

      return PaymentsRepo.getBillsForRetailer(retailer.id, filters);
    }

    if (user.role === "distributor") {
      const dist = await OrdersRepo.findDistributorByUserId(user.id);
      if (!dist) throw new Error("Distributor not found");

      // bills where this distributor is creditor
      const rows = await db
        .select()
        .from(productBills)
        .where(eq(productBills.distributorId, dist.id));
      return rows;
    }

    throw new Error("Unauthorized");
  },

  // -----------------------------
  // Get a bill with transactions
  // -----------------------------
  async getBill(user, billId) {
    const bill = await PaymentsRepo.getBillById(billId);
    if (!bill) throw new Error("Bill not found");

    // permission checks
    if (user.role === "retailer") {
      const retailer = await OrdersRepo.findRetailerByUserId(user.id);
      if (!retailer || bill.retailerId !== retailer.id) {
        throw new Error("Forbidden");
      }
    } else if (user.role === "distributor") {
      const dist = await OrdersRepo.findDistributorByUserId(user.id);
      if (!dist || bill.distributorId !== dist.id) {
        throw new Error("Forbidden");
      }
    } else {
      throw new Error("Unauthorized");
    }

    const txs = await PaymentsRepo.listTransactionsForBill(bill.id);
    return { bill, transactions: txs };
  },

  async getTransactions(user, billId) {
    const result = await this.getBill(user, billId);
    return result.transactions;
  },

  // -----------------------------
  // Retailer pays a product bill
  // -----------------------------
  async payBill(user, billId, { amount, paymentMethod, note }) {
    if (user.role !== "retailer") {
      throw new Error("Only retailers can make payments");
    }

    const bill = await PaymentsRepo.getBillById(billId);
    if (!bill) throw new Error("Bill not found");

    const retailer = await OrdersRepo.findRetailerByUserId(user.id);
    if (!retailer || bill.retailerId !== retailer.id) {
      throw new Error("Forbidden");
    }

    const currentOutstanding = Number(bill.outstandingBalance || 0);
    const requested = Number(amount || 0);
    if (!requested || requested <= 0) {
      throw new Error("amount must be > 0");
    }

    const pay = Math.min(requested, currentOutstanding);
    if (pay <= 0) {
      throw new Error("Nothing to pay for this bill");
    }

    await db.transaction(async (tx) => {
      // 1) update bill + insert product_bill_transactions(payment)
      await PaymentsRepo.createPaymentTxAndUpdateBill(tx, {
        productBillId: bill.id,
        amount: pay,
        metadata: {
          paymentMethod,
          note,
          paidByUserId: user.id,
        },
      });

      const newOutstanding = currentOutstanding - pay;

      // 2) ledger entry — CREDIT from retailer to distributor
      await tx.insert(ledger).values({
        retailerId: bill.retailerId,
        distributorId: bill.distributorId,
        type: "credit",
        amount: String(pay),
        balance: String(newOutstanding),
        billId: bill.id,       // <-- link to product bill
        orderId: null,
      });

      // 3) outbox
      await tx.insert(outbox).values({
        eventType: "product_bill.paid",
        payload: {
          billId: bill.id,
          retailerId: bill.retailerId,
          distributorId: bill.distributorId,
          amount: pay,
          paymentMethod,
        },
      });
    });

    // NATS (best-effort)
    publishEvent("product_bill.paid", {
      billId: bill.id,
      retailerId: bill.retailerId,
      distributorId: bill.distributorId,
      amount: pay,
      paymentMethod,
    }).catch(() => {});

    return { success: true };
  },


  // -----------------------------
  // Gateway (Razorpay etc.) pays an INVOICE
  // -----------------------------
  async applyGatewayPayment({ invoiceId, amount, gatewayId, method }) {
    const amt = Number(amount || 0);
    if (!amt || amt <= 0) {
      throw new Error("amount must be > 0");
    }

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId));
    if (!invoice) throw new Error("Invoice not found");

    const currentTotal = Number(invoice.totalAmount || 0);
    const pay = Math.min(amt, currentTotal);
    const remaining = currentTotal - pay;
    const newStatus = remaining <= 0 ? "paid" : "partial";

    await db.transaction(async (tx) => {
      // 1) Update invoice totals + status
      await tx
        .update(invoices)
        .set({
          totalAmount: String(remaining),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId));

      // 2) Ledger entry: invoice payment
      await tx.insert(ledger).values({
        retailerId: invoice.retailerId,
        distributorId: invoice.distributorId,
        type: "credit",
        amount: String(pay),
        balance: String(remaining),
        referenceType: "invoice_payment",
        referenceId: invoiceId,
      });

      // 3) Outbox row
      await tx.insert(outbox).values({
        eventType: "invoice.paid",
        payload: {
          invoiceId,
          amount: pay,
          gatewayId,
          method,
          status: newStatus,
        },
      });
    });

    // best-effort publish to NATS
    try {
      await publishEvent("invoice.paid", { invoiceId, amount: pay });
    } catch (e) {
      console.warn("publish invoice.paid failed:", e.message);
    }

    return { success: true };
  },
};

export default PaymentsService;
