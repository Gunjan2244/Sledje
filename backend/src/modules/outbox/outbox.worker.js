import "dotenv/config";
import OutboxService from "./outbox.service.js";
import { initNats } from "../../config/nats.js";
import { StringCodec } from "nats";

const INTERVAL_MS = 2000; // poll every 2 seconds
let natsConnection = null;

async function startWorker() {
  console.log("🟢 Outbox Worker starting...");

  // connect to nats
  natsConnection = await initNats();
  const sc = StringCodec();

  console.log("🟢 Connected to NATS for Outbox Worker");

  // infinite loop
  while (true) {
    try {
      const pending = await OutboxService.getPending(50);

      if (pending.length === 0) {
        await sleep(INTERVAL_MS);
        continue;
      }

      for (const event of pending) {
        try {
          const subject = event.eventType;
          const data = JSON.stringify(event.payload);

          await natsConnection.publish(subject, sc.encode(data));

          await OutboxService.markPublished(event.id);

          console.log(`📤 Outbox event delivered: ${subject} (${event.id})`);
        } catch (err) {
          console.error("❌ Failed to publish event:", err.message);
          await OutboxService.markFailed(event.id, err.message);
        }
      }
    } catch (err) {
      console.error("❌ Outbox Loop Error:", err);
    }

    await sleep(INTERVAL_MS);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

startWorker().catch((err) => {
  console.error("❌ Outbox Worker failed to start:", err);
  process.exit(1);
});

// This worker runs forever in the background.
// You will run it separately from your Express backend:

// node src/outbox/outbox.worker.js


// Or in production with pm2:

// pm2 start src/outbox/outbox.worker.js --name outbox-worker
