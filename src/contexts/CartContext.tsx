'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { GuestCartItem, Product } from '@/types';
import {
  getGuestCart,
  addToGuestCart,
  updateGuestCartQuantity,
  removeFromGuestCart,
  clearGuestCart,
} from '@/lib/cart';

interface CartContextValue {
  items: GuestCartItem[];
  count: number;
  subtotal: number;
  addItem: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  refresh: () => void;
}

const CartContext = createContext<CartContextValue>({
  items: [],
  count: 0,
  subtotal: 0,
  addItem: () => {},
  updateQuantity: () => {},
  removeItem: () => {},
  clear: () => {},
  refresh: () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<GuestCartItem[]>([]);

  const refresh = useCallback(() => {
    setItems(getGuestCart());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback((product: Product, quantity = 1) => {
    setItems(addToGuestCart(product, quantity));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems(updateGuestCartQuantity(productId, quantity));
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(removeFromGuestCart(productId));
  }, []);

  const clear = useCallback(() => {
    clearGuestCart();
    setItems([]);
  }, []);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.quantity * i.product.price, 0);

  return (
    <CartContext.Provider
      value={{ items, count, subtotal, addItem, updateQuantity, removeItem, clear, refresh }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
