import { db } from "../../config/postgres.js";
import {
  users,
  retailers,
  distributors,
  // otp table name in your schema: we expect otp_codes table (if not present, create it)
} from "../../db/schema.js";
import { sql,eq } from "drizzle-orm";


export default {
  // Users
  async createUser({ role, email, password, phone }) {
    const [row] = await db.insert(users).values({
      role,
      email,
      password,
      phone,
    }).returning();
    return row;
  },

  async findUserByEmail(email) {
    const [row] = await db.select().from(users).where(eq(users.email, email));;
    return row || null;
  },

  async findUserById(id) {
    const [row] = await db.select().from(users).where(users.id.eq(id));
    return row || null;
  },

  // Retailer
  async createRetailer({ userId, businessName, ownerName, gstNumber, businessType, pincode, location, address }) {
    const [row] = await db.insert(retailers).values({
      userId,
      businessName,
      ownerName,
      gstNumber,
      businessType,
      pincode,
      location,
      
      address,
    }).returning();
    return row;
  },

  async findRetailerByUserId(userId) {
    const [row] = await db.select().from(retailers).where(retailers.userId.eq(userId));
    return row || null;
  },

  // Distributor
  async createDistributor({ userId, companyName, ownerName, gstNumber, businessType, pincode, location, address }) {
    const [row] = await db.insert(distributors).values({
      userId,
      companyName,
      ownerName,
      gstNumber,
      businessType,
      pincode,
      location,
      address,
    }).returning();
    return row;
  },

  async findDistributorByUserId(userId) {
    const [row] = await db.select().from(distributors).where(distributors.userId.eq(userId));
    return row || null;
  },

  // OTP: raw SQL - expects otp_codes table present
  async saveOtp({ email, otp, expiresAt }) {
    return db.execute(sql`INSERT INTO otp_codes (email, otp, expires_at) VALUES (${email}, ${otp}, ${expiresAt})`);
  },

  async getValidOtp(email, otp) {
    const now = new Date().toISOString();
    const [row] = await db.select().from(sql`otp_codes`).where(sql`email = ${email} AND otp = ${otp} AND expires_at > ${now}`);
    // NOTE: drizzle doesn't have dynamic table ref via variable; using raw SQL above for otp_codes.
    return row || null;
  },

  async deleteOtp(email) {
    return db.execute(sql`DELETE FROM otp_codes WHERE email = ${email}`);
  },

  // update password
  async updatePassword(userId, newHashed) {
    const [row] = await db.update(users).set({ password: newHashed }).where(users.id.eq(userId)).returning();
    return row;
  }
};
