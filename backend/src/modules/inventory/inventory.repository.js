import { db } from "../../config/postgres.js";
import { inventory, productVariants, products, retailers, orders, orderItems } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";

export default {
  async findRetailerIdByUserId(userId) {
    const rows = await db.select().from(retailers).where(eq(retailers.userId, userId));
    return rows[0] || null;
  },

  async getInventoryByRetailer(retailerId) {
    return db
      .select()
      .from(inventory)
      .where(eq(inventory.retailerId, retailerId));
  },

  async findVariantById(variantId) {
    const rows = await db.select().from(productVariants).where(eq(productVariants.id, variantId));
    return rows[0] || null;
  },

  async findProduct(productId) {
    const rows = await db.select().from(products).where(eq(products.id, productId));
    return rows[0] || null;
  },

  async findInventoryItem(retailerId, variantId) {
    const rows = await db
      .select()
      .from(inventory)
      .where(
        and(eq(inventory.retailerId, retailerId), eq(inventory.variantId, variantId))
      );
    return rows[0] || null;
  },

  async createInventoryItem(retailerId, variant, product) {
    const [row] = await db.insert(inventory).values({
      retailerId,
      productId: variant.productId,
      variantId: variant.id,
      productName: product.name,
      variantName: variant.name,
      sku: variant.sku,
      stock: variant.stock ?? 0,
      sellingPrice: variant.sellingPrice,
      costPrice: variant.costPrice,
      distributorId: product.distributorId,
      dailyAvgSales: 0,
    }).returning();
    return row;
  },

  async updateStock(retailerId, variantId, newStock) {
    const [row] = await db.update(inventory)
      .set({ stock: newStock })
      .where(and(eq(inventory.retailerId, retailerId), eq(inventory.variantId, variantId)))
      .returning();
    return row;
  },

  async getOrder(orderId) {
    const rows = await db.select().from(orders).where(eq(orders.id, orderId));
    return rows[0] || null;
  },

  async getOrderItems(orderId) {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }
};
