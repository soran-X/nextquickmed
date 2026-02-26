import Link from 'next/link';
import { Logo } from '@/components/shared/Logo';
import { Map, ListOrdered, User } from 'lucide-react';

const navItems = [
  { href: '/rider/dashboard', label: 'Queue', icon: ListOrdered },
  { href: '/rider/map', label: 'Map', icon: Map },
];

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Logo height={28} />
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="text-sm text-gray-500 hover:text-red-500 transition-colors">
              Sign Out
            </button>
          </form>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-20">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-30">
        <div className="max-w-lg mx-auto flex">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center justify-center py-3 text-gray-500 hover:text-[var(--brand-primary)] transition-colors">
              <Icon className="h-5 w-5 mb-0.5" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
