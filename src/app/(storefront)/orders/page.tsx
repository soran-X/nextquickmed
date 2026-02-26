import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { OrdersClient } from './OrdersClient';

export const dynamic = 'force-dynamic';

export default async function CustomerOrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/orders');

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      *,
      order_items(id, quantity, unit_price, product:products(brand_name)),
      rider_profile:profiles!orders_rider_id_fkey(full_name, phone)
    `)
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false });

  return <OrdersClient orders={(orders ?? []) as any} />;
}
