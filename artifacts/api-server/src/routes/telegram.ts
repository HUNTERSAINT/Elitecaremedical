import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import axios from "axios";
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
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY ?? "";
const PAYSTACK_CALLBACK_URL =
  process.env.PAYSTACK_CALLBACK_URL ??
  (process.env.PUBLIC_APP_URL
    ? `${process.env.PUBLIC_APP_URL.replace(/\/$/, "")}/payment-callback`
    : undefined);
const TELEGRAM_ADMIN_CHAT_IDS = new Set(
  (process.env.TELEGRAM_ADMIN_CHAT_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);
const DELIVERY_FEE = 2000;
let telegramApiUnauthorized = false;
let telegramPollingConflict = false;

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
  caption?: string;
  photo?: Array<{ file_id: string; width: number; height: number }>;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from?: TelegramUser;
    data?: string;
    message?: TelegramMessage;
  };
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
};

type TelegramButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

type TelegramReplyMarkup = {
  inline_keyboard: TelegramButton[][];
};

type OrderNotification = {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  city: string | null;
  state: string | null;
  items: Array<{
    productName: string;
    quantity: number;
    totalPrice: number;
  }>;
  total: string;
  paymentMethod: string;
  paymentStatus: string;
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
    if (response.status === 401 || body.error_code === 401) {
      telegramApiUnauthorized = true;
    }
    if (method === "getUpdates" && (response.status === 409 || body.error_code === 409)) {
      telegramPollingConflict = true;
    }
    logger.error(
      { method, status: response.status, description: body.description },
      "Telegram API request failed",
    );
    return null;
  }

  return body.result ?? null;
}

