import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import {
  adminsTable,
  categoriesTable,
  db,
  ordersTable,
  productsTable,
  telegramSessionsTable,
  type TelegramSessionContext,
} from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const TELEGRAM_API = "https://api.telegram.org";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const USE_WEBHOOK = process.env.TELEGRAM_USE_WEBHOOK === "true";
const DELIVERY_FEE = 2000;

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramMessage = {
  message_id: number;
  chat?: { id: number; type?: string };
  from?: TelegramUser;
  text?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramCommandField =
  | "name"
  | "slug"
  | "price"
  | "originalPrice"
  | "categoryId"
  | "description"
  | "imageUrl"
  | "inStock"
  | "isFeatured"
  | "brand"
  | "model"
  | "specifications";

function formatNaira(value: number): string {
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

function getContext(value: unknown): TelegramSessionContext {
  const parsed = (() => {
    try {
      return typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      return null;
    }
  })() as Partial<TelegramSessionContext> | null;

  return {
    cart: Array.isArray(parsed?.cart)
      ? parsed.cart.filter(
          (item) =>
            Number.isInteger(item?.productId) &&
            item.productId > 0 &&
            Number.isInteger(item?.quantity) &&
            item.quantity > 0,
        )
      : [],
    lastResults: Array.isArray(parsed?.lastResults)
      ? parsed.lastResults.filter((id) => Number.isInteger(id) && id > 0)
      : [],
    ...(typeof parsed?.customerName === "string"
      ? { customerName: parsed.customerName }
      : {}),
    ...(typeof parsed?.customerPhone === "string"
      ? { customerPhone: parsed.customerPhone }
      : {}),
    ...(typeof parsed?.customerEmail === "string"
      ? { customerEmail: parsed.customerEmail }
      : {}),
    ...(typeof parsed?.deliveryAddress === "string"
      ? { deliveryAddress: parsed.deliveryAddress }
      : {}),
    ...(typeof parsed?.city === "string" ? { city: parsed.city } : {}),
    ...(typeof parsed?.state === "string" ? { state: parsed.state } : {}),
    ...(typeof parsed?.adminUsername === "string"
      ? { adminUsername: parsed.adminUsername }
      : {}),
  };
}

async function getSession(chatId: string, username?: string) {
  const [existing] = await db
    .select()
    .from(telegramSessionsTable)
    .where(eq(telegramSessionsTable.chatId, chatId));

  if (existing) {
    if (username && existing.username !== username) {
      await db
        .update(telegramSessionsTable)
        .set({ username, updatedAt: new Date() })
        .where(eq(telegramSessionsTable.chatId, chatId));
    }
    return {
      ...existing,
      username: username ?? existing.username,
      context: getContext(existing.context),
    };
  }

  const [created] = await db
    .insert(telegramSessionsTable)
    .values({
      chatId,
      username: username ?? null,
      state: "idle",
      context: { cart: [], lastResults: [] },
    })
    .returning();

  return {
    ...created,
    context: getContext(created.context),
  };
}

async function saveSession(
  chatId: string,
  state: string,
  context: TelegramSessionContext,
  username?: string | null,
) {
  await db
    .insert(telegramSessionsTable)
    .values({
      chatId,
      username: username ?? null,
      state,
      context,
    })
    .onConflictDoUpdate({
      target: telegramSessionsTable.chatId,
      set: {
        ...(username === undefined ? {} : { username }),
        state,
        context,
        updatedAt: new Date(),
      },
    });
}

async function telegramRequest<T>(
  method: string,
  payload: Record<string, unknown>,
): Promise<T | null> {
  if (!BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN is not configured");
    return null;
  }

  const response = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as TelegramApiResponse<T>;

  if (!response.ok || !body.ok) {
    logger.error(
      { method, status: response.status, description: body.description },
      "Telegram API request failed",
    );
    return null;
  }

  return body.result ?? null;
}

async function sendMessage(chatId: string, text: string): Promise<void> {
  await telegramRequest("sendMessage", { chat_id: chatId, text });
}

function getPhoneForOrder(chatId: string, context: TelegramSessionContext): string {
  return context.customerPhone ?? `telegram:${chatId}`;
}

async function sendWelcome(chatId: string): Promise<void> {
  await sendMessage(
    chatId,
    [
      "Welcome to Elite Care Medical.",
      "",
      "Shop medical equipment directly here:",
      "/shop gloves",
      "/cart",
      "/checkout",
      "/clear",
      "",
      "You can also type a product name to search.",
      "Use /myid if you need to share your Telegram ID with the store admin.",
    ].join("\n"),
  );
}

async function sendCart(
  chatId: string,
  context: TelegramSessionContext,
): Promise<void> {
  if (!context.cart.length) {
    await sendMessage(
      chatId,
      "Your cart is empty. Try /shop gloves or search for a product name.",
    );
    return;
  }

  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      price: productsTable.price,
      inStock: productsTable.inStock,
    })
    .from(productsTable)
    .where(inArray(productsTable.id, context.cart.map((item) => item.productId)));
  const productMap = new Map(products.map((product) => [product.id, product]));
  const lines = context.cart.flatMap((item) => {
    const product = productMap.get(item.productId);
    if (!product) return [];
    return [
      `${item.quantity} × ${product.name} — ${formatNaira(
        Number(product.price) * item.quantity,
      )}${product.inStock ? "" : " (out of stock)"}`,
    ];
  });
  const subtotal = context.cart.reduce((sum, item) => {
    const product = productMap.get(item.productId);
    return sum + (product ? Number(product.price) * item.quantity : 0);
  }, 0);

  await sendMessage(
    chatId,
    [
      "Your Elite Care cart:",
      ...lines,
      "",
      `Subtotal: ${formatNaira(subtotal)}`,
      `Delivery: ${formatNaira(DELIVERY_FEE)}`,
      `Total: ${formatNaira(subtotal + DELIVERY_FEE)}`,
      "",
      "Reply /checkout to place the order.",
    ].join("\n"),
  );
}

