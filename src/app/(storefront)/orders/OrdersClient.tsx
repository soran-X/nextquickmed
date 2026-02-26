'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, ArrowRight, User, Phone, Package, Truck, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import { formatCurrency, formatDate, formatInvoiceNo, getOrderStatusColor, getOrderStatusLabel } from '@/lib/utils';
import { Order, OrderStatus } from '@/types';

type OrderWithRider = Order & {
  order_items: Array<{ id: string; quantity: number; unit_price: number; product?: { brand_name: string } }>;
  rider_profile?: { full_name: string | null; phone: string | null } | null;
};

const TABS: { label: string; value: string; statuses: OrderStatus[] | null }[] = [
  { label: 'All',              value: 'all',             statuses: null },
  { label: 'Active',           value: 'active',          statuses: ['pending', 'packed', 'out_for_delivery'] },
  { label: 'Packed',           value: 'packed',          statuses: ['packed'] },
  { label: 'Out for Delivery', value: 'out_for_delivery',statuses: ['out_for_delivery'] },
  { label: 'Delivered',        value: 'delivered',       statuses: ['delivered'] },
  { label: 'Cancelled',        value: 'cancelled',       statuses: ['cancelled'] },
];

const STEPS: { key: OrderStatus | 'placed'; label: string; icon: typeof Clock }[] = [
  { key: 'placed',           label: 'Placed',       icon: Clock },
  { key: 'packed',           label: 'Packed',       icon: Package },
  { key: 'out_for_delivery', label: 'On the way',   icon: Truck },
  { key: 'delivered',        label: 'Delivered',    icon: CheckCircle2 },
];

function stepIndex(status: OrderStatus): number {
  if (status === 'delivered')        return 3;
  if (status === 'out_for_delivery') return 2;
  if (status === 'packed')           return 1;
  return 0; // pending / needs_manual_review / cancelled
}

function OrderProgressBar({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-1.5 text-gray-400 text-xs">
        <XCircle className="h-4 w-4 text-red-400" />
        <span className="text-red-500">Order cancelled</span>
      </div>
    );
  }
  if (status === 'needs_manual_review') {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <AlertCircle className="h-4 w-4 text-yellow-500" />
        <span className="text-yellow-600 font-medium">Needs manual review — our team will contact you</span>
      </div>
    );
  }

  const current = stepIndex(status);

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const done = i <= current;
        const active = i === current;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
                done
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                  : 'border-gray-200 bg-white text-gray-300'
              } ${active ? 'ring-2 ring-offset-1 ring-[var(--brand-primary)]/30' : ''}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className={`text-[10px] mt-1 font-medium ${done ? 'text-[var(--brand-primary)]' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-8 sm:w-14 mb-4 mx-0.5 transition-colors ${i < current ? 'bg-[var(--brand-primary)]' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function OrdersClient({ orders }: { orders: OrderWithRider[] }) {
  const [activeTab, setActiveTab] = useState('all');

  const filtered = activeTab === 'all'
    ? orders
    : orders.filter(o => {
        const tab = TABS.find(t => t.value === activeTab);
        return tab?.statuses?.includes(o.status) ?? true;
      });

  // Counts for badges
  const counts = TABS.reduce<Record<string, number>>((acc, tab) => {
    acc[tab.value] = tab.statuses === null
      ? orders.length
      : orders.filter(o => tab.statuses!.includes(o.status)).length;
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h1>

      {!orders.length ? (
        <div className="text-center py-16">
          <ShoppingBag className="h-14 w-14 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No orders yet</p>
          <Link
            href="/products"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium hover:underline"
            style={{ color: 'var(--brand-primary)' }}
          >
            Browse products <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <>
          {/* Filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5 scrollbar-hide">
            {TABS.map((tab) => {
              const count = counts[tab.value];
              if (count === 0 && tab.value !== 'all') return null;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    activeTab === tab.value
                      ? 'text-white border-transparent'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                  style={activeTab === tab.value ? { backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary)' } : {}}
                >
                  {tab.label}
                  <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-bold ${
                    activeTab === tab.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Order cards */}
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-12">No orders in this category.</p>
          ) : (
            <div className="space-y-4">
              {filtered.map((order) => {
                const items = order.order_items ?? [];
                const isActive = ['pending', 'packed', 'out_for_delivery'].includes(order.status);

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-xl border p-5 transition-shadow hover:shadow-md ${
                      isActive ? 'border-[var(--brand-primary)]/30 shadow-sm' : 'border-gray-200'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs text-gray-400 font-mono">
                          {order.invoice_no
                            ? formatInvoiceNo(order.invoice_prefix, order.invoice_no)
                            : `#${order.id.slice(0, 8).toUpperCase()}`}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">{formatDate(order.created_at)}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getOrderStatusColor(order.status)}`}>
                        {getOrderStatusLabel(order.status)}
                      </span>
                    </div>

                    {/* Progress tracker */}
                    <div className="mb-4">
                      <OrderProgressBar status={order.status} />
                    </div>

                    {/* Items */}
                    <div className="border-t border-gray-100 pt-3 space-y-1 mb-3">
                      {items.slice(0, 3).map((item) => (
                        <p key={item.id} className="text-sm text-gray-600">
                          {item.product?.brand_name ?? '—'}
                          <span className="text-gray-400"> ×{item.quantity}</span>
                        </p>
                      ))}
                      {items.length > 3 && (
                        <p className="text-xs text-gray-400">+{items.length - 3} more item{items.length - 3 !== 1 ? 's' : ''}</p>
                      )}
                    </div>

                    {/* Rider info (shown when out for delivery) */}
                    {order.status === 'out_for_delivery' && order.rider_profile && (
                      <div className="bg-purple-50 rounded-lg px-3 py-2 mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-purple-500" />
                          <div>
                            <p className="text-xs font-medium text-purple-800">
                              {order.rider_profile.full_name ?? 'Rider assigned'}
                            </p>
                            <p className="text-xs text-purple-600">Your rider is on the way</p>
                          </div>
                        </div>
                        {order.rider_profile.phone && (
                          <a
                            href={`tel:${order.rider_profile.phone}`}
                            className="flex items-center gap-1 text-xs font-medium text-purple-700 hover:text-purple-900"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {order.rider_profile.phone}
                          </a>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                      <div className="text-sm">
                        <span className="text-gray-500">COD Total: </span>
                        <span className="font-bold text-gray-900">{formatCurrency(order.cod_total)}</span>
                      </div>
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-xs font-medium hover:underline flex-shrink-0"
                        style={{ color: 'var(--brand-primary)' }}
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
