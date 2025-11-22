import {
  pgTable,
  text,
  uuid,
  integer,
  timestamp,
  numeric,
  boolean,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";

/* ===============================
   1. USERS (for login/auth)
   =============================== */

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  role: text("role").notNull(), // retailer | distributor

  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  phone: text("phone").notNull(),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   2. RETAILERS
   =============================== */

export const retailers = pgTable("retailers", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),

  businessName: text("business_name").notNull(),
  ownerName: text("owner_name").notNull(),

  gstNumber: text("gst_number"),
  businessType: text("business_type").notNull(),

  pincode: text("pincode").notNull(),
  state: text("state"), // for GST intra/inter state logic
  location: text("location"),
  address: text("address"),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   3. DISTRIBUTORS
   =============================== */

export const distributors = pgTable("distributors", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),

  companyName: text("company_name").notNull(),
  ownerName: text("owner_name").notNull(),

  gstNumber: text("gst_number"),
  businessType: text("business_type").notNull(),

  pincode: text("pincode").notNull(),
  state: text("state"), // for GST intra/inter state logic
  location: text("location"),
  address: text("address"),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   4. CONNECTION REQUESTS
   =============================== */

export const connectionRequests = pgTable("connection_requests", {
  id: uuid("id").defaultRandom().primaryKey(),

  retailerId: uuid("retailer_id").references(() => retailers.id, {
    onDelete: "cascade",
  }),

  distributorId: uuid("distributor_id").references(() => distributors.id, {
    onDelete: "cascade",
  }),

  status: text("status").default("pending"), // pending | approved | rejected
  message: text("message"),
  rejectionReason: text("rejection_reason"),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   5. CONNECTIONS (approved)
   =============================== */

export const connections = pgTable(
  "connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    retailerId: uuid("retailer_id").references(() => retailers.id, {
      onDelete: "cascade",
    }),

    distributorId: uuid("distributor_id").references(() => distributors.id, {
      onDelete: "cascade",
    }),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("uq_connection_pair").on(table.retailerId, table.distributorId),
  ]
);

/* ===============================
   6. PRODUCTS
   =============================== */

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),

  distributorId: uuid("distributor_id").references(() => distributors.id, {
    onDelete: "cascade",
  }),

  name: text("name").notNull(),
  icon: text("icon"),
  category: text("category"),
  subcategory: text("subcategory"),

  // optional: base reorder level (retailer-specific kept on inventory)
  reorderLevel: integer("reorder_level").default(5),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   7. PRODUCT VARIANTS
   =============================== */

export const productVariants = pgTable("product_variants", {
  id: uuid("id").defaultRandom().primaryKey(),

  productId: uuid("product_id").references(() => products.id, {
    onDelete: "cascade",
  }),

  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),

  unit: text("unit"),
  hsnCode: text("hsn_code"),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).default("0"),
  isTaxInclusive: boolean("is_tax_inclusive").default(false),

  stock: integer("stock").notNull().default(0),
  sellingPrice: numeric("selling_price", { precision: 10, scale: 2 }).notNull(),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 }).notNull(),

  expiry: timestamp("expiry"),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   8. RETAILER INVENTORY
   =============================== */

export const inventory = pgTable("inventory", {
  id: uuid("id").defaultRandom().primaryKey(),

  retailerId: uuid("retailer_id").references(() => retailers.id, {
    onDelete: "cascade",
  }),

  variantId: uuid("variant_id").references(() => productVariants.id, {
    onDelete: "cascade",
  }),

  qty: integer("qty").notNull().default(0),

  // per-retailer reorder level (for low stock alerts)
  reorderLevel: integer("reorder_level").default(5),

  // optional expiry at retailer level (per-batch would need separate table)
  expiry: timestamp("expiry"),

  dailyAvgSales: numeric("daily_avg_sales", {
    precision: 10,
    scale: 2,
  }).default("0"),

  lastUpdated: timestamp("last_updated").defaultNow(),
});

/* ===============================
   9. CART
   =============================== */

