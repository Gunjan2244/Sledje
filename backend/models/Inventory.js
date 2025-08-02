import { BaseModel } from "./base.js";
export class Inventory extends BaseModel {
  constructor() {
    super('inventory');
  }

  async getRetailerInventory(retailerId) {
    const query = `
      SELECT 
        i.*,
        p.name as product_name,
        p.icon as product_icon,
        p.category,
        pv.name as variant_name,
        pv.selling_price,
        pv.cost_price,
        pv.expiry,
        d.id as distributor_id,
        d.owner_name as distributor_name,
        d.company_name
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN product_variants pv ON i.variant_id = pv.id
      JOIN distributors d ON i.distributor_id = d.id
      WHERE i.retailer_id = $1
      ORDER BY p.name, pv.name
    `;
    const result = await this.query(query, [retailerId]);
    return result.rows;
  }

  async addToInventory(data) {
    const query = `
      INSERT INTO inventory (retailer_id, distributor_id, product_id, variant_id, sku, stock)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (retailer_id, variant_id) 
      DO UPDATE SET 
        stock = inventory.stock + EXCLUDED.stock,
        last_updated = NOW()
      RETURNING *
    `;
    const result = await this.query(query, [
      data.retailer_id,
      data.distributor_id,
      data.product_id,
      data.variant_id,
      data.sku,
      data.stock || 0
    ]);
    return result.rows[0];
  }

  async updateStock(retailerId, variantId, quantity) {
    const query = `
      UPDATE inventory 
      SET stock = stock + $3, last_updated = NOW()
      WHERE retailer_id = $1 AND variant_id = $2
      RETURNING *
    `;
    const result = await this.query(query, [retailerId, variantId, quantity]);
    return result.rows[0];
  }

  async bulkUpdateStock(retailerId, items) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      const results = [];
      for (const item of items) {
        const query = `
          UPDATE inventory 
          SET stock = stock + $3, last_updated = NOW()
          WHERE retailer_id = $1 AND variant_id = $2
          RETURNING *
        `;
        const result = await client.query(query, [
          retailerId,
          item.variant_id,
          item.quantity
        ]);
        if (result.rows[0]) {
          results.push(result.rows[0]);
        }
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
