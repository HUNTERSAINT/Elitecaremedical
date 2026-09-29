---
name: Telegram commerce data
description: Durable decisions for Telegram catalog images, size variants, carts, and orders.
---

Telegram product photos are persisted as Telegram file IDs in the product record, while the API exposes a proxy image URL for website use. Size-specific products use a shared text-array catalog field, and the selected size is copied into both Telegram cart items and order JSON.

**Why:** Telegram photo messages provide stable file IDs but not a permanent public URL, and size variants must remain distinguishable when the same product is ordered in multiple sizes.

**How to apply:** Keep Telegram and website checkout flows on the shared product/order shape; do not replace file IDs with temporary Telegram download URLs.