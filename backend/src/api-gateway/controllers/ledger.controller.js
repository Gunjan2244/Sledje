import LedgerService from "../../modules/ledger/ledger.service.js";

export async function getLedger(req, res, next) {
  try {
    const data = await LedgerService.getLedgerForUser(req.user);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getLedgerForBill(req, res, next) {
  try {
    const { billId } = req.params;
    const data = await LedgerService.getLedgerForBill(req.user, billId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getLedgerForVariant(req, res, next) {
  try {
    const { variantId } = req.params;
    const data = await LedgerService.getLedgerForVariant(req.user, variantId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getLedgerForInvoice(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const data = await LedgerService.getLedgerForInvoice(req.user, invoiceId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getFullStatement(req, res, next) {
  try {
    const data = await LedgerService.getFullStatement(req.user);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
