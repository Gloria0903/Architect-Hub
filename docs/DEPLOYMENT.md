# Deploying Architect Hub

This app is two long-running processes sharing one codebase â€” the Next.js
web app, and a background worker (email sending + reminder jobs, via
BullMQ). The worker **cannot** run on a serverless platform like Vercel â€”
it needs a persistent connection to Redis, not a request/response cycle.
That's why this guide uses **Railway**, not Vercel: Railway runs both
processes as ordinary long-lived containers, and it can build straight
from the multi-stage `Dockerfile` already in this repo (`runner` target
for the web app, `worker` target for the background jobs) â€” no new
Docker config needed.

Keep using your existing **Supabase** Postgres â€” no need to migrate
databases. Add **Upstash** for Redis (see `docs/INFRASTRUCTURE_SETUP.md`
for both).

## 1. Create the Railway project

1. [railway.app](https://railway.app) â†’ New Project â†’ **Deploy from GitHub
   repo** â†’ select `Gloria0903/Architect-Hub`.
2. Railway will create one service from the repo. Rename it **web**.
3. Add a second service: **+ New â†’ GitHub Repo â†’ same repo again** â†’
   rename it **worker**. (Two services, same repo, different build
   target â€” see step 2.)

## 2. Point each service at the right Docker build target

For **each** service â†’ Settings â†’ Build:
- Builder: **Dockerfile**
- Dockerfile Path: `Dockerfile` (default, already correct)
- Docker Build Target:
  - `web` service â†’ `runner`
  - `worker` service â†’ `worker`

This matches the two named stages already in the Dockerfile â€” no image
duplication, no new files.

## 3. Environment variables

Set these under each service's **Variables** tab. Generate `AUTH_SECRET`
locally first:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**web** service needs all of these:
```
DATABASE_URL=<Supabase POOLED connection string, port 6543, "Transaction" mode>
DIRECT_URL=<Supabase DIRECT connection string, port 5432>
REDIS_URL=<your Upstash rediss:// URL>
AUTH_SECRET=<generated above>
NEXTAUTH_URL=https://<your-railway-domain-or-custom-domain>
NEXT_PUBLIC_APP_URL=https://<same-as-above>
AWS_REGION=<if using S3>
AWS_S3_BUCKET=<if using S3>
AWS_ACCESS_KEY_ID=<if using S3, and not using an IAM role>
AWS_SECRET_ACCESS_KEY=<if using S3, and not using an IAM role>
RESEND_API_KEY=<for email delivery>
RESEND_FROM_EMAIL=Architect Hub <notifications@yourdomain.com>
NODE_ENV=production
```

**worker** service needs only the subset it actually uses:
```
DATABASE_URL=<same as web>
DIRECT_URL=<same as web -- Prisma requires it, even though the worker only reads/writes through the pooled connection>
REDIS_URL=<same as web>
RESEND_API_KEY=<same as web>
RESEND_FROM_EMAIL=<same as web>
NODE_ENV=production
```

Railway supports **Shared Variables** at the project level so you don't
have to paste `DATABASE_URL`/`REDIS_URL` twice â€” set them once there and
reference them from both services.

## 4. Networking

- **web**: Settings â†’ Networking â†’ Generate Domain (or attach your own
  custom domain). This is the URL `NEXTAUTH_URL`/`NEXT_PUBLIC_APP_URL`
  must match exactly, including `https://`.
- **worker**: no public networking needed at all â€” it doesn't listen on a
  port. Leave networking off for this service.

## 5. Database migrations

The `runner`/`worker` Docker stages intentionally ship a minimal image â€”
they don't include the full `prisma` CLI, only the already-generated
client (keeps the container small and the cold start fast). So
migrations run as their own step, **not** inside the container's start
command:

**First deploy (manual, one time):**
```bash
# From your own machine, pointed at the PRODUCTION database:
DATABASE_URL="<your production Supabase URL>" npx prisma migrate deploy
```

**Every deploy after that:** add `DATABASE_URL_PRODUCTION` as a GitHub
Actions secret (Settings â†’ Secrets and variables â†’ Actions), then enable
the commented-out `migrate-production` job in `.github/workflows/ci.yml`
(see the comment there) â€” it runs `prisma migrate deploy` against
production automatically on every push to `main`, ahead of Railway's own
auto-deploy picking up the same commit.

## 6. What "done" looks like

- `https://<your-domain>/api/health` returns `{"status":"ok", ...}` with
  both `database: "connected"` and `redis: "connected"`.
- Logging into the app and submitting a daily log actually sends the
  assignment/notification emails (confirms the worker service is
  running and connected to the same Redis as web).

## What this guide deliberately doesn't cover

Sentry/error tracking, and anything requiring your actual Railway/AWS/
Upstash account credentials â€” those need you in the loop; ask Claude to
wire in the code side once you've created the accounts and have keys to
share.
