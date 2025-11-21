import { connect, StringCodec } from "nats";

let nc = null;
const sc = StringCodec();

export async function initNats() {
  if (nc) return nc;

  nc = await connect({
    servers: process.env.NATS_URL || "nats://localhost:4222"
  });

  console.log("🚀 Connected to NATS");
  return nc;
}

export function natsClient() {
  if (!nc) throw new Error("NATS not initialized");
  return nc;
}

export const codec = sc;
