import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import { ShoppingBag, Package, Users, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 30;

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [ordersRes, productsRes, ridersRes, revenueRes] = await Promise.all([
    supabase.from('orders').select('id, status', { count: 'exact' }),
    supabase.from('products').select('id', { count: 'exact' }).eq('is_active', true),
    supabase.from('riders').select('id', { count: 'exact' }).eq('is_active', true),
    supabase.from('orders').select('cod_total').eq('status', 'delivered'),
  ]);

  const pendingOrders = ordersRes.data?.filter((o) => o.status === 'pending').length ?? 0;
  const totalProducts = productsRes.count ?? 0;
  const activeRiders = ridersRes.count ?? 0;
  const revenue = revenueRes.data?.reduce((s, o) => s + (o.cod_total ?? 0), 0) ?? 0;

  const stats = [
    {
      label: 'Pending Orders',
      value: pendingOrders,
      icon: ShoppingBag,
      color: 'bg-yellow-50 text-yellow-700',
      href: '/admin/orders',
    },
    {
      label: 'Active Products',
      value: totalProducts,
      icon: Package,
      color: 'bg-blue-50 text-blue-700',
      href: '/admin/products',
    },
    {
      label: 'Active Riders',
      value: activeRiders,
      icon: Users,
      color: 'bg-green-50 text-green-700',
      href: '/admin/riders',
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(revenue),
      icon: TrendingUp,
      color: 'bg-purple-50 text-purple-700',
      href: '/admin/orders',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{stat.label}</span>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </Link>
        ))}
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Recent Orders</h2>
          <Link href="/admin/orders" className="text-sm hover:underline" style={{ color: 'var(--brand-primary)' }}>
            View all →
          </Link>
        </div>
        <RecentOrders />
      </div>
    </div>
  );
}

async function RecentOrders() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, cod_total, created_at, invoice_no, profiles!customer_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(5);

  if (!orders?.length) {
    return <p className="text-gray-400 text-sm text-center py-8">No orders yet.</p>;
  }

  return (
    <div className="divide-y">
      {orders.map((order) => {
        const customer = (order.profiles as unknown as { full_name: string | null } | null);
        return (
          <Link key={order.id} href={`/admin/orders`}
            className="flex items-center justify-between py-3 hover:bg-gray-50 px-2 rounded transition-colors">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {customer?.full_name ?? 'Customer'}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(order.created_at).toLocaleDateString('en-PH')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
                order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                order.status === 'needs_manual_review' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {order.status.replace('_', ' ')}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(order.cod_total)}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