async function sendMessage(
  chatId: string,
  text: string,
  replyMarkup?: TelegramReplyMarkup,
): Promise<void> {
  await telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  await telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

function buttons(...rows: TelegramButton[][]): TelegramReplyMarkup {
  return { inline_keyboard: rows };
}

function menuButton(text: string, callbackData: string): TelegramButton {
  return { text, callback_data: callbackData };
}

function telegramImageUrl(fileId: string): string {
  const path = `/api/telegram/image/${encodeURIComponent(fileId)}`;
  return process.env.PUBLIC_APP_URL
    ? `${process.env.PUBLIC_APP_URL.replace(/\/$/, "")}${path}`
    : path;
}

function hasConfiguredAdminAccess(chatId: string): boolean {
  return TELEGRAM_ADMIN_CHAT_IDS.has(chatId);
}

export async function notifyTelegramAdmins(message: string): Promise<void> {
  if (!BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_IDS.size) return;

  await Promise.all(
    [...TELEGRAM_ADMIN_CHAT_IDS].map((chatId) => sendMessage(chatId, message)),
  );
}

export async function notifyAdminsAboutOrder(
  order: OrderNotification,
  source: "Website" | "Telegram",
  paystackReference?: string,
): Promise<void> {
  const itemLines = order.items.map(
    (item) =>
      `• ${item.quantity} × ${item.productName} — ${formatNaira(item.totalPrice)}`,
  );

  await notifyTelegramAdmins(
    [
      `New ${source} order #${order.id}`,
      `Customer: ${order.customerName}`,
      `Phone: ${order.customerPhone}`,
      `Email: ${order.customerEmail}`,
      `Delivery: ${order.deliveryAddress}, ${order.city ?? ""}, ${order.state ?? ""}`,
      "",
      ...itemLines,
      "",
      `Total: ${formatNaira(Number(order.total))}`,
      `Payment: ${order.paymentMethod} (${order.paymentStatus})`,
      ...(paystackReference ? [`Paystack ref: ${paystackReference}`] : []),
    ].join("\n"),
  );
}

export async function notifyAdminsAboutPayment(
  orderId: number,
  reference: string,
  amount: number,
): Promise<void> {
  await notifyTelegramAdmins(
    [
      `Paystack payment confirmed for order #${orderId}`,
      `Amount: ${formatNaira(amount)}`,
      `Reference: ${reference}`,
    ].join("\n"),
  );
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
      "Shop medical equipment directly here. Use the buttons below to continue.",
    ].join("\n"),
    buttons(
      [menuButton("Browse products", "shop:featured")],
      [menuButton("View cart", "cart:view"), menuButton("Checkout", "checkout:start")],
      [menuButton("Clear cart", "cart:clear")],
    ),
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
      "Choose an action:",
    ].join("\n"),
    buttons(
      [menuButton("Checkout", "checkout:start")],
      [menuButton("Clear cart", "cart:clear"), menuButton("Browse more", "shop:featured")],
    ),
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
        (product) =>
          `• ${product.name} — ${formatNaira(Number(product.price))}`,
      ),
      "",
      "Choose a product to add it to your cart.",
    ].join("\n"),
    buttons(
      ...products.map((product) => [
        menuButton(
          `Add ${product.name.slice(0, 28)}`,
          `cart:add:${product.id}`,
        ),
      ]),
      [menuButton("View cart", "cart:view"), menuButton("Main menu", "menu:main")],
    ),
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
  await sendMessage(
    chatId,
    "Great. What is your full name?",
    buttons([menuButton("Cancel checkout", "checkout:cancel")]),
  );
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
  const paymentMethod = PAYSTACK_SECRET ? "card" : "bank_transfer";
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
      paymentMethod,
      status: "pending",
      paymentStatus: "pending",
      notes: "Order placed via Telegram bot",
    })
    .returning({ id: ordersTable.id, total: ordersTable.total });

  let payment:
    | { authorizationUrl: string; reference: string }
    | undefined;
  if (PAYSTACK_SECRET) {
    try {
      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: context.customerEmail,
          amount: Math.round(Number(order.total) * 100),
          reference: `ECM-TG-${order.id}-${Date.now()}`,
          ...(PAYSTACK_CALLBACK_URL
            ? { callback_url: PAYSTACK_CALLBACK_URL }
            : {}),
          metadata: { orderId: order.id, source: "telegram" },
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
            "Content-Type": "application/json",
          },
        },
      );
      const paymentData = response.data?.data;
      if (paymentData?.authorization_url && paymentData?.reference) {
        payment = {
          authorizationUrl: paymentData.authorization_url,
          reference: paymentData.reference,
        };
        await db
          .update(ordersTable)
          .set({ paystackReference: payment.reference })
          .where(eq(ordersTable.id, order.id));
      }
    } catch (error) {
      logger.error(
        { error, orderId: order.id },
        "Telegram Paystack initialization failed",
      );
    }
  }

  await notifyAdminsAboutOrder(
    {
      id: order.id,
      customerName: context.customerName ?? "",
      customerEmail: context.customerEmail ?? "",
      customerPhone: getPhoneForOrder(chatId, context),
      deliveryAddress: context.deliveryAddress ?? "",
      city: context.city ?? null,
      state: context.state ?? null,
      items: orderItems,
      total: order.total,
      paymentMethod,
      paymentStatus: "pending",
    },
    "Telegram",
    payment?.reference,
  );

  await saveSession(chatId, "idle", { cart: [], lastResults: [] }, username);
  if (payment) {
    await sendMessage(
      chatId,
      [
        `Order #${order.id} received.`,
        `Total: ${formatNaira(Number(order.total))}`,
        "",
        "Tap Pay now to complete your payment securely with Paystack.",
        "",
        "After paying, tap Check payment. You do not need to contact an admin.",
      ].join("\n"),
      buttons(
        [{ text: "Pay now", url: payment.authorizationUrl }],
        [menuButton("Check payment", `payment:check:${payment.reference}`)],
      ),
    );
    return;
  }

  await sendMessage(
    chatId,
    [
      `Order #${order.id} received.`,
      `Total: ${formatNaira(Number(order.total))}`,
      "",
      "Online payment is temporarily unavailable. Please try checkout again later.",
      "No payment has been taken and no admin contact is required.",
    ].join("\n"),
    buttons([menuButton("Back to menu", "menu:main")]),
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
      "Store admin panel",
      "",
      "Use the buttons to manage products. To add a product, send the name, price, description, then send the product image when requested.",
      "",
      "Product changes made here are reflected on the website immediately.",
    ].join("\n"),
    buttons(
      [menuButton("Add product", "admin:add")],
      [menuButton("Manage products", "admin:products")],
      [menuButton("Main menu", "menu:main")],
    ),
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

  if (!products.length) {
    await sendMessage(
      chatId,
      "No products matched that search.",
      buttons([menuButton("Back to admin", "admin:menu")]),
    );
    return;
  }

  await sendMessage(
    chatId,
    "Catalog products:",
    buttons(
      ...products.map((product) => [
        menuButton(
          `#${product.id} ${product.name.slice(0, 24)} — ${formatNaira(Number(product.price))}`,
          `admin:product:${product.id}`,
        ),
      ]),
      [menuButton("Add product", "admin:add"), menuButton("Admin menu", "admin:menu")],
    ),
  );
}

