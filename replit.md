# Elite Care Medical — Project Overview

A full-stack e-commerce website for **Elite Care Medical**, a professional medical equipment supplier based in Lagos, Nigeria.

## Architecture

| Layer | Technology | Location |
|-------|-----------|----------|
| Frontend | React + Vite + Tailwind CSS v4 | `artifacts/elite-care-medical/` |
| Backend API | Express + TypeScript | `artifacts/api-server/` |
| Database | PostgreSQL via Drizzle ORM | `lib/db/` |
| API Spec | OpenAPI 3.0 + Orval codegen | `lib/api-spec/` |
| Generated Client | React Query hooks | `lib/api-client-react/` |

## Routes (Frontend)

| Path | Page |
|------|------|
| `/` | Homepage with hero, featured products, categories |
| `/shop` | Product catalogue with search + category filter |
| `/products/:slug` | Product detail page |
| `/cart` | Shopping cart |
| `/checkout` | Checkout with Paystack card + bank transfer |
| `/payment-callback` | Paystack redirect handler |
| `/order-confirmation` | Order success / bank transfer details |
| `/admin` | Admin login |
| `/admin/dashboard` | Stats, charts, recent orders |
| `/admin/products` | Product management (CRUD + price editor) |
| `/admin/orders` | Order management with inline status updates |

## API Endpoints

All API routes mount at `/api` (handled by the API Server artifact):

- `GET/POST /api/products` — list + create
- `PATCH/DELETE /api/products/:id` — update + delete (admin)
- `GET/POST /api/categories` — list + create
- `POST /api/orders` — create order (public)
- `GET /api/orders` + `GET /api/orders/:id` — view (admin)
- `PATCH /api/orders/:id` — update order status (admin)
- `POST /api/payments/initialize` — Paystack init
- `GET /api/payments/verify/:reference` — Paystack verify
- `POST /api/admin/login` — JWT auth
- `GET /api/admin/stats` — dashboard stats

## Admin Credentials

- **Username:** `admin`
- **Password:** `EliteCare2024!`

## Contact Details

- **Email:** Nkingsley130@gmail.com
- **WhatsApp:** +2347065599931

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `SESSION_SECRET` | JWT signing secret (already set) |
| `PAYSTACK_SECRET_KEY` | Paystack payments (must be configured) |
| `DATABASE_URL` | PostgreSQL connection (managed by Replit) |

## Key Design Decisions

- Deep navy blue (`hsl(218,65%,28%)`) + Crimson red accent — trust/authority palette
- Fraunces serif for headings, Plus Jakarta Sans for body
- Cart state persisted in `localStorage` (key: `ecm_cart`)
- Admin JWT token stored in `localStorage` (key: `adminToken`), injected into API requests via `setAuthTokenGetter`
- Paystack payments redirect to `/payment-callback?reference=<ref>` for verification
- Bank transfer orders go directly to `/order-confirmation?orderId=<id>&method=bank_transfer`

## User Preferences

- 100 medical/lab/surgical products including nurses scrubs and adult diapers
- Paystack payment integration (card + bank transfer)
- Admin panel for per-product price customisation
- Lagos, Nigeria focused with nationwide delivery
