import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Search, X, Check, AlertTriangle } from 'lucide-react';
import { useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useListCategories, getListProductsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import AdminGuard from '@/components/AdminGuard';
import AdminLayout from '@/components/AdminLayout';
import { formatNaira } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface EditPriceModalProps {
  productId: number;
  productName: string;
  currentPrice: number;
  onClose: () => void;
}

function EditPriceModal({ productId, productName, currentPrice, onClose }: EditPriceModalProps) {
  const [price, setPrice] = useState(currentPrice.toString());
  const [originalPrice, setOriginalPrice] = useState('');
  const updateProduct = useUpdateProduct();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSave = () => {
    const newPrice = parseFloat(price);
    if (isNaN(newPrice) || newPrice <= 0) {
      toast({ title: 'Invalid price', variant: 'destructive' });
      return;
    }
    updateProduct.mutate({
      id: productId,
      data: {
        price: newPrice,
        originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
      },
    }, {
      onSuccess: () => {
        toast({ title: 'Price updated successfully' });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        onClose();
      },
      onError: () => {
        toast({ title: 'Failed to update price', variant: 'destructive' });
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-sm shadow-2xl"
      >
        <h2 className="font-serif text-lg font-bold mb-1">Edit Price</h2>
        <p className="text-sm text-muted-foreground mb-5 line-clamp-2">{productName}</p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">New Price (₦) *</label>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              data-testid="input-edit-price"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Original Price (₦) — optional</label>
            <input
              type="number"
              value={originalPrice}
              onChange={e => setOriginalPrice(e.target.value)}
              placeholder={`Was ${currentPrice}`}
              className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              data-testid="input-edit-original-price"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
            data-testid="button-cancel-edit-price"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateProduct.isPending}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            data-testid="button-save-price"
          >
            <Check size={15} />
            {updateProduct.isPending ? 'Saving...' : 'Save Price'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

interface AddProductModalProps {
  onClose: () => void;
}

function AddProductModal({ onClose }: AddProductModalProps) {
  const [form, setForm] = useState({
    name: '', slug: '', description: '', price: '', categoryId: '', brand: '', model: '', imageUrl: '', inStock: true, isFeatured: false,
  });
  const createProduct = useCreateProduct();
  const { data: categories } = useListCategories();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleChange = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.name || !form.price || !form.categoryId) {
      toast({ title: 'Fill required fields', variant: 'destructive' });
      return;
    }
    const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    createProduct.mutate({
      data: {
        name: form.name,
        slug,
        description: form.description || undefined,
        price: parseFloat(form.price),
        categoryId: parseInt(form.categoryId),
        brand: form.brand || undefined,
        model: form.model || undefined,
        imageUrl: form.imageUrl || undefined,
        inStock: form.inStock,
        isFeatured: form.isFeatured,
      },
    }, {
      onSuccess: () => {
        toast({ title: 'Product created successfully' });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        onClose();
      },
      onError: () => {
        toast({ title: 'Failed to create product', variant: 'destructive' });
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <h2 className="font-serif text-lg font-bold mb-5">Add New Product</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Product Name *', key: 'name', placeholder: 'e.g. Digital Stethoscope' },
            { label: 'URL Slug', key: 'slug', placeholder: 'auto-generated if empty' },
            { label: 'Price (₦) *', key: 'price', placeholder: '25000', type: 'number' },
            { label: 'Brand', key: 'brand', placeholder: 'e.g. 3M, Omron' },
            { label: 'Model', key: 'model', placeholder: 'Model number' },
            { label: 'Image URL', key: 'imageUrl', placeholder: 'https://...' },
          ].map(f => (
            <div key={f.key} className={f.key === 'name' ? 'sm:col-span-2' : ''}>
              <label className="text-sm font-medium text-foreground block mb-1.5">{f.label}</label>
              <input
                type={f.type ?? 'text'}
                value={form[f.key as keyof typeof form] as string}
                onChange={e => handleChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                data-testid={`input-new-product-${f.key}`}
              />
            </div>
          ))}

          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-foreground block mb-1.5">Category *</label>
            <select
              value={form.categoryId}
              onChange={e => handleChange('categoryId', e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
              data-testid="select-new-product-category"
            >
              <option value="">Select Category</option>
              {categories?.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-foreground block mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => handleChange('description', e.target.value)}
              rows={3}
              placeholder="Product description..."
              className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              data-testid="textarea-new-product-description"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="inStock"
              checked={form.inStock}
              onChange={e => handleChange('inStock', e.target.checked)}
              className="w-4 h-4 rounded accent-primary"
              data-testid="checkbox-in-stock"
            />
            <label htmlFor="inStock" className="text-sm font-medium">In Stock</label>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isFeatured"
              checked={form.isFeatured}
              onChange={e => handleChange('isFeatured', e.target.checked)}
              className="w-4 h-4 rounded accent-primary"
              data-testid="checkbox-is-featured"
            />
            <label htmlFor="isFeatured" className="text-sm font-medium">Featured Product</label>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
            data-testid="button-cancel-add-product"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createProduct.isPending}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            data-testid="button-save-new-product"
          >
            {createProduct.isPending ? 'Creating...' : 'Create Product'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function AdminProducts() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingProduct, setEditingProduct] = useState<{ id: number; name: string; price: number } | null>(null);
  const [addingProduct, setAddingProduct] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteProduct = useDeleteProduct();

  const { data: productsData, isLoading } = useListProducts({ search: debouncedSearch || undefined, page, limit: 15 });

  const handleSearch = (v: string) => {
    setSearch(v);
    const t = setTimeout(() => { setDebouncedSearch(v); setPage(1); }, 400);
    return () => clearTimeout(t);
  };

  const handleDelete = (id: number) => {
    deleteProduct.mutate({ id }, {
      onSuccess: () => {
        toast({ title: 'Product deleted' });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setDeletingId(null);
      },
      onError: () => {
        toast({ title: 'Failed to delete product', variant: 'destructive' });
        setDeletingId(null);
      },
    });
  };

  const totalPages = productsData ? Math.ceil(productsData.total / 15) : 0;

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-serif font-bold">Products</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{productsData?.total ?? 0} total products</p>
            </div>
            <button
              onClick={() => setAddingProduct(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-colors text-sm"
              data-testid="button-add-product"
            >
              <Plus size={16} />
              Add Product
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search products..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              data-testid="input-admin-search-products"
            />
          </div>

          {/* Table */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="p-5 space-y-3">
                {[...Array(8)].map((_, i) => <div key={i} className="h-14 rounded skeleton-shimmer" />)}
              </div>
            ) : productsData?.products && productsData.products.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Product</th>
                        <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Category</th>
                        <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Price</th>
                        <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Stock</th>
                        <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {productsData.products.map(product => (
                        <tr key={product.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-product-${product.id}`}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                                    {product.name[0]}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="font-medium line-clamp-1">{product.name}</div>
                                {product.brand && <div className="text-xs text-muted-foreground">{product.brand}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground text-xs">{product.categoryName}</td>
                          <td className="px-5 py-3.5">
                            <div className="font-semibold">{formatNaira(product.price)}</div>
                            {product.originalPrice && product.originalPrice > product.price && (
                              <div className="text-xs text-muted-foreground line-through">{formatNaira(product.originalPrice)}</div>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              product.inStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {product.inStock ? 'In Stock' : 'Out of Stock'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingProduct({ id: product.id, name: product.name, price: product.price })}
                                className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/15 transition-colors font-medium"
                                data-testid={`button-edit-price-${product.id}`}
                              >
                                <Pencil size={12} />
                                Edit Price
                              </button>
                              <button
                                onClick={() => setDeletingId(product.id)}
                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                data-testid={`button-delete-product-${product.id}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-4 border-t border-border">
                    {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                      const p = i + 1;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                            page === p ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          }`}
                          data-testid={`button-admin-page-${p}`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="p-10 text-center text-muted-foreground">
                <p className="text-sm">No products found</p>
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        <AnimatePresence>
          {editingProduct && (
            <EditPriceModal
              productId={editingProduct.id}
              productName={editingProduct.name}
              currentPrice={editingProduct.price}
              onClose={() => setEditingProduct(null)}
            />
          )}
          {addingProduct && (
            <AddProductModal onClose={() => setAddingProduct(false)} />
          )}
          {deletingId !== null && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle size={18} className="text-destructive" />
                  </div>
                  <h2 className="font-semibold">Delete Product</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete this product? This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingId(null)}
                    className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium"
                    data-testid="button-cancel-delete"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deletingId!)}
                    disabled={deleteProduct.isPending}
                    className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-xl text-sm font-semibold disabled:opacity-60"
                    data-testid="button-confirm-delete"
                  >
                    {deleteProduct.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </AdminLayout>
    </AdminGuard>
  );
}
