import { Router, type IRouter } from "express";
import axios from "axios";
import { db, ordersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { InitializePaymentBody, VerifyPaymentParams } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY ?? "";

router.post("/payments/initialize", async (req, res): Promise<void> => {
  const parsed = InitializePaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { orderId, email, amount, callbackUrl } = parsed.data;

  if (!PAYSTACK_SECRET) {
    req.log.error("PAYSTACK_SECRET_KEY is not set");
    res.status(500).json({ error: "Payment service not configured" });
    return;
  }

  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: Math.round(amount * 100), // Convert to kobo
        reference: `ECM-${orderId}-${Date.now()}`,
        callback_url: callbackUrl,
        metadata: { orderId },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { authorization_url, reference, access_code } = response.data.data;

    // Update order with reference
    await db
      .update(ordersTable)
      .set({ paystackReference: reference })
      .where(eq(ordersTable.id, orderId));

    res.json({
      authorizationUrl: authorization_url,
      reference,
      accessCode: access_code,
    });
  } catch (err) {
    req.log.error({ err }, "Paystack initialize failed");
    res.status(400).json({ error: "Payment initialization failed" });
  }
});

router.get("/payments/verify/:reference", async (req, res): Promise<void> => {
  const params = VerifyPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { reference } = params.data;

  if (!PAYSTACK_SECRET) {
    res.status(500).json({ error: "Payment service not configured" });
    return;
  }

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      }
    );

    const txData = response.data.data;
    const orderId = txData.metadata?.orderId;

    if (txData.status === "success") {
      if (orderId) {
        await db
          .update(ordersTable)
          .set({ paymentStatus: "paid", status: "processing", paystackReference: reference })
          .where(eq(ordersTable.id, orderId));
      }

      res.json({ status: "success", message: "Payment verified", orderId: orderId ?? 0 });
    } else {
      res.json({ status: "failed", message: "Payment not completed", orderId: orderId ?? 0 });
    }
  } catch (err) {
    logger.error({ err }, "Paystack verify failed");
    res.status(400).json({ error: "Payment verification failed" });
  }
});

export default router;
