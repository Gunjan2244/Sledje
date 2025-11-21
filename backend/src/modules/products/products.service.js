import ProductsRepo from "./products.repository.js";
import { publishEvent } from "../../events/jetstream.js";
import crypto from "crypto";


import { db } from "../../config/postgres.js";
import { eq } from "drizzle-orm";

export default {
  async getProducts({ distributorId, search, page, limit }) {
    // when distributorId is provided, fetch its products
    return ProductsRepo.findProductsByDistributor(distributorId, { search, page, limit });
  },

  async getProductsFromConnectedDistributors(userId) {
    // find connected distributors for this retailer
    const distributorIds = await ProductsRepo.getConnectedDistributorIdsForRetailer(userId);
    if (!distributorIds || distributorIds.length === 0) return [];
    return ProductsRepo.findProductsByDistributorIds(distributorIds);
  },

  async getProductById(productId) {
    return ProductsRepo.findProductById(productId);
  },

  async createProduct(distributorUserId, payload) {
    // ensure distributorUserId maps to distributor record
    const distributor = await ProductsRepo.findDistributorByUserId(distributorUserId);
    if (!distributor) throw new Error("Distributor profile not found");

    const result = await ProductsRepo.createProduct(distributor.id, payload);

    // publish event for other services if needed
    publishEvent("products.created", {
      productId: result.id,
      distributorId: distributor.id,
      name: result.name,
      variants: result.variants
    }).catch((e) => console.warn("publish products.created failed:", e.message));

    return result;
  },

  async updateProduct(distributorUserId, productId, payload) {
    const distributor = await ProductsRepo.findDistributorByUserId(distributorUserId);
    if (!distributor) throw new Error("Distributor profile not found");

    // ownership check: ensure product belongs to distributor
    const product = await ProductsRepo.findProductById(productId);
    if (!product) throw new Error("Product not found");
    if (product.distributorId !== distributor.id) throw new Error("Not allowed to modify this product");

    const updated = await ProductsRepo.updateProduct(distributor.id, productId, payload);

    publishEvent("products.updated", {
      productId,
      distributorId: distributor.id,
      updated
    }).catch((e) => console.warn("publish products.updated failed:", e.message));

    return updated;
  },

  async deleteProduct(distributorUserId, productId) {
    const distributor = await ProductsRepo.findDistributorByUserId(distributorUserId);
    if (!distributor) throw new Error("Distributor profile not found");

    const product = await ProductsRepo.findProductById(productId);
    if (!product) throw new Error("Product not found");
    if (product.distributorId !== distributor.id) throw new Error("Not allowed to delete this product");

    await ProductsRepo.deleteProduct(productId);

    publishEvent("products.deleted", { productId, distributorId: distributor.id }).catch((e) =>
      console.warn("publish products.deleted failed:", e.message)
    );
  },

   // Bulk import: rows is array of objects from CSV/Excel
  async bulkInsert(rows, distributorUserId) {
    // 1) Resolve distributor from user
    const distributor = await ProductsRepo.findDistributorByUserId(distributorUserId);
    if (!distributor) throw new Error("Distributor profile not found");

    const distributorId = distributor.id;

    // 2) For each row, create/update product + variant
    for (const row of rows) {
      // Basic required fields
      const name = row.name?.trim();
      const variantName = row.variantName?.trim();
      const sku = row.sku?.trim();

      if (!name || !variantName || !sku) {
        // Skip bad rows, or you can collect errors
        continue;
      }

      const category = row.category || null;
      const subcategory = row.subcategory || null;

      // Numeric conversions
      const stock = Number(row.stock || 0);
      const costPrice = Number(row.costPrice || 0);
      const sellingPrice = Number(row.sellingPrice || 0);
      const gstRate = row.gstRate != null ? Number(row.gstRate) : 0;

      // GST + HSN
      const hsnCode = row.hsnCode || null;
      const isTaxInclusive =
        row.isTaxInclusive != null
          ? row.isTaxInclusive === true ||
            row.isTaxInclusive === "true" ||
            row.isTaxInclusive === "1"
          : false;

      // optional fields
      const unit = row.unit || null;
      const expiry = row.expiry ? new Date(row.expiry) : null;

      // 2a) Ensure product exists
      const productId = await this.findOrCreateProduct({
        name,
        category,
        subcategory,
        distributorId,
      });

      // 2b) Ensure variant exists / updated
      await this.insertVariant(productId, {
        variantName,
        sku,
        stock,
        costPrice,
        sellingPrice,
        expiry,
        hsnCode,
        gstRate,
        unit,
        isTaxInclusive,
      });
    }
  },

  async findOrCreateProduct({ name, category, subcategory = null, distributorId }) {
    // 1. Try to find existing product with same distributor + name
    let product = await ProductsRepo.findProductByName(name, distributorId);

    if (product) return product.id; // Found → Use existing

    // 2. Create new product using repo's shape
    const productPayload = {
      name,
      icon: "📦",
      category,
      subcategory,
      variants: [], // we'll insert variants separately
    };

    const created = await ProductsRepo.createProduct(distributorId, productPayload);
    return created.id;
  },

  // Insert or update a variant for the product
  async insertVariant(
    productId,
    {
      variantName,
      sku,
      stock,
      costPrice,
      sellingPrice,
      expiry,
      hsnCode,
      gstRate,
      unit,
      isTaxInclusive,
    }
  ) {
    // 1. Check if variant already exists under this product
    const existing = await ProductsRepo.findVariantBySku(sku, productId);
    const data = {
      productId,
      name: variantName,
      sku,
      stock,
      costPrice,
      sellingPrice,
      expiry,
      hsnCode,
      gstRate: String(gstRate),
      unit,
      isTaxInclusive,
    };

    if (existing) {
      // update
      await ProductsRepo.updateVariant(existing.id, data);
      return existing.id;
    }

    // 2. Insert new variant
    const created = await ProductsRepo.createVariant({
      id: crypto.randomUUID(),
      ...data,
    });

    return created.id;
  },

};
