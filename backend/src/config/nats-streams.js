import { natsClient, codec } from "./nats.js";

// Get JetStream client
export function jetstream() {
  return natsClient().jetstream();
}

// Safe publisher – will NEVER crash the server
export async function publishEvent(subject, data) {
  try {
    const js = jetstream();
    await js.publish(subject, codec.encode(JSON.stringify(data)));
  } catch (err) {
    console.error("❌ JetStream publish failed:", {
      subject,
      code: err.code,
      message: err.message
    });
  }
}

// Ensure EVENTS Stream exists
export async function ensureEventsStream() {
  const nc = natsClient();
  const jsm = await nc.jetstreamManager();

  try {
    await jsm.streams.info("EVENTS");
    console.log("EVENTS stream already exists");
    return;
  } catch {}

  console.log("EVENTS stream missing → creating...");

  // Create stream
  await jsm.streams.add({
    name: "EVENTS",
    subjects: [
      "orders.>",          // multi-token
      "connections.>",
      "inventory.>",
      "notifications.>",
      "product_bills.>",
      "invoice.>",
      "products.>",
      "payments.>",        // REQUIRED
      "outbox.>"           // optional but recommended
    ],
    storage: "file",
    retention: "limits",
    max_msgs: -1,
    max_bytes: -1,
    num_replicas: 1
  });

  console.log("EVENTS stream created.");
}
