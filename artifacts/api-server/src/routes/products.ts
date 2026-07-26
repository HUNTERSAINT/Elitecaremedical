import { Router, type IRouter } from "express";
import { db, productsTable, categoriesTable } from "@workspace/db";
import { eq, like, and, sql, desc } from "drizzle-orm";
import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
} from "@workspace/api-zod";
import { verifyAdminToken } from "../lib/auth";

const router: IRouter = Router();

router.get("/products", async (req, res): Promise<void> => {
  const query = ListProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { categoryId, search, page = 1, limit = 24, featured } = query.data;
  const offset = ((page ?? 1) - 1) * (limit ?? 24);

  const conditions = [];
  if (categoryId != null) conditions.push(eq(productsTable.categoryId, categoryId));
  if (featured != null) conditions.push(eq(productsTable.isFeatured, featured));
  if (search) conditions.push(like(productsTable.name, `%${search}%`));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [products, countResult] = await Promise.all([
    db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        slug: productsTable.slug,
        description: productsTable.description,
        price: productsTable.price,
        originalPrice: productsTable.originalPrice,
        categoryId: productsTable.categoryId,
        categoryName: categoriesTable.name,
        imageUrl: productsTable.imageUrl,
        images: productsTable.images,
        inStock: productsTable.inStock,
        isFeatured: productsTable.isFeatured,
        brand: productsTable.brand,
        model: productsTable.model,
        specifications: productsTable.specifications,
        createdAt: productsTable.createdAt,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(whereClause)
      .orderBy(desc(productsTable.isFeatured), desc(productsTable.createdAt))
      .limit(limit ?? 24)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(productsTable)
      .where(whereClause),
  ]);

  const mapped = products.map((p) => ({
    ...p,
    price: parseFloat(p.price),
    originalPrice: p.originalPrice ? parseFloat(p.originalPrice) : null,
    categoryName: p.categoryName ?? "",
    images: p.images ?? [],
    createdAt: p.createdAt.toISOString(),
  }));

  res.json({
    products: mapped,
    total: Number(countResult[0]?.count ?? 0),
    page: page ?? 1,
    limit: limit ?? 24,
  });
});

router.post("/products", verifyAdminToken, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { price, originalPrice, images, ...rest } = parsed.data;
  const [product] = await db
    .insert(productsTable)
    .values({
      ...rest,
      price: String(price),
      originalPrice: originalPrice != null ? String(originalPrice) : null,
      images: images ?? [],
    })
    .returning();

  const [cat] = await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, product.categoryId));

  res.status(201).json({
    ...product,
    price: parseFloat(product.price),
    originalPrice: product.originalPrice ? parseFloat(product.originalPrice) : null,
    categoryName: cat?.name ?? "",
    images: product.images ?? [],
    createdAt: product.createdAt.toISOString(),
  });
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      slug: productsTable.slug,
      description: productsTable.description,
      price: productsTable.price,
      originalPrice: productsTable.originalPrice,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      imageUrl: productsTable.imageUrl,
      images: productsTable.images,
      inStock: productsTable.inStock,
      isFeatured: productsTable.isFeatured,
      brand: productsTable.brand,
      model: productsTable.model,
      specifications: productsTable.specifications,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, params.data.id));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json({
    ...product,
    price: parseFloat(product.price),
    originalPrice: product.originalPrice ? parseFloat(product.originalPrice) : null,
    categoryName: product.categoryName ?? "",
    images: product.images ?? [],
    createdAt: product.createdAt.toISOString(),
  });
});

router.patch("/products/:id", verifyAdminToken, async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { price, originalPrice, images, ...rest } = parsed.data;
  const updateValues: Record<string, unknown> = { ...rest };
  if (price !== undefined) updateValues.price = String(price);
  if (originalPrice !== undefined) updateValues.originalPrice = originalPrice != null ? String(originalPrice) : null;
  if (images !== undefined) updateValues.images = images;

  const [product] = await db
    .update(productsTable)
    .set(updateValues)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const [cat] = await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, product.categoryId));

  res.json({
    ...product,
    price: parseFloat(product.price),
    originalPrice: product.originalPrice ? parseFloat(product.originalPrice) : null,
    categoryName: cat?.name ?? "",
    images: product.images ?? [],
    createdAt: product.createdAt.toISOString(),
  });
});

router.delete("/products/:id", verifyAdminToken, async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
