import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "../../config/postgres.js";
import AuthRepo from "./auth.repository.js";
import { sendOtpEmail } from "./email.service.js";
import { publishUserRegistered, publishPasswordReset } from "./auth.events.js";
import { eq } from "drizzle-orm";

import {
  users,
  retailers,
  distributors,
  outbox,
  otpCodes,
} from "../../db/schema.js";

const JWT_SECRET = process.env.JWT_SECRET || "please_change_this";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const SALT_ROUNDS = 10;

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export default {
  // ---------- REGISTER RETAILER ----------
  async registerRetailer(data) {
    const {
      email,
      password,
      phone,
      businessName,
      ownerName,
      gstNumber,
      businessType,
      pincode,
      location,
      address
    } = data;

    const existing = await AuthRepo.findUserByEmail(email);
    if (existing) throw new Error("Email already registered");

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const created = await db.transaction(async (tx) => {
      // 1) Create user
      const [userRow] = await tx
        .insert(users)
        .values({
          role: "retailer",      // ⚠ ensure this field exists in schema
          email,
          password: hashed,
          phone,
        })
        .returning();

      // 2) Create retailer
      const [retailerRow] = await tx
        .insert(retailers)
        .values({
          userId: userRow.id,          // ⚠ confirm: is this userId or user_id?
          businessName,                // ⚠ confirm schema field names
          ownerName,
          gstNumber,
          businessType,
          pincode,
          location,
          address,

        })
        .returning();

      // 3) Insert outbox entry
      await tx.insert(outbox).values({
        eventType: "users.registered",      // ⚠ confirm schema uses camelCase or snake_case
        payload: {
          userId: userRow.id,
          role: "retailer",
          email,
          retailer: retailerRow,
          createdAt: userRow.createdAt,     // ⚠ confirm field name
        },
      });

      return { user: userRow, retailer: retailerRow };
    });

    const token = signToken({ id: created.user.id, role: "retailer" });

    publishUserRegistered({
      userId: created.user.id,
      role: "retailer",
      email,
      retailer: created.retailer,
      createdAt: created.user.createdAt,
    }).catch((e) =>
      console.warn("publishUserRegistered failed:", e.message)
    );

    return {
      message: "Registration successful",
      token,
      user: { id: created.user.id, email, role: "retailer" },
    };
  },

  // ---------- LOGIN RETAILER ----------
  async loginRetailer({ email, password }) {
    const user = await AuthRepo.findUserByEmail(email);
    if (!user) throw new Error("Invalid credentials");

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new Error("Invalid credentials");

    if (user.role !== "retailer")
      throw new Error("Not a retailer account");

    const [retailerRow] = await db
      .select()
      .from(retailers)
      .where(eq(retailers.userId, user.id));

    const token = signToken({ id: user.id, role: user.role });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        retailer: retailerRow,
      },
    };
  },

  // ---------- REGISTER DISTRIBUTOR ----------
  async registerDistributor(data) {
    const {
      email,
      password,
      phone,
      companyName,
      ownerName,
      gstNumber,
      businessType,
      pincode,
      location,
      address
    } = data;

    const existing = await AuthRepo.findUserByEmail(email);
    if (existing) throw new Error("Email already registered");

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const created = await db.transaction(async (tx) => {
      const [userRow] = await tx
        .insert(users)
        .values({
          role: "distributor",
          email,
          password: hashed,
          phone,
        })
        .returning();

      const [distRow] = await tx
        .insert(distributors)
        .values({
          userId: userRow.id,        // ⚠ confirm field
          companyName,
          ownerName,
          gstNumber,
          businessType,
          pincode,
          location,
          address,
        })
        .returning();

      await tx.insert(outbox).values({
        eventType: "users.registered",
        payload: {
          userId: userRow.id,
          role: "distributor",
          email,
          distributor: distRow,
          createdAt: userRow.createdAt,
        },
      });

      return { user: userRow, distributor: distRow };
    });

    const token = signToken({
      id: created.user.id,
      role: "distributor",
    });

    publishUserRegistered({
      userId: created.user.id,
      role: "distributor",
      email,
      distributor: created.distributor,
      createdAt: created.user.createdAt,
    }).catch((e) => console.warn("publishUserRegistered failed:", e.message));

    return {
      message: "Registration successful",
      token,
      user: { id: created.user.id, email, role: "distributor" },
    };
  },

  // ---------- LOGIN DISTRIBUTOR ----------
  async loginDistributor({ email, password }) {
    const user = await AuthRepo.findUserByEmail(email);
    if (!user) throw new Error("Invalid credentials");

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new Error("Invalid credentials");

    if (user.role !== "distributor")
      throw new Error("Not a distributor account");

    const [distRow] = await db
      .select()
      .from(distributors)
      .where(eq(distributors.userId, user.id));

    const token = signToken({ id: user.id, role: user.role });

    return {
      token,
      user: { id: user.id, email: user.email, role: user.role, distributor: distRow },
    };
  },
};            