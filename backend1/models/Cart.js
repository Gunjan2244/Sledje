import { BaseModel } from "./base.js";
export class Cart extends BaseModel {
  constructor() {
    super('carts');
  }

  async saveItems(retailerId, items) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      // Upsert cart
      const cartQuery = `
        INSERT INTO carts (retailer_id) 
        VALUES ($1) 
        ON CONFLICT (retailer_id) DO UPDATE SET updated_at = NOW()
        RETURNING *
      `;
      const cartResult = await client.query(cartQuery, [retailerId]);
      const cart = cartResult.rows[0];

      // Clear existing items
      await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);

      // Add new items
      if (items && items.length > 0) {
        for (const item of items) {
          const itemQuery = `
            INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, unit)
            VALUES ($1, $2, $3, $4, $5)
          `;
          await client.query(itemQuery, [
            cart.id,
            item.productId,
            item.variantId,
            item.quantity,
            item.unit || 'box'
          ]);
        }
      }

      await client.query('COMMIT');
      return cart;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getItems(retailerId) {
    const query = `
      SELECT ci.*
      FROM cart_items ci
      JOIN carts c ON ci.cart_id = c.id
      WHERE c.retailer_id = $1
    `;
    const result = await this.query(query, [retailerId]);
    return result.rows;
  }

  async clearItems(retailerId) {
    const query = `
      DELETE FROM cart_items 
      WHERE cart_id = (SELECT id FROM carts WHERE retailer_id = $1)
    `;
    await this.query(query, [retailerId]);
  }
}