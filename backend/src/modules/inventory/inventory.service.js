import InventoryRepo from "./inventory.repository.js";
import { publishEvent } from "../../events/jetstream.js";

export default {
  async getInventory(userId) {
    const retailer = await InventoryRepo.findRetailerIdByUserId(userId);
    if (!retailer) throw new Error("Retailer account not found");

    return InventoryRepo.getInventoryByRetailer(retailer.id);
  },

  async addVariant(userId, variantId) {
    const retailer = await InventoryRepo.findRetailerIdByUserId(userId);
    if (!retailer) throw new Error("Retailer not found");

    const variant = await InventoryRepo.findVariantById(variantId);
    if (!variant) throw new Error("Variant not found");

    const product = await InventoryRepo.findProduct(variant.productId);
    if (!product) throw new Error("Product not found");

    const existing = await InventoryRepo.findInventoryItem(retailer.id, variantId);

    if (existing) {
      return existing; // already added
    }

    const created = await InventoryRepo.createInventoryItem(retailer.id, variant, product);

    publishEvent("inventory.variant_added", {
      retailerId: retailer.id,
      variantId,
      productId: product.id
    });

    return created;
  },

  async updateInventoryAfterOrder(userId, orderId) {
    const retailer = await InventoryRepo.findRetailerIdByUserId(userId);
    if (!retailer) throw new Error("Retailer not found");

    const order = await InventoryRepo.getOrder(orderId);
    if (!order) throw new Error("Order not found");

    if (order.status !== "completed")
      throw new Error("Order is not completed");

    const items = await InventoryRepo.getOrderItems(orderId);

    const updated = [];

    for (const item of items) {
      const existing = await InventoryRepo.findInventoryItem(retailer.id, item.variantId);

      if (!existing) {
        // create inventory entry if missing
        const variant = await InventoryRepo.findVariantById(item.variantId);
        const product = await InventoryRepo.findProduct(variant.productId);
        const created = await InventoryRepo.createInventoryItem(retailer.id, variant, product);
        existing = created;
      }

      // Add quantity to stock
      const newStock = Number(existing.stock) + Number(item.quantity);

      const updatedItem = await InventoryRepo.updateStock(
        retailer.id,
        item.variantId,
        newStock
      );

      updated.push(updatedItem);
    }

    publishEvent("inventory.updated_after_order", {
      retailerId: retailer.id,
      updated
    });

    return updated;
  }
};
