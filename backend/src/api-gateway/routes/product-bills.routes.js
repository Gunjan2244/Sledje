import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  listBillsController,
  getBillController,
  getBillTransactionsController,
  payBillController,
} from "../controllers/product-bills.controller.js";

const router = express.Router();

router.get("/", requireAuth, listBillsController);
router.get("/:billId", requireAuth, getBillController);
router.get("/:billId/transactions", requireAuth, getBillTransactionsController);
router.post("/:billId/pay", requireAuth, payBillController);

export default router;
