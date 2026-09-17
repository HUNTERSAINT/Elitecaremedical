---
name: WhatsApp token validation
description: WhatsApp configuration presence does not prove Meta API authorization.
---

The WhatsApp bot must validate the access token against Meta before treating the integration as connected; an expired token can leave webhook verification working while all outbound Graph API calls fail.

**Why:** The webhook verify token is independent of the Graph API access token, and the app's status endpoint only checks whether environment values exist.

**How to apply:** When testing WhatsApp, call Meta with the access token and confirm the configured phone-number ID is accessible before attempting a message. Use a recipient different from the business sender.