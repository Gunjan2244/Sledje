import { db } from "../../config/postgres.js";
import { eventDedupe } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export async function alreadyProcessed(eventId) {
  const [row] = await db.select().from(eventDedupe).where(eq(eventDedupe.eventId, eventId));
  return !!row;
}

export async function markProcessed(eventId) {
  await db.insert(eventDedupe).values({ eventId });
}

export async function dedupe(eventId, callback) {
  if (await alreadyProcessed(eventId)) {
    console.log(`⚠️ Skipping duplicate event → ${eventId}`);
    return;
  }
  await callback();
  await markProcessed(eventId);
}
