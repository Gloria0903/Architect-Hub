# Deploying Architect Hub

This app is two long-running processes sharing one codebase — the Next.js
web app, and a background worker (email sending + reminder jobs, via
BullMQ). The worker **cannot** run on a serverless platform like Vercel —
it needs a persistent connection to Redis, not a request/response cycle.
That's why this guide uses **Railway**, not Vercel: Railway runs both
processes as ordinary long-lived containers, and it can build straight
from the multi-stage `Dockerfile` already in this repo (`runner` target
for the web app, `worker` target for the background jobs) — no new
Docker config needed.

Keep using your existing **Supabase** Postgres — no need to migrate
databases. Add **Upstash** for Redis (see `docs/INFRASTRUCTURE_SETUP.md`
for both).

## 1. Create the Railway project

1. [railway.app](https://railway.app) → New Project → **Deploy from GitHub
   repo** → select `Gloria0903/Architect-Hub`.
2. Railway will create one service from the repo. Rename it **web**.
3. Add a second service: **+ New → GitHub Repo → same repo again** →
   rename it **worker**. (Two services, same repo, different build
   target — see step 2.)

## 2. Point each service at the right Docker build target

For **each** service → Settings → Build:
- Builder: **Dockerfile**
- Dockerfile Path: `Dockerfile` (default, already correct)
- Docker Build Target:
  - `web` service → `runner`
  - `worker` service → `worker`

This matches the two named stages already in the Dockerfile — no image
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
have to paste `DATABASE_URL`/`REDIS_URL` twice — set them once there and
reference them from both services.

## 4. Networking

- **web**: Settings → Networking → Generate Domain (or attach your own
  custom domain). This is the URL `NEXTAUTH_URL`/`NEXT_PUBLIC_APP_URL`
  must match exactly, including `https://`.
- **worker**: no public networking needed at all — it doesn't listen on a
  port. Leave networking off for this service.

## 5. Database migrations

The `runner`/`worker` Docker stages intentionally ship a minimal image —
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
Actions secret (Settings → Secrets and variables → Actions), then enable
the commented-out `migrate-production` job in `.github/workflows/ci.yml`
(see the comment there) — it runs `prisma migrate deploy` against
production automatically on every push to `main`, ahead of Railway's own
auto-deploy picking up the same commit.

## Alternative: HostPinnacle shared hosting (cPanel, Node.js App)

Confirmed with HostPinnacle support directly (not guessed): Node.js 22
supported, SSH available on request, cron jobs supported. **Not**
supported on shared plans, confirmed directly by their support after
hands-on testing: outbound PostgreSQL connections at all (both port
5432 and 6543 are refused -- a blanket policy on shared hosting, not a
per-account restriction), a second persistent process, or Redis. This
app has been engineered to not strictly need the last two -- see
below. The database restriction needed an actual architecture change,
covered here.

### 0. Database: Neon instead of Supabase, via the serverless driver

Raw Postgres is blocked outbound on shared hosting, full stop -- no
support ticket fixes that, it's policy. The app now uses Neon's
serverless driver adapter (`src/lib/prisma.ts`) instead of a raw TCP
connection: it queries the database over WSS (WebSocket Secure), which
rides the same port 443 as ordinary HTTPS traffic, so it gets through
where a raw Postgres connection can't.

1. Create a free project at [neon.tech](https://neon.tech)
2. Neon dashboard → **Connect** → copy both:
   - The **pooled** connection string (has `-pooler` in the hostname)
     → this is your `DATABASE_URL`
   - The **direct** connection string (no `-pooler`) → this is your
     `DIRECT_URL`
3. **Important limitation, not obvious from the code alone:**
   `prisma migrate deploy` always uses a raw, direct TCP connection for
   schema operations -- that's a Prisma CLI limitation, the driver
   adapter above only changes how the *running app* queries data, not
   how migrations run. This means **migrations can never run from the
   HostPinnacle server itself** -- run `npx prisma migrate deploy`
   from your own machine instead (pointed at Neon's `DIRECT_URL`), or
   from GitHub Actions (see the deploy pipeline below). Do this once,
   from your local machine, before the app on HostPinnacle can serve
   any real data:
   ```powershell
   $env:DATABASE_URL = "<Neon pooled connection string>"
   $env:DIRECT_URL = "<Neon direct connection string>"
   npx prisma migrate deploy
   ```

### 1. Request SSH access

Ask HostPinnacle support to enable SSH/terminal access for your
package (confirmed available on request, not on by default).

### 2. Set up the Node.js app in cPanel

cPanel → Software → **Setup Node.js App** → Create Application:
- Node.js version: **22**
- Application root: e.g. `architect-hub`
- Application URL: your domain
- **Application startup file: `server.js`** -- cPanel's Node.js
  Selector runs a literal `.js` file via `node`, not an npm script like
  `next start`. `server.js` at the repo root exists specifically for
  this -- see the comment in that file for why.

### 3. Environment variables

Set these via cPanel's Node.js App interface (or a `.env` file in the
application root, per their support's answer):

```
DATABASE_URL=<Neon POOLED connection string>
DIRECT_URL=<Neon DIRECT connection string -- unused at runtime on this
            host specifically, since migrations can't run here, but
            still required by schema.prisma>
AUTH_SECRET=<generate as in step 3 of the Railway section above>
NEXTAUTH_URL=https://your-domain
NEXT_PUBLIC_APP_URL=https://your-domain
DISABLE_STANDALONE_BUILD=true
CRON_SECRET=<generate the same way as AUTH_SECRET>
AWS_REGION / AWS_S3_BUCKET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
RESEND_API_KEY / RESEND_FROM_EMAIL
NODE_ENV=production
```

**Deliberately omit `REDIS_URL`.** Leaving it unset is the intended
configuration for this path, not a workaround -- every Redis-dependent
feature already degrades gracefully without it (see
`src/lib/notifications.ts` and `src/lib/redis.ts`): transactional
emails (assignment, upload, comment, payment) send directly within the
request regardless, and scheduled reminders run via the cron endpoint
below instead of the BullMQ-backed worker. The only real loss is a
retry safety net if Resend has a transient failure sending one of those
transactional emails -- acceptable at small scale, revisit if that
becomes a real problem.

### 4. Build and start

Via the SSH access from step 1, **clone the repo directly** (rather
than uploading a zip) -- this is what makes automated deploys possible
later, since `git pull` needs a real git checkout to work against:

```bash
git clone https://github.com/Gloria0903/Architect-Hub.git architect-hub
cd architect-hub
# create your .env file here with the variables from step 3
npm install
npx prisma generate
npm run build
```
Note: no `npx prisma migrate deploy` here -- that already ran from
your local machine in step 0, and can't run from this server anyway
(the same blocked-TCP-port limitation applies to migrations run from
here as to the app's old direct connection). Then start the app from
cPanel's Node.js App interface (it manages the running process for
you from here).

### 5. Scheduled reminders via cron

cPanel → **Cron Jobs** → add a job (once daily is enough) running:
```bash

curl "https://your-domain/api/cron/reminders?secret=<CRON_SECRET>"
```

### 6. Automating deploys (push to GitHub → it updates live)

Unlike Vercel/Railway, cPanel has no native "watch my GitHub repo"
integration -- without this section, every code change means SSHing in
and manually running `git pull` + rebuild + restart yourself, every
time. `.github/workflows/ci.yml` already has a commented-out
`deploy-hostpinnacle` job that automates exactly that, gated on your
existing tests passing first (same "only deploy if CI is green"
principle as the Railway path). Two **separate** SSH key pairs are
involved here -- easy to mix up, so the distinction is worth being
explicit about:

**Key pair 1 — lets your SERVER pull from GitHub** (needed regardless
of whether you automate deploys, since even a manual `git pull` needs
this):
1. On the server (via SSH): `ssh-keygen -t ed25519 -C "hostpinnacle-deploy"`
   (accept the default file location, no passphrase needed for this use)
2. `cat ~/.ssh/id_ed25519.pub` and copy the output
3. GitHub → your repo → Settings → **Deploy keys** → Add deploy key →
   paste it, read-only access is enough

**Key pair 2 — lets GITHUB ACTIONS reach your SERVER** (only needed if
you want the automated push-to-deploy pipeline, not for manual deploys):
1. On your own machine (not the server): generate a fresh key pair,
   e.g. `ssh-keygen -t ed25519 -f hostpinnacle_deploy_key -C "github-actions"`
2. Add the **public** half (`hostpinnacle_deploy_key.pub`) to the
   server via cPanel's **SSH Access** tool → Manage SSH Keys → Import Key
3. Add the **private** half (`hostpinnacle_deploy_key`, the whole file
   contents) as a GitHub repo secret named `HOSTPINNACLE_SSH_KEY`
   (Settings → Secrets and variables → Actions)
4. Also add `HOSTPINNACLE_SSH_HOST`, `HOSTPINNACLE_SSH_USER`, and
   `HOSTPINNACLE_APP_PATH` (the directory name from step 4 above, e.g.
   `architect-hub`) as secrets the same way
5. Uncomment the `deploy-hostpinnacle` job in `.github/workflows/ci.yml`

After this, every push to `main` that passes tests automatically pulls
the new code, reinstalls dependencies, applies any new migrations,
rebuilds, and restarts the app -- the same experience you already have
on Vercel/Railway, just built rather than provided by the platform.

### 7. Migrating to VPS later

When you outgrow this: `DATABASE_URL`/`DIRECT_URL` (Supabase),
`RESEND_API_KEY`, and every other env var above carry over unchanged.
On a VPS you'd additionally set `REDIS_URL` (restoring the full
worker-backed retry safety net) and run the real persistent worker
(`npm run worker`) instead of the cron endpoint -- nothing about the
app itself needs to change, only where and how it's deployed.

## Alternative: shared hosting with a Node.js app runner (general)

This path exists for hosting that runs a single managed Node.js process
per app slot, with no way to also run a second always-on background
worker -- common on shared hosting control panels (DirectAdmin's
"Node.js Selector", cPanel's equivalent). Confirm with your host first
that Node.js 22 is supported and you get real SSH access -- see the
verification checklist you already have for exactly what to ask.

Differences from the Railway path above:

1. **Set `DISABLE_STANDALONE_BUILD=true`** in the environment before
   building. Standalone output's `server.js` needs the static assets
   and `public/` folder manually copied alongside it (the Dockerfile
   does this with explicit `COPY` steps) -- most managed Node.js
   hosting panels have no way to do that copy step, so a plain
   `next build` + `next start` is simpler and is what this variable
   switches to.

2. **No second worker process.** Instead:
   - Transactional emails (assignment, upload, comment, payment) work
     with zero extra setup either way -- they send directly within the
     request, see `src/lib/notifications.ts`.
   - Scheduled reminders (deadline approaching, missing daily reports)
     need `/api/cron/reminders` hit periodically by an external cron
     service instead of the persistent worker in
     `src/jobs/reminders-worker.ts`. Set `CRON_SECRET` (see
     `.env.example`), then point your host's cron job feature (or an
     external free service like cron-job.org if the host's own cron
     can't make outbound HTTPS requests) at:
     ```
     https://<your-domain>/api/cron/reminders?secret=<CRON_SECRET>
     ```
     Once daily is enough (the checks are safe to call more than once
     without double-notifying, but there's no need to call more often
     than the conditions they check actually change).

     **If you're staying on Vercel instead of moving hosts**: this same
     endpoint is the answer there too. `vercel.json` in this repo
     already configures Vercel's own native Cron Jobs to call it daily
     — just set `CRON_SECRET` as an environment variable in the Vercel
     dashboard and Vercel handles the rest automatically (it sends the
     secret as a standard `Authorization: Bearer` header with zero
     extra config). No external cron service needed on Vercel
     specifically.

3. **Build and start commands** are the same either way --
   `npm run build` then `npm start` (which is `next start`, already
   reads the `PORT` your host assigns automatically). No custom server
   file needed for this path.

4. **Database and Redis** are unchanged -- same Supabase and Upstash
   setup as the Railway path, since those are separate services
   regardless of where the app itself runs.

## 6. What "done" looks like

- `https://<your-domain>/api/health` returns `{"status":"ok", ...}` with
  both `database: "connected"` and `redis: "connected"`.
- Logging into the app and submitting a daily log actually sends the
  assignment/notification emails (confirms the worker service is
  running and connected to the same Redis as web -- or, on the shared
  hosting path, confirms Resend is configured correctly, since that
  path doesn't depend on a worker for this specific email type).

## What this guide deliberately doesn't cover

Sentry/error tracking, and anything requiring your actual Railway/AWS/
Upstash account credentials — those need you in the loop; ask Claude to
wire in the code side once you've created the accounts and have keys to
share.
