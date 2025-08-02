-- PostgreSQL Database Schema for Distribution Management System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('retailer', 'distributor');
CREATE TYPE business_type_enum AS ENUM ('Groceries', 'Beverages', 'Personal Care');
CREATE TYPE connection_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE requested_by_enum AS ENUM ('retailer', 'distributor');
CREATE TYPE order_status AS ENUM ('pending', 'processing', 'completed', 'cancelled', 'modified');
CREATE TYPE order_unit AS ENUM ('box', 'piece', 'pack');
CREATE TYPE notification_type AS ENUM ('new_order', 'order_accepted', 'order_rejected', 'order_modified', 'modification_approved', 'modification_rejected', 'order_completed', 'order_cancelled');
CREATE TYPE recipient_type AS ENUM ('Retailer', 'Distributor');
CREATE TYPE transaction_type AS ENUM ('sale', 'payment', 'return', 'adjustment', 'price_change');
CREATE TYPE payment_method AS ENUM ('cash', 'cheque', 'bank_transfer', 'upi', 'card', 'credit');
CREATE TYPE bill_status AS ENUM ('active', 'inactive', 'disputed');

-- Retailers table
CREATE TABLE retailers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    gst_number VARCHAR(50),
    location VARCHAR(255),
    business_type VARCHAR(100),
    pincode VARCHAR(10),
    role user_role DEFAULT 'retailer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Distributors table
CREATE TABLE distributors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    gst_number VARCHAR(50),
    business_type VARCHAR(100),
    pincode VARCHAR(10),
    location VARCHAR(255),
    address TEXT,
    distributorships business_type_enum[] DEFAULT '{}',
    role user_role DEFAULT 'distributor',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Retailer-Distributor connections (many-to-many)
CREATE TABLE retailer_distributor_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
    distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(retailer_id, distributor_id)
);

-- Connection requests
CREATE TABLE connection_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
    distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
    status connection_status DEFAULT 'pending',
    requested_by requested_by_enum NOT NULL,
    message TEXT DEFAULT '',
    rejection_reason TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(retailer_id, distributor_id)
);

-- Products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
    product_id VARCHAR(100) NOT NULL, -- Original 'id' field from MongoDB
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(10) DEFAULT '📦',
    category VARCHAR(255) NOT NULL,
    distributorships business_type_enum[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product variants table
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id VARCHAR(100) NOT NULL, -- Original 'id' field from MongoDB variant
    name VARCHAR(255) NOT NULL,
    stock INTEGER DEFAULT 0,
    selling_price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2) NOT NULL,
    expiry VARCHAR(50) DEFAULT 'N/A',
    sku VARCHAR(100) UNIQUE NOT NULL,
    description TEXT DEFAULT 'No description provided',
    image VARCHAR(500) DEFAULT 'https://via.placeholder.com/150',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory table
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
    distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    stock INTEGER DEFAULT 0,
    ordered_stock INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(retailer_id, variant_id)
);

-- Cart table
CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    retailer_id UUID UNIQUE NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cart items table
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id VARCHAR(100) NOT NULL,
    variant_id VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    unit VARCHAR(20) DEFAULT 'box'
);

-- Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
    distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
    total_amount DECIMAL(12,2) NOT NULL,
    status order_status DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order items table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 1),
    unit order_unit DEFAULT 'box',
    ordered INTEGER NOT NULL,
    price DECIMAL(10,2), -- Added for order processing
    product_name VARCHAR(255), -- Denormalized for performance
    variant_name VARCHAR(255) -- Denormalized for performance
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL,
    recipient_type recipient_type NOT NULL,
    type notification_type NOT NULL,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product bills table
CREATE TABLE product_bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
    distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    sku VARCHAR(100) NOT NULL,
    total_quantity_sold INTEGER DEFAULT 0,
    total_quantity_returned INTEGER DEFAULT 0,
    total_amount_due DECIMAL(12,2) DEFAULT 0,
    total_amount_paid DECIMAL(12,2) DEFAULT 0,
    current_unit_price DECIMAL(10,2) DEFAULT 0,
    last_transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    credit_limit DECIMAL(12,2) DEFAULT 0,
    credit_days INTEGER DEFAULT 30,
    status bill_status DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(retailer_id, distributor_id, product_id, variant_id)
);

-- Product bill transactions table
CREATE TABLE product_bill_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_bill_id UUID NOT NULL REFERENCES product_bills(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(10,2) DEFAULT 0,
    amount DECIMAL(12,2) NOT NULL,
    note TEXT DEFAULT '',
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    payment_method payment_method,
    reference_number VARCHAR(100),
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL,
    created_by_model recipient_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_retailers_email ON retailers(email);
CREATE INDEX idx_retailers_pincode ON retailers(pincode);
CREATE INDEX idx_retailers_business_type ON retailers(business_type);

CREATE INDEX idx_distributors_email ON distributors(email);
CREATE INDEX idx_distributors_pincode ON distributors(pincode);
CREATE INDEX idx_distributors_business_type ON distributors(business_type);

CREATE INDEX idx_connection_requests_retailer ON connection_requests(retailer_id);
CREATE INDEX idx_connection_requests_distributor ON connection_requests(distributor_id);
CREATE INDEX idx_connection_requests_status ON connection_requests(status);

CREATE INDEX idx_products_distributor ON products(distributor_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('english', name));

CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);

CREATE INDEX idx_inventory_retailer ON inventory(retailer_id);
CREATE INDEX idx_inventory_distributor ON inventory(distributor_id);
CREATE INDEX idx_inventory_product ON inventory(product_id);

CREATE INDEX idx_orders_retailer_status ON orders(retailer_id, status, created_at DESC);
CREATE INDEX idx_orders_distributor_status ON orders(distributor_id, status, created_at DESC);
CREATE INDEX idx_orders_number ON orders(order_number);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, read, created_at DESC);
CREATE INDEX idx_notifications_order ON notifications(order_id);

CREATE INDEX idx_product_bills_retailer_distributor ON product_bills(retailer_id, distributor_id);
CREATE INDEX idx_product_bills_distributor_status ON product_bills(distributor_id, status);
CREATE INDEX idx_product_bills_last_transaction ON product_bills(last_transaction_date DESC);

CREATE INDEX idx_bill_transactions_bill ON product_bill_transactions(product_bill_id);
CREATE INDEX idx_bill_transactions_date ON product_bill_transactions(transaction_date DESC);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_retailers_updated_at BEFORE UPDATE ON retailers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_distributors_updated_at BEFORE UPDATE ON distributors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_connection_requests_updated_at BEFORE UPDATE ON connection_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_bills_updated_at BEFORE UPDATE ON product_bills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bill_transactions_updated_at BEFORE UPDATE ON product_bill_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := 'ORD-' || 
                           TO_CHAR(NOW(), 'YYMMDD') || '-' || 
                           LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER generate_order_number_trigger 
    BEFORE INSERT ON orders 
    FOR EACH ROW 
    EXECUTE FUNCTION generate_order_number();