async function searchProducts(
  chatId: string,
  query: string,
  context: TelegramSessionContext,
  username?: string | null,
): Promise<void> {
  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      price: productsTable.price,
      inStock: productsTable.inStock,
    })
    .from(productsTable)
    .where(
      and(
        ilike(productsTable.name, `%${query}%`),
        eq(productsTable.inStock, true),
      ),
    )
    .orderBy(desc(productsTable.isFeatured), desc(productsTable.createdAt))
    .limit(8);

  const nextContext = { ...context, lastResults: products.map((item) => item.id) };
  await saveSession(chatId, "idle", nextContext, username);

  if (!products.length) {
    await sendMessage(
      chatId,
      `I couldn't find an in-stock product matching “${query}”. Try gloves, diagnostic, surgical, microscope, or scrubs.`,
    );
    return;
  }

  await sendMessage(
    chatId,
    [
      `I found ${products.length} product${products.length === 1 ? "" : "s"}:`,
      "",
      ...products.map(
        (product, index) =>
          `${index + 1}. ${product.name} — ${formatNaira(Number(product.price))}`,
      ),
      "",
      "Reply /add 1 (or just 1) to add an item to your cart.",
    ].join("\n"),
  );
}

async function beginCheckout(
  chatId: string,
  context: TelegramSessionContext,
  username?: string | null,
): Promise<void> {
  if (!context.cart.length) {
    await sendCart(chatId, context);
    return;
  }
  await saveSession(chatId, "name", context, username);
  await sendMessage(chatId, "Great. What is your full name?");
}

