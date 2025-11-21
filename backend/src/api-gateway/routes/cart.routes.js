import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  checkoutCart
} from "../controllers/cart.controller.js";

const router = express.Router();

router.get("/", requireAuth, getCart);
router.post("/add", requireAuth, addToCart);
router.put("/update", requireAuth, updateCartItem);
router.delete("/:variantId", requireAuth, removeCartItem);
router.delete("/", requireAuth, clearCart);

// Order creation from cart
router.post("/checkout", requireAuth, checkoutCart);

export default router;
