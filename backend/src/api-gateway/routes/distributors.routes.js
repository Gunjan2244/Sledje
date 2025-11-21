import express from "express";
import {
  getDistributorProfile,
  updateDistributorProfile
} from "../controllers/distributors.controller.js";

import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/profile", requireAuth, getDistributorProfile);
router.put("/profile", requireAuth, updateDistributorProfile);

export default router;
