import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Product } from '@workspace/api-client-react';

export interface CartItem {
  product: Product;
  quantity: number;
  size?: string;
}

interface CartContextValue {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number, size?: string) => void;
  removeFromCart: (productId: number, size?: string) => void;
  updateQuantity: (productId: number, quantity: number, size?: string) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const CART_KEY = 'ecm_cart';
const DELIVERY_FEE = 2000;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const addToCart = useCallback((product: Product, quantity = 1, size?: string) => {
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id && i.size === size);
      if (existing) {
        return prev.map(i =>
          i.product.id === product.id && i.size === size
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { product, quantity, ...(size ? { size } : {}) }];
    });
  }, []);

  const removeFromCart = useCallback((productId: number, size?: string) => {
    setItems(prev => prev.filter(i => !(i.product.id === productId && i.size === size)));
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number, size?: string) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => !(i.product.id === productId && i.size === size)));
    } else {
      setItems(prev =>
        prev.map(i => i.product.id === productId && i.size === size ? { ...i, quantity } : i)
      );
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, addToCart, removeFromCart, updateQuantity, clearCart,
      totalItems, subtotal
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export { DELIVERY_FEE };
