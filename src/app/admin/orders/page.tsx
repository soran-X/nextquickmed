'use client';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Order, Rider, Profile } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate, formatInvoiceNo, getOrderStatusColor, getOrderStatusLabel } from '@/lib/utils';
import { toast } from 'sonner';
import { Printer, Truck, AlertTriangle, Search } from 'lucide-react';
import { ReceiptModal } from '@/components/admin/ReceiptModal';
import { ManualReviewModal } from '@/components/admin/ManualReviewModal';
import { Settings } from '@/types';

const STATUS_FILTERS = ['all', 'pending', 'packed', 'out_for_delivery', 'delivered', 'needs_manual_review'] as const;

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [riders, setRiders] = useState<Array<Rider & { profile: Profile }>>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [assignRiderId, setAssignRiderId] = useState('');
  const [assignDate, setAssignDate] = useState('');
  const [assigning, setAssigning] = useState(false);

  const supabase = createClient();

  const fetchData = async () => {
    const [ordersRes, ridersRes, settingsRes] = await Promise.all([
      supabase
        .from('orders')
        .select(`
          *,
          customer:profiles!customer_id(full_name, phone),
          order_items(*, product:products(brand_name, generic_name))
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('riders')
        .select('*, profile:profiles!user_id(full_name)')
        .eq('is_active', true),
      supabase.from('settings').select('*').eq('id', 1).single(),
    ]);

    setOrders((ordersRes.data ?? []) as unknown as Order[]);
    setRiders((ridersRes.data ?? []) as unknown as Array<Rider & { profile: Profile }>);
    if (settingsRes.data) setSettings(settingsRes.data as Settings);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredOrders = statusFilter === 'all'
    ? orders
    : orders.filter((o) => o.status === statusFilter);

  const packedSelected = orders.filter(
    (o) => selectedOrderIds.has(o.id) && o.status === 'packed'
  );

  const handlePrintReceipt = async (order: Order) => {
    // If no invoice number yet, generate one
    if (!order.invoice_no) {
      const { data } = await supabase.rpc('get_next_invoice_no');
      if (data) {
        const prefix = settings?.bir_tin ? `SI` : 'SI';
        await supabase.from('orders').update({
          invoice_no: data,
          invoice_prefix: prefix,
          status: 'packed',
        }).eq('id', order.id);

        const updated = { ...order, invoice_no: data, invoice_prefix: prefix, status: 'packed' as const };
        setReceiptOrder(updated);
        setOrders((prev) => prev.map((o) => o.id === order.id ? updated : o));
      } else {
        toast.error('Failed to generate invoice number');
      }
    } else {
      setReceiptOrder(order);
    }
  };

  const handleReviewResolved = (orderId: string, newStatus: string) => {
    setOrders((prev) =>
      prev.map((o) => o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o)
    );
  };

  const handleAssignRider = async () => {
    if (!assignRiderId || !assignDate) {
      toast.error('Please select a rider and delivery date');
      return;
    }
    if (packedSelected.length === 0) {
      toast.error('Select packed orders to assign');
      return;
    }
    setAssigning(true);

    const { error } = await supabase
      .from('orders')
      .update({
        rider_id: assignRiderId,
        delivery_date: assignDate,
        status: 'out_for_delivery',
      })
      .in('id', packedSelected.map((o) => o.id));

    if (error) {
      toast.error('Assignment failed');
    } else {
      toast.success(`${packedSelected.length} order(s) assigned to rider`);
      setSelectedOrderIds(new Set());
      setAssignRiderId('');
      fetchData();
    }
    setAssigning(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) return <div className="text-center py-16 text-gray-400">Loading orders…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{filteredOrders.length} orders</span>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === s
                ? 'text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            style={statusFilter === s ? { backgroundColor: 'var(--brand-primary)' } : {}}
          >
            {s === 'all' ? 'All' : getOrderStatusLabel(s)}
          </button>
        ))}
      </div>

      {/* Rider assignment panel */}
      {packedSelected.length > 0 && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-wrap gap-4 items-end">
          <div>
            <p className="text-sm font-semibold text-blue-800 mb-2">
              Assign {packedSelected.length} packed order(s) to rider:
            </p>
            <div className="flex gap-3 flex-wrap">
              <Select value={assignRiderId} onValueChange={setAssignRiderId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select rider…" />
                </SelectTrigger>
                <SelectContent>
                  {riders.map((r) => (
                    <SelectItem key={r.user_id} value={r.user_id}>
                      {r.profile?.full_name ?? r.plate_no}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="date"
                value={assignDate}
                onChange={(e) => setAssignDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
            </div>
          </div>
          <Button onClick={handleAssignRider} disabled={assigning} className="gap-2">
            <Truck className="h-4 w-4" />
            {assigning ? 'Assigning…' : 'Assign & Dispatch'}
          </Button>
        </div>
      )}

      {/* Orders table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left w-8">
                <input type="checkbox" className="rounded"
                  onChange={(e) => {
                    if (e.target.checked) setSelectedOrderIds(new Set(filteredOrders.map((o) => o.id)));
                    else setSelectedOrderIds(new Set());
                  }}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Invoice</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Customer</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">COD Total</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">No orders</td>
              </tr>
            )}
            {filteredOrders.map((order) => {
              const customer = order.customer as unknown as { full_name: string | null; phone: string | null } | null;
              return (
                <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${selectedOrderIds.has(order.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded"
                      checked={selectedOrderIds.has(order.id)}
                      onChange={() => toggleSelect(order.id)} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {order.invoice_no ? formatInvoiceNo(order.invoice_prefix, order.invoice_no) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{customer?.full_name ?? 'Unknown'}</p>
                    <p className="text-xs text-gray-400">{customer?.phone ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(order.created_at)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(order.cod_total)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getOrderStatusColor(order.status)}`}>
                      {getOrderStatusLabel(order.status)}
                    </span>
                    {order.status === 'needs_manual_review' && (
                      <AlertTriangle className="h-4 w-4 text-red-500 inline ml-1" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(order.status === 'pending' || order.status === 'packed') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePrintReceipt(order)}
                          className="gap-1 text-xs"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          {order.status === 'pending' ? 'Pack & Print' : 'Reprint'}
                        </Button>
                      )}
                      {order.status === 'needs_manual_review' && (
                        <Button
                          size="sm"
                          onClick={() => setReviewOrder(order)}
                          className="gap-1 text-xs bg-amber-500 hover:bg-amber-600 text-white border-0"
                        >
                          <Search className="h-3.5 w-3.5" />
                          Review
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Receipt Modal */}
      {receiptOrder && (
        <ReceiptModal
          order={receiptOrder}
          settings={settings}
          onClose={() => setReceiptOrder(null)}
        />
      )}

      {/* Manual Review Modal */}
      {reviewOrder && (
        <ManualReviewModal
          order={reviewOrder}
          onClose={() => setReviewOrder(null)}
          onResolved={handleReviewResolved}
        />
      )}
    </div>
  );
}
