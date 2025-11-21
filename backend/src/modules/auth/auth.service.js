import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "../../config/postgres.js";
import AuthRepo from "./auth.repository.js";
import { sendOtpEmail } from "./email.service.js";
import { publishUserRegistered, publishPasswordReset } from "./auth.events.js";
import { sql } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "please_change_this";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const SALT_ROUNDS = 10;

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export default {
  // ---------- REGISTER RETAILER ----------
  async registerRetailer(data) {
    const { email, password, phone, businessName, ownerName, gstNumber, businessType, pincode, location, address } = data;

    const existing = await AuthRepo.findUserByEmail(email);
    if (existing) throw new Error("Email already registered");

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    // Transaction: create user and retailer
    const created = await db.transaction(async (tx) => {
      const [userRow] = await tx.insert(db.table("users")).values({
        role: "retailer",
        email,
        password: hashed,
        phone,
      }).returning();

      const [retailerRow] = await tx.insert(db.table("retailers")).values({
        user_id: userRow.id,
        business_name: businessName,
        owner_name: ownerName,
        gst_number: gstNumber,
        business_type: businessType,
        pincode,
        location,
        address,
      }).returning();

      // optional: write to outbox if you want guaranteed publish
      await tx.insert(db.table("outbox")).values({
        event_type: "users.registered",
        payload: JSON.stringify({
          userId: userRow.id,
          role: "retailer",
          email,
          retailer: retailerRow,
          createdAt: userRow.created_at,
        }),
      });

      return { user: userRow, retailer: retailerRow };
    });

    // create token
    const token = signToken({ id: created.user.id, role: "retailer" });

    // Publish event asynchronously (outbox worker should handle publishing too)
    publishUserRegistered({
      userId: created.user.id,
      role: "retailer",
      email,
      retailer: created.retailer,
      createdAt: created.user.created_at,
    }).catch((e) => console.warn("publishUserRegistered failed:", e.message));

    return { message: "Registration successful", token, user: { id: created.user.id, email, role: "retailer" } };
  },

  // ---------- LOGIN RETAILER ----------
  async loginRetailer({ email, password }) {
    const user = await AuthRepo.findUserByEmail(email);
    if (!user) throw new Error("Invalid credentials");

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new Error("Invalid credentials");

    const role = user.role;
    if (role !== "retailer") throw new Error("Not a retailer account");

    // fetch profile
    const [retailerRow] = await db.select().from(db.table("retailers")).where(db.table("retailers").user_id.eq(user.id));

    const token = signToken({ id: user.id, role });

    return { token, user: { id: user.id, email: user.email, role, retailer: retailerRow } };
  },

  // ---------- REGISTER DISTRIBUTOR ----------
  async registerDistributor(data) {
    const { email, password, phone, companyName, ownerName, gstNumber, businessType, pincode, location, address } = data;
    const existing = await AuthRepo.findUserByEmail(email);
    if (existing) throw new Error("Email already registered");

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const created = await db.transaction(async (tx) => {
      const [userRow] = await tx.insert(db.table("users")).values({
        role: "distributor",
        email,
        password: hashed,
        phone,
      }).returning();

      const [distRow] = await tx.insert(db.table("distributors")).values({
        user_id: userRow.id,
        company_name: companyName,
        owner_name: ownerName,
        gst_number: gstNumber,
        business_type: businessType,
        pincode,
        location,
        address,
      }).returning();

      await tx.insert(db.table("outbox")).values({
        event_type: "users.registered",
        payload: JSON.stringify({
          userId: userRow.id,
          role: "distributor",
          email,
          distributor: distRow,
          createdAt: userRow.created_at,
        }),
      });

      return { user: userRow, distributor: distRow };
    });

    const token = signToken({ id: created.user.id, role: "distributor" });

    publishUserRegistered({
      userId: created.user.id,
      role: "distributor",
      email,
      distributor: created.distributor,
      createdAt: created.user.created_at,
    }).catch((e) => console.warn("publishUserRegistered failed:", e.message));

    return { message: "Registration successful", token, user: { id: created.user.id, email, role: "distributor" } };
  },

  // ---------- LOGIN DISTRIBUTOR ----------
  async loginDistributor({ email, password }) {
    const user = await AuthRepo.findUserByEmail(email);
    if (!user) throw new Error("Invalid credentials");

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new Error("Invalid credentials");

    const role = user.role;
    if (role !== "distributor") throw new Error("Not a distributor account");

    const [distRow] = await db.select().from(db.table("distributors")).where(db.table("distributors").user_id.eq(user.id));

    const token = signToken({ id: user.id, role });

    return { token, user: { id: user.id, email: user.email, role, distributor: distRow } };
  },

  // ---------- FORGOT PASSWORD (generate OTP) ----------
  async forgotPassword(email) {
    const user = await AuthRepo.findUserByEmail(email);
    if (!user) {
      // do not reveal whether email exists
      return;
    }

    // generate 6-digit OTP
    const otp = String(100000 + Math.floor(Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // save OTP (simple insert into otp_codes table)
    await AuthRepo.saveOtp({ email, otp, expiresAt });

    // send email (async)
    sendOtpEmail(email, otp).catch((e) => console.warn("sendOtpEmail failed:", e.message));
  },

  // ---------- VERIFY OTP ----------
  async verifyOtp(email, otp) {
    // uses AuthRepo.getValidOtp — returns row if OTP exists and not expired
    const row = await AuthRepo.getValidOtp(email, otp);
    return !!row;
  },

  // ---------- RESET PASSWORD ----------
  async resetPassword(email, otp, newPassword) {
    const row = await AuthRepo.getValidOtp(email, otp);
    if (!row) throw new Error("Invalid or expired OTP");

    // find user
    const user = await AuthRepo.findUserByEmail(email);
    if (!user) throw new Error("User not found");

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await AuthRepo.updatePassword(user.id, hashed);
    await AuthRepo.deleteOtp(email);

    // publish event
    publishPasswordReset({ userId: user.id, email }).catch((e) => console.warn(e.message));
  },

  // ---------- helper: verify token (used by middleware) ----------
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return null;
    }
  }
};
