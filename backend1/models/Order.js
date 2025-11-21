import { BaseModel } from "./base.js";
export class Order extends BaseModel {
  constructor() {
    super('orders');
  }

  async createWithItems(orderData, items) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      // Create order
      const orderQuery = `
        INSERT INTO orders (retailer_id, distributor_id, total_amount, status, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const orderResult = await client.query(orderQuery, [
        orderData.retailer_id,
        orderData.distributor_id,
        orderData.total_amount,
        orderData.status,
        orderData.notes
      ]);

      const order = orderResult.rows[0];

      // Create order items
      const createdItems = [];
      for (const item of items) {
        const itemQuery = `
          INSERT INTO order_items (
            order_id, product_id, sku, quantity, unit, ordered, price, product_name, variant_name
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `;
        const itemResult = await client.query(itemQuery, [
          order.id,
          item.product_id,
          item.sku,
          item.quantity,
          item.unit,
          item.ordered,
          item.price,
          item.product_name,
          item.variant_name
        ]);
        createdItems.push(itemResult.rows[0]);
      }

      await client.query('COMMIT');
      return { ...order, items: createdItems };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getWithItems(orderId) {
    const query = `
      SELECT 
        o.*,
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'sku', oi.sku,
            'quantity', oi.quantity,
            'unit', oi.unit,
            'ordered', oi.ordered,
            'price', oi.price,
            'product_name', oi.product_name,
            'variant_name', oi.variant_name
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
      GROUP BY o.id
    `;
    const result = await this.query(query, [orderId]);
    return result.rows[0];
  }

  async findByUser(userId, userType, options = {}) {
    let query = `
      SELECT o.*, r.business_name as retailer_name, d.company_name as distributor_name
      FROM orders o
      JOIN retailers r ON o.retailer_id = r.id
      JOIN distributors d ON o.distributor_id = d.id
      WHERE o.${userType}_id = $1
    `;

    const params = [userId];

    if (options.status) {
      query += ` AND o.status = ${params.length + 1}`;
      params.push(options.status);
    }

    query += ` ORDER BY o.created_at DESC`;

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const result = await this.query(query, params);
    return result.rows;
  }
}
