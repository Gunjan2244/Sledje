import "dotenv/config";
import { initNats } from "../api-gateway/routes/config/nats.js";
import { StringCodec } from "nats";
import { db } from "../api-gateway/routes/config/postgres.js";
import {
  notifications,
  retailers,
  distributors,
  users,
} from "../db/schema.js";
import { eq } from "drizzle-orm";

async function startNotificationsConsumer() {
  console.log("🔔 Notifications Consumer starting...");

  const nc = await initNats();
  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();
  const sc = StringCodec();

  // Create STREAM if missing
  try {
    await jsm.streams.info("EVENTS");
  } catch (err) {
    console.log("⚠️ Creating EVENTS stream...");
    await jsm.streams.add({
      name: "EVENTS",
      subjects: ["orders.*", "connections.*", "inventory.*"],
    });
  }

  // Create all individual durable consumers
  const subjects = [
    "orders.created",
    "orders.modified",
    "orders.accepted",
    "orders.status.updated",
    "orders.completed",

    "connections.requested",
    "connections.approved",
    "connections.rejected",

    "inventory.variant_added",
    "inventory.updated_after_order",
  ];

  for (let subject of subjects) {
    subscribeToSubject(js, sc, subject);
  }

  console.log("🟢 Notifications Consumer is live.");
}

/* Subscribe and handle events */
async function subscribeToSubject(js, sc, subject) {
  const sub = await js.subscribe(subject, {
    durable: `notif_${subject.replace(".", "_")}`,
    deliver_policy: "all",
  });

  console.log(`🔔 Listening → ${subject}`);

  for await (const msg of sub) {
    try {
      const json = JSON.parse(sc.decode(msg.data));
      await handleEvent(subject, json);
      msg.ack();
    } catch (err) {
      console.error("❌ Notification error:", err);
    }
  }
}

/* Main event handler */
async function handleEvent(subject, payload) {
  switch (subject) {
    /* ----------------------------- ORDERS ----------------------------- */

    case "orders.created":
      return notifyOrderCreated(payload);

    case "orders.modified":
      return notifyOrderModified(payload);

    case "orders.accepted":
      return notifyOrderAccepted(payload);

    case "orders.status.updated":
      return notifyOrderStatusChanged(payload);

    case "orders.completed":
      return notifyOrderCompleted(payload);

    /* --------------------------- CONNECTIONS -------------------------- */

    case "connections.requested":
      return notifyConnectionRequested(payload);

    case "connections.approved":
      return notifyConnectionApproved(payload);

    case "connections.rejected":
      return notifyConnectionRejected(payload);

    /* --------------------------- INVENTORY ---------------------------- */

    case "inventory.variant_added":
      return notifyVariantAdded(payload);

    case "inventory.updated_after_order":
      return notifyInventoryUpdated(payload);

    default:
      console.log("Unknown event:", subject);
  }
}

/* ----------------------------- HELPERS ----------------------------- */

/** Inserts a notification */
async function createNotification(userId, type, title, message) {
  await db.insert(notifications).values({
    userId,
    type,
    title,
    message,
    read: false,
  });
}

/** Get userId from retailerId or distributorId */
async function getUserIdForRetailer(retailerId) {
  const [r] = await db.select().from(retailers).where(eq(retailers.id, retailerId));
  return r ? r.userId : null;
}
async function getUserIdForDistributor(distributorId) {
  const [d] = await db
    .select()
    .from(distributors)
    .where(eq(distributors.id, distributorId));
  return d ? d.userId : null;
}

/* ----------------------------- ORDER EVENTS ----------------------------- */

async function notifyOrderCreated({ order }) {
  const userId = await getUserIdForDistributor(order.distributorId);
  if (!userId) return;

  await createNotification(
    userId,
    "order",
    "New Order Received",
    `Order #${order.orderNumber} has been created by a retailer.`
  );

  console.log("🔔 Sent notification → order.created");
}

async function notifyOrderModified({ order }) {
  const userId = await getUserIdForDistributor(order.distributorId);
  if (!userId) return;

  await createNotification(
    userId,
    "order",
    "Order Modified",
    `Order #${order.orderNumber} has been modified by the retailer.`
  );
}

async function notifyOrderAccepted({ order }) {
  const userId = await getUserIdForRetailer(order.retailerId);
  if (!userId) return;

  await createNotification(
    userId,
    "order",
    "Order Accepted",
    `Your order #${order.orderNumber} has been accepted by the distributor.`
  );
}

async function notifyOrderStatusChanged({ order }) {
  const userId = await getUserIdForRetailer(order.retailerId);
  if (!userId) return;

  await createNotification(
    userId,
    "order",
    "Order Status Updated",
    `Order #${order.orderNumber} is now ${order.status}.`
  );
}

async function notifyOrderCompleted({ order }) {
  const userId = await getUserIdForRetailer(order.retailerId);
  if (!userId) return;

  await createNotification(
    userId,
    "order",
    "Order Completed",
    `Order #${order.orderNumber} has been delivered and completed.`
  );
}

/* --------------------------- CONNECTION EVENTS -------------------------- */

async function notifyConnectionRequested({ retailerId, distributorId }) {
  const userId = await getUserIdForDistributor(distributorId);
  if (!userId) return;

  await createNotification(
    userId,
    "connection",
    "New Connection Request",
    `A retailer has requested to connect with you.`
  );
}

async function notifyConnectionApproved({ retailerId }) {
  const userId = await getUserIdForRetailer(retailerId);
  if (!userId) return;

  await createNotification(
    userId,
    "connection",
    "Connection Approved",
    `Your connection request has been approved.`
  );
}

async function notifyConnectionRejected({ retailerId }) {
  const userId = await getUserIdForRetailer(retailerId);
  if (!userId) return;

  await createNotification(
    userId,
    "connection",
    "Connection Rejected",
    `Your distributor has rejected the connection request.`
  );
}

/* --------------------------- INVENTORY EVENTS -------------------------- */

async function notifyVariantAdded({ retailerId, variantId }) {
  const userId = await getUserIdForRetailer(retailerId);

  await createNotification(
    userId,
    "inventory",
    "New Variant Added",
    "A new product variant was added to your inventory."
  );
}

async function notifyInventoryUpdated({ retailerId }) {
  const userId = await getUserIdForRetailer(retailerId);

  await createNotification(
    userId,
    "inventory",
    "Inventory Updated",
    "Your inventory has been updated after order delivery."
  );
}

startNotificationsConsumer().catch((err) =>
  console.error("❌ Failed to start Notifications Consumer:", err)
);
