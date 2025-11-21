import crypto from "crypto";
import PaymentsService from "../../modules/payments/payments.service.js";

export async function razorpayWebhookHandler(req, res) {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const body = req.body.toString("utf8");

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== signature) {
      return res.status(400).send("Invalid signature");
    }

    const payload = JSON.parse(body);

    if (payload.event === "payment.captured") {
      const invoiceId = payload.payload.payment.entity.notes.invoiceId;
      const amount = payload.payload.payment.entity.amount / 100;

      await PaymentsService.applyGatewayPayment({
        invoiceId,
        amount,
        gatewayId: payload.payload.payment.entity.id,
        method: payload.payload.payment.entity.method
      });
    }

    res.json({ status: "ok" });

  } catch (err) {
    console.error("Webhook error", err);
    res.status(500).send("Webhook failed");
  }
}
