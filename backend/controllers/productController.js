import { models } from '../models/index.js';
export const addProduct = async (req, res) => {
  const { id, name, icon, distributorships, category, variants } = req.body;

  try {
    const productExists = await models.Product.findOne({ product_id: id, distributor_id: req.user.id });
    if (productExists) {
      return res.status(400).json({ message: 'Product with this ID already exists' });
    }

    const product = await models.Product.createWithVariants({
      distributor_id: req.user.id,
      product_id: id,
      name,
      icon,
      distributorships,
      category,
    }, variants);

    res.status(201).json(product);
  } catch (error) {
    console.error('❌ Error adding product:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

export const updateProduct = async (req, res) => {
  const { productId } = req.params;
  const { name, icon, category, variants } = req.body;

  try {
    const product = await models.Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const updatedProduct = await models.Product.update(productId, {
      name: name || product.name,
      icon: icon || product.icon,
      category: category || product.category,
    });

    // Note: Variant updates would need additional logic
    // This is simplified for the example

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('❌ Error updating product:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

export const deleteProduct = async (req, res) => {
  const { productId } = req.params;

  try {
    const product = await models.Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await models.Product.delete(productId);
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting product:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

export const getProducts = async (req, res) => {
  console.log('Fetching products with query:', req.query);
  try {
    const { distributorId, category, search } = req.query;

    if (!distributorId) {
      return res.status(400).json({ message: "Missing distributorId" });
    }

    const products = await models.Product.findByDistributor(distributorId, { category, search });
    res.status(200).json(products);
  } catch (error) {
    console.error("❌ Error fetching products:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
};

export const getProductsForConnectedDistributors = async (req, res) => {
  try {
    const connectedDistributors = await models.Retailer.getConnectedDistributors(req.user.id);
    const distributorIds = connectedDistributors.map(d => d.id);
    
    if (distributorIds.length === 0) {
      return res.json({ products: [] });
    }

    // Get products for all connected distributors
    const allProducts = [];
    for (const distributorId of distributorIds) {
      const products = await models.Product.findByDistributor(distributorId);
      allProducts.push(...products);
    }

    res.json({ products: allProducts });
  } catch (error) {
    console.error("❌ Error fetching connected distributors' products:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
};
