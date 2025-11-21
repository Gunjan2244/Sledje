CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL CHECK (role IN ('retailer', 'distributor')),
    
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    
    phone TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE retailers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    business_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    gst_number TEXT,
    business_type TEXT NOT NULL,

    pincode TEXT NOT NULL,
    location TEXT,
    address TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE distributors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    company_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    gst_number TEXT,
    business_type TEXT NOT NULL,

    pincode TEXT NOT NULL,
    location TEXT,
    address TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE connection_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    retailer_id UUID REFERENCES retailers(id) ON DELETE CASCADE,
    distributor_id UUID REFERENCES distributors(id) ON DELETE CASCADE,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),

    message TEXT,
    rejection_reason TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    retailer_id UUID REFERENCES retailers(id) ON DELETE CASCADE,
    distributor_id UUID REFERENCES distributors(id) ON DELETE CASCADE,

    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(retailer_id, distributor_id)
);
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    distributor_id UUID REFERENCES distributors(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    icon TEXT,
    category TEXT,
    subcategory TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    product_id UUID REFERENCES products(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    unit TEXT,
    
    stock INTEGER NOT NULL DEFAULT 0,
    selling_price NUMERIC(10,2) NOT NULL,
    cost_price NUMERIC(10,2) NOT NULL,
    expiry DATE,

    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    retailer_id UUID REFERENCES retailers(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,

    qty INTEGER NOT NULL DEFAULT 0,
    daily_avg_sales NUMERIC(10,2) DEFAULT 0,

    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(retailer_id, variant_id)
);
CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    retailer_id UUID REFERENCES retailers(id) ON DELETE CASCADE,

    variant_id UUID REFERENCES product_variants(id),
    distributor_id UUID REFERENCES distributors(id),

    quantity INTEGER NOT NULL,
    unit TEXT,
    price NUMERIC(10,2),

    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_number TEXT UNIQUE NOT NULL,
    
    retailer_id UUID REFERENCES retailers(id),
    distributor_id UUID REFERENCES distributors(id),

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','modified','processing','cancelled','completed')),

    total_amount NUMERIC(12,2) NOT NULL,
    notes TEXT,
    expected_delivery DATE,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id),

    product_name TEXT,
    variant_name TEXT,
    sku TEXT,

    quantity INTEGER NOT NULL,
    unit TEXT,
    variant_selling_price NUMERIC(10,2),

    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,

    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    title TEXT,
    message TEXT,
    type TEXT,
    read BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    retailer_id UUID REFERENCES retailers(id),
    distributor_id UUID REFERENCES distributors(id),

    variant_id UUID REFERENCES product_variants(id),

    outstanding_balance NUMERIC(12,2) DEFAULT 0,
    total_quantity_sold INTEGER DEFAULT 0,
    total_amount_due NUMERIC(12,2) DEFAULT 0,
    total_amount_paid NUMERIC(12,2) DEFAULT 0,

    last_transaction TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE bill_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,

    date TIMESTAMP DEFAULT NOW(),
    quantity INTEGER,
    unit_price NUMERIC(10,2),
    amount NUMERIC(12,2),
    type TEXT CHECK (type IN ('sale','return','payment')),
    metadata JSONB
);
CREATE TABLE ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    retailer_id UUID REFERENCES retailers(id),
    distributor_id UUID REFERENCES distributors(id),

    type TEXT NOT NULL,        -- debit/credit
    amount NUMERIC(10,2) NOT NULL,
    balance NUMERIC(10,2) NOT NULL,

    order_id UUID,
    bill_id UUID,

    created_at TIMESTAMP DEFAULT NOW()
);
-- Helper: trigger function to update updated_at
CREATE TABLE outbox (
    id BIGSERIAL PRIMARY KEY,

    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    published BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW()
);
