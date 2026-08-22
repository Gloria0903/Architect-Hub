# Scaling, Reliability, and Security — Where Architect Hub Actually Stands

Honest status as of this pass, written so you know what's actually solved
versus what still needs a decision from you.

## Crash resilience

- **Error boundaries** (`src/app/error.tsx`, `src/app/global-error.tsx`):
  previously, any unhandled render error took the whole page to a blank
  white screen. Now it shows a calm, branded fallback with a retry
  button — nothing else changed about the underlying error, but a person
  hitting it isn't stuck.
- **Redis failures fail soft**: if `REDIS_URL` is unset or unreachable,
  the app logs one warning and keeps running — email/reminders just
  no-op instead of crashing the process. Already true before this pass;
  confirmed still true.
- **API routes**: spot-checked across documents, logs, staff, and
  settings — consistent try/catch with a real error response, not an
  unhandled rejection. Notification sends specifically use
  `Promise.allSettled` so a failed notification never turns an
  already-saved document/log into a 500 (verified in `api/documents/route.ts`).

## Data & file durability

- **Database**: Supabase Postgres. Supabase takes automatic daily backups
  on paid tiers, with point-in-time recovery on Pro and above — check
  your current plan in the Supabase dashboard (Settings → Backups) and
  upgrade if you're still on Free, which has no PITR. This is a plan
  choice on their side, not something to configure in code.
- **Files**: S3 with versioning + encryption already correct in
  `src/lib/s3.ts` (see `docs/INFRASTRUCTURE_SETUP.md`). Turn on S3
  **bucket versioning** in the AWS console if you haven't — protects
  against accidental overwrites/deletes, cheap for the volume this app
  generates.

## Horizontal scaling (running more than one app instance behind a load balancer)

This is the one with the most moving parts, and where this pass made
real fixes:

- **Sessions are already fine.** JWT strategy, not database sessions — no
  sticky-session requirement, any instance can handle any request.
- **Database connections — fixed this pass.** `prisma/schema.prisma` now
  has a separate `directUrl` alongside `url`. Point `DATABASE_URL` at
  Supabase's **pooled** connection (port 6543, pgbouncer transaction
  mode) and `DIRECT_URL` at the **direct** one (port 5432, migrations
  only). Without this, each app instance opens its own connection pool
  straight to Postgres, and a handful of instances can exhaust Supabase's
  connection limit fast — this is one of the most common ways a "works
  fine in testing" app falls over the moment it's actually scaled.
- **In-memory rate limiting and the file-picker guard — known limitation,
  not fixed.** `src/lib/rate-limit.ts` and `src/lib/file-picker-guard.ts`
  both hold state in a plain JS `Map`/variable, scoped to one process.
  Across multiple instances, each instance enforces its own limit
  independently — someone could get `limit × instance count` requests
  instead of `limit`, not zero protection, just weaker than intended.
  **I deliberately did not "fix" this by wiring the rate limiter to
  Redis** — `src/middleware.ts` (where the security-critical IP rate
  limiting lives) has no explicit Node.js runtime declared, which means
  it very likely runs on Next's **Edge runtime**, where `ioredis` (a raw
  TCP client) doesn't work at all. Converting blind risked silently
  breaking rate-limiting on deploy, or crashing middleware outright —
  worse than the current limitation. The correct fix is confirming the
  middleware runtime first (or explicitly forcing
  `export const runtime = "nodejs"` if your Next.js version's stable —
  needs verifying against your exact version) and building a Redis-backed
  limiter deliberately, tested, as its own piece of work. Ask for this
  specifically when you're ready to actually run multiple instances.
- **Static assets**: whatever host you land on (Railway, per
  `docs/DEPLOYMENT.md`) serves Next's static build output efficiently by
  default — nothing extra needed here for a firm-sized user base.

## "Dynamic to changes going on" — notifications, logs, live updates

Current behavior: every mutation (submitting a log, adding a client,
posting a comment, etc.) triggers an immediate refresh **for the person
who did it** — confirmed this is already wired throughout `app-store.tsx`.
Everyone else finds out on the next poll: the dashboard/store polls every
30s, the notification bell separately polls every 30s.

That's "eventually dynamic," not "live." True live updates (someone else's
change appearing on your screen within a second or two) needs a push
mechanism — Server-Sent Events or WebSockets — instead of polling. I
didn't build this in this pass: it's a real feature, not a tweak, and
given the in-memory rate-limiter caveat above, anything push-based has to
be designed with multi-instance fan-out in mind from the start (Redis
pub/sub, which you already have the Redis client for) or it'll have the
same single-instance blind spot. Worth doing properly as its own piece of
work rather than bolted on here.

I also deliberately did **not** just shorten the polling intervals as a
quick "more dynamic" fix — that directly fights the "many users" goal:
tighter polling means more requests per second, multiplied by every
concurrent user, for a marginal responsiveness gain. That's the wrong
tradeoff to make blindly.

## Security — leak audit performed this pass

Checked and clean:
- No sensitive values (passwords, secrets, tokens, API keys) ever logged
- No raw error objects or stack traces returned to the client anywhere in
  `src/app/api`
- No hardcoded credentials/keys anywhere in the repo
- Every API route has a real auth check (`auth()` for staff routes,
  `requireClientSession()` for the client portal — verified both exist
  and are used consistently)
- Password hashes are fetched server-side for `bcrypt.compare()` only,
  never included in a JSON response
- `select` clauses on user-list endpoints are explicit allowlists, not
  broad object dumps — confirmed `mfaSecret`/`password` never appear in
  a `select` block that flows into a response

Nothing new found. The rate-limiter scaling caveat above is the one real
gap, and it's a robustness/availability concern more than a data leak.

## What still needs you specifically

- Supabase backup tier/plan decision
- S3 bucket versioning toggle (2-minute AWS console change)
- When ready to run multiple instances: confirm the middleware runtime,
  then a proper Redis-backed rate limiter
- When ready for live updates: SSE/WebSocket notifications, built with
  multi-instance fan-out from day one
