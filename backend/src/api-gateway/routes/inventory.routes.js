import express from "express";
import {
  getInventory,
  addVariantToInventory,
  updateInventoryAfterOrder
} from "../controllers/inventory.controller.js";

import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", requireAuth, getInventory);
router.post("/add", requireAuth, addVariantToInventory);
router.post("/checkout", requireAuth, updateInventoryAfterOrder);

export default router;
