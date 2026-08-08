# Provisioning Redis and S3 for Architect Hub

Neither is required to run the app — everything works today without them.
Documents fall back to local-disk storage (`uploads/`, now validated and
git-ignored), and notifications stay in-app-only. Set these up whenever
you're ready to move off local storage and turn on email delivery.

## S3 (required for real document storage — you already know this stack)

1. Create a bucket, e.g. `architect-hub-documents-prod`. Block all public
   access — every file access goes through a short-lived presigned URL
   (`src/lib/s3.ts`), never a public bucket URL.
2. Enable default encryption (SSE-S3 is fine — `src/lib/s3.ts` already sets
   `ServerSideEncryption: "AES256"` on every upload).
3. CORS config on the bucket, so the browser can PUT directly to S3 via the
   presigned URL:
   ```json
   [
     {
       "AllowedOrigins": ["https://yourdomain.com", "http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
4. IAM: create a dedicated user/role scoped to just this bucket —
   `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on
   `arn:aws:s3:::architect-hub-documents-prod/*`. Don't reuse a broad admin
   key. If you're deploying to AWS infra (ECS/EC2), skip the access
   key/secret entirely and attach an IAM role instead — `src/lib/s3.ts`
   already falls back to the default credential provider chain when
   `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` aren't set.
5. Env vars:
   ```
   AWS_REGION="af-south-1"          # or wherever your bucket lives
   AWS_S3_BUCKET="architect-hub-documents-prod"
   AWS_ACCESS_KEY_ID="..."          # omit if using an IAM role instead
   AWS_SECRET_ACCESS_KEY="..."      # omit if using an IAM role instead
   ```

Once these are set, wire the presigned-upload flow into the documents UI
(the routes exist server-side; the client components need to be (re)built
to match this app's design system the way I already did for the
notification bell — that's the next piece of work, not yet done).

## Redis (required for email delivery + reminder jobs)

You don't need to run your own Redis server. **Upstash** is the path of
least resistance — serverless Redis, free tier is enough for this, and it
speaks the real Redis protocol (unlike some "REST-only" alternatives),
so `ioredis`/BullMQ work against it unmodified.

1. Create a database at upstash.com — pick a region close to wherever
   you'll deploy the Next.js app (latency matters more than proximity to
   your users here).
2. Copy the **Redis URL** (the `rediss://...` TCP connection string, not
   the REST API URL — BullMQ needs the TCP protocol).
3. Env var:
   ```
   REDIS_URL="rediss://default:xxxxx@your-db.upstash.io:6379"
   ```

If you'd rather self-host: `docker run -d -p 6379:6379 redis:7-alpine`
locally, or a managed Redis on AWS (ElastiCache) in production — same env
var either way, just point it at the right host.

## Resend (required for the actual email sends)

1. Sign up at resend.com, verify a sending domain (not just an email
   address — DNS records, takes a few minutes to propagate).
2. Env vars:
   ```
   RESEND_API_KEY="re_..."
   RESEND_FROM_EMAIL="Architect Hub <notifications@yourdomain.com>"
   ```
   The from-address domain must match the one you verified, or Resend
   silently rejects the send.

## Running the worker

Once Redis is set, the background worker (email sending + daily/weekly
reminder jobs) runs as its **own process**, separate from `next dev` /
`next start`:

```bash
npm run worker          # starts src/worker.ts
```

In production this needs to be a long-lived process (its own container, a
PM2-managed process, whatever your deploy target supports) — it cannot be
bundled into a serverless/edge Next.js deployment, since those don't host
persistent connections.

## What happens if you deploy without any of this set

Nothing breaks. `redis.ts` won't crash the app if Redis is unreachable —
it logs one warning and email/reminders silently no-op. Documents keep
using local disk. This is intentionally safe to leave unconfigured for as
long as you need.
