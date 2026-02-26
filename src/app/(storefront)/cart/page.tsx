'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { computeVAT } from '@/lib/haversine';

export default function CartPage() {
  const { items, updateQuantity, removeItem, subtotal } = useCart();
  const { vatAmount, vatInclusive } = computeVAT(subtotal);

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <ShoppingBag className="h-20 w-20 mx-auto text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-700 mb-2">Your cart is empty</h1>
        <p className="text-gray-400 mb-8">Add some medicines to get started.</p>
        <Button asChild>
          <Link href="/products">Browse Products</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Shopping Cart</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Items list */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.product_id} className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4">
              <div className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                {item.product.images?.[0] ? (
                  <Image src={item.product.images[0]} alt={item.product.brand_name} fill className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-300">
                    <ShoppingBag className="h-8 w-8" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{item.product.brand_name}</h3>
                <p className="text-xs text-gray-500 truncate">{item.product.generic_name}</p>
                <p className="text-sm font-bold mt-1" style={{ color: 'var(--brand-primary)' }}>
                  {formatCurrency(item.product.price)}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => removeItem(item.product_id)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                    className="h-7 w-7 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                    disabled={item.quantity >= item.product.stock}
                    className="h-7 w-7 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 font-semibold">
                  {formatCurrency(item.quantity * item.product.price)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 h-fit space-y-4">
          <h2 className="font-semibold text-gray-900 text-lg">Order Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal (excl. VAT)</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>VAT (12%)</span>
              <span>{formatCurrency(vatAmount)}</span>
            </div>
            <div className="flex justify-between text-gray-500 text-xs italic">
              <span>Delivery fee</span>
              <span>Calculated at checkout</span>
            </div>
          </div>
          <div className="border-t pt-3 flex justify-between font-bold text-gray-900">
            <span>Est. Total (w/ VAT)</span>
            <span>{formatCurrency(vatInclusive)}</span>
          </div>
          <Button asChild className="w-full gap-2">
            <Link href="/checkout">
              Proceed to Checkout <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/products">Continue Shopping</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