export const carts = pgTable("carts", {
  id: uuid("id").defaultRandom().primaryKey(),

  retailerId: uuid("retailer_id").references(() => retailers.id, {
    onDelete: "cascade",
  }),

  variantId: uuid("variant_id").references(() => productVariants.id),
  distributorId: uuid("distributor_id").references(() => distributors.id),

  quantity: integer("quantity").notNull(),
  unit: text("unit"),
  price: numeric("price", { precision: 10, scale: 2 }),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   10. ORDERS
   =============================== */

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),

  orderNumber: text("order_number").notNull().unique(),

  retailerId: uuid("retailer_id").references(() => retailers.id),
  distributorId: uuid("distributor_id").references(() => distributors.id),

  status: text("status")
    .notNull()
    .default("pending"), // pending | modified | processing | cancelled | completed

  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  expectedDelivery: timestamp("expected_delivery"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),

  // optional timestamps for analytics / audit
  acceptedAt: timestamp("accepted_at"),
  deliveredAt: timestamp("delivered_at"),
  completedAt: timestamp("completed_at"),
});

/* ===============================
   11. ORDER ITEMS
   =============================== */

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),

  orderId: uuid("order_id").references(() => orders.id, {
    onDelete: "cascade",
  }),

  variantId: uuid("variant_id").references(() => productVariants.id),

  productName: text("product_name"),
  variantName: text("variant_name"),
  sku: text("sku"),

  quantity: integer("quantity").notNull(),
  unit: text("unit"),

  variantSellingPrice: numeric("variant_selling_price", {
    precision: 10,
    scale: 2,
  }),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   12. NOTIFICATIONS
   =============================== */

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),

  title: text("title"),
  message: text("message"),
  type: text("type"),

  // optional: who triggered this & what entity
  entityId: uuid("entity_id"),
  actorId: uuid("actor_id"),

  read: boolean("read").default(false),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   15. LEDGER
   =============================== */

export const ledger = pgTable("ledger", {
  id: uuid("id").defaultRandom().primaryKey(),

  retailerId: uuid("retailer_id").references(() => retailers.id),
  distributorId: uuid("distributor_id").references(() => distributors.id),

  type: text("type").notNull(), // debit | credit
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  balance: numeric("balance", { precision: 10, scale: 2 }).notNull(),

  orderId: uuid("order_id"),
  billId: uuid("productBillId"),

  // generic reference type/id for any entity (invoice, payment, adjustment)
  referenceType: text("reference_type"),
  referenceId: uuid("reference_id"),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   16. OUTBOX
   =============================== */

export const outbox = pgTable(
  "outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    published: boolean("published").default(false),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_outbox_published").on(table.published)]
);

/* ===============================
   17. OTP CODES
   =============================== */

export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").defaultRandom().primaryKey(),

  email: text("email").notNull(),
  otp: text("otp").notNull(),

  expiresAt: timestamp("expires_at", { withTimezone: false }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow(),
});

/* ===============================
   18. PRODUCT BILLS (per variant)
   =============================== */

export const productBills = pgTable(
  "product_bills",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    retailerId: uuid("retailer_id").notNull(),
    distributorId: uuid("distributor_id").notNull(),
    variantId: uuid("variant_id").notNull(),

    outstandingBalance: numeric("outstanding_balance", {
      precision: 14,
      scale: 2,
    }).default("0"),
    totalAmountPaid: numeric("total_amount_paid", {
      precision: 14,
      scale: 2,
    }).default("0"),
    totalAmountDue: numeric("total_amount_due", {
      precision: 14,
      scale: 2,
    }).default("0"),
    totalQuantityDelivered: integer("total_quantity_delivered").default(0),

    currentUnitCost: numeric("current_unit_cost", {
      precision: 12,
      scale: 2,
    }).default("0"),
    lastTransactionDate: timestamp("last_transaction_date"),
    meta: jsonb("meta"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_product_bills_retailer_variant").on(
      table.retailerId,
      table.variantId
    ),
  ]
);

/* ===============================
   19. PRODUCT BILL TRANSACTIONS
   =============================== */

