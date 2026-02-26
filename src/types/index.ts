// ============================================================
// QuickMed – Shared TypeScript Types
// ============================================================

export type UserRole = 'customer' | 'admin' | 'rider';

export type OrderStatus =
  | 'pending'
  | 'packed'
  | 'out_for_delivery'
  | 'delivered'
  | 'needs_manual_review'
  | 'cancelled';

// ── Database row types ────────────────────────────────────────

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: 1;
  company_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  tertiary_color: string;
  base_lat: number | null;
  base_lng: number | null;
  base_address: string | null;
  delivery_fee_per_km: number;
  bir_tin: string | null;
  bir_accreditation_no: string | null;
  bir_permit_no: string | null;
  bir_serial_no_start: number;
  last_invoice_no: number;
  updated_at: string;
}

export interface Product {
  id: string;
  brand_name: string;
  generic_name: string;
  description: string | null;
  images: string[];
  price: number;
  stock: number;
  requires_rx: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Cart {
  id: string;
  user_id: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  product?: Product;
}

export interface CartItemWithProduct extends CartItem {
  product: Product;
}

export interface Order {
  id: string;
  invoice_no: number | null;
  invoice_prefix: string | null;
  customer_id: string;
  rider_id: string | null;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  delivery_date: string | null;
  distance_km: number | null;
  subtotal: number;
  vat_amount: number;
  delivery_fee: number;
  discount_amount: number;
  discount_type: string | null;
  cod_total: number;
  prescription_url: string | null;
  senior_pwd_id_url: string | null;
  status: OrderStatus;
  pod_image_url: string | null;
  pod_ai_result: PodAiResult | null;
  delivery_sequence: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  customer?: Profile;
  rider?: Profile;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product?: Product;
}

export interface Rider {
  id: string;
  user_id: string;
  profile_pic: string | null;
  plate_no: string;
  license_no: string;
  vehicle_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface PodAiResult {
  match: boolean;
  reason: string;
}

// ── UI / Client types ─────────────────────────────────────────

export interface GuestCartItem {
  product_id: string;
  quantity: number;
  product: Product;
}

export interface BrandingConfig {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor: string;
}

export interface CheckoutSummary {
  subtotal: number;
  vatAmount: number;
  deliveryFee: number;
  discountAmount: number;
  discountType: string | null;
  codTotal: number;
  distanceKm: number;
}
