import { Worker, type Job } from "bullmq";
import { redis } from "@/lib/redis";
import { EMAIL_QUEUE_NAME, type EmailJobPayload } from "@/lib/queues/email-queue";
import { renderEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/resend";

/**
 * Runs as a separate long-lived process from the Next.js server (see
 * src/worker.ts entrypoint + NOTIFICATIONS_INTEGRATION.md for how to deploy
 * it). Concurrency is deliberately conservative — Resend's default rate
 * limit is low enough that blasting requests in parallel just produces 429s
 * that then eat into the retry budget for no benefit.
 */
export function startEmailWorker() {
  const worker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobPayload>) => {
      const { subject, html } = renderEmail(job.data);
      await sendEmail({ to: job.data.to, subject, html });
    },
    {
      connection: redis,
      concurrency: 5,
      limiter: { max: 10, duration: 1000 }, // 10 sends/sec ceiling
    }
  );

  worker.on("completed", (job) => {
     
    console.log(`[email-worker] sent ${job.data.kind} to ${job.data.to}`);
  });

  worker.on("failed", (job, err) => {
     
    console.error(`[email-worker] failed ${job?.data.kind} to ${job?.data.to}:`, err.message);
  });

  return worker;
}
