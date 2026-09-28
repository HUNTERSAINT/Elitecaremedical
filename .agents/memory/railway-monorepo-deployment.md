---
name: Railway monorepo services
description: Deployment lessons for this monorepo when Railway creates services for individual workspace packages.
---

The Railway project can contain a public app service plus automatically created services for individual workspace packages. The package services are not standalone deployables: the API package needs the database environment, and Vite packages need the production build/start configuration. The public app service may also have no GitHub repository trigger, so pushing to the repository does not necessarily create a new deployment.

**Why:** A healthy public service can coexist with several crashing package services, which makes a Railway project look broken even when the intended app is running. A repository fix alone cannot remove or reconfigure those extra services.

**How to apply:** When diagnosing a Railway monorepo, inspect every service's source, build/start commands, environment requirements, and repository trigger. Treat package-service cleanup and deployment-trigger setup as Railway configuration work separate from application code.