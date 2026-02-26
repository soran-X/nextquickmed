'use client';
import Link from 'next/link';
import { ShoppingCart, User, Search, Menu, X, LogOut, Package, LayoutDashboard, Bike } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Logo } from '@/components/shared/Logo';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type UserRole = 'admin' | 'rider' | 'customer' | null;

export function Navbar() {
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [role, setRole] = useState<UserRole>(null);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setRole(null); setLoaded(true); return; }
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single();
      setRole((profile?.role as UserRole) ?? 'customer');
      setLoaded(true);
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const isCustomerOrGuest = role === null || role === 'customer';

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            href={role === 'admin' ? '/admin/dashboard' : role === 'rider' ? '/rider/dashboard' : '/'}
            className="flex-shrink-0"
          >
            <Logo height={36} />
          </Link>

          {/* Search – desktop (customers/guests only) */}
          {isCustomerOrGuest && (
            <div className="hidden md:flex flex-1 max-w-xl mx-6">
              <form action="/products" method="GET" className="w-full flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="search"
                    name="q"
                    placeholder="Search by brand or generic name…"
                    className="w-full pl-9 pr-3 h-10 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  />
                </div>
                <Button type="submit" size="sm">Search</Button>
              </form>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Admin */}
            {loaded && role === 'admin' && (
              <>
                <Link href="/admin/dashboard">
                  <Button size="sm" style={{ backgroundColor: 'var(--brand-primary)' }}>
                    <LayoutDashboard className="h-4 w-4 mr-1" />
                    Admin Panel
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-1" />
                  Sign Out
                </Button>
              </>
            )}

            {/* Rider */}
            {loaded && role === 'rider' && (
              <>
                <Link href="/rider/dashboard">
                  <Button size="sm" style={{ backgroundColor: 'var(--brand-primary)' }}>
                    <Bike className="h-4 w-4 mr-1" />
                    Rider App
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-1" />
                  Sign Out
                </Button>
              </>
            )}

            {/* Logged-in customer */}
            {loaded && role === 'customer' && (
              <>
                <Link href="/cart" className="relative p-2 text-gray-600 hover:text-[var(--brand-primary)] transition-colors">
                  <ShoppingCart className="h-6 w-6" />
                  {count > 0 && (
                    <span
                      className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full text-white text-xs flex items-center justify-center font-bold"
                      style={{ backgroundColor: 'var(--brand-primary)' }}
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </Link>
                <div className="relative group">
                  <Button variant="outline" size="sm">
                    <User className="h-4 w-4 mr-1" />
                    Account
                  </Button>
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <Link
                      href="/orders"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
                    >
                      <Package className="h-4 w-4" />
                      My Orders
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50 rounded-b-lg"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Guest (not loaded yet: show nothing; loaded + null: show Sign In) */}
            {loaded && role === null && (
              <>
                <Link href="/cart" className="relative p-2 text-gray-600 hover:text-[var(--brand-primary)] transition-colors">
                  <ShoppingCart className="h-6 w-6" />
                  {count > 0 && (
                    <span
                      className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full text-white text-xs flex items-center justify-center font-bold"
                      style={{ backgroundColor: 'var(--brand-primary)' }}
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </Link>
                <Link href="/login">
                  <Button variant="outline" size="sm">
                    <User className="h-4 w-4 mr-1" />
                    Sign In
                  </Button>
                </Link>
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 text-gray-600"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile search (customers/guests only) */}
        {menuOpen && isCustomerOrGuest && (
          <div className="md:hidden pb-3">
            <form action="/products" method="GET" className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="search"
                  name="q"
                  placeholder="Search medicines…"
                  className="w-full pl-9 pr-3 h-10 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
              </div>
              <Button type="submit" size="sm">Go</Button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
