import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const whatsappCartItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

export const whatsappSessionContextSchema = z.object({
  cart: z.array(whatsappCartItemSchema).default([]),
  lastResults: z.array(z.number().int().positive()).default([]),
  customerName: z.string().optional(),
  customerEmail: z.string().optional(),
  deliveryAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

export type WhatsAppSessionContext = z.infer<
  typeof whatsappSessionContextSchema
>;

export const whatsappSessionsTable = pgTable("whatsapp_sessions", {
  phoneNumber: text("phone_number").primaryKey(),
  state: text("state").notNull().default("idle"),
  context: jsonb("context")
    .$type<WhatsAppSessionContext>()
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

export type WhatsAppSession = typeof whatsappSessionsTable.$inferSelect;