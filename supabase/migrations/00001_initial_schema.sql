-- ============================================================
-- QuickMed Initial Schema
-- ============================================================
-- Enable required extensions
-- gen_random_uuid() is built-in on Supabase cloud (no extension needed)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('customer', 'admin', 'rider');

CREATE TYPE order_status AS ENUM (
  'pending',
  'packed',
  'out_for_delivery',
  'delivered',
  'needs_manual_review',
  'cancelled'
);

-- ============================================================
-- TABLE: profiles
-- Extends Supabase Auth users with app-specific data
-- ============================================================
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         user_role NOT NULL DEFAULT 'customer',
  full_name    TEXT,
  phone        TEXT,
  address      TEXT,
  delivery_lat NUMERIC(10, 8),
  delivery_lng NUMERIC(11, 8),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on new auth user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TABLE: settings
-- Singleton row (always id = 1). Admin-managed config.
-- ============================================================
CREATE TABLE settings (
  id                   INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Branding
  company_name         TEXT NOT NULL DEFAULT 'QuickMed',
  logo_url             TEXT,
  primary_color        TEXT NOT NULL DEFAULT '#0ea5e9',
  secondary_color      TEXT NOT NULL DEFAULT '#0284c7',
  tertiary_color       TEXT NOT NULL DEFAULT '#f0f9ff',
  -- Location (pharmacy base for distance calc)
  base_lat             NUMERIC(10, 8),
  base_lng             NUMERIC(11, 8),
  base_address         TEXT,
  -- Delivery pricing
  delivery_fee_per_km  NUMERIC(8, 2) NOT NULL DEFAULT 15.00,
  -- BIR / Invoice details
  bir_tin              TEXT,
  bir_accreditation_no TEXT,
  bir_permit_no        TEXT,
  bir_serial_no_start  BIGINT NOT NULL DEFAULT 1000,
  -- Invoice counter (incremented on each print)
  last_invoice_no      BIGINT NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the singleton row
INSERT INTO settings DEFAULT VALUES;

-- ============================================================
-- TABLE: products
-- ============================================================
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name      TEXT NOT NULL,
  generic_name    TEXT NOT NULL,
  description     TEXT,
  images          TEXT[] NOT NULL DEFAULT '{}',  -- max 3 URLs
  price           NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock           INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  requires_rx     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full-text search index on brand + generic name
CREATE INDEX products_search_idx ON products
  USING GIN (to_tsvector('english', brand_name || ' ' || generic_name));

CREATE INDEX products_active_idx ON products (is_active) WHERE is_active = TRUE;

-- ============================================================
-- TABLE: carts
-- One cart per user (or guest via session_id)
-- ============================================================
CREATE TABLE carts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id   TEXT,  -- For guest carts
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cart_owner_check CHECK (
    (user_id IS NOT NULL AND session_id IS NULL) OR
    (user_id IS NULL AND session_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX carts_user_idx ON carts (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX carts_session_idx ON carts (session_id) WHERE session_id IS NOT NULL;

-- ============================================================
-- TABLE: cart_items
-- ============================================================
CREATE TABLE cart_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id    UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity   INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, product_id)
);

-- ============================================================
-- TABLE: orders
-- ============================================================
CREATE TABLE orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Invoice / SI number (set when admin prints receipt)
  invoice_no           BIGINT UNIQUE,
  invoice_prefix       TEXT,
  -- Customer
  customer_id          UUID NOT NULL REFERENCES profiles(id),
  -- Rider (assigned when packed)
  rider_id             UUID REFERENCES profiles(id),
  -- Delivery details
  delivery_address     TEXT NOT NULL,
  delivery_lat         NUMERIC(10, 8) NOT NULL,
  delivery_lng         NUMERIC(11, 8) NOT NULL,
  delivery_date        DATE,
  distance_km          NUMERIC(8, 4),
  -- Financial
  subtotal             NUMERIC(10, 2) NOT NULL DEFAULT 0,
  vat_amount           NUMERIC(10, 2) NOT NULL DEFAULT 0,   -- 12% VAT
  delivery_fee         NUMERIC(10, 2) NOT NULL DEFAULT 0,
  discount_amount      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  discount_type        TEXT,  -- 'senior', 'pwd', 'prescription'
  cod_total            NUMERIC(10, 2) NOT NULL DEFAULT 0,
  -- Uploads
  prescription_url     TEXT,
  senior_pwd_id_url    TEXT,
  -- Status
  status               order_status NOT NULL DEFAULT 'pending',
  pod_image_url        TEXT,  -- Proof of Delivery photo
  pod_ai_result        JSONB, -- Gemini AI response
  -- Sequence for rider (null = unsequenced)
  delivery_sequence    INT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX orders_customer_idx ON orders (customer_id);
CREATE INDEX orders_rider_idx ON orders (rider_id);
CREATE INDEX orders_status_idx ON orders (status);
CREATE INDEX orders_delivery_date_idx ON orders (delivery_date);

-- ============================================================
-- TABLE: order_items
-- ============================================================
CREATE TABLE order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity   INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL,  -- Price at time of order
  subtotal   NUMERIC(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE INDEX order_items_order_idx ON order_items (order_id);

-- ============================================================
-- TABLE: riders
-- Extended profile for users with role = 'rider'
-- ============================================================
CREATE TABLE riders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  profile_pic    TEXT,
  plate_no       TEXT NOT NULL,
  license_no     TEXT NOT NULL,
  vehicle_type   TEXT NOT NULL DEFAULT 'motorcycle',
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- HELPER: increment invoice number (atomic)
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_invoice_no()
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next BIGINT;
  v_start BIGINT;
BEGIN
  SELECT bir_serial_no_start INTO v_start FROM settings WHERE id = 1;
  UPDATE settings
    SET last_invoice_no = last_invoice_no + 1,
        updated_at = NOW()
    WHERE id = 1
  RETURNING (bir_serial_no_start + last_invoice_no) INTO v_next;
  RETURN v_next;
END;
$$;

-- ============================================================
-- HELPER: compute order totals
-- ============================================================
CREATE OR REPLACE FUNCTION compute_order_totals(p_order_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_subtotal       NUMERIC(10,2);
  v_vat            NUMERIC(10,2);
  v_delivery_fee   NUMERIC(10,2);
  v_discount       NUMERIC(10,2);
  v_cod            NUMERIC(10,2);
BEGIN
  SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
  FROM order_items WHERE order_id = p_order_id;

  SELECT delivery_fee, discount_amount INTO v_delivery_fee, v_discount
  FROM orders WHERE id = p_order_id;

  v_vat  := ROUND(v_subtotal * 0.12, 2);
  v_cod  := v_subtotal + v_vat + v_delivery_fee - v_discount;

  UPDATE orders
  SET subtotal   = v_subtotal,
      vat_amount = v_vat,
      cod_total  = v_cod,
      updated_at = NOW()
  WHERE id = p_order_id;
END;
$$;

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER carts_updated_at BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER riders_updated_at BEFORE UPDATE ON riders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders       ENABLE ROW LEVEL SECURITY;

-- ── profiles ────────────────────────────────────────────────
-- Users can read/update their own profile
CREATE POLICY "profiles: own read" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles: own update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admin can read all profiles
CREATE POLICY "profiles: admin read all" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Admin can update any profile (e.g., assign rider role)
CREATE POLICY "profiles: admin update all" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ── settings ────────────────────────────────────────────────
-- Public read (needed for branding, fees)
CREATE POLICY "settings: public read" ON settings
  FOR SELECT USING (TRUE);

-- Only admin can update
CREATE POLICY "settings: admin update" ON settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ── products ────────────────────────────────────────────────
-- Public read active products
CREATE POLICY "products: public read active" ON products
  FOR SELECT USING (is_active = TRUE);

-- Admin can read all (including inactive)
CREATE POLICY "products: admin read all" ON products
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Admin full write
CREATE POLICY "products: admin insert" ON products
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "products: admin update" ON products
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "products: admin delete" ON products
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ── carts ────────────────────────────────────────────────────
-- Authenticated users can manage their own cart
CREATE POLICY "carts: own" ON carts
  FOR ALL USING (auth.uid() = user_id);

-- Unauthenticated access via session_id handled server-side (service role)

-- ── cart_items ───────────────────────────────────────────────
CREATE POLICY "cart_items: own cart" ON cart_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM carts c WHERE c.id = cart_id AND c.user_id = auth.uid())
  );

-- ── orders ───────────────────────────────────────────────────
-- Customers see their own orders
CREATE POLICY "orders: customer own" ON orders
  FOR SELECT USING (customer_id = auth.uid());

-- Customers can insert their own orders
CREATE POLICY "orders: customer insert" ON orders
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Admin can read/update all orders
CREATE POLICY "orders: admin all" ON orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Rider can read their assigned orders
CREATE POLICY "orders: rider own" ON orders
  FOR SELECT USING (rider_id = auth.uid());

-- Rider can update status of their assigned orders
CREATE POLICY "orders: rider update status" ON orders
  FOR UPDATE USING (rider_id = auth.uid())
  WITH CHECK (rider_id = auth.uid());

-- ── order_items ──────────────────────────────────────────────
CREATE POLICY "order_items: customer own" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
  );

CREATE POLICY "order_items: customer insert" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
  );

CREATE POLICY "order_items: admin all" ON order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "order_items: rider read" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.rider_id = auth.uid())
  );

-- ── riders ───────────────────────────────────────────────────
-- Rider can read their own record
CREATE POLICY "riders: own read" ON riders
  FOR SELECT USING (user_id = auth.uid());

-- Admin can manage all riders
CREATE POLICY "riders: admin all" ON riders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
-- Run these after migrations via supabase dashboard or seed
-- INSERT INTO storage.buckets (id, name, public) VALUES
--   ('products',      'products',      true),
--   ('receipts',      'receipts',      false),
--   ('prescriptions', 'prescriptions', false),
--   ('pod',           'pod',           false),
--   ('riders',        'riders',        false),
--   ('branding',      'branding',      true);
