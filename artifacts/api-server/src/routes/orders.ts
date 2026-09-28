import { Router, type IRouter } from "express";
import { db, ordersTable, productsTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  CreateOrderBody,
  GetOrderParams,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody,
  ListOrdersQueryParams,
} from "@workspace/api-zod";
import { verifyAdminToken } from "../lib/auth";

const router: IRouter = Router();

function serializeOrder(order: typeof ordersTable.$inferSelect) {
  return {
    ...order,
    subtotal: parseFloat(order.subtotal),
    deliveryFee: parseFloat(order.deliveryFee),
    total: parseFloat(order.total),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

router.get("/orders", verifyAdminToken, async (req, res): Promise<void> => {
  const query = ListOrdersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { status, page = 1 } = query.data;
  const limit = 20;
  const offset = ((page ?? 1) - 1) * limit;

  const conditions = [];
  if (status) conditions.push(eq(ordersTable.status, status));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [orders, countResult] = await Promise.all([
    db.select().from(ordersTable).where(whereClause).orderBy(desc(ordersTable.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(whereClause),
  ]);

  res.json({
    orders: orders.map(serializeOrder),
    total: Number(countResult[0]?.count ?? 0),
    page: page ?? 1,
  });
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { items, paymentMethod, ...customerInfo } = parsed.data;

  // Fetch product prices to compute totals
  const productIds = items.map((i: { productId: number }) => i.productId);
  const products = await db.select({ id: productsTable.id, name: productsTable.name, price: productsTable.price, imageUrl: productsTable.imageUrl })
    .from(productsTable)
    .where(sql`${productsTable.id} = ANY(ARRAY[${sql.raw(productIds.join(","))}]::integer[])`);

  const productMap = new Map(products.map((p) => [p.id, p]));

  const orderItems = items.map((item: { productId: number; quantity: number }) => {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found`);
    const unitPrice = parseFloat(product.price);
    return {
      productId: item.productId,
      productName: product.name,
      productImage: product.imageUrl,
      quantity: item.quantity,
      unitPrice,
      totalPrice: unitPrice * item.quantity,
    };
  });

  const subtotal = orderItems.reduce((sum: number, i: { totalPrice: number }) => sum + i.totalPrice, 0);
  const deliveryFee = 2000;
  const total = subtotal + deliveryFee;

  const [order] = await db
    .insert(ordersTable)
    .values({
      ...customerInfo,
      items: orderItems,
      subtotal: String(subtotal),
      deliveryFee: String(deliveryFee),
      total: String(total),
      paymentMethod,
      status: "pending",
      paymentStatus: "pending",
    })
    .returning();

  res.status(201).json(serializeOrder(order));
});

router.get("/orders/:id", verifyAdminToken, async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(serializeOrder(order));
});

router.patch("/orders/:id", verifyAdminToken, async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [order] = await db
    .update(ordersTable)
    .set(parsed.data)
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(serializeOrder(order));
});

export default router;
