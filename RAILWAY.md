# Railway deployment

Railway runs the API server as the public process. In production, that server
also serves the built Elite Care Medical storefront, so one Railway service
handles both `/` and `/api/*`.

## Setup

1. Create a Railway project from this repository.
2. Add a Railway PostgreSQL service.
3. Deploy the repository service using the checked-in `railway.json`.
4. Add the required variables to the Railway service:
   - `DATABASE_URL` (provided by the Railway PostgreSQL service)
   - `SESSION_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `PAYSTACK_SECRET_KEY` if Paystack checkout is enabled
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_ACCESS_TOKEN`
   - `WHATSAPP_VERIFY_TOKEN`
   - `WHATSAPP_APP_SECRET`
5. After the first deploy, apply the Drizzle schema against the Railway
   database:

   ```sh
   pnpm --filter @workspace/db run push
   ```

Railway supplies `PORT` at runtime. The build command supplies the frontend
build-only values `PORT=4173` and `BASE_PATH=/`.

## Health check

The configured health check is:

```text
/api/healthz
```

The public website is served at `/`, and the WhatsApp webhook is:

```text
/api/whatsapp/webhook
```