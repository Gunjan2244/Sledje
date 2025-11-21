

import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  listInvoices,
  getInvoice,
  getInvoicePDF,
} from "../controllers/invoices.controller.js";
import InvoiceService from "../../modules/invoices/invoices.service.js";
import { markInvoicePaid } from "../controllers/invoices.controller.js";
const router = express.Router();

/**
 * GET /api/invoices
 * Query: period=monthly|weekly|custom&start=&end=
 * Role: retailer OR distributor
 */
router.get("/", requireAuth, listInvoices);

/**
 * GET /api/invoices/:invoiceId
 */
router.get("/:invoiceId", requireAuth, getInvoice);

/**
 * POST /api/invoices/generate
 * Body: { periodType, start, end }
 * Only distributor may generate invoice for retailer
 */
router.post("/generate", requireAuth, InvoiceService.generateInvoice);

/**
 * GET /api/invoices/:invoiceId/pdf
 */
router.get("/:invoiceId/pdf", requireAuth, getInvoicePDF);

router.post("/:invoiceId/pay", requireAuth, markInvoicePaid);

export default router;