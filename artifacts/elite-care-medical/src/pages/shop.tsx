import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useListProducts, useListCategories } from '@workspace/api-client-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import ProductSkeleton from '@/components/ProductSkeleton';

const LIMIT = 12;

export default function Shop() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] ?? '');
  const initialCat = searchParams.get('category') ? Number(searchParams.get('category')) : undefined;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(initialCat);
  const [page, setPage] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategory]);

  const { data: productsData, isLoading } = useListProducts({
    search: debouncedSearch || undefined,
    categoryId: selectedCategory,
    page,
    limit: LIMIT,
  });

  const { data: categories } = useListCategories();

  const totalPages = productsData ? Math.ceil(productsData.total / LIMIT) : 0;

  const FilterPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-sm text-foreground mb-3">Categories</h3>
        <div className="space-y-1">
          <button
            onClick={() => setSelectedCategory(undefined)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              !selectedCategory ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-foreground/70'
            }`}
            data-testid="button-filter-all"
          >
            All Products
          </button>
          {categories?.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                selectedCategory === cat.id ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-foreground/70'
              }`}
              data-testid={`button-filter-category-${cat.id}`}
            >
              <span>{cat.name}</span>
              <span className={`text-xs ${selectedCategory === cat.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {cat.productCount}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />

      {/* Page header */}
      <div className="bg-primary text-primary-foreground py-10">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl font-serif font-bold mb-2">Shop All Products</h1>
          <p className="text-primary-foreground/70 text-sm">
            Professional medical equipment for healthcare providers across Nigeria
          </p>
        </div>
      </div>

      <div className="flex-1 bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Search + filter bar */}
          <div className="flex gap-3 mb-8">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search products..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                data-testid="input-search-products"
              />
            </div>
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex items-center gap-2 px-4 py-2.5 bg-white border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
              data-testid="button-open-filters"
            >
              <SlidersHorizontal size={15} />
              Filter
            </button>
          </div>

          <div className="flex gap-8">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:block w-56 shrink-0">
              <div className="bg-white rounded-xl border border-border p-5 sticky top-24">
                <FilterPanel />
              </div>
            </aside>

            {/* Mobile sidebar */}
            {sidebarOpen && (
              <div className="fixed inset-0 z-50 lg:hidden">
                <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
                <motion.div
                  initial={{ x: -280 }}
                  animate={{ x: 0 }}
                  exit={{ x: -280 }}
                  className="absolute left-0 top-0 h-full w-72 bg-white p-5 overflow-y-auto"
                >
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-semibold">Filters</h2>
                    <button onClick={() => setSidebarOpen(false)} data-testid="button-close-filters">
                      <X size={18} />
                    </button>
                  </div>
                  <FilterPanel />
                </motion.div>
              </div>
            )}

            {/* Products grid */}
            <div className="flex-1 min-w-0">
              {/* Result count */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-muted-foreground" data-testid="text-results-count">
                  {isLoading ? 'Loading...' : `${productsData?.total ?? 0} products found`}
                </p>
                {selectedCategory && (
                  <button
                    onClick={() => setSelectedCategory(undefined)}
                    className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full hover:bg-primary/15 transition-colors"
                    data-testid="button-clear-category-filter"
                  >
                    <X size={12} />
                    Clear filter
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {[...Array(LIMIT)].map((_, i) => <ProductSkeleton key={i} />)}
                </div>
              ) : productsData?.products && productsData.products.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {productsData.products.map((product, i) => (
                      <ProductCard key={product.id} product={product} index={i} />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-10">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                        const p = i + 1;
                        return (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                              page === p
                                ? 'bg-primary text-primary-foreground'
                                : 'border border-border hover:bg-muted'
                            }`}
                            data-testid={`button-page-${p}`}
                          >
                            {p}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        data-testid="button-next-page"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-20">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Search size={24} className="text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">No products found</h3>
                  <p className="text-sm text-muted-foreground">
                    {search ? `No results for "${search}". Try a different search.` : 'No products in this category yet.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
