import { useLocation, Link } from 'wouter';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useVerifyPayment } from '@workspace/api-client-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function PaymentCallback() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search || location.split('?')[1] || '');
  const reference = searchParams.get('reference') ?? '';

  const { data, isLoading, isError } = useVerifyPayment(reference, {
    query: {
      enabled: !!reference,
      queryKey: ['/api/payments/verify', reference],
      retry: 2,
    },
  });

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />

      <div className="flex-1 bg-background py-20">
        <div className="max-w-md mx-auto px-4 text-center">
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Loader2 size={36} className="text-primary animate-spin" />
              </div>
              <h1 className="font-serif text-2xl font-bold mb-2">Verifying Payment</h1>
              <p className="text-muted-foreground">Please wait while we confirm your payment...</p>
            </motion.div>
          )}

          {!isLoading && !isError && data && data.status === 'success' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 20 }}
            >
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={40} className="text-green-600" />
              </div>
              <h1 className="font-serif text-3xl font-bold text-foreground mb-3" data-testid="text-payment-success">Payment Successful!</h1>
              <p className="text-muted-foreground mb-2">{data.message || 'Your payment has been confirmed.'}</p>
              {data.orderId && (
                <div className="inline-flex items-center gap-2 bg-muted px-4 py-2 rounded-full text-sm font-mono font-medium text-foreground mb-8">
                  Order #: {data.orderId}
                </div>
              )}
              <div className="flex flex-col gap-3 mt-6">
                <Link
                  href="/shop"
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-colors"
                  data-testid="link-back-to-shop-success"
                >
                  Continue Shopping
                </Link>
                <a
                  href="https://wa.me/2347065599931"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold py-3 rounded-xl hover:bg-[#20bd5a] transition-colors"
                  data-testid="link-whatsapp-success"
                >
                  Contact Support
                </a>
              </div>
            </motion.div>
          )}

          {(!isLoading && (isError || (data && data.status !== 'success'))) && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 20 }}
            >
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                <XCircle size={40} className="text-red-600" />
              </div>
              <h1 className="font-serif text-3xl font-bold text-foreground mb-3" data-testid="text-payment-failed">Payment Failed</h1>
              <p className="text-muted-foreground mb-6">
                {data?.message || 'We could not verify your payment. Please contact support if you were charged.'}
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  href="/checkout"
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-xl"
                  data-testid="link-retry-checkout"
                >
                  Try Again
                </Link>
                <a
                  href="https://wa.me/2347065599931"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold py-3 rounded-xl"
                  data-testid="link-whatsapp-failed"
                >
                  Contact Support on WhatsApp
                </a>
              </div>
            </motion.div>
          )}

          {!reference && (
            <div>
              <h2 className="font-serif text-2xl font-bold mb-3">Invalid Link</h2>
              <p className="text-muted-foreground mb-6">No payment reference found in the URL.</p>
              <Link href="/" className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold" data-testid="link-home-invalid">
                Go Home
              </Link>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