async function sendAdminProductActions(
  chatId: string,
  productId: number,
): Promise<void> {
  const [product] = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      price: productsTable.price,
      imageUrl: productsTable.imageUrl,
      inStock: productsTable.inStock,
    })
    .from(productsTable)
    .where(eq(productsTable.id, productId));

  if (!product) {
    await sendMessage(
      chatId,
      "That product was not found.",
      buttons([menuButton("Manage products", "admin:products")]),
    );
    return;
  }

  await sendMessage(
    chatId,
    [
      `#${product.id} ${product.name}`,
      `Price: ${formatNaira(Number(product.price))}`,
      `Status: ${product.inStock ? "In stock" : "Out of stock"}`,
      `Image: ${product.imageUrl ? "set" : "not set"}`,
    ].join("\n"),
    buttons(
      [menuButton("Update image", `admin:image:${product.id}`)],
      [
        menuButton(
          product.inStock ? "Mark out of stock" : "Mark in stock",
          `admin:stock:${product.id}`,
        ),
      ],
      [menuButton("Manage products", "admin:products")],
    ),
  );
}

async function startAdminProductWizard(
  chatId: string,
  context: TelegramSessionContext,
  username?: string | null,
): Promise<void> {
  await saveSession(
    chatId,
    "admin_name",
    { ...context, adminDraft: undefined },
    username,
  );
  await sendMessage(
    chatId,
    "Add product: send the product name.",
    buttons([menuButton("Cancel", "admin:cancel")]),
  );
}

async function sendAdminCategories(
  chatId: string,
  context: TelegramSessionContext,
  username?: string | null,
): Promise<void> {
  const categories = await db
    .select({ id: categoriesTable.id, name: categoriesTable.name })
    .from(categoriesTable)
    .orderBy(categoriesTable.name);

  await saveSession(chatId, "admin_category", context, username);
  await sendMessage(
    chatId,
    "Choose the product category:",
    buttons(
      ...categories.map((category) => [
        menuButton(category.name, `admin:category:${category.id}`),
      ]),
      [menuButton("Cancel", "admin:cancel")],
    ),
  );
}

async function startAdminImageUpdate(
  chatId: string,
  productId: number,
  context: TelegramSessionContext,
  username?: string | null,
): Promise<void> {
  await saveSession(
    chatId,
    "admin_image",
    { ...context, adminDraft: { productId } },
    username,
  );
  await sendMessage(
    chatId,
    `Send the new image for product #${productId} as a Telegram photo.`,
    buttons([menuButton("Cancel", "admin:cancel")]),
  );
}

async function createProductFromDraft(
  chatId: string,
  context: TelegramSessionContext,
  imageFileId: string | undefined,
  username?: string | null,
): Promise<void> {
  const draft = context.adminDraft;
  if (!draft?.name || !draft.price || !draft.categoryId) {
    await sendMessage(chatId, "The product details are incomplete. Please start again.");
    await sendAdminHelp(chatId);
    return;
  }

  const baseSlug = slugify(draft.name) || `product-${Date.now()}`;
  const [existingSlug] = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(eq(productsTable.slug, baseSlug));
  const slug = existingSlug ? `${baseSlug}-${Date.now()}` : baseSlug;
  const imageUrl = imageFileId ? telegramImageUrl(imageFileId) : null;
  const [product] = await db
    .insert(productsTable)
    .values({
      name: draft.name,
      slug,
      price: draft.price,
      categoryId: draft.categoryId,
      description: draft.description || null,
      imageUrl,
      images: imageUrl ? [imageUrl] : [],
    })
    .returning({ id: productsTable.id, name: productsTable.name });

  await saveSession(chatId, "idle", { ...context, adminDraft: undefined }, username);
  await sendMessage(
    chatId,
    `Product #${product.id} created: ${product.name}${imageUrl ? "\nThe image is live on the website." : ""}`,
    buttons(
      [menuButton("Add another product", "admin:add")],
      [menuButton("Manage products", "admin:products")],
    ),
  );
}

