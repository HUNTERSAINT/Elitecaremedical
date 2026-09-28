import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, adminsTable, productsTable, ordersTable, categoriesTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { AdminLoginBody } from "@workspace/api-zod";
import { signAdminToken, verifyAdminToken } from "../lib/auth";

const router: IRouter = Router();

router.post("/admin/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;

  const [admin] = await db.select().from(adminsTable).where(eq(adminsTable.username, username));

  if (!admin) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signAdminToken(username);
  res.json({ success: true, token });
});

router.post("/admin/logout", (_req, res): void => {
  res.json({ message: "Logged out" });
});

router.get("/admin/stats", verifyAdminToken, async (_req, res): Promise<void> => {
  const [
    productCount,
    orderStats,
    pendingCount,
    categoryStats,
    recentOrders,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(productsTable),
    db.select({
      count: sql<number>`count(*)`,
      revenue: sql<number>`sum(total)`,
    }).from(ordersTable),
    db
      .select({ count: sql<number>`count(*)` })
      .from(ordersTable)
      .where(eq(ordersTable.status, "pending")),
    db
      .select({
        categoryName: categoriesTable.name,
        productCount: sql<number>`count(distinct ${productsTable.id})`,
        orderCount: sql<number>`0`,
      })
      .from(categoriesTable)
      .leftJoin(productsTable, eq(productsTable.categoryId, categoriesTable.id))
      .groupBy(categoriesTable.id, categoriesTable.name)
      .orderBy(categoriesTable.name),
    db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(5),
  ]);

  res.json({
    totalProducts: Number(productCount[0]?.count ?? 0),
    totalOrders: Number(orderStats[0]?.count ?? 0),
    totalRevenue: parseFloat(String(orderStats[0]?.revenue ?? 0)),
    pendingOrders: Number(pendingCount[0]?.count ?? 0),
    categoryBreakdown: categoryStats.map((c) => ({
      categoryName: c.categoryName,
      productCount: Number(c.productCount),
      orderCount: Number(c.orderCount),
    })),
    recentOrders: recentOrders.map((o) => ({
      ...o,
      subtotal: parseFloat(o.subtotal),
      deliveryFee: parseFloat(o.deliveryFee),
      total: parseFloat(o.total),
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    })),
  });
});

export default router;
