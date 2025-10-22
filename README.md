#  Sledje – Smart Retail & Distribution Management Platform

**Sledje** is a full-stack platform that connects **retailers** and **distributors** in a single ecosystem.
It helps manage **inventory, orders, payments, and relationships** — all in one place.
Sledje aims to make supply chain management for small and medium retailers **faster, transparent, and fully digital**.

---

## Overview

Sledje consists of:

*  **Retailer Panel** – for managing shop inventory, placing orders, tracking payments, and maintaining relationships.
*  **Distributor Panel** – for managing product catalogs, processing retailer orders, analyzing sales, and tracking payments.
*  **Landing Page** – a unified entry point for both retailers and distributors to sign up, log in, and learn about the platform.

---

##  Core Features

###  **Retailer Dashboard**

| Section               | Description                                                                            |
| --------------------- | -------------------------------------------------------------------------------------- |
| **Shelf (Inventory)** | View, manage, and update all available products in the shop.                           |
| **Cart & Order Page** | Add items to cart, place new orders, and manage existing ones (track status).          |
| **Payments Page**     | Manage **daily or weekly** payments to distributors, based on sales of their products. |
| **You Page**          | Update shop profile, manage connected distributors, and view relationship info.        |

---

###  **Distributor Dashboard**

| Section           | Description                                                                     |
| ----------------- | ------------------------------------------------------------------------------- |
| **Orders Page**   | View incoming retailer orders; **accept, reject, or modify** them in real time. |
| **Products Page** | Add, edit, or remove products distributed to connected retailers.               |
| **Overview Page** | Analyze overall product sales, performance, and demand trends.                  |
| **Payments Page** | Track retailer payments, send **payment reminders** or mark defaults.           |
| **You Page**      | Update distributor profile and connect with new retailers.                      |

---

###  **Landing Page**

* Welcomes new and existing users
* Provides login and signup portals for both retailers and distributors
* Highlights Sledje’s features and benefits

---

##  Tech Stack

| Layer                 | Technology                                            |
| --------------------- | ----------------------------------------------------- |
| **Frontend (Web)**    | React.js + Tailwind CSS                               |
| **Backend**           | Node.js + Express.js                                  |
| **Database**          | PostgreSQL                                            |
| **Mobile (optional)** | Flutter (for portable version of retailer dashboard)  |
| **Auth**              | JWT (JSON Web Token)                                  |
| **Payments**          | Integrated via gateway API (e.g., Razorpay or Stripe) |

---

## ⚙️ Setup & Installation

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/sledje.git
cd sledje
```

### 2️⃣ Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Fill in database and secret details
npm start
```

### 3️⃣ Frontend Setup

```bash
cd frontend
npm install
npm start
```


---

## Environment Variables

Create a `.env` file inside the **backend** folder with the following:

```
PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5432/sledje
JWT_SECRET=your_secret_key
PAYMENT_GATEWAY_KEY=your_payment_key
```

---

## 📂 Folder Structure

```
Sledje/
│
├── backend/            # Node.js + Express API
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   ├── middleware/
│   └── utils/
│
├── frontend/           # React app for retailer + distributor dashboards
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── Retailer/
│   │   │   ├── Distributor/
│   │   │   └── Landing/
│   │   └── utils/
│   └── public/
│
├── mobile/             # Flutter app (optional)
│   ├── lib/
│   └── assets/
│
└── README.md
```

---

##  Example API Endpoints

| Method | Endpoint                     | Description                      |
| ------ | ---------------------------- | -------------------------------- |
| GET    | `/api/retailers/products`    | Fetch all available products     |
| POST   | `/api/orders/new`            | Place a new retailer order       |
| PUT    | `/api/orders/:id`            | Update order status              |
| GET    | `/api/payments`              | Get payment history              |
| POST   | `/api/distributors/products` | Add or edit distributor products |

---

##  Key Workflows

**Retailer → Distributor**

1. Retailer browses product shelf
2. Adds items to cart and places order
3. Distributor receives and accepts/rejects
4. Payment tracked based on sale
5. Distributor sends reminders if overdue

---

## 💡 Future Enhancements

*  Advanced analytics dashboard
*  Smart restocking suggestions
*  In-app notifications for payment reminders
*  Chat between retailers and distributors
*  Complete Flutter app for both roles

---

##  Contributing

Contributions are welcome!

1. Fork the repository
2. Create a new branch:

   ```bash
   git checkout -b feature-name
   ```
3. Commit changes and push
4. Create a Pull Request 

---

##  Author

**Gunjan Kumar**
[[gunjan23ths@gmail.com](mailto:gunjan23ths@gmail.com)]
 [LinkedIn or Portfolio link]

---

##  License

This project is licensed under the **MIT License**.

---

