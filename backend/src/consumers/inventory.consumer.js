import "dotenv/config";
import { initNats } from "../config/nats.js";
import { StringCodec } from "nats";
import { db } from "../config/postgres.js";
import {
  inventory,
  productVariants,
  retailers,
  orders,
  orderItems,
  distributors,
} from "../db/schema.js";

import { eq, and } from "drizzle-orm";

async function startInventoryConsumer() {
  console.log("📦 Inventory Consumer starting...");

  const nc = await initNats();
  const jsm = await nc.jetstreamManager();
  const js = nc.jetstream();
  const sc = StringCodec();

  // Ensure JetStream stream exists (STREAM: ORDERS)
  try {
    await jsm.streams.info("ORDERS");
  } catch (err) {
    console.log("⚠️ Stream ORDERS missing. Creating...");
    await jsm.streams.add({
      name: "ORDERS",
      subjects: ["orders.*"],
    });
  }

  // Durable consumer ensures we don’t lose events if service restarts
  const sub = await js.subscribe("orders.completed", {
    durable: "inventory_updater",
    deliver_policy: "all",
  });

  console.log("🟢 Inventory Consumer listening on orders.completed");

  for await (const msg of sub) {
    try {
      const json = JSON.parse(sc.decode(msg.data));
      await handleOrderCompleted(json.order);
      msg.ack(); // always ack after processing
    } catch (err) {
      console.error("❌ Inventory consumer failed:", err);
    }
  }
}

async function handleOrderCompleted(order) {
  console.log(`📦 Updating inventory for completed order ${order.id}`);

  // Fetch full order items (if not included)
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  // Identify retailer + distributor
  const [ret] = await db
    .select()
    .from(retailers)
    .where(eq(retailers.id, order.retailerId));

  const [dist] = await db
    .select()
    .from(distributors)
    .where(eq(distributors.id, order.distributorId));

  if (!ret) throw new Error("Retailer not found for order");
  if (!dist) throw new Error("Distributor not found");

  // For each item: add to retailer inventory, deduct from distributor stock
  for (const item of items) {
    await updateRetailerInventory(ret.id, item);
    await deductDistributorStock(item.variantId, item.quantity);
  }

  console.log(`✅ Inventory updated for order ${order.id}`);
}

async function updateRetailerInventory(retailerId, item) {
  // Check if inventory row exists
  const existing = (
    await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.retailerId, retailerId),
          eq(inventory.variantId, item.variantId)
        )
      )
  )[0];

  if (!existing) {
    // Fetch variant details to create inventory entry
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, item.variantId));

    if (!variant) return;

    await db.insert(inventory).values({
      retailerId,
      productId: variant.productId,
      variantId: variant.id,
      productName: variant.name, // will update if needed
      variantName: variant.name,
      sku: variant.sku,
      stock: item.quantity,
      sellingPrice: variant.sellingPrice,
      costPrice: variant.costPrice,
      distributorId: variant.distributorId || null,
      dailyAvgSales: 0,
    });
    console.log(`➕ Added new inventory row for retailer ${retailerId}`);
  } else {
    // Update stock
    const newStock = Number(existing.stock) + Number(item.quantity);
    await db
      .update(inventory)
      .set({ stock: newStock })
      .where(eq(inventory.id, existing.id));

    console.log(`🔼 Updated retailer stock: +${item.quantity}`);
  }
}

async function deductDistributorStock(variantId, quantity) {
  // Deduct from productVariants stock
  const [variant] = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, variantId));

  if (!variant) return;

  const updated = Number(variant.stock) - Number(quantity);
  const newStock = updated < 0 ? 0 : updated;

  await db
    .update(productVariants)
    .set({ stock: newStock })
    .where(eq(productVariants.id, variantId));

  console.log(
    `📉 Distributor stock updated for variant ${variantId}: -${quantity}`
  );
}

startInventoryConsumer().catch((err) => {
  console.error("❌ Failed to start Inventory Consumer:", err);
});