async function createTelegramOrder(
  chatId: string,
  context: TelegramSessionContext,
  username?: string | null,
): Promise<void> {
  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      price: productsTable.price,
      imageUrl: productsTable.imageUrl,
      inStock: productsTable.inStock,
    })
    .from(productsTable)
    .where(inArray(productsTable.id, context.cart.map((item) => item.productId)));
  const productMap = new Map(products.map((product) => [product.id, product]));
  const orderItems = context.cart.flatMap((item) => {
    const product = productMap.get(item.productId);
    if (!product || !product.inStock) return [];
    const unitPrice = Number(product.price);
    return [
      {
        productId: product.id,
        productName: product.name,
        productImage: product.imageUrl,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
      },
    ];
  });

  if (!orderItems.length) {
    await sendMessage(
      chatId,
      "Your cart is no longer available. Please search again.",
    );
    await saveSession(chatId, "idle", { cart: [], lastResults: [] }, username);
    return;
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const [order] = await db
    .insert(ordersTable)
    .values({
      customerName: context.customerName ?? "",
      customerEmail: context.customerEmail ?? "",
      customerPhone: getPhoneForOrder(chatId, context),
      deliveryAddress: context.deliveryAddress ?? "",
      city: context.city,
      state: context.state,
      items: orderItems,
      subtotal: String(subtotal),
      deliveryFee: String(DELIVERY_FEE),
      total: String(subtotal + DELIVERY_FEE),
      paymentMethod: "bank_transfer",
      status: "pending",
      paymentStatus: "pending",
      notes: "Order placed via Telegram bot",
    })
    .returning({ id: ordersTable.id, total: ordersTable.total });

  await saveSession(chatId, "idle", { cart: [], lastResults: [] }, username);
  await sendMessage(
    chatId,
    [
      `Order #${order.id} received.`,
      `Total: ${formatNaira(Number(order.total))}`,
      "",
      "Our team will contact you with verified payment details and delivery confirmation.",
    ].join("\n"),
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseValue(value: string): string {
  return value.replace(/^["']|["']$/g, "").trim();
}

function parseAdminFields(input: string): Map<string, string> {
  const fields = new Map<string, string>();
  const matcher = /([a-zA-Z][a-zA-Z0-9]*)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  for (const match of input.matchAll(matcher)) {
    fields.set(match[1], parseValue(match[2] ?? match[3] ?? match[4] ?? ""));
  }
  return fields;
}

function toBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true" || value === "yes" || value === "1") return true;
  if (value === "false" || value === "no" || value === "0") return false;
  return undefined;
}

async function sendAdminHelp(chatId: string): Promise<void> {
  await sendMessage(
    chatId,
    [
      "Admin commands:",
      "/admin login <username> <password>",
      "/admin logout",
      "/admin products [search]",
      "/admin add Name | price | categoryId | description | imageUrl",
      "/admin update <id> name=\"New name\" price=12000 inStock=true",
      "",
      "The add command requires a category ID from the website admin panel.",
    ].join("\n"),
  );
}

async function sendAdminProducts(chatId: string, search?: string): Promise<void> {
  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      price: productsTable.price,
      inStock: productsTable.inStock,
      categoryName: categoriesTable.name,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(search ? ilike(productsTable.name, `%${search}%`) : undefined)
    .orderBy(desc(productsTable.createdAt))
    .limit(20);

  await sendMessage(
    chatId,
    products.length
      ? [
          "Catalog:",
          ...products.map(
            (product) =>
              `#${product.id} ${product.name} — ${formatNaira(
                Number(product.price),
              )} — ${product.categoryName ?? "Uncategorized"} — ${
                product.inStock ? "in stock" : "out of stock"
              }`,
          ),
        ].join("\n")
      : "No products matched that search.",
  );
}

async function handleAdminCommand(
  chatId: string,
  text: string,
  context: TelegramSessionContext,
  username?: string | null,
): Promise<boolean> {
  const body = text.replace(/^\/?admin\b/i, "").trim();
  const [subcommand, ...rest] = body.split(/\s+/);
  const action = (subcommand ?? "help").toLowerCase();

  if (action === "login") {
    const loginText = rest.join(" ");
    const firstSpace = loginText.indexOf(" ");
    if (firstSpace < 1) {
      await sendMessage(chatId, "Usage: /admin login <username> <password>");
      return true;
    }
    const login = loginText.slice(0, firstSpace);
    const password = loginText.slice(firstSpace + 1).trim();
    const [admin] = await db
      .select()
      .from(adminsTable)
      .where(eq(adminsTable.username, login));
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      await sendMessage(chatId, "Admin login failed.");
      return true;
    }
    await saveSession(chatId, "idle", { ...context, adminUsername: login }, username);
    await sendMessage(
      chatId,
      "Admin mode enabled for this Telegram chat. Use /admin help for commands.",
    );
    return true;
  }

  if (action === "logout") {
    await saveSession(
      chatId,
      "idle",
      { ...context, adminUsername: undefined },
      username,
    );
    await sendMessage(chatId, "Admin mode disabled.");
    return true;
  }

  if (!context.adminUsername) {
    await sendMessage(
      chatId,
      "Admin commands are protected. Use /admin login <username> <password> to continue.",
    );
    return true;
  }

  if (action === "help") {
    await sendAdminHelp(chatId);
    return true;
  }

  if (action === "products" || action === "list") {
    await sendAdminProducts(chatId, rest.join(" ").trim() || undefined);
    return true;
  }

  if (action === "add") {
    const values = rest.join(" ").split("|").map((value) => value.trim());
    const [name, rawPrice, rawCategoryId, description, imageUrl] = values;
    const price = Number(rawPrice);
    const categoryId = Number(rawCategoryId);
    if (!name || !Number.isFinite(price) || !Number.isInteger(categoryId)) {
      await sendMessage(
        chatId,
        "Usage: /admin add Name | price | categoryId | description | imageUrl",
      );
      return true;
    }
    const [category] = await db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, categoryId));
    if (!category) {
      await sendMessage(chatId, `Category ${categoryId} does not exist.`);
      return true;
    }
    const baseSlug = slugify(name) || `product-${Date.now()}`;
    const [existingSlug] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.slug, baseSlug));
    const slug = existingSlug ? `${baseSlug}-${Date.now()}` : baseSlug;
    const [product] = await db
      .insert(productsTable)
      .values({
        name,
        slug,
        price: String(price),
        categoryId,
        description: description || null,
        imageUrl: imageUrl || null,
        images: imageUrl ? [imageUrl] : [],
      })
      .returning({ id: productsTable.id, name: productsTable.name });
    await sendMessage(chatId, `Product #${product.id} created: ${product.name}`);
    return true;
  }

  if (action === "update") {
    const productId = Number(rest.shift());
    const fields = parseAdminFields(rest.join(" "));
    if (!Number.isInteger(productId) || fields.size === 0) {
      await sendMessage(
        chatId,
        "Usage: /admin update <id> name=\"New name\" price=12000 inStock=true",
      );
      return true;
    }

    const allowed = new Set<TelegramCommandField>([
      "name",
      "slug",
      "price",
      "originalPrice",
      "categoryId",
      "description",
      "imageUrl",
      "inStock",
      "isFeatured",
      "brand",
      "model",
      "specifications",
    ]);
    const values: Record<string, unknown> = {};
    for (const [key, value] of fields) {
      if (!allowed.has(key as TelegramCommandField)) continue;
      if (key === "price" || key === "originalPrice") {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
          await sendMessage(chatId, `${key} must be a number.`);
          return true;
        }
        values[key] = String(parsed);
      } else if (key === "categoryId") {
        const parsed = Number(value);
        if (!Number.isInteger(parsed)) {
          await sendMessage(chatId, "categoryId must be an integer.");
          return true;
        }
        values[key] = parsed;
      } else if (key === "inStock" || key === "isFeatured") {
        const parsed = toBoolean(value);
        if (parsed === undefined) {
          await sendMessage(chatId, `${key} must be true or false.`);
          return true;
        }
        values[key] = parsed;
      } else {
        values[key] = value;
      }
    }

    if (Object.keys(values).length === 0) {
      await sendMessage(chatId, "No supported fields were provided.");
      return true;
    }

    const [product] = await db
      .update(productsTable)
      .set(values)
      .where(eq(productsTable.id, productId))
      .returning({ id: productsTable.id, name: productsTable.name });
    await sendMessage(
      chatId,
      product
        ? `Product #${product.id} updated: ${product.name}`
        : `Product #${productId} was not found.`,
    );
    return true;
  }

  await sendAdminHelp(chatId);
  return true;
}

