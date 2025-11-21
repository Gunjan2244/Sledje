import { db } from "../../config/postgres.js";
import { distributors, users } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export default {
  async findByUserId(userId) {
    const result = await db
      .select()
      .from(distributors)
      .leftJoin(users, eq(users.id, distributors.userId))
      .where(eq(distributors.userId, userId));

    return result[0] || null;
  },

  async updateProfile(userId, data) {
    const updated = await db
      .update(distributors)
      .set({
        companyName: data.companyName,
        ownerName: data.ownerName,
        gstNumber: data.gstNumber,
        businessType: data.businessType,
        pincode: data.pincode,
        location: data.location,
        address: data.address,
      })
      .where(eq(distributors.userId, userId))
      .returning();

    return updated[0];
  },
};
    