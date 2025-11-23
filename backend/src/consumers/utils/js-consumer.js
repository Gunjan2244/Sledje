import { natsClient, codec } from "../../config/nats.js";
import { consumerOpts, createInbox } from "nats";  
import { db } from "../../config/postgres.js";

/**
 * Hybrid: At-least-once delivery + de-duplication table
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
 * Create JetStream Consumer (durable, manual ack)
 */
export async function createConsumer(subject, durable, handler) {
  try {
    const nc = natsClient();
    const js = nc.jetstream();

    // 🛠 REQUIRED FIX — add inbox for durable consumer
    const inbox = createInbox();

    const opts = consumerOpts();
    opts.durable(durable);
    opts.deliverTo(inbox);          // <-- REQUIRED FOR DURABLE CONSUMERS
    opts.deliverAll();              // deliver_policy = all
    opts.ackExplicit();             // ack_policy = explicit
    opts.manualAck();               // manual ack enabled

    const sub = await js.subscribe(subject, opts);

    console.log(`🔗 Consumer ready → ${subject} (durable=${durable})`);

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

      if (messageId && await isDuplicate(messageId)) {
        console.log(`♻️ Duplicate ignored ${subject} -> seq=${messageId}`);
        msg.ack();
        continue;
      }

      try {
        await handler(json, msg);
        if (messageId) await markProcessed(messageId);
        msg.ack();
      } catch (err) {
        console.error(`❌ Error in consumer handler: ${subject}`, err);
        // msg.nak() if you want retry
      }
    }

  } catch (err) {
    console.error(`❌ Failed to start consumer: ${subject}`, err);
  }
}