async function handleMessage(
  chatId: string,
  rawText: string,
  username?: string | null,
): Promise<void> {
  const text = rawText.trim();
  const normalized = text.toLowerCase();
  const session = await getSession(chatId, username ?? undefined);
  const context = session.context;

  if (normalized === "/myid" || normalized === "myid") {
    await sendMessage(chatId, `Your Telegram chat ID is ${chatId}.`);
    return;
  }

  if (/^\/?admin(?:\s|$)/i.test(text)) {
    await handleAdminCommand(chatId, text, context, username);
    return;
  }

  if (normalized === "/cancel" || normalized === "cancel") {
    await saveSession(chatId, "idle", { ...context, lastResults: [] }, username);
    await sendMessage(chatId, "Cancelled. Use /menu to start again.");
    return;
  }

  if (/^(\/start|\/help|\/menu|hi|hello|hey)$/i.test(normalized)) {
    await saveSession(chatId, "idle", { ...context, lastResults: [] }, username);
    await sendWelcome(chatId);
    return;
  }

  if (normalized === "/cart" || normalized === "cart") {
    await sendCart(chatId, context);
    return;
  }

  if (normalized === "/clear" || normalized === "clear") {
    await saveSession(chatId, "idle", { ...context, cart: [] }, username);
    await sendMessage(chatId, "Your cart is empty now.");
    return;
  }

  if (normalized === "/checkout" || normalized === "checkout" || normalized === "buy") {
    await beginCheckout(chatId, context, username);
    return;
  }

  if (session.state === "name") {
    if (text.length < 2) {
      await sendMessage(chatId, "Please send your full name.");
      return;
    }
    await saveSession(
      chatId,
      "phone",
      { ...context, customerName: text },
      username,
    );
    await sendMessage(chatId, "What phone number should we use for delivery updates?");
    return;
  }

  if (session.state === "phone") {
    if (text.length < 7) {
      await sendMessage(chatId, "Please send a valid phone number.");
      return;
    }
    await saveSession(
      chatId,
      "email",
      { ...context, customerPhone: text },
      username,
    );
    await sendMessage(chatId, "What email address should we attach to the order?");
    return;
  }

  if (session.state === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      await sendMessage(chatId, "Please send a valid email address.");
      return;
    }
    await saveSession(
      chatId,
      "address",
      { ...context, customerEmail: text },
      username,
    );
    await sendMessage(chatId, "What is the full delivery address?");
    return;
  }

  if (session.state === "address") {
    await saveSession(
      chatId,
      "city",
      { ...context, deliveryAddress: text },
      username,
    );
    await sendMessage(chatId, "Which city should we deliver to?");
    return;
  }

  if (session.state === "city") {
    await saveSession(chatId, "state", { ...context, city: text }, username);
    await sendMessage(chatId, "Which state is the delivery in?");
    return;
  }

  if (session.state === "state") {
    const nextContext = { ...context, state: text };
    await saveSession(chatId, "confirm", nextContext, username);
    await sendMessage(
      chatId,
      [
        "Please confirm your order:",
        `Name: ${nextContext.customerName}`,
        `Phone: ${nextContext.customerPhone}`,
        `Email: ${nextContext.customerEmail}`,
        `Delivery: ${nextContext.deliveryAddress}, ${nextContext.city}, ${nextContext.state}`,
        "",
        "Reply confirm to place it, or /cancel to start over.",
      ].join("\n"),
    );
    return;
  }

  if (session.state === "confirm") {
    if (normalized === "confirm" || normalized === "yes") {
      await createTelegramOrder(chatId, context, username);
    } else {
      await sendMessage(chatId, "Reply confirm to place the order, or /cancel.");
    }
    return;
  }

  const addMatch = normalized.match(/^(?:\/add\s+|add\s+)?(\d+)$/);
  if (addMatch) {
    const resultIndex = Number(addMatch[1]) - 1;
    const productId = context.lastResults[resultIndex];
    if (productId) {
      const existing = context.cart.find((item) => item.productId === productId);
      const nextCart = existing
        ? context.cart.map((item) =>
            item.productId === productId
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          )
        : [...context.cart, { productId, quantity: 1 }];
      await saveSession(chatId, "idle", { ...context, cart: nextCart }, username);
      await sendMessage(chatId, "Added to your cart. Use /cart or /checkout.");
      return;
    }
  }

  if (normalized.startsWith("/shop")) {
    await searchProducts(
      chatId,
      text.replace(/^\/shop/i, "").trim(),
      context,
      username,
    );
    return;
  }

  await searchProducts(chatId, text, context, username);
}

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  const chatId = message?.chat?.id;
  const text = message?.text;
  if (!chatId || !text) return;
  await handleMessage(String(chatId), text, message.from?.username ?? null);
}

