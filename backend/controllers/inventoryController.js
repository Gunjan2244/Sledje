import { models } from '../models/index.js';
export const getInventory = async (req, res) => {
  try {
    console.log('📥 Fetching inventory for retailer:', req.user.id);
    
    const inventory = await models.Inventory.getRetailerInventory(req.user.id);

    // Group by product and format response
    const inventoryMap = {};
    
    inventory.forEach(item => {
      const productKey = item.product_id;
      
      if (!inventoryMap[productKey]) {
        inventoryMap[productKey] = {
          id: item.product_id,
          name: item.product_name,
          icon: item.product_icon,
          distributorId: item.distributor_id,
          distributor: item.distributor_name,
          category: item.category,
          subcategory: item.category, // Using same for both levels
          variants: []
        };
      }

      inventoryMap[productKey].variants.push({
        id: item.variant_id,
        _id: item.variant_id,
        name: item.variant_name,
        stock: item.stock,
        sellingPrice: parseFloat(item.selling_price),
        costPrice: parseFloat(item.cost_price),
        expiry: item.expiry,
        sku: item.sku
      });
    });

    const inventoryData = Object.values(inventoryMap);
    res.status(200).json(inventoryData);
  } catch (error) {
    console.error('❌ Error fetching inventory:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

export const updateInventoryStock = async (req, res) => {
  const { productId, variantId, quantity } = req.body;

  try {
    if (!productId || !variantId || quantity === undefined || quantity <= 0) {
      return res.status(400).json({ message: 'Invalid input data' });
    }

    const inventoryItem = await models.Inventory.updateStock(req.user.id, variantId, quantity);

    if (!inventoryItem) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    res.status(200).json({ message: 'Inventory stock updated successfully', inventoryItem });
  } catch (error) {
    console.error('❌ Error updating inventory stock:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

export const checkoutInventory = async (req, res) => {
  const { cartItems } = req.body;

  try {
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ message: 'Cart is empty or invalid' });
    }

    // Convert cart items to inventory update format
    const inventoryUpdates = cartItems.map(item => ({
      variant_id: item.variantId,
      quantity: item.quantity
    }));

    await models.Inventory.bulkUpdateStock(req.user.id, inventoryUpdates);

    res.status(200).json({ message: 'Checkout successful, inventory updated' });
  } catch (error) {
    console.error('❌ Error during checkout:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

export const addToInventory = async (req, res) => {
  const { variantId, stock = 0 } = req.body;
  console.log('Adding to inventory:', variantId, stock);

  try {
    // Find the product and variant by variantId
    const variantQuery = `
      SELECT 
        pv.*,
        p.id as product_id,
        p.distributor_id
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.id = $1
    `;
    
    const variantResult = await models.Inventory.query(variantQuery, [variantId]);
    const variant = variantResult.rows[0];
    
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    const inventoryItem = await models.Inventory.addToInventory({
      retailer_id: req.user.id,
      distributor_id: variant.distributor_id,
      product_id: variant.product_id,
      variant_id: variant.id,
      sku: variant.sku,
      stock
    });

    res.status(200).json({ message: 'Product variant added to inventory', inventoryItem });
  } catch (error) {
    console.error('❌ Error adding to inventory:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};