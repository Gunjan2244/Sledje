import express from "express";
import cors from "cors";

// Core modules
import authRoutes from "./api-gateway/routes/auth.routes.js";
import retailerRoutes from "./api-gateway/routes/retailers.routes.js";
import distributorRoutes from "./api-gateway/routes/distributors.routes.js";

// Domain modules
import productsRoutes from "./api-gateway/routes/products.routes.js";
import inventoryRoutes from "./api-gateway/routes/inventory.routes.js";
import ordersRoutes from "./api-gateway/routes/orders.routes.js";
import connectionsRoutes from "./api-gateway/routes/connections.routes.js";
import notificationsRoutes from "./api-gateway/routes/notifications.routes.js";

// Financial modules
import productBillsRoutes from "./api-gateway/routes/product-bills.routes.js";
import invoicesRoutes from "./api-gateway/routes/invoices.routes.js";
import ledgerRoutes from "./api-gateway/routes/ledger.routes.js";

// Cart
import cartRoutes from "./api-gateway/routes/cart.routes.js";


const app = express();

app.use(cors());
app.use(express.json());

// Auth
app.use("/api/auth", authRoutes);

// Retailer/Distributor
app.use("/api/retailers", retailerRoutes);
app.use("/api/distributors", distributorRoutes);

// Products + Inventory
app.use("/api/products", productsRoutes);
app.use("/api/inventory", inventoryRoutes);

// Cart
app.use("/api/cart", cartRoutes);

// Orders
app.use("/api/orders", ordersRoutes);

// Connections / Notifications
app.use("/api/connections", connectionsRoutes);
app.use("/api/notifications", notificationsRoutes);

// Billing / Invoices / Ledger
app.use("/api/bills", productBillsRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/ledger", ledgerRoutes);



export default app;
