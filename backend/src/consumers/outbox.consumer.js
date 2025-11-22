import { db } from "../config/postgres.js";
import { outbox } from "../db/schema.js";
import { publishEvent } from "../config/nats-streams.js";
import { createConsumer } from "./utils/js-consumer.js";
import { eq } from "drizzle-orm";


export default async function startOutboxConsumer() {
  // Not JetStream subscription — runs on interval
  async function processOutbox() {
    const rows = await db.select().from(outbox).limit(50);

    for (const evt of rows) {
      await publishEvent(evt.eventType, evt.payload);
      await db.delete(outbox).where(eq(outbox.id, evt.id));

      console.log("📤 Outbox → Published:", evt.eventType);
    }
  }

  // run every 1 second
  setInterval(processOutbox, 1000);

  console.log("📦 Outbox consumer running...");
}
