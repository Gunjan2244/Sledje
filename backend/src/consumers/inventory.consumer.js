import { createConsumer } from "./utils/js-consumer.js";
import { dedupe } from "./utils/dedupe.js";
import { db } from "../config/postgres.js";
import { productVariants, retailerInventory } from "../db/schema.js";
import { publishEvent } from "../config/nats-streams.js";
import { eq } from "drizzle-orm";

export default async function startInventoryConsumers() {
  await createConsumer({
    subject: "orders.completed",
    durable: "inventory_orders_completed",
    handler: async (data) => {
      const { order, items, eventId } = data;

      await dedupe(eventId, async () => {
        await db.transaction(async (tx) => {
          // decrement distributor stock
          for (const item of items) {
            await tx.update(productVariants)
              .set({
                stock: productVariants.stock - item.quantity
              })
              .where(eq(productVariants.id, item.variantId));
          }

          // increment retailer inventory
          for (const item of items) {
            await tx.insert(retailerInventory).values({
              retailerId: order.retailerId,
              variantId: item.variantId,
              quantity: item.quantity
            });
          }
        });

        // publish next event
        await publishEvent("inventory.updated_after_order", {
          eventId,
          orderId: order.id,
          retailerId: order.retailerId,
          distributorId: order.distributorId,
        });
        console.log("📦 inventory.updated_after_order published");
      });
    },
  });
}
