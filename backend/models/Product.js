import { BaseModel } from "./base.js";
export class Product extends BaseModel {
  constructor() {
    super('products');
  }

  async createWithVariants(productData, variants) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      // Create product
      const productQuery = `
        INSERT INTO products (distributor_id, product_id, name, icon, category, distributorships)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const productResult = await client.query(productQuery, [
        productData.distributor_id,
        productData.product_id,
        productData.name,
        productData.icon,
        productData.category,
        productData.distributorships
      ]);

      const product = productResult.rows[0];

      // Create variants
      const createdVariants = [];
      for (const variant of variants) {
        const variantQuery = `
          INSERT INTO product_variants (
            product_id, variant_id, name, stock, selling_price, cost_price,
            expiry, sku, description, image
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `;
        const variantResult = await client.query(variantQuery, [
          product.id,
          variant.id,
          variant.name,
          variant.stock,
          variant.sellingPrice,
          variant.costPrice,
          variant.expiry,
          variant.sku,
          variant.description,
          variant.image
        ]);
        createdVariants.push(variantResult.rows[0]);
      }

      await client.query('COMMIT');
      return { ...product, variants: createdVariants };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getWithVariants(productId) {
    const query = `
      SELECT 
        p.*,
        json_agg(
          json_build_object(
            'id', pv.id,
            'variant_id', pv.variant_id,
            'name', pv.name,
            'stock', pv.stock,
            'selling_price', pv.selling_price,
            'cost_price', pv.cost_price,
            'expiry', pv.expiry,
            'sku', pv.sku,
            'description', pv.description,
            'image', pv.image
          )
        ) as variants
      FROM products p
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      WHERE p.id = $1
      GROUP BY p.id
    `;
    const result = await this.query(query, [productId]);
    return result.rows[0];
  }

  async findByDistributor(distributorId, options = {}) {
    let query = `
      SELECT 
        p.*,
        json_agg(
          json_build_object(
            'id', pv.id,
            'variant_id', pv.variant_id,
            'name', pv.name,
            'stock', pv.stock,
            'selling_price', pv.selling_price,
            'cost_price', pv.cost_price,
            'expiry', pv.expiry,
            'sku', pv.sku,
            'description', pv.description,
            'image', pv.image
          )
        ) as variants
      FROM products p
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      WHERE p.distributor_id = $1
    `;

    const params = [distributorId];
    
    if (options.category) {
      query += ` AND p.category ILIKE $${params.length + 1}`;
      params.push(`%${options.category}%`);
    }

    if (options.search) {
      query += ` AND p.name ILIKE $${params.length + 1}`;
      params.push(`%${options.search}%`);
    }

    query += ` GROUP BY p.id ORDER BY p.created_at DESC`;

    const result = await this.query(query, params);
    return result.rows;
  }
}
