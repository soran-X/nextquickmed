'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Order } from '@/types';
import { formatCurrency, formatInvoiceNo, getOrderStatusColor } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronUp, ChevronDown, MapPin, Package, Navigation } from 'lucide-react';
import { toast } from 'sonner';

function SortableOrderCard({
  order,
  index,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  order: Order;
  index: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: order.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const customer = order.customer as unknown as { full_name?: string; phone?: string } | null;
  const itemCount = (order.order_items ?? []).length;

  return (
    <div ref={setNodeRef} style={style}
      className="bg-white rounded-xl border border-gray-200 p-4 flex gap-3 shadow-sm">
      {/* Drag handle */}
      <div {...attributes} {...listeners}
        className="flex items-center text-gray-300 cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5" />
      </div>

      {/* Sequence number */}
      <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
        style={{ backgroundColor: 'var(--brand-primary)' }}>
        {index + 1}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{customer?.full_name ?? 'Customer'}</p>
        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{order.delivery_address}</span>
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3" /> {itemCount} item{itemCount !== 1 ? 's' : ''}
          </span>
          <span className="font-semibold text-gray-700">{formatCurrency(order.cod_total)}</span>
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${getOrderStatusColor(order.status)}`}>
            {order.status.replace(/_/g, ' ')}
          </span>
        </div>
        {order.invoice_no && (
          <p className="text-xs font-mono text-gray-400 mt-1">
            {formatInvoiceNo(order.invoice_prefix, order.invoice_no)}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 items-end justify-between">
        <div className="flex flex-col gap-1">
          <button disabled={isFirst} onClick={onMoveUp}
            className="h-6 w-6 rounded border border-gray-200 flex items-center justify-center disabled:opacity-30 hover:bg-gray-50">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button disabled={isLast} onClick={onMoveDown}
            className="h-6 w-6 rounded border border-gray-200 flex items-center justify-center disabled:opacity-30 hover:bg-gray-50">
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        <Link href={`/rider/delivery/${order.id}`}>
          <Button size="sm" className="text-xs gap-1 h-7 px-2">
            <Navigation className="h-3 w-3" /> Go
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function RiderDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [savingSequence, setSavingSequence] = useState(false);

  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchOrders = useCallback(async (uid: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        customer:profiles!customer_id(full_name, phone),
        order_items(id, quantity, unit_price, product:products(brand_name, generic_name))
      `)
      .eq('rider_id', uid)
      .eq('delivery_date', today)
      .in('status', ['out_for_delivery', 'delivered', 'needs_manual_review'])
      .order('delivery_sequence', { ascending: true, nullsFirst: false });

    setOrders((data ?? []) as unknown as Order[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        fetchOrders(user.id);
      }
    });
  }, [fetchOrders]);

  const saveSequence = async (reorderedOrders: Order[]) => {
    setSavingSequence(true);
    const updates = reorderedOrders.map((o, i) => ({
      id: o.id,
      delivery_sequence: i + 1,
    }));

    for (const u of updates) {
      await supabase.from('orders').update({ delivery_sequence: u.delivery_sequence }).eq('id', u.id);
    }
    setSavingSequence(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrders((prev) => {
      const oldIndex = prev.findIndex((o) => o.id === active.id);
      const newIndex = prev.findIndex((o) => o.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      saveSequence(reordered);
      return reordered;
    });
  };

  const moveOrder = (index: number, direction: 'up' | 'down') => {
    setOrders((prev) => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      const reordered = arrayMove(prev, index, newIndex);
      saveSequence(reordered);
      return reordered;
    });
  };

  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Today&apos;s Deliveries</h1>
        <p className="text-sm text-gray-500">{today}</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-28 animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No deliveries scheduled for today</p>
          <p className="text-sm mt-1">Check back later or contact your admin</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">
            {savingSequence ? 'Saving order…' : 'Drag or use arrows to resequence your route'}
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orders.map((o) => o.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {orders.map((order, i) => (
                  <SortableOrderCard
                    key={order.id}
                    order={order}
                    index={i}
                    isFirst={i === 0}
                    isLast={i === orders.length - 1}
                    onMoveUp={() => moveOrder(i, 'up')}
                    onMoveDown={() => moveOrder(i, 'down')}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}
