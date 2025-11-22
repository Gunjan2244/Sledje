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
app.use("/auth", authRoutes);

// Retailer/Distributor
app.use("/retailers", retailerRoutes);
app.use("/distributors", distributorRoutes);

// Products + Inventory
app.use("/products", productsRoutes);
app.use("/inventory", inventoryRoutes);

// Cart
app.use("/cart", cartRoutes);

// Orders
app.use("/orders", ordersRoutes);

// Connections / Notifications
app.use("/connections", connectionsRoutes);
app.use("/notifications", notificationsRoutes);
// Billing / Invoices / Ledger
app.use("/bills", productBillsRoutes);
app.use("/invoices", invoicesRoutes);
app.use("/ledger", ledgerRoutes);


export default app;
