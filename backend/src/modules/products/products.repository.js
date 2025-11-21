import { db } from "../../config/postgres.js";
import { products, productVariants, distributors, connections } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";



export default {
  // simple paginated query for products by distributor
  async findProductsByDistributor(distributorId, { search, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    const whereClause = distributorId
      ? eq(products.distributorId, distributorId)
      : undefined;

    // basic fetch products
    let q = db.select().from(products);
    if (distributorId) q = q.where(eq(products.distributorId, distributorId));
    if (search) q = q.where(products.name.ilike(`%${search}%`)); // drizzle supports `.ilike` on text? if not, can use raw sql; assume `.ilike` exists.
    q = q.orderBy(products.createdAt, "desc").limit(limit).offset(offset);

    const rows = await q;
    // fetch variants for all product ids
    const productIds = rows.map((r) => r.id);
    let variants = [];
    if (productIds.length) {
      variants = await db
        .select()
        .from(productVariants)
        .where(productVariants.productId.in(productIds));
    }

    // map variants to products
    const map = Object.fromEntries(productIds.map((id) => [id, []]));
    for (const v of variants) {
      if (!map[v.productId]) map[v.productId] = [];
      map[v.productId].push(v);
    }

    const productsWithVariants = rows.map((p) => ({
      ...p,
      variants: map[p.id] || []
    }));

    return productsWithVariants;
  },

  async findProductById(productId) {
    const [prod] = await db.select().from(products).where(eq(products.id, productId));
    if (!prod) return null;
    const variants = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
    return { ...prod, variants };
  },

  async createProduct(distributorId, productPayload) {
    // productPayload: { id?, name, icon, category, subcategory, variants: [...] }
    const productInsert = {
      distributorId,
      name: productPayload.name,
      icon: productPayload.icon || null,
      category: productPayload.category || null,
      subcategory: productPayload.subcategory || null
    };

    const [createdProduct] = await db.insert(products).values(productInsert).returning();

    // insert variants
    const variantsToInsert = (productPayload.variants || []).map((v) => ({
      productId: createdProduct.id,
      name: v.name,
      sku: v.sku || `${createdProduct.id}-${Date.now()}`,
      unit: v.unit || null,
      stock: v.stock ?? 0,
      sellingPrice: v.sellingPrice ?? 0,
      costPrice: v.costPrice ?? 0,
      expiry: v.expiry ?? null
    }));

    let insertedVariants = [];
    if (variantsToInsert.length) {
      insertedVariants = await db.insert(productVariants).values(variantsToInsert).returning();
    }

    return { ...createdProduct, variants: insertedVariants };
  },

  async updateProduct(distributorId, productId, payload) {
    // ensure ownership done in service layer; here just perform update
    const [updatedProduct] = await db
      .update(products)
      .set({
        name: payload.name,
        icon: payload.icon,
        category: payload.category,
        subcategory: payload.subcategory,
      })
      .where(eq(products.id, productId))
      .returning();

    // Strategy for variants: replace current variants for simplicity
    if (payload.variants) {
      // delete existing variants for this product
      await db.delete(productVariants).where(eq(productVariants.productId, productId));
      const variantsToInsert = payload.variants.map((v) => ({
        productId,
        name: v.name,
        sku: v.sku || `${productId}-${Date.now()}`,
        unit: v.unit || null,
        stock: v.stock ?? 0,
        sellingPrice: v.sellingPrice ?? 0,
        costPrice: v.costPrice ?? 0,
        expiry: v.expiry ?? null
      }));
      const insertedVariants = variantsToInsert.length ? await db.insert(productVariants).values(variantsToInsert).returning() : [];
      return { ...updatedProduct, variants: insertedVariants };
    }

    const currentVariants = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
    return { ...updatedProduct, variants: currentVariants };
  },

  async deleteProduct(productId) {
    // cascade deletion on product_variants via DB schema
    await db.delete(products).where(eq(products.id, productId));
    return;
  },

  async findProductsByDistributorIds(distributorIds = []) {
    if (!distributorIds || !distributorIds.length) return [];
    const rows = await db.select().from(products).where(products.distributorId.in(distributorIds)).orderBy(products.createdAt, "desc");
    const productIds = rows.map(r => r.id);
    let variants = [];
    if (productIds.length) {
      variants = await db.select().from(productVariants).where(productVariants.productId.in(productIds));
    }
    const map = Object.fromEntries(productIds.map(id => [id, []]));
    for (const v of variants) {
      if (!map[v.productId]) map[v.productId] = [];
      map[v.productId].push(v);
    }
    return rows.map(p => ({ ...p, variants: map[p.id] || [] }));
  },

  async getConnectedDistributorIdsForRetailer(retailerId) {
    const rows = await db.select().from(connections).where(eq(connections.retailerId, retailerId));
    return rows.map(r => r.distributorId);
  },

  // helper: find distributor id by user id (user -> distributors.userId)
  async findDistributorByUserId(userId) {
    const [row] = await db.select().from(distributors).where(eq(distributors.userId, userId));
    return row || null;
  },

   async findProductByName(name, distributorId) {
    const result = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.name, name),
          eq(products.distributorId, distributorId)
        )
      );
    return result[0] || null;
  },


  async findVariantBySku(sku, productId) {
    const result = await db
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.sku, sku),
          eq(productVariants.productId, productId)
        )
      );
    return result[0] || null;
  },

  async createVariant(data) {
    const result = await db.insert(productVariants).values(data).returning();
    return result[0];
  },

  async updateVariant(id, data) {
    return db
      .update(productVariants)
      .set(data)
      .where(eq(productVariants.id, id))
      .returning();
  }
};
