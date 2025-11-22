import { createConsumer } from "./utils/js-consumer.js";
import { dedupe } from "./utils/dedupe.js";
import { db } from "../config/postgres.js";
import productBillRepo from "../modules/product-bills/product-bills.repository.js";
import { publishEvent } from "../config/nats-streams.js";

export default async function startPaymentConsumer() {
  await createConsumer({
    subject: "payments.captured",
    durable: "payments_handler",
    handler: async (data) => {
      const { eventId, productBillId, amount, metadata } = data;

      await dedupe(eventId, async () => {
        await db.transaction(async (tx) => {
          await productBillRepo.createPaymentTxAndUpdateBill(tx, {
            productBillId,
            amount,
            metadata,
          });
        });

        await publishEvent("product_bills.payment_applied", {
          eventId,
          productBillId,
          amount,
        });

        console.log("💵 Payment processed (exact once).");
      });
    },
  });
}
