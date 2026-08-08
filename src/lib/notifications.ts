import { prisma } from "@/lib/prisma";
import { enqueueEmail, type EmailJobPayload } from "@/lib/queues/email-queue";

type NotificationType = "INFO" | "WARNING" | "SUCCESS" | "ERROR";

async function dispatch(params: {
  userId: string;
  message: string;
  type: NotificationType;
  buildEmail: (user: { email: string; name: string }) => EmailJobPayload;
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { email: true, name: true, isActive: true },
  });

  // In-app notification always gets written, even for inactive/no-email
  // edge cases — it's cheap, and it keeps the activity trail complete for
  // Take Over Project even if email delivery is skipped.
  await prisma.notification.create({
    data: { userId: params.userId, message: params.message, type: params.type },
  });

  if (!user || !user.isActive || !user.email) return;

  await enqueueEmail(params.buildEmail({ email: user.email, name: user.name }));
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
