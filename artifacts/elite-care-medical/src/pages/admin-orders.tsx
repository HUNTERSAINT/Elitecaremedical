import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useListOrders, useUpdateOrderStatus } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import AdminGuard from '@/components/AdminGuard';
import AdminLayout from '@/components/AdminLayout';
import { formatNaira, formatDate, getOrderStatusColor, getPaymentStatusColor } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

export default function AdminOrders() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const LIMIT = 20;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateOrderStatus = useUpdateOrderStatus();

  const { data, isLoading } = useListOrders({ page });

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0;

  const filteredOrders = data?.orders?.filter(o =>
    !search ||
    o.customerName.toLowerCase().includes(search.toLowerCase()) ||
    o.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
    String(o.id).includes(search)
  ) ?? [];

  const handleStatusChange = (orderId: number, status: string) => {
    updateOrderStatus.mutate({ id: orderId, data: { status } }, {
      onSuccess: () => {
        toast({ title: 'Order status updated' });
        queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      },
      onError: () => {
        toast({ title: 'Failed to update order', variant: 'destructive' });
      },
    });
  };

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-serif font-bold">Orders</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{data?.total ?? 0} total orders</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by name, email or order ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              data-testid="input-admin-search-orders"
            />
          </div>

          {/* Table */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="p-5 space-y-3">
                {[...Array(8)].map((_, i) => <div key={i} className="h-14 rounded skeleton-shimmer" />)}
              </div>
            ) : filteredOrders.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Order</th>
                        <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Customer</th>
                        <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Total</th>
                        <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Payment</th>
                        <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Status</th>
                        <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredOrders.map(order => (
                        <>
                          <tr
                            key={order.id}
                            onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                            className="hover:bg-muted/30 transition-colors cursor-pointer"
                            data-testid={`row-order-${order.id}`}
                          >
                            <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">#{order.id}</td>
                            <td className="px-5 py-3.5">
                              <div className="font-medium">{order.customerName}</div>
                              <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                            </td>
                            <td className="px-5 py-3.5 font-semibold">{formatNaira(order.total)}</td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
                                {order.paymentStatus}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <select
                                value={order.status}
                                onClick={e => e.stopPropagation()}
                                onChange={e => handleStatusChange(order.id, e.target.value)}
                                className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-primary/30 outline-none ${getOrderStatusColor(order.status)}`}
                                data-testid={`select-order-status-${order.id}`}
                              >
                                {ORDER_STATUSES.map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-5 py-3.5 text-muted-foreground text-xs">{formatDate(order.createdAt)}</td>
                          </tr>

                          {/* Expanded row */}
                          {expandedId === order.id && (
                            <tr key={`${order.id}-expanded`}>
                              <td colSpan={6} className="px-5 py-4 bg-muted/20">
                                <motion.div
                                  initial={{ opacity: 0, y: -8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                                >
                                  <div>
                                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Delivery Details</h4>
                                    <div className="text-sm space-y-1">
                                      <div><span className="text-muted-foreground">Phone: </span>{order.customerPhone}</div>
                                      <div><span className="text-muted-foreground">Address: </span>{order.deliveryAddress}</div>
                                      <div><span className="text-muted-foreground">City: </span>{order.city}, {order.state}</div>
                                      {order.notes && <div><span className="text-muted-foreground">Notes: </span>{order.notes}</div>}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Order Items</h4>
                                    <div className="text-sm space-y-1">
                                      {order.items.map((item, i) => (
                                        <div key={i} className="flex justify-between">
                                          <span>{item.productName} × {item.quantity}</span>
                                          <span className="font-medium">{formatNaira(item.totalPrice)}</span>
                                        </div>
                                      ))}
                                      <div className="border-t border-border pt-1 mt-1 flex justify-between font-semibold">
                                        <span>Total</span>
                                        <span>{formatNaira(order.total)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-4 border-t border-border">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      data-testid="button-orders-prev"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                      const p = i + 1;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === p ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                          data-testid={`button-orders-page-${p}`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      data-testid="button-orders-next"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="p-12 text-center">
                <p className="text-sm text-muted-foreground">
                  {search ? `No orders matching "${search}"` : 'No orders yet'}
                </p>
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
