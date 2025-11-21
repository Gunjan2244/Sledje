import express from "express";
import {
  sendConnectionRequest,
  getRetailerRequests,
  getConnectedDistributors,
  getDistributorRequests,
  getConnectedRetailers,
  respondToRequest,
  removeConnection,
  searchDistributors,
  suggestedDistributors,
  searchRetailers,
  suggestedRetailers,
} from "../controllers/connections.controller.js";

import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

// RETAILER → Distributor
router.post("/request", requireAuth, sendConnectionRequest);
router.get("/retailer/requests", requireAuth, getRetailerRequests);
router.get("/retailer/distributors", requireAuth, getConnectedDistributors);

// DISTRIBUTOR → Retailer
router.get("/distributor/requests", requireAuth, getDistributorRequests);
router.get("/distributor/retailers", requireAuth, getConnectedRetailers);

// Distributor responds to request
router.put("/respond/:requestId", requireAuth, respondToRequest);

// Remove connection
router.delete("/remove/:distributorId", requireAuth, removeConnection);

// Search
router.get("/search/distributors", requireAuth, searchDistributors);
router.get("/suggestions", requireAuth, suggestedDistributors);

router.get("/retailers/search", requireAuth, searchRetailers);
router.get("/suggest/retailers", requireAuth, suggestedRetailers);

export default router;