async function updateProductImage(
  chatId: string,
  productId: number,
  fileId: string,
  context: TelegramSessionContext,
  username?: string | null,
): Promise<void> {
  const imageUrl = telegramImageUrl(fileId);
  const [product] = await db
    .update(productsTable)
    .set({ imageUrl, images: [imageUrl] })
    .where(eq(productsTable.id, productId))
    .returning({ id: productsTable.id, name: productsTable.name });

  await saveSession(chatId, "idle", { ...context, adminDraft: undefined }, username);
  await sendMessage(
    chatId,
    product
      ? `Image updated for #${product.id} ${product.name}. It is now live on the website.`
      : `Product #${productId} was not found.`,
    buttons([menuButton("Manage products", "admin:products")]),
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
    if (TELEGRAM_ADMIN_CHAT_IDS.size) {
      await sendMessage(
        chatId,
        hasConfiguredAdminAccess(chatId)
          ? "This chat is already configured as a Telegram store admin."
          : "This chat is not configured as a Telegram store admin.",
      );
      return true;
    }
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
    if (hasConfiguredAdminAccess(chatId)) {
      await sendMessage(
        chatId,
        "This chat is configured as a store admin. Remove its chat ID from TELEGRAM_ADMIN_CHAT_IDS to revoke access.",
      );
      return true;
    }
    await saveSession(
      chatId,
      "idle",
      { ...context, adminUsername: undefined },
      username,
    );
    await sendMessage(chatId, "Admin mode disabled.");
    return true;
  }

  const adminAccess = TELEGRAM_ADMIN_CHAT_IDS.size
    ? hasConfiguredAdminAccess(chatId)
    : Boolean(context.adminUsername);
  if (!adminAccess) {
    await sendMessage(
      chatId,
      TELEGRAM_ADMIN_CHAT_IDS.size
        ? "This Telegram chat is not configured as a store admin."
        : "Admin commands are protected. Use /admin login <username> <password> to continue.",
    );
    return true;
  }

  if (action === "help") {
    await sendAdminHelp(chatId);
    return true;
  }

  if (action === "add") {
    await startAdminProductWizard(chatId, context, username);
    return true;
  }

  if (action === "products" || action === "list") {
    await sendAdminProducts(chatId, rest.join(" ").trim() || undefined);
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

async function verifyTelegramPayment(
  chatId: string,
  reference: string,
): Promise<void> {
  if (!PAYSTACK_SECRET) {
    await sendMessage(
      chatId,
      "Online payment is temporarily unavailable. Please try again later.",
      buttons([menuButton("Back to menu", "menu:main")]),
    );
    return;
  }

  const [order] = await db
    .select({ id: ordersTable.id, total: ordersTable.total, paymentStatus: ordersTable.paymentStatus })
    .from(ordersTable)
    .where(eq(ordersTable.paystackReference, reference));
  if (!order) {
    await sendMessage(chatId, "Payment reference not found. Please start checkout again.");
    return;
  }

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } },
    );
    const transaction = response.data?.data;
    if (transaction?.status !== "success") {
      await sendMessage(
        chatId,
        "Payment has not been completed yet. Tap Pay now to finish, then check again.",
        buttons([menuButton("Check payment again", `payment:check:${reference}`)]),
      );
      return;
    }

    if (order.paymentStatus !== "paid") {
      const [paidOrder] = await db
        .update(ordersTable)
        .set({ paymentStatus: "paid", status: "processing" })
        .where(eq(ordersTable.id, order.id))
        .returning({ id: ordersTable.id, total: ordersTable.total });
      if (paidOrder) {
        await notifyAdminsAboutPayment(
          paidOrder.id,
          reference,
          Number(paidOrder.total),
        );
      }
    }

    await sendMessage(
      chatId,
      `Payment confirmed for order #${order.id}. Your order is now being processed.`,
      buttons([menuButton("Continue shopping", "shop:featured")]),
    );
  } catch (error) {
    logger.error({ error, reference }, "Telegram payment verification failed");
    await sendMessage(
      chatId,
      "We could not verify the payment right now. Tap Check payment again in a moment.",
      buttons([menuButton("Check payment again", `payment:check:${reference}`)]),
    );
  }
}

