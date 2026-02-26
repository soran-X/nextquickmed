-- ============================================================
-- Helper: Decrement stock safely
-- ============================================================
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_quantity INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE products
  SET stock = GREATEST(0, stock - p_quantity),
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$;

-- ============================================================
-- Helper: Get next invoice number (already defined in migration 1,
-- but repeated here for safety if running migrations individually)
-- ============================================================
-- (Already defined in 00001_initial_schema.sql)

-- ============================================================
-- Index: delivery date + rider (for daily queue)
-- ============================================================
CREATE INDEX IF NOT EXISTS orders_rider_date_idx
  ON orders (rider_id, delivery_date, delivery_sequence)
  WHERE status IN ('out_for_delivery', 'delivered', 'needs_manual_review');

-- ============================================================
-- View: Order summary for admin dashboard
-- ============================================================
CREATE OR REPLACE VIEW order_summary AS
SELECT
  o.id,
  o.invoice_no,
  o.invoice_prefix,
  o.status,
  o.cod_total,
  o.delivery_date,
  o.delivery_sequence,
  o.created_at,
  p.full_name AS customer_name,
  r.full_name AS rider_name,
  COUNT(oi.id)::INT AS item_count
FROM orders o
LEFT JOIN profiles p ON p.id = o.customer_id
LEFT JOIN profiles r ON r.id = o.rider_id
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id, p.full_name, r.full_name;
