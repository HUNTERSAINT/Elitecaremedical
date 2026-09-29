import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const telegramCartItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  size: z.string().min(1).optional(),
});

export const telegramSessionContextSchema = z.object({
  cart: z.array(telegramCartItemSchema).default([]),
  lastResults: z.array(z.number().int().positive()).default([]),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().optional(),
  deliveryAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  adminUsername: z.string().optional(),
  pendingProductId: z.number().int().positive().optional(),
  adminDraft: z
    .object({
      productId: z.number().int().positive().optional(),
      name: z.string().optional(),
      price: z.string().optional(),
      categoryId: z.number().int().positive().optional(),
      description: z.string().optional(),
      sizes: z.array(z.string().min(1)).optional(),
    })
    .optional(),
});

export type TelegramSessionContext = z.infer<
  typeof telegramSessionContextSchema
>;

export const telegramSessionsTable = pgTable("telegram_sessions", {
  chatId: text("chat_id").primaryKey(),
  username: text("username"),
  state: text("state").notNull().default("idle"),
  context: jsonb("context")
    .$type<TelegramSessionContext>()
    .notNull()
    .default({
      cart: [],
      lastResults: [],
    }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type TelegramSession = typeof telegramSessionsTable.$inferSelect;