// src/api-gateway/controllers/product-bills.controller.js
import ProductBillsService from "../../modules/product-bills/product-bills.service.js";

export async function listBills(req, res, next) {
  try {
    const filters = {
      variantId: req.query.variantId,
      distributorId: req.query.distributorId,
      retailerId: req.query.retailerId,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };

    const bills = await ProductBillsService.listBills(req.user, filters);
    res.json({ data: bills });
  } catch (err) {
    next(err);
  }
}

export async function getBill(req, res, next) {
  try {
    const { billId } = req.params;
    const result = await ProductBillsService.getBill(req.user, billId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function getBillTransactions(req, res, next) {
  try {
    const { billId } = req.params;
    const txs = await ProductBillsService.getTransactions(req.user, billId);
    res.json({ data: txs });
  } catch (err) {
    next(err);
  }
}

export async function payBill(req, res, next) {
  try {
    const { billId } = req.params;
    const { amount, paymentMethod, note } = req.body;

    const result = await ProductBillsService.payBill(req.user, billId, {
      amount,
      paymentMethod,
      note,
    });

    res.json({ message: "Payment applied successfully", ...result });
  } catch (err) {
    next(err);
  }
}
