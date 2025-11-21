import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  getLedger,
  getLedgerForBill,
  getLedgerForVariant,
  getLedgerForInvoice,
  getFullStatement,
} from "../controllers/ledger.controller.js";

const router = express.Router();

// GET /api/ledger
router.get("/", requireAuth, getLedger);

// GET /api/ledger/bill/:billId
router.get("/bill/:billId", requireAuth, getLedgerForBill);

// GET /api/ledger/variant/:variantId
router.get("/variant/:variantId", requireAuth, getLedgerForVariant);

// GET /api/ledger/invoice/:invoiceId
router.get("/invoice/:invoiceId", requireAuth, getLedgerForInvoice);

// GET /api/ledger/statement (full combined statement)
router.get("/statement/full", requireAuth, getFullStatement);

export default router;
