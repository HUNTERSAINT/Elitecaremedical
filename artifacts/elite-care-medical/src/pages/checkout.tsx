import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { CreditCard, Building2, ShieldCheck, ChevronRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart, DELIVERY_FEE } from '@/context/CartContext';
import { formatNaira } from '@/lib/utils';
import { useCreateOrder, useInitializePayment } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

const checkoutSchema = z.object({
  customerName: z.string().min(2, 'Full name is required'),
  customerEmail: z.string().email('Valid email is required'),
  customerPhone: z.string().min(10, 'Phone number is required'),
  deliveryAddress: z.string().min(5, 'Delivery address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  notes: z.string().optional(),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
  'Yobe', 'Zamfara',
];

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank_transfer'>('card');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const total = subtotal + DELIVERY_FEE;

  const createOrder = useCreateOrder();
  const initializePayment = useInitializePayment();

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      deliveryAddress: '',
      city: '',
      state: '',
      notes: '',
    },
  });

  const onSubmit = async (data: CheckoutForm) => {
    if (items.length === 0) {
      toast({ title: 'Cart is empty', variant: 'destructive' });
      return;
    }

    createOrder.mutate({
      data: {
        ...data,
        paymentMethod,
        items: items.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
      },
    }, {
      onSuccess: (order) => {
        if (paymentMethod === 'card') {
          // Initialize Paystack payment
          initializePayment.mutate({
            data: {
              orderId: order.id,
              email: data.customerEmail,
              // The API accepts naira and converts to Paystack's kobo unit.
              amount: total,
              callbackUrl: `${window.location.origin}/payment-callback`,
            },
          }, {
            onSuccess: (paymentData) => {
              clearCart();
              window.location.href = paymentData.authorizationUrl;
            },
            onError: () => {
              toast({ title: 'Payment initialization failed', description: 'Please try again or use bank transfer.', variant: 'destructive' });
            },
          });
        } else {
          clearCart();
          setLocation(`/order-confirmation?orderId=${order.id}&method=bank_transfer`);
        }
      },
      onError: () => {
        toast({ title: 'Order creation failed', description: 'Please check your details and try again.', variant: 'destructive' });
      },
    });
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center">
            <h2 className="font-serif text-2xl font-bold mb-3">Your cart is empty</h2>
            <Link href="/shop" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-semibold" data-testid="link-goto-shop-from-checkout">
              Browse Products
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const isSubmitting = createOrder.isPending || initializePayment.isPending;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />

      <div className="bg-primary text-primary-foreground py-10">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl font-serif font-bold mb-1">Checkout</h1>
          <nav className="flex items-center gap-2 text-primary-foreground/60 text-sm mt-2">
            <Link href="/cart" className="hover:text-primary-foreground" data-testid="link-breadcrumb-cart">Cart</Link>
            <ChevronRight size={13} />
            <span className="text-primary-foreground">Checkout</span>
          </nav>
        </div>
      </div>

      <div className="flex-1 bg-background py-10">
        <div className="max-w-7xl mx-auto px-4">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* Customer info */}
                <div className="bg-card border border-card-border rounded-xl p-6">
                  <h2 className="font-serif text-lg font-bold mb-5">Customer Information</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium text-foreground block mb-1.5">Full Name *</label>
                      <input
                        {...form.register('customerName')}
                        placeholder="e.g. Adebayo Okafor"
                        className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        data-testid="input-customer-name"
                      />
                      {form.formState.errors.customerName && (
                        <p className="text-xs text-destructive mt-1">{form.formState.errors.customerName.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">Email Address *</label>
                      <input
                        {...form.register('customerEmail')}
                        type="email"
                        placeholder="your@email.com"
                        className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        data-testid="input-customer-email"
                      />
                      {form.formState.errors.customerEmail && (
                        <p className="text-xs text-destructive mt-1">{form.formState.errors.customerEmail.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">Phone Number *</label>
                      <input
                        {...form.register('customerPhone')}
                        placeholder="+234 800 000 0000"
                        className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        data-testid="input-customer-phone"
                      />
                      {form.formState.errors.customerPhone && (
                        <p className="text-xs text-destructive mt-1">{form.formState.errors.customerPhone.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delivery info */}
                <div className="bg-card border border-card-border rounded-xl p-6">
                  <h2 className="font-serif text-lg font-bold mb-5">Delivery Details</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium text-foreground block mb-1.5">Delivery Address *</label>
                      <input
                        {...form.register('deliveryAddress')}
                        placeholder="House number, street, area"
                        className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        data-testid="input-delivery-address"
                      />
                      {form.formState.errors.deliveryAddress && (
                        <p className="text-xs text-destructive mt-1">{form.formState.errors.deliveryAddress.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">City *</label>
                      <input
                        {...form.register('city')}
                        placeholder="e.g. Ikeja"
                        className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        data-testid="input-city"
                      />
                      {form.formState.errors.city && (
                        <p className="text-xs text-destructive mt-1">{form.formState.errors.city.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">State *</label>
                      <select
                        {...form.register('state')}
                        className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
                        data-testid="select-state"
                      >
                        <option value="">Select State</option>
                        {NIGERIAN_STATES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      {form.formState.errors.state && (
                        <p className="text-xs text-destructive mt-1">{form.formState.errors.state.message}</p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium text-foreground block mb-1.5">Order Notes (optional)</label>
                      <textarea
                        {...form.register('notes')}
                        rows={3}
                        placeholder="Any special instructions for your order..."
                        className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                        data-testid="input-notes"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment method */}
                <div className="bg-card border border-card-border rounded-xl p-6">
                  <h2 className="font-serif text-lg font-bold mb-5">Payment Method</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
                        paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                      }`}
                      data-testid="button-payment-card"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${paymentMethod === 'card' ? 'bg-primary' : 'bg-muted'}`}>
                        <CreditCard size={18} className={paymentMethod === 'card' ? 'text-primary-foreground' : 'text-muted-foreground'} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground">Pay with Card</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Debit/Credit card via Paystack. Secure &amp; instant.</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bank_transfer')}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
                        paymentMethod === 'bank_transfer' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                      }`}
                      data-testid="button-payment-bank-transfer"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${paymentMethod === 'bank_transfer' ? 'bg-primary' : 'bg-muted'}`}>
                        <Building2 size={18} className={paymentMethod === 'bank_transfer' ? 'text-primary-foreground' : 'text-muted-foreground'} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground">Bank Transfer</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Transfer to our GTB account. Order confirmed after payment proof.</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Order summary */}
              <div className="lg:col-span-1">
                <div className="bg-card border border-card-border rounded-xl p-6 sticky top-24">
                  <h2 className="font-serif text-lg font-bold mb-5">Order Summary</h2>

                  <div className="space-y-3 mb-5">
                    {items.map(item => (
                      <div key={item.product.id} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
                          {item.product.imageUrl ? (
                            <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                              {item.product.name[0]}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground line-clamp-1">{item.product.name}</div>
                          <div className="text-xs text-muted-foreground">Qty: {item.quantity}</div>
                        </div>
                        <div className="text-xs font-semibold text-foreground shrink-0">{formatNaira(item.product.price * item.quantity)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-border pt-4 space-y-2 text-sm mb-5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatNaira(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery</span>
                      <span className="font-medium">{formatNaira(DELIVERY_FEE)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base border-t border-border pt-2">
                      <span>Total</span>
                      <span className="text-primary">{formatNaira(total)}</span>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    data-testid="button-place-order"
                  >
                    {isSubmitting ? 'Processing...' : paymentMethod === 'card' ? 'Pay with Card' : 'Place Order'}
                  </motion.button>

                  <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck size={13} />
                    Secure &amp; encrypted checkout
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      <Footer />
    </div>
  );
}
