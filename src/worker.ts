/**
 * Background worker process. Does NOT run inside the Next.js server —
 * Next's serverless/edge-friendly runtime isn't meant to host long-lived
 * connections like a BullMQ Worker. Run this as its own process:
 *
 *   npx tsx src/worker.ts          (dev)
 *   node dist/worker.js            (prod, after build)
 *
 * See docs/NOTIFICATIONS_INTEGRATION.md for the Docker/PM2 setup.
 */
import { startEmailWorker } from "@/workers/email-worker";
import { scheduleReminderJobs, startReminderWorker } from "@/jobs/reminders-worker";

async function main() {
  const emailWorker = startEmailWorker();
  const remindersWorker = startReminderWorker();
  await scheduleReminderJobs();

   
  console.log("[worker] email worker + reminders worker started");

  const shutdown = async () => {
     
    console.log("[worker] shutting down...");
    await Promise.all([emailWorker.close(), remindersWorker.close()]);
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
   
  console.error("[worker] fatal startup error", err);
  process.exit(1);
});
