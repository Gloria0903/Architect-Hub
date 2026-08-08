# Notifications module — integration guide

## 1. Install dependencies

```bash
npm install bullmq ioredis resend
```

## 2. ShadCN components used

```bash
npx shadcn@latest add popover
```
(`button` and `badge` are already used elsewhere in this bundle.)

## 3. Environment variables

```
REDIS_URL="redis://localhost:6379"
RESEND_API_KEY="re_your_key_here"
RESEND_FROM_EMAIL="Architect Hub <notifications@yourdomain.com>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

`RESEND_FROM_EMAIL` must be on a domain you've verified in Resend's
dashboard — unverified domains get emails silently rejected or land in
spam.

## 4. Run Redis locally

If you don't already have Redis running:

```bash
docker run -d --name architect-hub-redis -p 6379:6379 redis:7-alpine
```

(The full `docker-compose.yml` in Phase F will include this as a service —
this is just for local dev in the meantime.)

## 5. Run the worker process

The worker is **separate from `npm run dev`** — it's a long-lived process,
not a request handler:

```bash
npx tsx src/worker.ts
```

Add a script to `package.json`:

```json
"scripts": {
  "worker": "tsx src/worker.ts",
  "worker:build": "tsc --project tsconfig.worker.json"
}
```

In production you'll run this as its own container/process (covered in
Phase F deployment) — it must not be bundled into the Next.js server
process, since serverless/edge runtimes aren't built to host a persistent
BullMQ connection.

## 6. Wire notifications into existing actions

This is the integration step that actually makes emails go out. Add one
call at each of these points in your existing code:

**Project assignment** — wherever you currently set `architectId`/
`supervisorId` on a project:
```ts
await notifyProjectAssignment({
  userId: newArchitectId,
  projectId: project.id,
  projectName: project.name,
  assignedRole: "ARCHITECT",
  assignedByName: currentUser.name,
});
```

**Document upload** — after the Document row is created (see
`documents/route.ts` in the Documents module bundle), notify the other
people on the project (not the uploader):
```ts
const others = [project.architectId, project.supervisorId].filter(
  (id) => id && id !== session.user.id
);
for (const userId of others) {
  await notifyDocumentUploaded({ userId, projectId, projectName, documentName, uploadedByName });
}
```

**Client comment** — wherever `ClientComment.create` happens, notify the
assigned architect and supervisor:
```ts
await notifyClientComment({ userId, projectId, projectName, commentPreview: content, commentType: type });
```

**Payment recorded** — after `Payment.create`, notify the project's
architect/supervisor with the updated outstanding balance:
```ts
await notifyPaymentUpdate({ userId, projectId, projectName, amount, outstandingBalance });
```

**Deadlines and missing reports** are fully automatic — no call site
needed. They're driven by the scheduled jobs in `src/jobs/`, which run on
their own cron schedule once the worker process is running (08:00 daily
for deadlines, 17:00 weekdays for missing reports).

## 7. Add the bell to your header/nav

```tsx
import { NotificationBell } from "@/components/notifications/notification-bell";

// in your top nav bar:
<NotificationBell />
```

## 8. Production dedup upgrade (worth doing before you scale up staff count)

Right now, `checkApproachingDeadlines` fires once per threshold day (7/3/1/0
days out) — safe against spam, but if the worker restarts mid-day and
re-registers the repeatable job, or if you manually re-run the check, the
same person could get a duplicate email for the same threshold. To close
that gap: add a `lastDeadlineNotifiedAt` (or a small `NotificationLog` join
table keyed on `projectId + userId + thresholdDays`) and check it before
sending. Flagging this now rather than silently shipping it, since it's a
real (if minor) gap — not a placeholder.

## 9. What's enforced

- Every email failure retries 5x with exponential backoff (10s → 160s)
  before landing in the dead-letter set for manual inspection
- A Redis outage never breaks the request that triggered a notification —
  `enqueueEmail` catches and logs rather than throwing
- In-app notifications always get written even if the email fails, so the
  activity trail for Take Over Project stays complete
- `PATCH /api/notifications/[id]` is scoped to `userId` — you cannot mark
  someone else's notification as read by guessing an id