async function handleCallbackQuery(callbackQuery: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
  const chatId = callbackQuery.message?.chat?.id;
  const data = callbackQuery.data ?? "";
  if (!chatId) return;

  await answerCallbackQuery(callbackQuery.id);
  const chatIdString = String(chatId);
  const username = callbackQuery.from?.username ?? null;
  const session = await getSession(chatIdString, username ?? undefined);
  const context = session.context;

  if (data === "menu:main") {
    await saveSession(chatIdString, "idle", { ...context, lastResults: [] }, username);
    await sendWelcome(chatIdString);
    return;
  }

  if (data === "shop:featured") {
    await searchProducts(chatIdString, "", context, username);
    return;
  }

  if (data === "cart:view") {
    await sendCart(chatIdString, context);
    return;
  }

  if (data === "cart:clear") {
    await saveSession(chatIdString, "idle", { ...context, cart: [] }, username);
    await sendMessage(
      chatIdString,
      "Your cart is empty now.",
      buttons([menuButton("Browse products", "shop:featured")]),
    );
    return;
  }

  if (data.startsWith("cart:add:")) {
    const productId = Number(data.slice("cart:add:".length));
    if (!Number.isInteger(productId)) return;
    const [product] = await db
      .select({ id: productsTable.id, name: productsTable.name, inStock: productsTable.inStock })
      .from(productsTable)
      .where(eq(productsTable.id, productId));
    if (!product || !product.inStock) {
      await sendMessage(chatIdString, "That product is no longer in stock.");
      return;
    }
    const existing = context.cart.find((item) => item.productId === productId);
    const cart = existing
      ? context.cart.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
      : [...context.cart, { productId, quantity: 1 }];
    await saveSession(chatIdString, "idle", { ...context, cart }, username);
    await sendMessage(
      chatIdString,
      `${product.name} added to your cart.`,
      buttons(
        [menuButton("View cart", "cart:view"), menuButton("Checkout", "checkout:start")],
        [menuButton("Browse more", "shop:featured")],
      ),
    );
    return;
  }

  if (data === "checkout:start") {
    await beginCheckout(chatIdString, context, username);
    return;
  }

  if (data === "checkout:cancel") {
    await saveSession(chatIdString, "idle", { ...context, lastResults: [] }, username);
    await sendMessage(chatIdString, "Checkout cancelled.", buttons([menuButton("View cart", "cart:view")]));
    return;
  }

  if (data === "checkout:confirm") {
    if (session.state !== "confirm") {
      await sendMessage(chatIdString, "Checkout has expired. Tap Checkout to start again.");
      return;
    }
    await createTelegramOrder(chatIdString, context, username);
    return;
  }

  if (data.startsWith("payment:check:")) {
    await verifyTelegramPayment(chatIdString, data.slice("payment:check:".length));
    return;
  }

  const adminAccess = TELEGRAM_ADMIN_CHAT_IDS.size
    ? hasConfiguredAdminAccess(chatIdString)
    : Boolean(context.adminUsername);
  if (!adminAccess && data.startsWith("admin:")) {
    await sendMessage(chatIdString, "This Telegram chat is not configured as a store admin.");
    return;
  }

  if (data === "admin:menu") {
    await sendAdminHelp(chatIdString);
    return;
  }

  if (data === "admin:add") {
    await startAdminProductWizard(chatIdString, context, username);
    return;
  }

  if (data === "admin:products") {
    await sendAdminProducts(chatIdString);
    return;
  }

  if (data === "admin:cancel") {
    await saveSession(chatIdString, "idle", { ...context, adminDraft: undefined }, username);
    await sendAdminHelp(chatIdString);
    return;
  }

  if (data === "admin:skip-description") {
    await saveSession(
      chatIdString,
      "admin_image",
      { ...context, adminDraft: { ...context.adminDraft, description: "" } },
      username,
    );
    await sendMessage(
      chatIdString,
      "Now send the product image as a Telegram photo, or tap Skip image.",
      buttons([menuButton("Skip image", "admin:skip-image")], [menuButton("Cancel", "admin:cancel")]),
    );
    return;
  }

  if (data === "admin:skip-image") {
    if (context.adminDraft?.productId) {
      await sendMessage(chatIdString, "An image is required when updating a product. Send the photo or tap Cancel.");
      return;
    }
    await createProductFromDraft(chatIdString, context, undefined, username);
    return;
  }

  if (data.startsWith("admin:category:")) {
    const categoryId = Number(data.slice("admin:category:".length));
    if (!Number.isInteger(categoryId)) return;
    await saveSession(
      chatIdString,
      "admin_description",
      { ...context, adminDraft: { ...context.adminDraft, categoryId } },
      username,
    );
    await sendMessage(
      chatIdString,
      "Send a short product description, or tap Skip description.",
      buttons([menuButton("Skip description", "admin:skip-description")], [menuButton("Cancel", "admin:cancel")]),
    );
    return;
  }

  if (data.startsWith("admin:image:")) {
    const productId = Number(data.slice("admin:image:".length));
    if (Number.isInteger(productId)) {
      await startAdminImageUpdate(chatIdString, productId, context, username);
    }
    return;
  }

  if (data.startsWith("admin:product:")) {
    const productId = Number(data.slice("admin:product:".length));
    if (Number.isInteger(productId)) {
      await sendAdminProductActions(chatIdString, productId);
    }
    return;
  }

  if (data.startsWith("admin:stock:")) {
    const productId = Number(data.slice("admin:stock:".length));
    if (!Number.isInteger(productId)) return;
    const [product] = await db
      .select({ inStock: productsTable.inStock })
      .from(productsTable)
      .where(eq(productsTable.id, productId));
    if (!product) {
      await sendMessage(chatIdString, "That product was not found.");
      return;
    }
    await db
      .update(productsTable)
      .set({ inStock: !product.inStock })
      .where(eq(productsTable.id, productId));
    await sendAdminProductActions(chatIdString, productId);
  }
}

