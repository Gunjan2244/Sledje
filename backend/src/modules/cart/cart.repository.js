import { db } from "../../config/postgres.js";
import { carts } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";

export default {
  getCart(retailerId) {
    return db.select().from(carts).where(eq(carts.retailerId, retailerId));
  },

  async addToCart(retailerId, { variantId, distributorId, quantity, unit, price }) {
    const existing = await db
      .select()
      .from(carts)
      .where(
        and(
          eq(carts.retailerId, retailerId),
          eq(carts.variantId, variantId)
        )
      );

    if (existing.length) {
      return db
        .update(carts)
        .set({ quantity: existing[0].quantity + quantity })
        .where(eq(carts.id, existing[0].id))
        .returning();
    }

    return db.insert(carts).values({
      retailerId,
      variantId,
      distributorId,
      quantity,
      unit,
      price,
    }).returning();
  },

  updateCartItem(retailerId, { variantId, quantity }) {
    return db
      .update(carts)
      .set({ quantity })
      .where(
        and(eq(carts.retailerId, retailerId), eq(carts.variantId, variantId))
      )
      .returning();
  },

  removeCartItem(retailerId, variantId) {
    return db
      .delete(carts)
      .where(
        and(eq(carts.retailerId, retailerId), eq(carts.variantId, variantId))
      );
  },

  clearCart(retailerId) {
    return db.delete(carts).where(eq(carts.retailerId, retailerId));
  },
};
