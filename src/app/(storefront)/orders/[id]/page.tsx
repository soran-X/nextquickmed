import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, User, Phone, Package, Truck,
  CheckCircle2, Clock, XCircle, AlertCircle,
} from 'lucide-react';
import { formatCurrency, formatDate, formatInvoiceNo, getOrderStatusColor, getOrderStatusLabel } from '@/lib/utils';
import { OrderStatus } from '@/types';

export const dynamic = 'force-dynamic';

function stepIndex(status: OrderStatus): number {
  if (status === 'delivered')        return 3;
  if (status === 'out_for_delivery') return 2;
  if (status === 'packed')           return 1;
  return 0;
}

const STEPS = [
  { label: 'Order Placed',    Icon: Clock },
  { label: 'Packed',          Icon: Package },
  { label: 'Out for Delivery',Icon: Truck },
  { label: 'Delivered',       Icon: CheckCircle2 },
];

function ProgressTracker({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-red-500">
        <XCircle className="h-5 w-5" /> Order cancelled
      </div>
    );
  }
  if (status === 'needs_manual_review') {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-yellow-600">
        <AlertCircle className="h-5 w-5" /> Needs manual review — our team will contact you
      </div>
    );
  }

  const current = stepIndex(status);
  return (
    <div className="flex items-start gap-0">
      {STEPS.map(({ label, Icon }, i) => {
        const done   = i <= current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                done
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                  : 'border-gray-200 bg-white text-gray-300'
              } ${active ? 'ring-2 ring-offset-2 ring-[var(--brand-primary)]/30' : ''}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className={`text-[11px] mt-1.5 font-medium text-center leading-tight max-w-[60px] ${
                done ? 'text-[var(--brand-primary)]' : 'text-gray-400'
              }`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-10 sm:w-20 mb-5 mx-1 transition-colors ${
                i < current ? 'bg-[var(--brand-primary)]' : 'bg-gray-200'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/orders/${id}`);

  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      order_items(
        id, quantity, unit_price, subtotal,
        product:products(id, brand_name, generic_name, images)
      )
    `)
    .eq('id', id)
    .eq('customer_id', user.id)
    .single();

  if (!order) notFound();

  // Fetch rider profile separately to avoid join ambiguity
  let riderProfile: { full_name: string | null; phone: string | null } | null = null;
  if (order.rider_id) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', order.rider_id)
      .single();
    riderProfile = data;
  }

  const items = (order.order_items ?? []) as Array<{
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    product?: { id: string; brand_name: string; generic_name: string; images: string[] };
  }>;

  const invoiceLabel = order.invoice_no
    ? formatInvoiceNo(order.invoice_prefix, order.invoice_no)
    : `#${order.id.slice(0, 8).toUpperCase()}`;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[var(--brand-primary)] mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Orders
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-mono">{invoiceLabel}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Placed on {formatDate(order.created_at)}</p>
        </div>
        <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${getOrderStatusColor(order.status)}`}>
          {getOrderStatusLabel(order.status)}
        </span>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 overflow-x-auto">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Order Status</h2>
        <ProgressTracker status={order.status as OrderStatus} />
      </div>

      {/* Rider info */}
      {order.status === 'out_for_delivery' && riderProfile && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-purple-200 flex items-center justify-center">
              <User className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-purple-900">{riderProfile.full_name ?? 'Rider'}</p>
              <p className="text-xs text-purple-600">Your rider is on the way</p>
            </div>
          </div>
          {riderProfile.phone && (
            <a
              href={`tel:${riderProfile.phone}`}
              className="flex items-center gap-1.5 text-sm font-medium text-purple-700 hover:text-purple-900"
            >
              <Phone className="h-4 w-4" />
              {riderProfile.phone}
            </a>
          )}
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            Items ({items.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item.id} className="px-5 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {/* Product image thumbnail */}
                {item.product?.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.product.images[0]}
                    alt={item.product.brand_name}
                    className="h-12 w-12 rounded-lg object-cover border border-gray-100 flex-shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center">
                    <Package className="h-5 w-5 text-gray-300" />
                  </div>
                )}
                <div className="min-w-0">
                  {item.product ? (
                    <Link
                      href={`/products/${item.product.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-[var(--brand-primary)] hover:underline line-clamp-1"
                    >
                      {item.product.brand_name}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-gray-900">—</p>
                  )}
                  {item.product?.generic_name && (
                    <p className="text-xs text-gray-400 line-clamp-1">{item.product.generic_name}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatCurrency(item.unit_price)} × {item.quantity}
                  </p>
                </div>
              </div>
              <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                {formatCurrency(item.unit_price * item.quantity)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Delivery */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Delivery Details</h2>
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 text-gray-400" />
          <div>
            <p>{order.delivery_address}</p>
            {order.distance_km && (
              <p className="text-xs text-gray-400 mt-0.5">{Number(order.distance_km).toFixed(2)} km from pharmacy</p>
            )}
          </div>
        </div>
        {order.delivery_date && (
          <p className="text-xs text-gray-500 mt-2">
            Estimated delivery: {formatDate(order.delivery_date)}
          </p>
        )}
      </div>

      {/* Pricing */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Payment Summary</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT (12%)</span>
            <span>{formatCurrency(order.vat_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery Fee</span>
            <span>{formatCurrency(order.delivery_fee)}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>{order.discount_type === 'senior' ? 'Senior Citizen' : 'PWD'} Discount</span>
              <span>-{formatCurrency(order.discount_amount)}</span>
            </div>
          )}
        </div>
        <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between font-bold text-gray-900">
          <span>COD Total</span>
          <span className="text-lg" style={{ color: 'var(--brand-primary)' }}>
            {formatCurrency(order.cod_total)}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-2">Payment method: Cash on Delivery</p>
      </div>
    </div>
  );
}
