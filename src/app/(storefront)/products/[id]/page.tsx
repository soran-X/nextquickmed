'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/contexts/CartContext';
import { formatCurrency } from '@/lib/utils';
import { ShoppingCart, Minus, Plus, AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single()
      .then(({ data, error }) => {
        if (error || !data) router.push('/products');
        else setProduct(data);
        setLoading(false);
      });
  }, [id, router]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-8" />
        <div className="grid md:grid-cols-2 gap-8">
          <div className="h-80 bg-gray-200 rounded-xl" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-10 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const handleAddToCart = () => {
    addItem(product, quantity);
    toast.success(`${product.brand_name} ×${quantity} added to cart`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/products" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[var(--brand-primary)] mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Products
      </Link>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Images */}
        <div>
          <div className="relative h-72 sm:h-96 rounded-xl overflow-hidden bg-gray-100">
            {product.images?.[activeImage] ? (
              <Image
                src={product.images[activeImage]}
                alt={product.brand_name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-300">
                <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
            )}
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-2 mt-3">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(idx)}
                  className={`relative h-16 w-16 rounded-lg overflow-hidden border-2 transition-colors ${activeImage === idx ? 'border-[var(--brand-primary)]' : 'border-transparent'}`}
                >
                  <Image src={img} alt={`View ${idx + 1}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          {product.requires_rx && (
            <Badge variant="warning" className="gap-1">
              <AlertCircle className="h-3 w-3" /> Prescription Required
            </Badge>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{product.brand_name}</h1>
          <p className="text-gray-500 text-sm font-medium">Generic: {product.generic_name}</p>

          {product.description && (
            <p className="text-gray-600 text-sm leading-relaxed">{product.description}</p>
          )}

          <div className="border-t pt-4">
            <p className="text-3xl font-bold" style={{ color: 'var(--brand-primary)' }}>
              {formatCurrency(product.price)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {product.stock > 0 ? (
                <span className="text-green-600 font-medium">{product.stock} in stock</span>
              ) : (
                <span className="text-red-500 font-medium">Out of stock</span>
              )}
            </p>
          </div>

          {product.stock > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="h-9 w-9 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-12 text-center font-semibold text-lg">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                className="h-9 w-9 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}

          <Button
            size="lg"
            className="w-full gap-2"
            onClick={handleAddToCart}
            disabled={product.stock === 0}
          >
            <ShoppingCart className="h-5 w-5" />
            {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </Button>
        </div>
      </div>
    </div>
  );
}
