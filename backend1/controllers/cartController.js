import { models } from '../models/index.js';
export const saveCart = async (req, res) => {
  const { cartItems } = req.body;
  
  try {
    if (!Array.isArray(cartItems)) {
      return res.status(400).json({ message: "Invalid cart" });
    }

    await models.Cart.saveItems(req.user.id, cartItems);
    res.json({ message: "Cart saved" });
  } catch (error) {
    console.error('Error saving cart:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

export const getCart = async (req, res) => {
  try {
    const items = await models.Cart.getItems(req.user.id);
    res.json(items);
  } catch (error) {
    console.error('Error getting cart:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

export const clearCart = async (req, res) => {
  try {
    await models.Cart.clearItems(req.user.id);
    res.json({ message: "Cart cleared" });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};