export const productBillTransactions = pgTable("product_bill_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  productBillId: uuid("product_bill_id")
    .notNull()
    .references(() => productBills.id, { onDelete: "cascade" }),

  date: timestamp("date").defaultNow(),
  quantity: integer("quantity").default(0),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).default("0"),
  amount: numeric("amount", { precision: 14, scale: 2 }).default("0"),
  type: text("type").notNull(), // delivery | return | payment | adjustment
  metadata: jsonb("metadata"),
});

/* ===============================
   20. PRODUCT DELIVERY LOG
   =============================== */

export const productDeliveryLog = pgTable(
  "product_delivery_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").notNull(),
    productBillId: uuid("product_bill_id")
      .notNull()
      .references(() => productBills.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").notNull(),
    quantityDelivered: integer("quantity_delivered").notNull().default(0),
    unitCost: numeric("unit_cost", {
      precision: 12,
      scale: 2,
    }).default("0"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("uq_product_delivery_order_bill").on(
      table.orderId,
      table.productBillId
    ),
  ]
);

/* ===============================
   21. INVOICES
   =============================== */

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    retailerId: uuid("retailer_id").notNull(),
    distributorId: uuid("distributor_id").notNull(),

    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),

    currency: text("currency").default("INR"),
    gstNumber: text("gst_number"),
    placeOfSupply: text("place_of_supply"),
    invoiceNumber: text("invoice_number"),

    totalTaxableValue: numeric("total_taxable_value", {
      precision: 14,
      scale: 2,
    }),
    totalGst: numeric("total_gst", { precision: 14, scale: 2 }),
    cgst: numeric("cgst", { precision: 14, scale: 2 }),
    sgst: numeric("sgst", { precision: 14, scale: 2 }),
    igst: numeric("igst", { precision: 14, scale: 2 }),

    totalAmount: numeric("total_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),

    status: text("status").notNull().default("draft"), // draft | issued | paid | partial

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),

    metadata: jsonb("metadata"),
  },
  (table) => [
    index("idx_invoices_retailer_distributor").on(
      table.retailerId,
      table.distributorId
    ),
    unique("uq_invoice_period").on(
      table.retailerId,
      table.distributorId,
      table.periodStart,
      table.periodEnd
    ),
  ]
);

/* ===============================
   22. INVOICE ITEMS
   =============================== */

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),

    productBillId: uuid("product_bill_id").notNull(),
    variantId: uuid("variant_id").notNull(),

    quantity: integer("quantity").notNull().default(0),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),

    // GST / HSN fields (per line item)
    hsnCode: text("hsn_code"),
    taxableValue: numeric("taxable_value", {
      precision: 14,
      scale: 2,
    }),
    cgst: numeric("cgst", { precision: 14, scale: 2 }),
    sgst: numeric("sgst", { precision: 14, scale: 2 }),
    igst: numeric("igst", { precision: 14, scale: 2 }),

    amount: numeric("amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),

    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_invoice_items_invoice_id").on(table.invoiceId)]
);

/* ===============================
   23. INVENTORY SNAPSHOTS (for aging/analytics)
   =============================== */

export const inventorySnapshots = pgTable("inventory_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  retailerId: uuid("retailer_id").notNull(),
  variantId: uuid("variant_id").notNull(),
  stock: integer("stock").notNull().default(0),
  snapDate: timestamp("snap_date").notNull(),
});




// =========================================
// EVENT DEDUPLICATION TABLE
// =========================================
export const eventDedupe = pgTable("event_dedupe", {
  eventId: text("event_id").primaryKey(),
  processedAt: timestamp("processed_at").defaultNow()
});



// =========================================
// NOTIFICATIONS LOG
// =========================================
export const notificationsLog = pgTable("notifications_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  title: text("title"),
  body: text("body"),
  eventType: text("event_type"),
  createdAt: timestamp("created_at").defaultNow()
});



// =========================================
// RETAILER INVENTORY TABLE
// =========================================
export const retailerInventory = pgTable("retailer_inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  retailerId: uuid("retailer_id").references(() => retailers.id),
  variantId: uuid("variant_id").references(() => productVariants.id),
  quantity: integer("quantity").default(0),
  updatedAt: timestamp("updated_at").defaultNow()
});

