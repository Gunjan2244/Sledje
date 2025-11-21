import express from "express";
import {
  getRetailerProfile,
  updateRetailerProfile
} from "../controllers/retailers.controller.js";

import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

// role: retailer
router.get("/profile", requireAuth, getRetailerProfile);
router.put("/profile", requireAuth, updateRetailerProfile);

export default router;
