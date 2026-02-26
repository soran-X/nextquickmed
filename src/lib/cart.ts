/**
 * Guest cart utilities using localStorage
 */

import { GuestCartItem, Product } from '@/types';

const CART_KEY = 'quickmed_guest_cart';

export function getGuestCart(): GuestCartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as GuestCartItem[]) : [];
  } catch {
    return [];
  }
}

export function setGuestCart(items: GuestCartItem[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function addToGuestCart(product: Product, quantity = 1): GuestCartItem[] {
  const cart = getGuestCart();
  const existing = cart.find((i) => i.product_id === product.id);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, product.stock);
  } else {
    cart.push({ product_id: product.id, quantity, product });
  }
  setGuestCart(cart);
  return cart;
}

export function updateGuestCartQuantity(
  productId: string,
  quantity: number
): GuestCartItem[] {
  const cart = getGuestCart();
  const item = cart.find((i) => i.product_id === productId);
  if (item) {
    if (quantity <= 0) {
      return removeFromGuestCart(productId);
    }
    item.quantity = quantity;
  }
  setGuestCart(cart);
  return cart;
}

export function removeFromGuestCart(productId: string): GuestCartItem[] {
  const cart = getGuestCart().filter((i) => i.product_id !== productId);
  setGuestCart(cart);
  return cart;
}

export function clearGuestCart(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CART_KEY);
}

export function getGuestCartCount(): number {
  return getGuestCart().reduce((sum, i) => sum + i.quantity, 0);
}

export function getGuestCartSubtotal(): number {
  return getGuestCart().reduce(
    (sum, i) => sum + i.quantity * i.product.price,
    0
  );
}
