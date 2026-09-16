import crypto from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { and, eq, ilike, inArray } from "drizzle-orm";
import {
  db,
  ordersTable,
  productsTable,
  whatsappSessionsTable,
  type WhatsAppSessionContext,
} from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v23.0";
const PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID ?? process.env.WATS_NUM;
const ACCESS_TOKEN =
  process.env.WHATSAPP_ACCESS_TOKEN ?? process.env.WATS_KEY;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const DELIVERY_FEE = 2000;

type WhatsAppMessage = {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
};

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WhatsAppMessage[];
      };
    }>;
  }>;
};

function formatNaira(value: number): string {
  return `₦${value.toLocaleString("en-NG", {
    maximumFractionDigits: 0,
  })}`;
}

function getContext(value: unknown): WhatsAppSessionContext {
  const parsed = (() => {
    try {
      return typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      return null;
    }
  })();

  const result = {
    cart: Array.isArray((parsed as { cart?: unknown })?.cart)
      ? (parsed as { cart: WhatsAppSessionContext["cart"] }).cart
      : [],
    lastResults: Array.isArray((parsed as { lastResults?: unknown })?.lastResults)
      ? (parsed as { lastResults: number[] }).lastResults
      : [],
    customerName: (parsed as { customerName?: unknown })?.customerName,
    customerEmail: (parsed as { customerEmail?: unknown })?.customerEmail,
    deliveryAddress: (parsed as { deliveryAddress?: unknown })?.deliveryAddress,
    city: (parsed as { city?: unknown })?.city,
    state: (parsed as { state?: unknown })?.state,
  };

  return {
    cart: result.cart.filter(
      (item) =>
        Number.isInteger(item?.productId) &&
        item.productId > 0 &&
        Number.isInteger(item?.quantity) &&
        item.quantity > 0,
    ),
    lastResults: result.lastResults.filter(
      (id) => Number.isInteger(id) && id > 0,
    ),
    ...(typeof result.customerName === "string"
      ? { customerName: result.customerName }
      : {}),
    ...(typeof result.customerEmail === "string"
      ? { customerEmail: result.customerEmail }
      : {}),
    ...(typeof result.deliveryAddress === "string"
      ? { deliveryAddress: result.deliveryAddress }
      : {}),
    ...(typeof result.city === "string" ? { city: result.city } : {}),
    ...(typeof result.state === "string" ? { state: result.state } : {}),
  };
}

async function getSession(phoneNumber: string) {
  const [existing] = await db
    .select()
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.phoneNumber, phoneNumber));

  if (existing) {
    return {
      ...existing,
      context: getContext(existing.context),
    };
  }

  const [created] = await db
    .insert(whatsappSessionsTable)
    .values({
      phoneNumber,
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
  phoneNumber: string,
  state: string,
  context: WhatsAppSessionContext,
) {
  await db
    .insert(whatsappSessionsTable)
    .values({ phoneNumber, state, context })
    .onConflictDoUpdate({
      target: whatsappSessionsTable.phoneNumber,
      set: { state, context, updatedAt: new Date() },
    });
}

async function sendText(phoneNumber: string, body: string): Promise<void> {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    logger.error(
      "WhatsApp phone number ID or API access token is not configured; cannot send WhatsApp message",
    );
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: "text",
        text: { body, preview_url: false },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error(
      { status: response.status, body: errorBody },
      "WhatsApp message send failed",
    );
  }
}

