import { Navbar } from '@/components/storefront/Navbar';

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main>{children}</main>
      <footer className="mt-16 border-t bg-white py-8 text-center text-sm text-gray-500">
        <p style={{ color: 'var(--brand-primary)' }} className="font-semibold mb-1">QuickMed</p>
        <p>© {new Date().getFullYear()} All rights reserved. Fast, reliable pharmacy delivery.</p>
      </footer>
    </div>
  );
}
