import PaymentsService from "../../modules/payments/payments.service.js";

export async function listBillsController(req, res, next) {
  try {
    const bills = await PaymentsService.listBills(req.user, req.query);
    res.json({ data: bills });
  } catch (err) { next(err); }
}

export async function getBillController(req, res, next) {
  try {
    const bill = await PaymentsService.getBill(req.user, req.params.billId);
    res.json({ data: bill });
  } catch (err) { next(err); }
}

export async function getBillTransactionsController(req, res, next) {
  try {
    const txs = await PaymentsService.getTransactions(
      req.user,
      req.params.billId
    );
    res.json({ data: txs });
  } catch (err) { next(err); }
}

export async function payBillController(req, res, next) {
  try {
    const { amount, paymentMethod, note } = req.body;
    const result = await PaymentsService.payBill(req.user, req.params.billId, {
      amount,
      paymentMethod,
      note,
    });
    res.json(result);
  } catch (err) { next(err); }
}