async function markRead(messageId: string | undefined): Promise<void> {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN || !messageId) return;

  const response = await fetch(
    `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    },
  );

  if (!response.ok) {
    logger.warn({ status: response.status }, "Could not mark WhatsApp message read");
  }
}

async function sendWelcome(phoneNumber: string): Promise<void> {
  await sendText(
    phoneNumber,
    [
      "Welcome to Elite Care Medical.",
      "",
      "I can help you shop for medical equipment on WhatsApp.",
      "",
      "Try:",
      "• Type a product name, like stethoscope",
      "• Reply with a number to add a result",
      "• cart — view your cart",
      "• checkout — place your order",
      "• clear — empty your cart",
      "",
      "Type menu at any time to see this again.",
    ].join("\n"),
  );
}

async function sendCart(phoneNumber: string, context: WhatsAppSessionContext) {
  if (!context.cart.length) {
    await sendText(
      phoneNumber,
      "Your cart is empty. Tell me what equipment you are looking for to get started.",
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
    const total = Number(product.price) * item.quantity;
    return [`${item.quantity} × ${product.name} — ${formatNaira(total)}`];
  });
  const subtotal = context.cart.reduce((sum, item) => {
    const product = productMap.get(item.productId);
    return sum + (product ? Number(product.price) * item.quantity : 0);
  }, 0);

  await sendText(
    phoneNumber,
    [
      "Your Elite Care cart:",
      ...lines,
      "",
      `Subtotal: ${formatNaira(subtotal)}`,
      `Delivery: ${formatNaira(DELIVERY_FEE)}`,
      `Total: ${formatNaira(subtotal + DELIVERY_FEE)}`,
      "",
      "Reply checkout to continue, or keep searching to add more items.",
    ].join("\n"),
  );
}

async function searchProducts(phoneNumber: string, query: string) {
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
    .limit(5);

  const [session] = await db
    .select()
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.phoneNumber, phoneNumber));
  const context = getContext(session?.context);
  context.lastResults = products.map((product) => product.id);
  await saveSession(phoneNumber, session?.state ?? "idle", context);

  if (!products.length) {
    await sendText(
      phoneNumber,
      `I couldn't find an in-stock product matching “${query}”. Try a broader term like gloves, diagnostic, surgical, or microscope.`,
    );
    return;
  }

  await sendText(
    phoneNumber,
    [
      `I found ${products.length} option${products.length === 1 ? "" : "s"}:`,
      "",
      ...products.map(
        (product, index) =>
          `${index + 1}. ${product.name} — ${formatNaira(Number(product.price))}`,
      ),
      "",
      "Reply with a number to add it to your cart, or search for something else.",
    ].join("\n"),
  );
}

async function beginCheckout(
  phoneNumber: string,
  context: WhatsAppSessionContext,
) {
  if (!context.cart.length) {
    await sendCart(phoneNumber, context);
    return;
  }

  await saveSession(phoneNumber, "name", context);
  await sendText(phoneNumber, "Great. What is your full name?");
}

