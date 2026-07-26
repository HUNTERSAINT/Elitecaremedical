import { useState } from 'react';
import { useParams, Link } from 'wouter';
import { motion } from 'framer-motion';
import { ShoppingCart, ChevronRight, Minus, Plus, Package, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react';
import { useListProducts } from '@workspace/api-client-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { useCart } from '@/context/CartContext';
import { formatNaira } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// We load product by slug from the list (API doesn't have slug-based get)
export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const { addToCart } = useCart();
  const { toast } = useToast();

  // Load product by slug
  const { data: productsData, isLoading } = useListProducts(
    { search: slug?.replace(/-/g, ' '), limit: 20 },
    { query: { queryKey: ['/api/products', { search: slug }] } }
  );

  const product = productsData?.products?.find(p => p.slug === slug) || productsData?.products?.[0];

  // Related products
  const { data: relatedData } = useListProducts(
    { categoryId: product?.categoryId, limit: 4 },
    { query: { enabled: !!product?.categoryId, queryKey: ['/api/products', { categoryId: product?.categoryId }] } }
  );

  const relatedProducts = relatedData?.products?.filter(p => p.id !== product?.id).slice(0, 4) ?? [];

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product, quantity);
    toast({ title: 'Added to cart', description: `${quantity}x ${product.name} added to cart.` });
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <Navbar />
        <div className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="aspect-square rounded-2xl skeleton-shimmer" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 rounded skeleton-shimmer" />
              <div className="h-6 w-1/3 rounded skeleton-shimmer" />
              <div className="h-20 rounded skeleton-shimmer" />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center">
            <Package size={48} className="mx-auto mb-4 text-muted-foreground opacity-30" />
            <h2 className="font-serif text-2xl font-bold mb-2">Product Not Found</h2>
            <p className="text-muted-foreground mb-6">This product may have been removed or the link is incorrect.</p>
            <Link href="/shop" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-semibold" data-testid="link-back-to-shop">
              Back to Shop
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const images = product.images?.length ? product.images : [product.imageUrl].filter(Boolean) as string[];
  const specs = product.specifications ? JSON.parse(product.specifications) as Record<string, string> : null;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />

      <div className="flex-1 bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-muted-foreground mb-8">
            <Link href="/" className="hover:text-foreground transition-colors" data-testid="link-breadcrumb-home">Home</Link>
            <ChevronRight size={12} />
            <Link href="/shop" className="hover:text-foreground transition-colors" data-testid="link-breadcrumb-shop">Shop</Link>
            <ChevronRight size={12} />
            <span className="text-foreground font-medium line-clamp-1">{product.name}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            {/* Images */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="aspect-square rounded-2xl overflow-hidden bg-white border border-border mb-3">
                {images.length > 0 ? (
                  <img
                    src={images[activeImage]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    data-testid="img-product-main"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <Package size={48} className="text-muted-foreground/30" />
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                        activeImage === i ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30'
                      }`}
                      data-testid={`button-image-thumb-${i}`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Details */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col"
            >
              <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-2">{product.categoryName}</div>
              <h1 className="font-serif text-2xl lg:text-3xl font-bold text-foreground mb-2" data-testid="text-product-title">{product.name}</h1>

              {(product.brand || product.model) && (
                <div className="flex items-center gap-3 mb-4">
                  {product.brand && <span className="text-sm text-muted-foreground">Brand: <strong className="text-foreground">{product.brand}</strong></span>}
                  {product.model && <span className="text-sm text-muted-foreground">Model: <strong className="text-foreground">{product.model}</strong></span>}
                </div>
              )}

              {/* Price */}
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-3xl font-bold text-primary" data-testid="text-product-price">{formatNaira(product.price)}</span>
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="text-lg text-muted-foreground line-through">{formatNaira(product.originalPrice)}</span>
                )}
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="text-sm font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                    Save {formatNaira(product.originalPrice - product.price)}
                  </span>
                )}
              </div>

              {/* Stock */}
              <div className={`flex items-center gap-2 text-sm mb-6 ${product.inStock ? 'text-green-700' : 'text-red-600'}`}>
                {product.inStock ? (
                  <><CheckCircle size={15} /> In Stock — Ready to Ship</>
                ) : (
                  <><AlertCircle size={15} /> Out of Stock</>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">{product.description}</p>
              )}

              {/* Quantity + Add to Cart */}
              {product.inStock && (
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="px-3 py-2.5 hover:bg-muted transition-colors"
                      data-testid="button-decrease-quantity"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="px-4 py-2.5 font-semibold text-sm min-w-[2.5rem] text-center" data-testid="text-quantity">{quantity}</span>
                    <button
                      onClick={() => setQuantity(q => q + 1)}
                      className="px-3 py-2.5 hover:bg-muted transition-colors"
                      data-testid="button-increase-quantity"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleAddToCart}
                    className="flex-1 flex items-center justify-center gap-2.5 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-colors"
                    data-testid="button-add-to-cart-detail"
                  >
                    <ShoppingCart size={18} />
                    Add to Cart
                  </motion.button>
                </div>
              )}

              <a
                href="https://wa.me/2347065599931"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#25D366]/10 border border-[#25D366]/30 text-[#128C7E] font-medium py-3 rounded-xl hover:bg-[#25D366]/20 transition-colors text-sm mb-6"
                data-testid="link-whatsapp-product"
              >
                <MessageCircle size={16} />
                Enquire on WhatsApp
              </a>

              {/* Specs */}
              {specs && Object.keys(specs).length > 0 && (
                <div className="border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-sm mb-3">Specifications</h3>
                  <div className="space-y-2">
                    {Object.entries(specs).map(([key, val]) => (
                      <div key={key} className="flex items-start justify-between text-sm gap-4">
                        <span className="text-muted-foreground shrink-0">{key}</span>
                        <span className="text-foreground text-right">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div>
              <h2 className="text-2xl font-serif font-bold mb-6">Related Products</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {relatedProducts.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
