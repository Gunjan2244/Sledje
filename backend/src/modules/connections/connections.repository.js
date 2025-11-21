import { db } from "../../config/postgres.js";
import { connectionRequests, connections, retailers, distributors, users } from "../../db/schema.js";
import { eq, and, ilike } from "drizzle-orm";

export default {
  // Retailer initiates request
  async createRequest(retailerId, distributorId, message) {
    const rows = await db.insert(connectionRequests).values({
      retailerId,
      distributorId,
      message,
      status: "pending",
    }).returning();
    return rows[0];
  },

  async findExistingRequest(retailerId, distributorId) {
    const rows = await db.select().from(connectionRequests).where(
      and(eq(connectionRequests.retailerId, retailerId),
          eq(connectionRequests.distributorId, distributorId))
    );
    return rows[0] || null;
  },

  async getRetailerRequests(retailerId) {
    return db
      .select()
      .from(connectionRequests)
      .where(eq(connectionRequests.retailerId, retailerId));
  },

  async getDistributorRequests(distributorId) {
    return db
      .select()
      .from(connectionRequests)
      .where(eq(connectionRequests.distributorId, distributorId));
  },

  async approveRequest(requestId) {
    const [row] = await db
      .update(connectionRequests)
      .set({ status: "approved" })
      .where(eq(connectionRequests.id, requestId))
      .returning();
    return row;
  },

  async rejectRequest(requestId, reason) {
    const [row] = await db
      .update(connectionRequests)
      .set({ status: "rejected", rejectionReason: reason })
      .where(eq(connectionRequests.id, requestId))
      .returning();
    return row;
  },

  async createConnection(retailerId, distributorId) {
    return db.insert(connections)
      .values({ retailerId, distributorId })
      .returning();
  },

  async getRetailerConnections(retailerId) {
    return db.select().from(connections).where(eq(connections.retailerId, retailerId));
  },

  async getDistributorConnections(distributorId) {
    return db.select().from(connections).where(eq(connections.distributorId, distributorId));
  },

  async removeConnection(retailerId, distributorId) {
    await db
      .delete(connections)
      .where(
        and(eq(connections.retailerId, retailerId), eq(connections.distributorId, distributorId))
      );
  },

  // Search distributors
  async searchDistributors(filters) {
    let q = db.select().from(distributors);

    if (filters.companyName) {
      q = q.where(ilike(distributors.companyName, `%${filters.companyName}%`));
    }
    if (filters.location) {
      q = q.where(ilike(distributors.location, `%${filters.location}%`));
    }
    if (filters.businessType) {
      q = q.where(eq(distributors.businessType, filters.businessType));
    }
    if (filters.pincode) {
      q = q.where(eq(distributors.pincode, filters.pincode));
    }

    return q;
  },

  // Search retailers
  async searchRetailers(filters) {
    let q = db.select().from(retailers);

    if (filters.businessName) {
      q = q.where(ilike(retailers.businessName, `%${filters.businessName}%`));
    }
    if (filters.location) {
      q = q.where(ilike(retailers.location, `%${filters.location}%`));
    }
    if (filters.businessType) {
      q = q.where(eq(retailers.businessType, filters.businessType));
    }
    if (filters.pincode) {
      q = q.where(eq(retailers.pincode, filters.pincode));
    }

    return q;
  }
};
