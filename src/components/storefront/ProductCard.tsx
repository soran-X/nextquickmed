'use client';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart, AlertCircle } from 'lucide-react';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/contexts/CartContext';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();

  const handleAdd = () => {
    if (product.stock === 0) return;
    addItem(product, 1);
    toast.success(`${product.brand_name} added to cart`);
  };

  const firstImage = product.images?.[0];

  return (
    <div className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Image */}
      <Link href={`/products/${product.id}`} className="relative h-48 bg-gray-100 overflow-hidden">
        {firstImage ? (
          <Image
            src={firstImage}
            alt={product.brand_name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
        )}
        {product.requires_rx && (
          <span className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Rx
          </span>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <Badge variant="destructive">Out of Stock</Badge>
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <Link href={`/products/${product.id}`}>
          <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-[var(--brand-primary)] transition-colors">
            {product.brand_name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{product.generic_name}</p>
        </Link>

        <div className="mt-auto pt-3 flex items-center justify-between">
          <span className="text-lg font-bold" style={{ color: 'var(--brand-primary)' }}>
            {formatCurrency(product.price)}
          </span>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={product.stock === 0}
            className="gap-1"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
        </p>
      </div>
    </div>
  );
}
