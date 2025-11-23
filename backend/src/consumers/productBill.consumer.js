import { createConsumer } from "./utils/js-consumer.js";
import { dedupe } from "./utils/dedupe.js";
import { db } from "../config/postgres.js";
import productBillRepo from "../modules/product-bills/product-bills.repository.js";
import { publishEvent } from "../config/nats-streams.js";

export default async function startProductBillConsumer() {
  await createConsumer(
    "inventory.updated_after_order",
    "product_bill_updater",
    async (data) => {
      const { eventId, orderId, distributorId, retailerId, items } = data;

      await dedupe(eventId, async () => {
        await db.transaction(async (tx) => {
          for (const item of items) {
            const existingBill = await productBillRepo.findBillByVariant(
              retailerId,
              distributorId,
              item.variantId
            );

            let bill;

            if (!existingBill) {
              bill = await productBillRepo.createBill({
                retailerId,
                distributorId,
                variantId: item.variantId,
                unitCost: item.costPrice,
              });
            } else {
              bill = existingBill;
            }

            await productBillRepo.upsertDeliveryAndTransaction(tx, {
              productBillId: bill.id,
              orderId,
              variantId: item.variantId,
              qty: item.quantity,
              unitCost: item.costPrice,
            });
          }
        });

        await publishEvent("product_bills.updated", {
          eventId,
          retailerId,
          distributorId,
          orderId,
        });

        console.log("💰 product_bills.updated published");
      });
    },
  );
}
