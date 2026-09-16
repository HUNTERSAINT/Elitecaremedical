import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Minus, Plus, ShoppingCart, ArrowRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart, DELIVERY_FEE } from '@/context/CartContext';
import { formatNaira } from '@/lib/utils';

export default function Cart() {
  const { items, removeFromCart, updateQuantity, subtotal } = useCart();
  const total = subtotal + DELIVERY_FEE;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />

      <div className="bg-primary text-primary-foreground py-10">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl font-serif font-bold mb-1">Shopping Cart</h1>
          <p className="text-primary-foreground/70 text-sm">{items.length} item{items.length !== 1 ? 's' : ''} in your cart</p>
        </div>
      </div>

      <div className="flex-1 bg-background py-10">
        <div className="max-w-7xl mx-auto px-4">
          {items.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
                <ShoppingCart size={32} className="text-muted-foreground" />
              </div>
              <h2 className="font-serif text-2xl font-bold mb-3">Your cart is empty</h2>
              <p className="text-muted-foreground mb-8">Browse our catalog and add products to your cart.</p>
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-8 py-3.5 rounded-xl hover:bg-primary/90 transition-colors"
                data-testid="link-continue-shopping"
              >
                Browse Products
                <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Items */}
              <div className="lg:col-span-2 space-y-4">
                <AnimatePresence>
                  {items.map(item => (
                    <motion.div
                      key={item.product.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="bg-card border border-card-border rounded-xl p-4 flex gap-4"
                      data-testid={`card-cart-item-${item.product.id}`}
                    >
                      {/* Image */}
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                        {item.product.imageUrl ? (
                          <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-xl font-serif font-bold text-muted-foreground/30">{item.product.name[0]}</span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{item.product.categoryName}</div>
                        <h3 className="font-semibold text-sm text-foreground line-clamp-2 mb-1" data-testid={`text-cart-item-name-${item.product.id}`}>
                          {item.product.name}
                        </h3>
                        <div className="font-bold text-primary text-sm" data-testid={`text-cart-item-price-${item.product.id}`}>
                          {formatNaira(item.product.price)}
                        </div>
                      </div>

                      {/* Quantity + Remove */}
                      <div className="flex flex-col items-end justify-between">
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                          data-testid={`button-remove-cart-item-${item.product.id}`}
                        >
                          <Trash2 size={16} />
                        </button>

                        <div>
                          <div className="text-xs text-muted-foreground text-right mb-1">
                            {formatNaira(item.product.price * item.quantity)}
                          </div>
                          <div className="flex items-center border border-border rounded-lg overflow-hidden">
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              className="px-2.5 py-1.5 hover:bg-muted transition-colors"
                              data-testid={`button-decrease-qty-${item.product.id}`}
                            >
                              <Minus size={12} />
                            </button>
                            <span className="px-3 text-sm font-semibold" data-testid={`text-cart-qty-${item.product.id}`}>{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              className="px-2.5 py-1.5 hover:bg-muted transition-colors"
                              data-testid={`button-increase-qty-${item.product.id}`}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <Link href="/shop" className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors" data-testid="link-continue-shopping-cart">
                  Continue Shopping
                </Link>
              </div>

              {/* Summary */}
              <div className="lg:col-span-1">
                <div className="bg-card border border-card-border rounded-xl p-6 sticky top-24">
                  <h2 className="font-serif text-lg font-bold mb-5">Order Summary</h2>
                  <div className="space-y-3 text-sm mb-5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</span>
                      <span className="font-medium" data-testid="text-cart-subtotal">{formatNaira(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span className="font-medium" data-testid="text-delivery-fee">{formatNaira(DELIVERY_FEE)}</span>
                    </div>
                    <div className="border-t border-border pt-3 flex justify-between font-bold text-base">
                      <span>Total</span>
                      <span className="text-primary" data-testid="text-cart-total">{formatNaira(total)}</span>
                    </div>
                  </div>

                  <Link
                    href="/checkout"
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl hover:bg-primary/90 transition-colors"
                    data-testid="button-proceed-checkout"
                  >
                    Proceed to Checkout
                    <ArrowRight size={16} />
                  </Link>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                      Secure checkout
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                      Pay with card or bank transfer
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
