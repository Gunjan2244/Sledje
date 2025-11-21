import PaymentsService from "../../modules/payments/payments.service.js";

export async function listBills(req, res, next) {
  try {
    const data = await PaymentsService.listBills(req.user, req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getBill(req, res, next) {
  try {
    const bill = await PaymentsService.getBill(req.user, req.params.billId);
    res.json(bill);
  } catch (err) {
    next(err);
  }
}

export async function getTransactions(req, res, next) {
  try {
    const tx = await PaymentsService.getTransactions(
      req.user,
      req.params.billId
    );
    res.json(tx);
  } catch (err) {
    next(err);
  }
}

export async function payBill(req, res, next) {
  try {
    const result = await PaymentsService.payBill(
      req.user,
      req.params.billId,
      req.body
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function gatewayPayment(req, res, next) {
  try {
    await PaymentsService.applyGatewayPayment(req.body);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
