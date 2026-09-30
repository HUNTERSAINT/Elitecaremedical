import { pool } from "@workspace/db";

async function ensureProductionSchema(): Promise<void> {
  await pool.query(`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS telegram_file_id text,
      ADD COLUMN IF NOT EXISTS sizes text[];

    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS delivery_fee numeric(12, 2) NOT NULL DEFAULT 2000;

    CREATE TABLE IF NOT EXISTS telegram_sessions (
      chat_id text PRIMARY KEY,
      username text,
      state text NOT NULL DEFAULT 'idle',
      context jsonb NOT NULL DEFAULT '{"cart":[],"lastResults":[]}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  console.log("Production schema additions are ready.");
}

ensureProductionSchema()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });