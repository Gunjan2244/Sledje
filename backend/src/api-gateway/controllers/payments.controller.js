import PaymentsService from "../../modules/payments/payments.service.js";

export async function getProductBills(req, res, next) {
  try {
    const user = req.user;
    const role = user.role;
    // optional query filters: variantId, distributorId, page, limit
    const filters = req.query || {};
    const data = await PaymentsService.listBills(user, filters);
    res.json(data);
  } catch (err) { next(err); }
}

export async function getProductBill(req, res, next) {
  try {
    const user = req.user;
    const { billId } = req.params;
    const bill = await PaymentsService.getBill(user, billId);
    res.json(bill);
  } catch (err) { next(err); }
}

export async function postPayment(req, res, next) {
  try {
    const user = req.user;
    const { billId } = req.params;
    const { amount, paymentMethod = "manual", note } = req.body;
    const result = await PaymentsService.payBill(user, billId, { amount, paymentMethod, note });
    res.json({ message: "Payment applied", data: result });
  } catch (err) { next(err); }
}

export async function getBillTransactions(req, res, next) {
  try {
    const user = req.user;
    const { billId } = req.params;
    const rows = await PaymentsService.getTransactions(user, billId);
    res.json({ data: rows });
  } catch (err) { next(err); }
}
