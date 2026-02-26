-- ============================================================
-- Fix: Infinite RLS recursion on profiles table
--
-- Root cause: admin policies on every table did:
--   EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
-- When called from WITHIN a profiles policy this self-references
-- profiles → policy checks profiles → policy checks profiles → ∞
--
-- Fix: a SECURITY DEFINER function reads profiles with RLS bypassed,
-- then all policies call get_my_role() instead of querying profiles directly.
-- ============================================================

-- ── 1. Helper: get the current user's role (bypasses RLS) ────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM profiles WHERE id = auth.uid();
$$;

-- ── 2. Drop ALL existing policies (clean slate) ──────────────

-- profiles
DROP POLICY IF EXISTS "profiles: own read"        ON profiles;
DROP POLICY IF EXISTS "profiles: own update"       ON profiles;
DROP POLICY IF EXISTS "profiles: admin read all"   ON profiles;
DROP POLICY IF EXISTS "profiles: admin update all" ON profiles;

-- settings
DROP POLICY IF EXISTS "settings: public read"   ON settings;
DROP POLICY IF EXISTS "settings: admin update"  ON settings;

-- products
DROP POLICY IF EXISTS "products: public read active" ON products;
DROP POLICY IF EXISTS "products: admin read all"     ON products;
DROP POLICY IF EXISTS "products: admin insert"       ON products;
DROP POLICY IF EXISTS "products: admin update"       ON products;
DROP POLICY IF EXISTS "products: admin delete"       ON products;

-- carts
DROP POLICY IF EXISTS "carts: own" ON carts;

-- cart_items
DROP POLICY IF EXISTS "cart_items: own cart" ON cart_items;

-- orders
DROP POLICY IF EXISTS "orders: customer own"         ON orders;
DROP POLICY IF EXISTS "orders: customer insert"      ON orders;
DROP POLICY IF EXISTS "orders: admin all"            ON orders;
DROP POLICY IF EXISTS "orders: rider own"            ON orders;
DROP POLICY IF EXISTS "orders: rider update status"  ON orders;

-- order_items
DROP POLICY IF EXISTS "order_items: customer own"    ON order_items;
DROP POLICY IF EXISTS "order_items: customer insert" ON order_items;
DROP POLICY IF EXISTS "order_items: admin all"       ON order_items;
DROP POLICY IF EXISTS "order_items: rider read"      ON order_items;

-- riders
DROP POLICY IF EXISTS "riders: own read"  ON riders;
DROP POLICY IF EXISTS "riders: admin all" ON riders;

-- ── 3. Recreate all policies using get_my_role() ─────────────

-- ── profiles ─────────────────────────────────────────────────
CREATE POLICY "profiles: own read" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles: own update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admin uses get_my_role() – no recursion
CREATE POLICY "profiles: admin read all" ON profiles
  FOR SELECT USING (get_my_role() = 'admin');

CREATE POLICY "profiles: admin update all" ON profiles
  FOR UPDATE USING (get_my_role() = 'admin');

-- ── settings ──────────────────────────────────────────────────
CREATE POLICY "settings: public read" ON settings
  FOR SELECT USING (TRUE);

CREATE POLICY "settings: admin update" ON settings
  FOR UPDATE USING (get_my_role() = 'admin');

-- ── products ──────────────────────────────────────────────────
-- Anyone (including unauthenticated) can read active products
CREATE POLICY "products: public read active" ON products
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "products: admin read all" ON products
  FOR SELECT USING (get_my_role() = 'admin');

CREATE POLICY "products: admin insert" ON products
  FOR INSERT WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "products: admin update" ON products
  FOR UPDATE USING (get_my_role() = 'admin');

CREATE POLICY "products: admin delete" ON products
  FOR DELETE USING (get_my_role() = 'admin');

-- ── carts ─────────────────────────────────────────────────────
CREATE POLICY "carts: own" ON carts
  FOR ALL USING (auth.uid() = user_id);

-- ── cart_items ────────────────────────────────────────────────
CREATE POLICY "cart_items: own cart" ON cart_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM carts c WHERE c.id = cart_id AND c.user_id = auth.uid())
  );

-- ── orders ────────────────────────────────────────────────────
CREATE POLICY "orders: customer own" ON orders
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "orders: customer insert" ON orders
  FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "orders: admin all" ON orders
  FOR ALL USING (get_my_role() = 'admin');

CREATE POLICY "orders: rider own" ON orders
  FOR SELECT USING (rider_id = auth.uid());

CREATE POLICY "orders: rider update status" ON orders
  FOR UPDATE USING (rider_id = auth.uid())
  WITH CHECK (rider_id = auth.uid());

-- ── order_items ───────────────────────────────────────────────
CREATE POLICY "order_items: customer own" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
  );

CREATE POLICY "order_items: customer insert" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
  );

CREATE POLICY "order_items: admin all" ON order_items
  FOR ALL USING (get_my_role() = 'admin');

CREATE POLICY "order_items: rider read" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.rider_id = auth.uid())
  );

-- ── riders ────────────────────────────────────────────────────
CREATE POLICY "riders: own read" ON riders
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "riders: admin all" ON riders
  FOR ALL USING (get_my_role() = 'admin');
