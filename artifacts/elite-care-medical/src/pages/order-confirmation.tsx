import { useLocation, Link } from 'wouter';
import { motion } from 'framer-motion';
import { CheckCircle, MessageCircle, ShoppingBag } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';

export default function OrderConfirmation() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search || location.split('?')[1] || '');
  const orderId = searchParams.get('orderId');
  const method = searchParams.get('method');
  const { toast } = useToast();

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />

      <div className="flex-1 bg-background py-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle size={40} className="text-green-600" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="font-serif text-3xl font-bold text-foreground mb-3">Order Confirmed!</h1>
            <p className="text-muted-foreground mb-2">
              Thank you for your order. We've received your request and will process it shortly.
            </p>
            {orderId && (
              <div className="inline-flex items-center gap-2 bg-muted px-4 py-2 rounded-full text-sm font-mono font-medium text-foreground mb-8">
                Order ID: #{orderId}
              </div>
            )}
          </motion.div>

          {method === 'bank_transfer' ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8 text-left"
            >
              <h2 className="font-semibold text-amber-900 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Bank Transfer Instructions
              </h2>
              <p className="text-sm text-amber-800 mb-4">
                Your order is reserved for 24 hours. Please contact us on WhatsApp for the current verified bank-transfer details, then send your payment proof for confirmation.
              </p>
              <div className="bg-white rounded-xl border border-amber-200 p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment details</span>
                  <span className="font-semibold text-right">Provided securely on request</span>
                </div>
              </div>
              <a
                href="https://wa.me/2347065599931"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#20bd5a]"
                data-testid="link-bank-transfer-whatsapp"
              >
                <MessageCircle size={16} />
                Request Bank Details on WhatsApp
              </a>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-8 text-left"
            >
              <h2 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                <CheckCircle size={16} className="text-green-600" />
                Payment Successful
              </h2>
              <p className="text-sm text-green-800">
                Your payment has been received. We'll begin processing your order immediately.
              </p>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <a
              href="https://wa.me/2347065599931"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#20bd5a] transition-colors"
              data-testid="link-whatsapp-support"
            >
              <MessageCircle size={16} />
              WhatsApp Support
            </a>
            <Link
              href="/shop"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors"
              data-testid="link-continue-shopping-confirm"
            >
              <ShoppingBag size={16} />
              Continue Shopping
            </Link>
          </motion.div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
