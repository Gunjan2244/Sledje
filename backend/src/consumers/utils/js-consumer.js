import { natsClient, codec } from "../../config/nats.js";
import { db } from "../../config/postgres.js";

/**
 * Hybrid: At-least-once delivery + de-duplication table
 * Ensures idempotency for all consumers
 */
async function isDuplicate(messageId) {
  const result = await db.execute(`
    SELECT 1 FROM event_dedup WHERE message_id = '${messageId}'
  `);
  return result.length > 0;
}

async function markProcessed(messageId) {
  await db.execute(`
    INSERT INTO event_dedup(message_id, processed_at)
    VALUES ('${messageId}', NOW())
    ON CONFLICT DO NOTHING;
  `);
}

/**
 * Create a JetStream consumer (durable)
 */
export async function createConsumer(subject, durable, handler) {
  try {
    const nc = natsClient();
    const js = nc.jetstream();

    const sub = await js.subscribe(subject, {
      durable,
      deliver_policy: "all",
      ack_policy: "explicit"
    });

    console.log(`🔗 Consumer ready → ${subject}`);

    for await (const msg of sub) {
      const raw = codec.decode(msg.data);

      let json;
      try {
        json = JSON.parse(raw);
      } catch (e) {
        console.error(`⚠️ Invalid JSON in ${subject}`, raw);
        msg.ack();
        continue;
      }

      const messageId = msg?.info?.streamSequence;
      if (!messageId) {
        console.warn("⚠ No seq found, skipping marking", subject);
      }

      // DEDUP CHECK
      if (await isDuplicate(messageId)) {
        console.log(`♻️ Duplicate ignored → ${subject} seq=${messageId}`);
        msg.ack();
        continue;
      }

      try {
        await handler(json, msg);

        if (messageId) await markProcessed(messageId);

        msg.ack();
      } catch (err) {
        console.error(`❌ Handler error in ${subject}`, err);
      }
    }
  } catch (err) {
    console.error(`❌ Failed to start consumer: ${subject}`, err);
  }
}
