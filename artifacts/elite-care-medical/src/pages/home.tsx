import { useRef } from 'react';
import { Link } from 'wouter';
import { motion, useInView } from 'framer-motion';
import { ShieldCheck, Truck, Award, MessageCircle, ArrowRight, Phone } from 'lucide-react';
import { useListProducts, useListCategories } from '@workspace/api-client-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import ProductSkeleton from '@/components/ProductSkeleton';
import heroBanner from '@assets/hero-banner.jpg';
import catLab from '@assets/cat-laboratory.jpg';
import catSurgical from '@assets/cat-surgical.jpg';
import catDiagnostic from '@assets/cat-diagnostic.jpg';
import catPatient from '@assets/cat-patient-care.jpg';
import catNursing from '@assets/cat-nursing.jpg';
import catPPE from '@assets/cat-ppe.jpg';

const categoryImages: Record<string, string> = {
  'laboratory': catLab,
  'laboratory-equipment': catLab,
  'surgical': catSurgical,
  'surgical-equipment': catSurgical,
  'diagnostic': catDiagnostic,
  'diagnostic-equipment': catDiagnostic,
  'patient-care': catPatient,
  'nursing': catNursing,
  'nursing-supplies': catNursing,
  'ppe': catPPE,
  'personal-protective-equipment': catPPE,
};

function getCategoryImage(slug: string): string {
  return categoryImages[slug.toLowerCase()] || catLab;
}

const trustBadges = [
  {
    icon: ShieldCheck,
    title: 'NAFDAC Licensed',
    desc: 'All products are certified and approved by Nigerian regulatory bodies.',
  },
  {
    icon: Truck,
    title: 'Fast Nationwide Delivery',
    desc: 'Prompt delivery to hospitals and clinics across all 36 states.',
  },
  {
    icon: Award,
    title: 'Quality Assured',
    desc: 'Every product meets international medical equipment standards.',
  },
  {
    icon: MessageCircle,
    title: '24/7 WhatsApp Support',
    desc: 'Dedicated support for orders, inquiries, and after-sales service.',
  },
];

function FadeInSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export default function Home() {
  const { data: featuredData, isLoading: loadingFeatured } = useListProducts({ featured: true, limit: 8 });
  const { data: categories, isLoading: loadingCategories } = useListCategories();

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-[580px] lg:min-h-[680px] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroBanner}
            alt="Elite Care Medical"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/92 via-primary/75 to-primary/30" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-24 lg:py-32 w-full">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="max-w-xl"
          >
            <div className="inline-flex items-center gap-2 bg-accent/20 border border-accent/30 text-accent-foreground rounded-full px-4 py-1.5 text-xs font-semibold mb-6 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-accent badge-pulse" />
              Trusted Medical Supplier in Lagos
            </div>

            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-serif font-bold text-white leading-tight mb-6">
              Professional Medical Equipment for{' '}
              <span className="text-accent" style={{ fontStyle: 'italic' }}>Every</span>{' '}
              Healthcare Need
            </h1>

            <p className="text-primary-foreground/80 text-lg mb-8 leading-relaxed">
              Supplying hospitals, clinics, labs, and healthcare professionals across Nigeria with certified medical equipment at competitive prices.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/shop"
                className="inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground font-semibold px-7 py-3.5 rounded-xl hover:bg-accent/90 transition-colors text-sm"
                data-testid="button-hero-shop"
              >
                Browse Products
                <ArrowRight size={16} />
              </Link>
              <a
                href="https://wa.me/2347065599931?text=Hi%20Elite%20Care%2C%20I%20want%20to%20shop%20for%20medical%20equipment."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-white/15 backdrop-blur-sm text-white border border-white/30 font-semibold px-7 py-3.5 rounded-xl hover:bg-white/25 transition-colors text-sm"
                data-testid="button-hero-whatsapp"
              >
                <MessageCircle size={16} />
                WhatsApp Us
              </a>
            </div>
          </motion.div>
        </div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="absolute bottom-0 left-0 right-0 bg-white/10 backdrop-blur-sm border-t border-white/20"
        >
          <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-3 lg:grid-cols-3 gap-6 text-center text-white">
            {[
              { val: '500+', label: 'Products Available' },
              { val: '1,200+', label: 'Satisfied Clients' },
              { val: '36', label: 'States Served' },
            ].map(s => (
              <div key={s.label}>
                <div className="text-xl lg:text-2xl font-bold font-serif">{s.val}</div>
                <div className="text-xs text-white/70">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Trust badges */}
      <section className="bg-white border-b border-border py-16">
        <div className="max-w-7xl mx-auto px-4">
          <FadeInSection>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {trustBadges.map((badge, i) => (
                <motion.div
                  key={badge.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <badge.icon size={22} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground mb-1">{badge.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{badge.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <FadeInSection>
            <div className="flex items-end justify-between mb-10">
              <div>
                <div className="text-xs font-bold tracking-widest uppercase text-accent mb-2">Top Picks</div>
                <h2 className="text-3xl font-serif font-bold text-foreground">Featured Products</h2>
              </div>
              <Link
                href="/shop"
                className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                data-testid="link-view-all-products"
              >
                View All <ArrowRight size={15} />
              </Link>
            </div>
          </FadeInSection>

          {loadingFeatured ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => <ProductSkeleton key={i} />)}
            </div>
          ) : featuredData?.products && featuredData.products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredData.products.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p>Products coming soon. Check back shortly.</p>
            </div>
          )}

          <div className="text-center mt-10 sm:hidden">
            <Link href="/shop" className="inline-flex items-center gap-2 text-sm font-semibold text-primary" data-testid="link-view-all-mobile">
              View All Products <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20 bg-secondary/40">
        <div className="max-w-7xl mx-auto px-4">
          <FadeInSection>
            <div className="text-center mb-12">
              <div className="text-xs font-bold tracking-widest uppercase text-accent mb-2">Shop by Category</div>
              <h2 className="text-3xl font-serif font-bold text-foreground">Product Categories</h2>
            </div>
          </FadeInSection>

          {loadingCategories ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square rounded-xl skeleton-shimmer" />
              ))}
            </div>
          ) : categories && categories.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-5">
              {categories.slice(0, 6).map((cat, i) => (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.07, duration: 0.4 }}
                >
                  <Link
                    href={`/shop?category=${cat.id}`}
                    className="group relative rounded-2xl overflow-hidden aspect-[3/2] block"
                    data-testid={`link-category-${cat.id}`}
                  >
                    <img
                      src={getCategoryImage(cat.slug)}
                      alt={cat.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-white font-semibold text-sm mb-1">{cat.name}</h3>
                      <div className="text-white/60 text-xs">{cat.productCount} products</div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {['Laboratory Equipment', 'Surgical Equipment', 'Diagnostic Equipment', 'Patient Care', 'Nursing Supplies', 'PPE'].map((name, i) => (
                <Link
                  key={name}
                  href="/shop"
                  className="group relative rounded-2xl overflow-hidden aspect-[3/2] block"
                  data-testid={`link-category-static-${i}`}
                >
                  <img
                    src={Object.values(categoryImages)[i] || catLab}
                    alt={name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white font-semibold text-sm">{name}</h3>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-20 bg-primary">
        <FadeInSection>
          <div className="max-w-3xl mx-auto px-4 text-center">
            <div className="text-xs font-bold tracking-widest uppercase text-accent mb-3">Get in Touch</div>
            <h2 className="text-3xl font-serif font-bold text-white mb-4">
              Need Bulk Orders or Custom Procurement?
            </h2>
            <p className="text-primary-foreground/70 mb-8 text-lg">
              We handle large-scale supply for hospitals, government institutions, and NGOs across Nigeria. Contact us for special pricing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://wa.me/2347065599931?text=Hi%20Elite%20Care%2C%20I%20want%20to%20shop%20for%20medical%20equipment."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 bg-[#25D366] text-white font-semibold px-8 py-4 rounded-xl hover:bg-[#20bd5a] transition-colors"
                data-testid="button-cta-whatsapp"
              >
                <MessageCircle size={18} />
                Chat on WhatsApp
              </a>
              <a
                href="tel:+2347065599931"
                className="inline-flex items-center justify-center gap-2.5 bg-white/15 border border-white/30 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/25 transition-colors"
                data-testid="button-cta-phone"
              >
                <Phone size={18} />
                Call Us
              </a>
            </div>
          </div>
        </FadeInSection>
      </section>

      <Footer />
    </div>
  );
}

function Package({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
    </svg>
  );
}
