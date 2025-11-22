import OrdersRepo from "../modules/orders/orders.repository.js";
import InventoryService from "../modules/inventory/inventory.service.js";
import ProductBillsService from "../modules/product-bills/product-bills.service.js";
import { publishEvent } from "../events/jetstream.js";
import { createConsumer } from "./utils/js-consumer.js";

export default async function startOrdersConsumers() {
  // ORDER CREATED
  await createConsumer(
    "orders.created",
    "orders_created_worker",
    async ({ order }) => {
      console.log("🟩 Order Created:", order.id);

      // inventory reservation? optional
      
      // notify retailer + distributor
      await publishEvent("notifications.order_created", {
        orderId: order.id,
        retailerId: order.retailerId,
        distributorId: order.distributorId
      });
    }
  );

  // ORDER ACCEPTED
  await createConsumer(
    "orders.accepted",
    "orders_accepted_worker",
    async ({ order }) => {
      console.log("🤝 Order Accepted:", order.id);

      // notify retailer
      await publishEvent("notifications.order_accepted", {
        orderId: order.id,
        retailerId: order.retailerId
      });
    }
  );

  // ORDER COMPLETED → THIS IS THE IMPORTANT ONE
  await createConsumer(
    "orders.completed",
    "orders_completed_worker",
    async ({ order, items }) => {
      console.log("🏁 Order Completed:", order.id);

      // decrease distributor stock
      await InventoryService.applyDeliveredOrder(order, items);

      // update product bills (per variant)
      for (const it of items) {
        await ProductBillsService.applyDelivery({
          retailerId: order.retailerId,
          distributorId: order.distributorId,
          variantId: it.variantId,
          quantity: it.quantity,
          unitCost: it.costPrice,
          orderId: order.id
        });
      }

      // notify retailer
      await publishEvent("notifications.order_completed", {
        orderId: order.id,
        retailerId: order.retailerId
      });
    }
  );
}
