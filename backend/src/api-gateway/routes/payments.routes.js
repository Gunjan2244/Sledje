import express from "express";
import {
  getProductBills,
  getProductBill,
  postPayment,
  getBillTransactions
} from "../controllers/payments.controller.js";

import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

// list bills for logged-in retailer (or distributor with role query)
router.get("/", requireAuth, getProductBills);
router.get("/:billId", requireAuth, getProductBill);

// payment against a bill
router.post("/:billId/pay", requireAuth, postPayment);

// transaction history
router.get("/:billId/transactions", requireAuth, getBillTransactions);

export default router;