async function handlePhoto(
  chatId: string,
  photo: Array<{ file_id: string; width: number; height: number }>,
  username?: string | null,
): Promise<void> {
  const session = await getSession(chatId, username ?? undefined);
  const context = session.context;
  const adminAccess = TELEGRAM_ADMIN_CHAT_IDS.size
    ? hasConfiguredAdminAccess(chatId)
    : Boolean(context.adminUsername);
  if (!adminAccess || session.state !== "admin_image") {
    await sendMessage(chatId, "Use the buttons in the menu to choose an action.");
    return;
  }

  const largestPhoto = [...photo].sort(
    (left, right) => right.width * right.height - left.width * left.height,
  )[0];
  if (!largestPhoto) return;

  if (context.adminDraft?.productId) {
    await updateProductImage(
      chatId,
      context.adminDraft.productId,
      largestPhoto.file_id,
      context,
      username,
    );
    return;
  }

  await createProductFromDraft(chatId, context, largestPhoto.file_id, username);
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

  const adminAccess = TELEGRAM_ADMIN_CHAT_IDS.size
    ? hasConfiguredAdminAccess(chatId)
    : Boolean(context.adminUsername);

  if (adminAccess && session.state === "admin_name") {
    if (text.length < 2) {
      await sendMessage(chatId, "Please send a product name.", buttons([menuButton("Cancel", "admin:cancel")]));
      return;
    }
    await saveSession(
      chatId,
      "admin_price",
      { ...context, adminDraft: { name: text } },
      username,
    );
    await sendMessage(
      chatId,
      "Send the price in naira, for example 12500.",
      buttons([menuButton("Cancel", "admin:cancel")]),
    );
    return;
  }

  if (adminAccess && session.state === "admin_price") {
    const price = Number(text.replace(/[₦,]/g, ""));
    if (!Number.isFinite(price) || price <= 0) {
      await sendMessage(chatId, "Please send a valid price in naira.", buttons([menuButton("Cancel", "admin:cancel")]));
      return;
    }
    await sendAdminCategories(
      chatId,
      { ...context, adminDraft: { ...context.adminDraft, price: String(price) } },
      username,
    );
    return;
  }

  if (adminAccess && session.state === "admin_description") {
    await saveSession(
      chatId,
      "admin_image",
      { ...context, adminDraft: { ...context.adminDraft, description: text } },
      username,
    );
    await sendMessage(
      chatId,
      "Now send the product image as a Telegram photo, or tap Skip image.",
      buttons(
        [menuButton("Skip image", "admin:skip-image")],
        [menuButton("Cancel", "admin:cancel")],
      ),
    );
    return;
  }

  if (adminAccess && session.state === "admin_image") {
    await sendMessage(
      chatId,
      "Please send the image using Telegram's photo attachment button, or tap Skip image.",
      buttons([menuButton("Skip image", "admin:skip-image")]),
    );
    return;
  }

  if (normalized === "/cancel" || normalized === "cancel") {
    await saveSession(chatId, "idle", { ...context, lastResults: [] }, username);
    await sendMessage(chatId, "Cancelled.", buttons([menuButton("Main menu", "menu:main")]));
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
    await sendMessage(
      chatId,
      "What phone number should we use for delivery updates?",
      buttons([menuButton("Cancel checkout", "checkout:cancel")]),
    );
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
    await sendMessage(
      chatId,
      "What email address should we attach to the order?",
      buttons([menuButton("Cancel checkout", "checkout:cancel")]),
    );
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
    await sendMessage(
      chatId,
      "What is the full delivery address?",
      buttons([menuButton("Cancel checkout", "checkout:cancel")]),
    );
    return;
  }

  if (session.state === "address") {
    await saveSession(
      chatId,
      "city",
      { ...context, deliveryAddress: text },
      username,
    );
    await sendMessage(
      chatId,
      "Which city should we deliver to?",
      buttons([menuButton("Cancel checkout", "checkout:cancel")]),
    );
    return;
  }

  if (session.state === "city") {
    await saveSession(chatId, "state", { ...context, city: text }, username);
    await sendMessage(
      chatId,
      "Which state is the delivery in?",
      buttons([menuButton("Cancel checkout", "checkout:cancel")]),
    );
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
        "Tap Confirm order to place it.",
      ].join("\n"),
      buttons(
        [menuButton("Confirm order", "checkout:confirm")],
        [menuButton("Cancel checkout", "checkout:cancel")],
      ),
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
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  const message = update.message;
  const chatId = message?.chat?.id;
  if (!chatId) return;
  const username = message?.from?.username ?? null;
  if (message?.photo?.length) {
    await handlePhoto(String(chatId), message.photo, username);
    return;
  }
  if (message?.text) {
    await handleMessage(String(chatId), message.text, username);
  }
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
          allowed_updates: ["message", "callback_query"],
        })) ?? [];
      if (telegramApiUnauthorized || telegramPollingConflict) {
        polling = false;
        logger.error(
          telegramApiUnauthorized
            ? "Telegram polling stopped because TELEGRAM_BOT_TOKEN was rejected"
            : "Telegram polling stopped because another bot instance owns getUpdates",
        );
        break;
      }
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
  telegramApiUnauthorized = false;
  telegramPollingConflict = false;
  polling = true;
  void telegramRequest("setMyCommands", {
    commands: [
      { command: "start", description: "Open the shopping menu" },
      { command: "shop", description: "Search the product catalog" },
      { command: "cart", description: "View your cart" },
      { command: "checkout", description: "Place your order" },
      { command: "myid", description: "Show your Telegram chat ID" },
      { command: "admin", description: "Open the admin panel" },
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

router.get("/telegram/image/:fileId", async (req, res): Promise<void> => {
  if (!BOT_TOKEN) {
    res.sendStatus(404);
    return;
  }

  const file = await telegramRequest<{ file_path?: string }>("getFile", {
    file_id: req.params.fileId,
  });
  if (!file?.file_path) {
    res.sendStatus(404);
    return;
  }

  try {
    const response = await fetch(
      `${TELEGRAM_API}/file/bot${BOT_TOKEN}/${file.file_path}`,
    );
    if (!response.ok) {
      res.sendStatus(404);
      return;
    }
    const contentType = response.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    logger.error({ error }, "Telegram image proxy failed");
    res.sendStatus(502);
  }
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