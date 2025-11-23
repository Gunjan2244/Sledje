import { createConsumer } from "./utils/js-consumer.js";
import { dedupe } from "./utils/dedupe.js";
import { ledger } from "../db/schema.js";
import { db } from "../config/postgres.js";
import { eq } from "drizzle-orm";

export default async function startLedgerConsumer() {
  await createConsumer("product_bills.updated",
  "ledger_updater",
  async (data) => {
    const { eventId, orderId, retailerId, distributorId } = data;

      await dedupe(eventId, async () => {
        await db.insert(ledger).values({
          retailerId,
          distributorId,
          event: "order_delivery_recorded",
          refId: orderId,
        });
      });
    },
  );
}
