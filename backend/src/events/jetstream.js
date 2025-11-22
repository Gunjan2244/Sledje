import { natsClient, codec } from "../config/nats.js";

export async function jetstream() {
  return natsClient().jetstream();
}

export async function publishEvent(subject, data) {
  const js = await jetstream();
  return js.publish(subject, codec.encode(JSON.stringify(data)));
}

export async function ensureEventsStream() {
  const nc = natsClient();
  const jsm = await nc.jetstreamManager();

  try {
    await jsm.streams.info("EVENTS");
    console.log("EVENTS stream already exists");
  } catch {
    console.log("EVENTS stream missing → creating...");

    await jsm.streams.add({
      name: "EVENTS",
      subjects: [
        "orders.>",
        "connections.*",
        "inventory.*",
        "notifications.*",
        "product_bills.*",
        "invoice.*",
        "products.*"
      ],
      storage: "file",
      retention: "limits",
      max_msgs: -1,
      max_bytes: -1,
      num_replicas: 1
    });

    console.log("EVENTS stream created.");
  }
}