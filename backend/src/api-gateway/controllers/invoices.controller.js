import InvoiceService from "../../modules/invoices/invoices.service.js";

// Distributor creates invoice for retailer
export async function createInvoice(req, res, next) {
  try {
    const { retailerId, periodStart, periodEnd, periodType } = req.body;

    // user context added — distributor only
    const invoice = await InvoiceService.generateInvoice(req.user, {
      retailerId,
      start: periodStart,
      end: periodEnd,
      periodType,
    });

    res.json({ success: true, invoice });
  } catch (err) {
    next(err);
  }
}

// GET a specific invoice
export async function getInvoice(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const data = await InvoiceService.getInvoice(req.user, invoiceId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET all invoices (retailer or distributor)
export async function listInvoices(req, res, next) {
  try {
    const data = await InvoiceService.listInvoices(req.user, req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Generate and download PDF
export async function getInvoicePDF(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const filePath = await InvoiceService.getInvoicePDF(req.user, invoiceId);
    res.download(filePath);
  } catch (err) {
    next(err);
  }
}

// Mark invoice as paid
export async function markInvoicePaid(req, res, next) {
  try {
    const { invoiceId } = req.params;

    const result = await InvoiceService.markInvoicePaid(req.user, invoiceId);

    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
}
