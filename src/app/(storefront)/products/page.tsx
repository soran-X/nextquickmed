import { createClient } from '@/lib/supabase/server';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Product } from '@/types';
import { Search } from 'lucide-react';

interface SearchParams {
  q?: string;
}

export const revalidate = 60; // ISR every 60s

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('brand_name');

  if (q && q.trim()) {
    // Full-text search across brand + generic name
    query = query.or(
      `brand_name.ilike.%${q}%,generic_name.ilike.%${q}%`
    );
  }

  const { data: products, error } = await query;

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-red-500">
        Failed to load products. Please try again.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        {q ? (
          <div className="flex items-center gap-2 mb-2">
            <Search className="h-5 w-5 text-gray-400" />
            <h1 className="text-2xl font-bold text-gray-900">
              Results for &ldquo;<span style={{ color: 'var(--brand-primary)' }}>{q}</span>&rdquo;
            </h1>
          </div>
        ) : (
          <h1 className="text-2xl font-bold text-gray-900 mb-2">All Products</h1>
        )}
        <p className="text-gray-500">
          {products?.length ?? 0} product{products?.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Grid */}
      {products && products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {products.map((product: Product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24">
          <div className="text-gray-300 mb-4">
            <Search className="h-16 w-16 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-gray-600">No products found</h2>
          {q && (
            <p className="text-gray-400 mt-2">
              Try searching for a different brand or generic name.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
