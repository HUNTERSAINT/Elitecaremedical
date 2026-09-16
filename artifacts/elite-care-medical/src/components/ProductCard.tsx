import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { ShoppingCart, Star } from 'lucide-react';
import type { Product } from '@workspace/api-client-react';
import { useCart } from '@/context/CartContext';
import { formatNaira } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ProductCardProps {
  product: Product;
  index?: number;
}

export default function ProductCard({ product, index = 0 }: ProductCardProps) {
  const { addToCart } = useCart();
  const { toast } = useToast();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1);
    toast({
      title: 'Added to cart',
      description: `${product.name} has been added to your cart.`,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: 'easeOut' }}
      className="group bg-card rounded-xl border border-card-border overflow-hidden hover:shadow-lg transition-shadow duration-300"
      data-testid={`card-product-${product.id}`}
    >
      <Link href={`/products/${product.slug}`} className="block">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              data-testid={`img-product-${product.id}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-secondary">
              <span className="text-4xl font-serif font-bold text-muted-foreground/30">{product.name[0]}</span>
            </div>
          )}
          {!product.inStock && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <span className="bg-foreground text-background text-xs font-semibold px-3 py-1 rounded-full">Out of Stock</span>
            </div>
          )}
          {product.isFeatured && (
            <div className="absolute top-3 left-3">
              <span className="bg-accent text-accent-foreground text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <Star size={9} fill="currentColor" />
                Featured
              </span>
            </div>
          )}
          {product.originalPrice && product.originalPrice > product.price && (
            <div className="absolute top-3 right-3">
              <span className="bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                {Math.round((1 - product.price / product.originalPrice) * 100)}% OFF
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{product.categoryName}</div>
          <h3 className="font-semibold text-sm text-foreground leading-snug line-clamp-2 mb-1 group-hover:text-primary transition-colors" data-testid={`text-product-name-${product.id}`}>
            {product.name}
          </h3>
          {product.brand && (
            <div className="text-xs text-muted-foreground mb-2">{product.brand}</div>
          )}
          <div className="flex items-center justify-between mt-3">
            <div>
              <div className="font-bold text-primary text-base" data-testid={`text-price-${product.id}`}>{formatNaira(product.price)}</div>
              {product.originalPrice && product.originalPrice > product.price && (
                <div className="text-xs text-muted-foreground line-through">{formatNaira(product.originalPrice)}</div>
              )}
            </div>
            {product.inStock && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleAddToCart}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3.5 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                data-testid={`button-add-to-cart-${product.id}`}
              >
                <ShoppingCart size={13} />
                Add
              </motion.button>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
