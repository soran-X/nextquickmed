'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { Order } from '@/types';
import { formatInvoiceNo } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const MapComponent = dynamic(() => import('@/components/storefront/MapComponent'), { ssr: false });

export default function RiderMapPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [baseLocation, setBaseLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const today = new Date().toISOString().split('T')[0];
      const [ordersRes, settingsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, delivery_lat, delivery_lng, invoice_no, invoice_prefix, status, delivery_sequence')
          .eq('rider_id', user.id)
          .eq('delivery_date', today)
          .in('status', ['out_for_delivery', 'delivered', 'needs_manual_review'])
          .order('delivery_sequence'),
        supabase.from('settings').select('base_lat, base_lng').eq('id', 1).single(),
      ]);
      setOrders((ordersRes.data ?? []) as unknown as Order[]);
      if (settingsRes.data?.base_lat && settingsRes.data?.base_lng) {
        setBaseLocation({ lat: settingsRes.data.base_lat, lng: settingsRes.data.base_lng });
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const center = baseLocation ?? (orders[0] ? { lat: orders[0].delivery_lat, lng: orders[0].delivery_lng } : { lat: 14.5995, lng: 120.9842 });

  const markers = [
    ...(baseLocation ? [{ lat: baseLocation.lat, lng: baseLocation.lng, popup: 'Pharmacy (Base)' }] : []),
    ...orders.map((o, i) => ({
      lat: o.delivery_lat,
      lng: o.delivery_lng,
      popup: `Stop ${i + 1} – ${formatInvoiceNo(o.invoice_prefix, o.invoice_no)}`,
    })),
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Route Map</h1>
      <p className="text-sm text-gray-500 mb-3">{orders.length} stop{orders.length !== 1 ? 's' : ''} today</p>
      <MapComponent
        lat={center.lat}
        lng={center.lng}
        onMapClick={() => {}}
        defaultCenter={[center.lat, center.lng]}
        readOnly
        markers={markers}
      />
      <div className="mt-4 space-y-2">
        {orders.map((o, i) => (
          <div key={o.id} className="bg-white rounded-lg border border-gray-200 px-4 py-2.5 flex items-center gap-3">
            <div className="h-6 w-6 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: o.status === 'delivered' ? '#22c55e' : 'var(--brand-primary)' }}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono font-semibold text-gray-700 truncate">
                {formatInvoiceNo(o.invoice_prefix, o.invoice_no)}
              </p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              o.status === 'delivered' ? 'bg-green-100 text-green-700' :
              o.status === 'needs_manual_review' ? 'bg-red-100 text-red-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {o.status === 'delivered' ? 'Done' : o.status === 'needs_manual_review' ? 'Review' : 'Pending'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
