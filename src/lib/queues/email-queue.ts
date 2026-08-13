import { Queue } from "bullmq";
import { redis, redisConfigured } from "@/lib/redis";

export const EMAIL_QUEUE_NAME = "email";

/**
 * One discriminated union of every email kind the app sends. Adding a new
 * notification type means adding one variant here and one case in the
 * worker's template switch — the compiler catches anywhere you forgot to
 * handle it.
 */
export type EmailJobPayload =
  | {
      kind: "PROJECT_ASSIGNED";
      to: string;
      recipientName: string;
      projectName: string;
      projectId: string;
      assignedRole: "ARCHITECT" | "SUPERVISOR";
      assignedBy: string;
    }

  | {
      kind: "PASSWORD_RESET";
      to: string;
      recipientName: string;
      resetUrl: string;
      expiresInMinutes: number;
    }
    
  | {
      kind: "DOCUMENT_UPLOADED";
      to: string;
      recipientName: string;
      projectName: string;
      projectId: string;
      documentName: string;
      uploadedBy: string;
    }
  | {
      kind: "CLIENT_COMMENT";
      to: string;
      recipientName: string;
      projectName: string;
      projectId: string;
      commentPreview: string;
      commentType: "FEEDBACK" | "APPROVAL" | "CHANGE_REQUEST" | "QUERY";
    }
  | {
      kind: "DEADLINE_APPROACHING";
      to: string;
      recipientName: string;
      projectName: string;
      projectId: string;
      dueDate: string; // ISO date
      daysRemaining: number;
    }
  | {
      kind: "MISSING_DAILY_REPORT";
      to: string;
      recipientName: string;
      projectName: string;
      projectId: string;
      date: string; // ISO date, the day that's missing a report
    }
  | {
      kind: "PAYMENT_UPDATE";
      to: string;
      recipientName: string;
      projectName: string;
      projectId: string;
      amount: number;
      outstandingBalance: number;
    };

export const emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 10_000 }, // 10s, 20s, 40s, 80s, 160s
    removeOnComplete: { age: 60 * 60 * 24 * 7 }, // keep 7 days for debugging
    removeOnFail: { age: 60 * 60 * 24 * 30 }, // keep failures 30 days
  },
});

export async function enqueueEmail(payload: EmailJobPayload) {
  if (!redisConfigured) return; // No REDIS_URL set — email delivery is disabled until it is.

  // Never let a queueing failure break the request that triggered it
  // (e.g. creating a project shouldn't 500 because Redis hiccuped).
  try {
    await emailQueue.add(payload.kind, payload);
  } catch (err) {
     
    console.error("[email-queue] failed to enqueue", payload.kind, err);
  }
}
