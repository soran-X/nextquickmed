import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { BrandingProvider } from '@/contexts/BrandingContext';
import { CartProvider } from '@/contexts/CartContext';
import { Toaster } from 'sonner';
import { createClient } from '@/lib/supabase/server';
import { BrandingConfig } from '@/types';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'QuickMed – Online Pharmacy',
  description: 'Fast, reliable medicine delivery to your door.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch branding from DB (SSR – no flash of default branding)
  let branding: Partial<BrandingConfig> = {};
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('settings')
      .select('company_name, logo_url, primary_color, secondary_color, tertiary_color')
      .eq('id', 1)
      .single();

    if (data) {
      branding = {
        companyName: data.company_name,
        logoUrl: data.logo_url,
        primaryColor: data.primary_color,
        secondaryColor: data.secondary_color,
        tertiaryColor: data.tertiary_color,
      };
    }
  } catch {
    // DB not ready – use defaults
  }

  const primary = branding.primaryColor ?? '#0ea5e9';
  const secondary = branding.secondaryColor ?? '#0284c7';
  const tertiary = branding.tertiaryColor ?? '#f0f9ff';

  return (
    <html lang="en">
      <head>
        <style>{`
          :root {
            --brand-primary: ${primary};
            --brand-secondary: ${secondary};
            --brand-tertiary: ${tertiary};
          }
        `}</style>
      </head>
      <body className={`${inter.className} antialiased`}>
        <BrandingProvider initial={branding}>
          <CartProvider>
            {children}
            <Toaster position="top-right" richColors />
          </CartProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
