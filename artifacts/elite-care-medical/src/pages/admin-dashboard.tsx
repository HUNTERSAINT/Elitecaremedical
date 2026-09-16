import { motion } from 'framer-motion';
import { Package, ShoppingBag, TrendingUp, Clock, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useGetAdminStats } from '@workspace/api-client-react';
import AdminGuard from '@/components/AdminGuard';
import AdminLayout from '@/components/AdminLayout';
import { formatNaira, formatDate, getOrderStatusColor } from '@/lib/utils';
import { Link } from 'wouter';

const COLORS = ['hsl(218,65%,28%)', 'hsl(354,72%,42%)', 'hsl(186,58%,38%)', 'hsl(36,85%,52%)', 'hsl(148,48%,42%)'];

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminStats();

  const statCards = [
    {
      label: 'Total Products',
      value: stats?.totalProducts ?? 0,
      icon: Package,
      color: 'bg-blue-50 text-blue-700',
      iconBg: 'bg-blue-100',
    },
    {
      label: 'Total Orders',
      value: stats?.totalOrders ?? 0,
      icon: ShoppingBag,
      color: 'bg-purple-50 text-purple-700',
      iconBg: 'bg-purple-100',
    },
    {
      label: 'Total Revenue',
      value: formatNaira(stats?.totalRevenue ?? 0),
      icon: TrendingUp,
      color: 'bg-green-50 text-green-700',
      iconBg: 'bg-green-100',
    },
    {
      label: 'Pending Orders',
      value: stats?.pendingOrders ?? 0,
      icon: Clock,
      color: 'bg-amber-50 text-amber-700',
      iconBg: 'bg-amber-100',
    },
  ];

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Overview of Elite Care Medical operations</p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {statCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-card border border-card-border rounded-xl p-5"
                data-testid={`card-stat-${card.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                    <card.icon size={18} className={card.color.split(' ')[1]} />
                  </div>
                  <ArrowUpRight size={14} className="text-muted-foreground" />
                </div>
                {isLoading ? (
                  <div className="h-7 w-24 skeleton-shimmer rounded mb-1" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">{card.value}</div>
                )}
                <div className="text-sm text-muted-foreground">{card.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Charts row */}
          {stats?.categoryBreakdown && stats.categoryBreakdown.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar chart */}
              <div className="bg-card border border-card-border rounded-xl p-5">
                <h2 className="font-semibold text-sm mb-5">Products by Category</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.categoryBreakdown} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="categoryName" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="productCount" fill="hsl(218,65%,28%)" radius={[4, 4, 0, 0]} name="Products" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie chart */}
              <div className="bg-card border border-card-border rounded-xl p-5">
                <h2 className="font-semibold text-sm mb-5">Orders by Category</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={stats.categoryBreakdown}
                      dataKey="orderCount"
                      nameKey="categoryName"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      strokeWidth={0}
                    >
                      {stats.categoryBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent Orders */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-sm">Recent Orders</h2>
              <Link href="/admin/orders" className="text-xs text-primary font-medium hover:underline" data-testid="link-view-all-orders">
                View All
              </Link>
            </div>
            {isLoading ? (
              <div className="p-5 space-y-3">
                {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded skeleton-shimmer" />)}
              </div>
            ) : stats?.recentOrders && stats.recentOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Order ID</th>
                      <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Customer</th>
                      <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Amount</th>
                      <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Status</th>
                      <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.recentOrders.map(order => (
                      <tr key={order.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-order-${order.id}`}>
                        <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">#{order.id}</td>
                        <td className="px-5 py-3.5 font-medium">{order.customerName}</td>
                        <td className="px-5 py-3.5 font-semibold">{formatNaira(order.total)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground text-xs">{formatDate(order.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-10 text-center text-muted-foreground">
                <ShoppingBag size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No orders yet</p>
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
