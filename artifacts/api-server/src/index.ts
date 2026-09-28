import app from "./app";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { adminsTable, db } from "@workspace/db";
import { logger } from "./lib/logger";
import { stopTelegramBot } from "./routes/telegram";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureConfiguredAdmin(): Promise<void> {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    logger.warn(
      "ADMIN_USERNAME and ADMIN_PASSWORD are not configured; admin login is disabled",
    );
    return;
  }

  const [existingAdmin] = await db
    .select({
      id: adminsTable.id,
      passwordHash: adminsTable.passwordHash,
    })
    .from(adminsTable)
    .where(eq(adminsTable.username, username));

  if (existingAdmin) {
    if (!(await bcrypt.compare(password, existingAdmin.passwordHash))) {
      await db
        .update(adminsTable)
        .set({ passwordHash: await bcrypt.hash(password, 12) })
        .where(eq(adminsTable.id, existingAdmin.id));
      logger.info({ username }, "Configured admin password updated");
    }
    return;
  }

  await db.insert(adminsTable).values({
    username,
    passwordHash: await bcrypt.hash(password, 12),
  });
  logger.info({ username }, "Configured admin account created");
}

async function startServer(): Promise<void> {
  try {
    await ensureConfiguredAdmin();
  } catch (err) {
    logger.error(
      { err },
      "Could not initialize the configured admin; apply the database schema and restart",
    );
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

startServer().catch((err) => {
  logger.error({ err }, "Failed to initialize API server");
  process.exit(1);
});

process.on("SIGTERM", () => {
  stopTelegramBot();
});

process.on("SIGINT", () => {
  stopTelegramBot();
});
