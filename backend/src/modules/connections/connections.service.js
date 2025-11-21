import ConnectionsRepo from "./connections.repository.js";
import { publishEvent } from "../../events/jetstream.js";
import { db } from "../../config/postgres.js";
import { retailers, distributors, users } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export default {
  async sendRequest(retailerUserId, distributorId, message) {
    // Map user → retailer
    const [retailer] = await db.select().from(retailers).where(eq(retailers.userId, retailerUserId));
    if (!retailer) throw new Error("Retailer profile not found");

    // prevent duplicates
    const existing = await ConnectionsRepo.findExistingRequest(retailer.id, distributorId);
    if (existing && ["pending", "approved"].includes(existing.status)) {
      return existing;
    }

    const request = await ConnectionsRepo.createRequest(retailer.id, distributorId, message);

    publishEvent("connections.requested", request);

    return { message: "Connection request sent", request };
  },

  async getRetailerRequests(retailerUserId) {
    const [retailer] = await db.select().from(retailers).where(eq(retailers.userId, retailerUserId));
    if (!retailer) throw new Error("Retailer profile not found");
    return ConnectionsRepo.getRetailerRequests(retailer.id);
  },

  async getConnectedDistributors(retailerUserId) {
    const [retailer] = await db.select().from(retailers).where(eq(retailers.userId, retailerUserId));

    const cons = await ConnectionsRepo.getRetailerConnections(retailer.id);
    const distributorIds = cons.map((c) => c.distributorId);

    if (!distributorIds.length) return [];

    return db.select().from(distributors).where(distributors.id.in(distributorIds));
  },

  async getDistributorRequests(distributorUserId) {
    const [dist] = await db.select().from(distributors).where(eq(distributors.userId, distributorUserId));
    return ConnectionsRepo.getDistributorRequests(dist.id);
  },

  async getConnectedRetailers(distributorUserId) {
    const [dist] = await db.select().from(distributors).where(eq(distributors.userId, distributorUserId));

    const cons = await ConnectionsRepo.getDistributorConnections(dist.id);
    const retailerIds = cons.map((c) => c.retailerId);

    if (!retailerIds.length) return [];

    return db.select().from(retailers).where(retailers.id.in(retailerIds));
  },

  async respondToRequest(distributorUserId, requestId, action, rejectionReason) {
    const [dist] = await db.select().from(distributors).where(eq(distributors.userId, distributorUserId));
    const requests = await ConnectionsRepo.getDistributorRequests(dist.id);
    const req = requests.find((r) => r.id === requestId);
    if (!req) throw new Error("Request not found");

    if (action === "approve") {
      const approved = await ConnectionsRepo.approveRequest(requestId);
      await ConnectionsRepo.createConnection(req.retailerId, req.distributorId);

      publishEvent("connections.approved", approved);
      return { message: "Request approved" };
    }

    if (action === "reject") {
      const rejected = await ConnectionsRepo.rejectRequest(requestId, rejectionReason);
      publishEvent("connections.rejected", rejected);
      return { message: "Request rejected" };
    }

    throw new Error("Invalid action");
  },

  async removeConnection(userId, distributorId) {
    const [retailer] = await db.select().from(retailers).where(eq(retailers.userId, userId));
    await ConnectionsRepo.removeConnection(retailer.id, distributorId);
    publishEvent("connections.deleted", { retailerId: retailer.id, distributorId });
    return { message: "Connection removed" };
  },

  async searchDistributors(retailerUserId, filters) {
    return ConnectionsRepo.searchDistributors(filters);
  },

  async suggestedDistributors(retailerUserId) {
    const [retailer] = await db.select().from(retailers).where(eq(retailers.userId, retailerUserId));

    // Suggestions based on pincode + businessType
    const distributors = await db.select().from(distributors).where(
      distributors.pincode.eq(retailer.pincode)
    );
    return distributors;
  },

  async searchRetailers(distributorUserId, filters) {
    return ConnectionsRepo.searchRetailers(filters);
  },

  async suggestedRetailers(distributorUserId) {
    const [dist] = await db.select().from(distributors).where(eq(distributors.userId, distributorUserId));
    return db.select().from(retailers).where(eq(retailers.pincode, dist.pincode));
  }
};
