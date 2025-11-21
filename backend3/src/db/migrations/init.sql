-- schemas
);


CREATE TABLE IF NOT EXISTS orders.order_items (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
order_id UUID NOT NULL REFERENCES orders.orders(id) ON DELETE CASCADE,
product_id UUID NOT NULL REFERENCES products.products(id),
variant_id UUID NOT NULL REFERENCES products.variants(id),
product_name TEXT,
variant_name TEXT,
sku TEXT,
quantity INT NOT NULL,
unit TEXT,
unit_price NUMERIC(12,2), -- price at time of order
cost_price NUMERIC(12,2),
line_total NUMERIC(14,2),
created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


CREATE TABLE IF NOT EXISTS orders.order_history (
id BIGSERIAL PRIMARY KEY,
order_id UUID NOT NULL REFERENCES orders.orders(id) ON DELETE CASCADE,
action TEXT NOT NULL,
actor_id UUID,
actor_role TEXT,
details JSONB,
created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- cart per retailer
CREATE TABLE IF NOT EXISTS cart.carts (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
retailer_id UUID UNIQUE NOT NULL,
items JSONB,
updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- connections (requests between retailers & distributors)
CREATE TABLE IF NOT EXISTS connections.requests (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
retailer UUID NOT NULL,
distributor UUID NOT NULL,
status TEXT NOT NULL DEFAULT 'pending',
message TEXT,
rejection_reason TEXT,
created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
UNIQUE (retailer, distributor)
);


-- notifications
CREATE TABLE IF NOT EXISTS notifications.notifications (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL,
user_role TEXT NOT NULL,
title TEXT NOT NULL,
message TEXT NOT NULL,
type TEXT,
related_id UUID,
read BOOLEAN DEFAULT FALSE,
created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- product bills / ledger (simplified to start)
CREATE TABLE IF NOT EXISTS billing.product_bills (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
retailer_id UUID NOT NULL,
distributor_id UUID NOT NULL,
product_id UUID NOT NULL,
sku TEXT,
outstanding_balance NUMERIC(14,2) DEFAULT 0,
total_quantity_sold BIGINT DEFAULT 0,
total_amount_due NUMERIC(14,2) DEFAULT 0,
total_amount_paid NUMERIC(14,2) DEFAULT 0,
last_transaction_date TIMESTAMP WITH TIME ZONE,
created_at TI