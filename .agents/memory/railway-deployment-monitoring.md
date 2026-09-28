---
name: Railway deployment monitoring
description: Railway deployment status must be checked against the deployed commit hash, not only the latest SUCCESS status.
---

Railway can have a healthy production deployment that is still serving an older GitHub commit when a push has not triggered a new deployment.

**Why:** A successful deployment status alone does not prove that the latest source revision is live.

**How to apply:** After pushing to GitHub, compare the Railway deployment metadata commit hash with the pushed commit before reporting the deployment as current.