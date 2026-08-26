import { prisma } from "@/lib/prisma";
import { enqueueEmail, type EmailJobPayload } from "@/lib/queues/email-queue";
import { renderEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/resend";
import { redisConfigured } from "@/lib/redis";
import { Prisma } from "@prisma/client";

type NotificationType = "INFO" | "WARNING" | "SUCCESS" | "ERROR";

async function dispatch(params: {
  userId: string;
  message: string;
  type: NotificationType;
  dedupeKey?: string;
  buildEmail: (user: { email: string; name: string }) => EmailJobPayload;
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { email: true, name: true, isActive: true },
  });

  // In-app notification always gets written, even for inactive/no-email
  // edge cases — it's cheap, and it keeps the activity trail complete for
  // Take Over Project even if email delivery is skipped.
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        message: params.message,
        type: params.type,
        dedupeKey: params.dedupeKey,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Already sent this exact reminder to this user — worker retry/restart, skip silently.
      return;
    }
    throw e;
  }

  if (!user || !user.isActive || !user.email) return;

  const payload = params.buildEmail({ email: user.email, name: user.name });

  /*
   * Sent directly rather than only enqueued: these are transactional
   * (fired in response to a real user action -- assignment, an upload,
   * etc.), low-volume, and time-sensitive. Relying solely on the BullMQ
   * queue means relying on a persistent worker process, which never
   * runs at all on serverless hosting (Vercel) -- that was the actual
   * reason "assign an architect, they get an email" wasn't working
   * regardless of how correctly the rest of this was wired.
   *
   * Still enqueued too, IF Redis is configured, purely as a retry
   * safety net for a transient Resend failure -- if the direct send
   * below throws, the job sits in the queue for a worker (if one is
   * running, e.g. on Railway) to retry with backoff instead of the
   * notification being lost outright. If Redis isn't configured at
   * all, the direct send is the only delivery path, which is fine --
   * it's synchronous and doesn't depend on anything else running.
   */
  try {
    const { subject, html } = renderEmail(payload);
    await sendEmail({ to: payload.to, subject, html });
  } catch (error) {
    console.error(`Failed to send notification email to ${user.email}:`, error);

    if (redisConfigured) {
      try {
        await enqueueEmail(payload);
      } catch (queueError) {
        console.error("Failed to enqueue fallback email job:", queueError);
      }
    }
  }
}

export async function notifyProjectAssignment(params: {
  userId: string;
  projectId: string;
  projectName: string;
  assignedRole: "ARCHITECT" | "SUPERVISOR";
  assignedByName: string;
}) {
  await dispatch({
    userId: params.userId,
    type: "INFO",
    message: `You were assigned as ${params.assignedRole === "ARCHITECT" ? "architect" : "supervisor"} on ${params.projectName}`,
    buildEmail: (user) => ({
      kind: "PROJECT_ASSIGNED",
      to: user.email,
      recipientName: user.name,
      projectName: params.projectName,
      projectId: params.projectId,
      assignedRole: params.assignedRole,
      assignedBy: params.assignedByName,
    }),
  });
}

export async function notifyDocumentUploaded(params: {
  userId: string;
  projectId: string;
  projectName: string;
  documentName: string;
  uploadedByName: string;
}) {
  await dispatch({
    userId: params.userId,
    type: "INFO",
    message: `${params.uploadedByName} uploaded "${params.documentName}" to ${params.projectName}`,
    buildEmail: (user) => ({
      kind: "DOCUMENT_UPLOADED",
      to: user.email,
      recipientName: user.name,
      projectName: params.projectName,
      projectId: params.projectId,
      documentName: params.documentName,
      uploadedBy: params.uploadedByName,
    }),
  });
}

export async function notifyClientComment(params: {
  userId: string;
  projectId: string;
  projectName: string;
  commentPreview: string;
  commentType: "FEEDBACK" | "APPROVAL" | "CHANGE_REQUEST" | "QUERY";
}) {
  const preview =
    params.commentPreview.length > 140
      ? `${params.commentPreview.slice(0, 140)}...`
      : params.commentPreview;

  await dispatch({
    userId: params.userId,
    type: params.commentType === "CHANGE_REQUEST" ? "WARNING" : "INFO",
    message: `New ${params.commentType.toLowerCase().replace("_", " ")} from client on ${params.projectName}`,
    buildEmail: (user) => ({
      kind: "CLIENT_COMMENT",
      to: user.email,
      recipientName: user.name,
      projectName: params.projectName,
      projectId: params.projectId,
      commentPreview: preview,
      commentType: params.commentType,
    }),
  });
}

export async function notifyDeadlineApproaching(params: {
  userId: string;
  projectId: string;
  projectName: string;
  dueDate: Date;
  daysRemaining: number;
}) {
  await dispatch({
    userId: params.userId,
    type: params.daysRemaining <= 2 ? "WARNING" : "INFO",
    message: `${params.projectName} is due in ${params.daysRemaining} day${params.daysRemaining === 1 ? "" : "s"}`,
    dedupeKey: `deadline:${params.projectId}:${params.daysRemaining}:${params.dueDate.toISOString().slice(0, 10)}`,
    buildEmail: (user) => ({
      kind: "DEADLINE_APPROACHING",
      to: user.email,
      recipientName: user.name,
      projectName: params.projectName,
      projectId: params.projectId,
      dueDate: params.dueDate.toISOString(),
      daysRemaining: params.daysRemaining,
    }),
  });
}

export async function notifyMissingDailyReport(params: {
  userId: string;
  projectId: string;
  projectName: string;
  date: Date;
}) {
  await dispatch({
    userId: params.userId,
    type: "WARNING",
    message: `Missing daily report for ${params.projectName} on ${params.date.toLocaleDateString()}`,
    dedupeKey: `missing-report:${params.projectId}:${params.userId}:${params.date.toISOString().slice(0, 10)}`,
    buildEmail: (user) => ({
      kind: "MISSING_DAILY_REPORT",
      to: user.email,
      recipientName: user.name,
      projectName: params.projectName,
      projectId: params.projectId,
      date: params.date.toISOString(),
    }),
  });
}

export async function notifyPaymentUpdate(params: {
  userId: string;
  projectId: string;
  projectName: string;
  amount: number;
  outstandingBalance: number;
}) {
  await dispatch({
    userId: params.userId,
    type: "SUCCESS",
    message: `Payment of ${params.amount.toLocaleString()} recorded on ${params.projectName}`,
    buildEmail: (user) => ({
      kind: "PAYMENT_UPDATE",
      to: user.email,
      recipientName: user.name,
      projectName: params.projectName,
      projectId: params.projectId,
      amount: params.amount,
      outstandingBalance: params.outstandingBalance,
    }),
  });
}