function hasValidWebhookSecret(req: { header(name: string): string | undefined }): boolean {
  if (!WEBHOOK_SECRET) return true;
  return req.header("x-telegram-bot-api-secret-token") === WEBHOOK_SECRET;
}

let polling = false;

async function pollTelegram(): Promise<void> {
  let offset = 0;
  while (polling) {
    try {
      const updates =
        (await telegramRequest<TelegramUpdate[]>("getUpdates", {
          offset,
          timeout: 25,
          allowed_updates: ["message"],
        })) ?? [];
      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);
        try {
          await handleUpdate(update);
        } catch (error) {
          logger.error({ error, updateId: update.update_id }, "Telegram update failed");
        }
      }
    } catch (error) {
      logger.error({ error }, "Telegram polling failed");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

export function startTelegramBot(): void {
  if (!BOT_TOKEN || USE_WEBHOOK || polling) return;
  polling = true;
  void telegramRequest("setMyCommands", {
    commands: [
      { command: "start", description: "Open the shopping menu" },
      { command: "shop", description: "Search the product catalog" },
      { command: "cart", description: "View your cart" },
      { command: "checkout", description: "Place your order" },
      { command: "myid", description: "Show your Telegram chat ID" },
    ],
  });
  void pollTelegram();
  logger.info("Telegram bot polling started");
}

export function stopTelegramBot(): void {
  polling = false;
}

router.get("/telegram/status", (_req, res): void => {
  res.json({
    configured: Boolean(BOT_TOKEN),
    pollingEnabled: Boolean(BOT_TOKEN && !USE_WEBHOOK),
    webhookSecretConfigured: Boolean(WEBHOOK_SECRET),
  });
});

router.post("/telegram/webhook", (req, res): void => {
  if (!hasValidWebhookSecret(req)) {
    res.sendStatus(401);
    return;
  }
  res.sendStatus(200);
  void handleUpdate(req.body as TelegramUpdate).catch((error) => {
    logger.error({ error }, "Telegram webhook update failed");
  });
});

export default router;