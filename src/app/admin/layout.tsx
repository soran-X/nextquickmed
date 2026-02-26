import Link from 'next/link';
import { Logo } from '@/components/shared/Logo';
import {
  LayoutDashboard, Package, ShoppingBag, Users, Settings, Bike, UserCog
} from 'lucide-react';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders',    label: 'Orders',    icon: ShoppingBag },
  { href: '/admin/products',  label: 'Products',  icon: Package },
  { href: '/admin/riders',    label: 'Riders',    icon: Bike },
  { href: '/admin/team',      label: 'Team',      icon: UserCog },
  { href: '/admin/settings',  label: 'Settings',  icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 left-0 z-30">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <Logo height={32} />
          <span className="ml-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-[var(--brand-primary)] transition-colors"
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="w-full text-left text-sm text-gray-500 hover:text-red-500 transition-colors px-3 py-2 rounded-lg hover:bg-red-50">
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div className="ml-64 flex-1">
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