async function createWhatsAppOrder(
  phoneNumber: string,
  context: WhatsAppSessionContext,
): Promise<void> {
  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      price: productsTable.price,
      imageUrl: productsTable.imageUrl,
    })
    .from(productsTable)
    .where(inArray(productsTable.id, context.cart.map((item) => item.productId)));
  const productMap = new Map(products.map((product) => [product.id, product]));
  const orderItems = context.cart.flatMap((item) => {
    const product = productMap.get(item.productId);
    if (!product) return [];
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
    await sendText(phoneNumber, "Your cart is no longer available. Please search again.");
    await saveSession(phoneNumber, "idle", {
      cart: [],
      lastResults: [],
    });
    return;
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const [order] = await db
    .insert(ordersTable)
    .values({
      customerName: context.customerName ?? "",
      customerEmail: context.customerEmail ?? "",
      customerPhone: phoneNumber,
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
      notes: "Order placed via WhatsApp bot",
    })
    .returning({ id: ordersTable.id, total: ordersTable.total });

  await saveSession(phoneNumber, "idle", { cart: [], lastResults: [] });
  await sendText(
    phoneNumber,
    [
      `Order #${order.id} received.`,
      `Total: ${formatNaira(Number(order.total))}`,
      "",
      "Our team will message you with verified payment details and delivery confirmation.",
      "Keep this chat open if you need help.",
    ].join("\n"),
  );
}

async function handleMessage(phoneNumber: string, rawText: string): Promise<void> {
  const text = rawText.trim();
  const normalized = text.toLowerCase();
  const session = await getSession(phoneNumber);
  const context = session.context;

  if (/^(hi|hello|hey|start|menu|help)$/i.test(normalized)) {
    await saveSession(phoneNumber, "idle", {
      ...context,
      lastResults: [],
    });
    await sendWelcome(phoneNumber);
    return;
  }

  if (normalized === "cart" || normalized === "view cart") {
    await sendCart(phoneNumber, context);
    return;
  }

  if (normalized === "clear" || normalized === "clear cart") {
    await saveSession(phoneNumber, "idle", { ...context, cart: [] });
    await sendText(phoneNumber, "Your cart is empty now. Search for equipment whenever you are ready.");
    return;
  }

  if (normalized === "checkout" || normalized === "buy") {
    await beginCheckout(phoneNumber, context);
    return;
  }

  if (session.state === "name") {
    if (text.length < 2) {
      await sendText(phoneNumber, "Please send your full name.");
      return;
    }
    await saveSession(phoneNumber, "email", { ...context, customerName: text });
    await sendText(phoneNumber, "What email address should we attach to the order?");
    return;
  }

  if (session.state === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      await sendText(phoneNumber, "That email does not look right. Please send a valid email address.");
      return;
    }
    await saveSession(phoneNumber, "address", { ...context, customerEmail: text });
    await sendText(phoneNumber, "What is the full delivery address?");
    return;
  }

  if (session.state === "address") {
    await saveSession(phoneNumber, "city", { ...context, deliveryAddress: text });
    await sendText(phoneNumber, "Which city should we deliver to?");
    return;
  }

  if (session.state === "city") {
    await saveSession(phoneNumber, "state", { ...context, city: text });
    await sendText(phoneNumber, "Which state is the delivery in?");
    return;
  }

  if (session.state === "state") {
    const nextContext = { ...context, state: text };
    await saveSession(phoneNumber, "confirm", nextContext);
    await sendText(
      phoneNumber,
      [
        "Please confirm your order:",
        `Name: ${nextContext.customerName}`,
        `Email: ${nextContext.customerEmail}`,
        `Delivery: ${nextContext.deliveryAddress}, ${nextContext.city}, ${nextContext.state}`,
        "",
        "Reply confirm to place it, or menu to start over.",
      ].join("\n"),
    );
    return;
  }

  if (session.state === "confirm") {
    if (normalized === "confirm" || normalized === "yes") {
      await createWhatsAppOrder(phoneNumber, context);
    } else {
      await sendText(phoneNumber, "Reply confirm to place the order, or menu to start over.");
    }
    return;
  }

  const addMatch = normalized.match(/^(?:add\s+)?(\d+)$/);
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
      await saveSession(phoneNumber, "idle", { ...context, cart: nextCart });
      await sendText(
        phoneNumber,
        "Added to your cart. Reply cart to review it or checkout when you are ready.",
      );
      return;
    }
  }

  await searchProducts(phoneNumber, text);
}

function hasValidSignature(req: Request): boolean {
  if (!APP_SECRET) return true;

  const signature = req.header("x-hub-signature-256");
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!signature || !rawBody) return false;

  const expected = `sha256=${crypto
    .createHmac("sha256", APP_SECRET)
    .update(rawBody)
    .digest("hex")}`;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}

router.get("/whatsapp/status", (_req, res): void => {
  res.json({
    configured: Boolean(PHONE_NUMBER_ID && VERIFY_TOKEN),
    phoneNumberConfigured: Boolean(PHONE_NUMBER_ID),
    verifyTokenConfigured: Boolean(VERIFY_TOKEN),
    appSecretConfigured: Boolean(APP_SECRET),
  });
});

router.get("/whatsapp/webhook", (req, res): void => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    VERIFY_TOKEN &&
    token === VERIFY_TOKEN &&
    typeof challenge === "string"
  ) {
    res.status(200).send(challenge);
    return;
  }

  res.sendStatus(403);
});

router.post("/whatsapp/webhook", (req, res): void => {
  if (!hasValidSignature(req)) {
    res.sendStatus(401);
    return;
  }

  const payload = req.body as WhatsAppWebhookPayload;
  const messages =
    payload.entry?.flatMap((entry) =>
      entry.changes?.flatMap((change) => change.value?.messages ?? []) ?? [],
    ) ?? [];

  res.sendStatus(200);

  for (const message of messages) {
    const body = message.text?.body;
    if (message.from && body) {
      void (async () => {
        try {
          await markRead(message.id);
          await handleMessage(message.from!, body);
        } catch (error) {
          logger.error({ error, phoneNumber: message.from }, "WhatsApp message handling failed");
        }
      })();
    }
  }
});

export default router;