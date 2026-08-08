import { Queue, Worker, type Job } from "bullmq";
import { redis } from "@/lib/redis";
import { checkApproachingDeadlines, checkMissingDailyReports } from "@/jobs/reminder-checks";

const REMINDERS_QUEUE_NAME = "reminders";

type ReminderJobName = "check-deadlines" | "check-missing-reports";

export const remindersQueue = new Queue(REMINDERS_QUEUE_NAME, { connection: redis });

/**
 * Registers the two recurring jobs. BullMQ dedupes repeatable jobs by
 * (name + cron pattern + jobId), so calling this on every worker boot is
 * safe — it won't create duplicate schedules.
 */
export async function scheduleReminderJobs() {
  await remindersQueue.upsertJobScheduler(
    "check-deadlines-daily",
    { pattern: "0 8 * * *" }, // 08:00 server time, every day
    { name: "check-deadlines" satisfies ReminderJobName }
  );

  await remindersQueue.upsertJobScheduler(
    "check-missing-reports-weekdays",
    { pattern: "0 17 * * 1-5" }, // 17:00, Monday–Friday
    { name: "check-missing-reports" satisfies ReminderJobName }
  );
}

export function startReminderWorker() {
  const worker = new Worker(
    REMINDERS_QUEUE_NAME,
    async (job: Job<unknown, unknown, ReminderJobName>) => {
      switch (job.name) {
        case "check-deadlines":
          return checkApproachingDeadlines();
        case "check-missing-reports":
          return checkMissingDailyReports();
        default:
          throw new Error(`Unknown reminder job: ${job.name}`);
      }
    },
    { connection: redis, concurrency: 1 }
  );

  worker.on("completed", (job, result) => {
    // eslint-disable-next-line no-console
    console.log(`[reminders] ${job.name} completed:`, result);
  });

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[reminders] ${job?.name} failed:`, err.message);
  });

  return worker;
}
