import type { EmailJobPayload } from "@/lib/queues/email-queue";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Single shared layout so every email looks like it came from the same
 * product. Inline styles only — most email clients strip <style> blocks.
 */
function layout(params: { preheader: string; heading: string; body: string; ctaLabel: string; ctaUrl: string }) {
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <span style="display:none;font-size:1px;color:#f4f4f5;">${params.preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:#18181b;padding:20px 32px;">
                <span style="color:#ffffff;font-size:16px;font-weight:600;letter-spacing:-0.02em;">Architect Hub</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 12px;font-size:18px;color:#18181b;">${params.heading}</h1>
                <div style="font-size:14px;line-height:1.6;color:#3f3f46;">${params.body}</div>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                  <tr>
                    <td style="border-radius:6px;background-color:#18181b;">
                      <a href="${params.ctaUrl}" style="display:inline-block;padding:10px 20px;font-size:14px;font-weight:500;color:#ffffff;text-decoration:none;">${params.ctaLabel}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background-color:#fafafa;">
                <p style="margin:0;font-size:12px;color:#a1a1aa;">
                  You're receiving this because you have notifications enabled in Architect Hub.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}

export function renderEmail(payload: EmailJobPayload): { subject: string; html: string } {
  switch (payload.kind) {
    case "PASSWORD_RESET":
      return {
        subject: "Reset your Architect Hub password",
        html: layout({
          preheader: "Reset your password — link expires soon",
          heading: "Reset your password",
          body: `Hi ${payload.recipientName}, we received a request to reset your password. This link expires in ${payload.expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email.`,
          ctaLabel: "Reset password",
          ctaUrl: payload.resetUrl,
        }),
      };

    case "ACCOUNT_INVITE": {
      const roleLabel =
        payload.role === "ADMIN"
          ? "Admin"
          : payload.role === "SENIOR_ARCHITECT"
            ? "Senior Architect"
            : "Architect";
      return {
        subject: "You've been invited to Architect Hub",
        html: layout({
          preheader: `${payload.invitedBy} invited you to join Architect Hub`,
          heading: "Welcome to Architect Hub",
          body: `Hi ${payload.recipientName},<br/><br/>${payload.invitedBy} has set up an account for you at Architect Hub as a <strong>${roleLabel}</strong>. Click below to set your password and get started — this link expires in ${payload.expiresInMinutes} minutes. If you weren't expecting this, you can safely ignore this email.`,
          ctaLabel: "Set up your account",
          ctaUrl: payload.setupUrl,
        }),
      };
    }

    case "PROJECT_ASSIGNED": {
      const projectUrl = `${APP_URL}/projects/${payload.projectId}`;
      return {
        subject: `You've been assigned to ${payload.projectName}`,
        html: layout({
          preheader: `${payload.assignedBy} assigned you to ${payload.projectName}`,
          heading: "New project assignment",
          body: `Hi ${payload.recipientName},<br/><br/>${payload.assignedBy} assigned you as <strong>${payload.assignedRole === "ARCHITECT" ? "architect" : "supervisor"}</strong> on <strong>${payload.projectName}</strong>.`,
          ctaLabel: "Open project",
          ctaUrl: projectUrl,
        }),
      };
    }

    case "DOCUMENT_UPLOADED": {
      const projectUrl = `${APP_URL}/projects/${payload.projectId}`;
      return {
        subject: `New document on ${payload.projectName}`,
        html: layout({
          preheader: `${payload.uploadedBy} uploaded ${payload.documentName}`,
          heading: "New document uploaded",
          body: `Hi ${payload.recipientName},<br/><br/>${payload.uploadedBy} uploaded <strong>${payload.documentName}</strong> to <strong>${payload.projectName}</strong>.`,
          ctaLabel: "View document",
          ctaUrl: `${projectUrl}?tab=documents`,
        }),
      };
    }

    case "CLIENT_COMMENT": {
      const projectUrl = `${APP_URL}/projects/${payload.projectId}`;
      const typeLabel: Record<typeof payload.commentType, string> = {
        FEEDBACK: "feedback",
        APPROVAL: "an approval",
        CHANGE_REQUEST: "a change request",
        QUERY: "a question",
      };
      return {
        subject: `New client comment on ${payload.projectName}`,
        html: layout({
          preheader: payload.commentPreview,
          heading: "New client communication",
          body: `Hi ${payload.recipientName},<br/><br/>The client left ${typeLabel[payload.commentType]} on <strong>${payload.projectName}</strong>:<br/><br/><em>"${payload.commentPreview}"</em>`,
          ctaLabel: "View project",
          ctaUrl: `${projectUrl}?tab=comments`,
        }),
      };
    }

    case "DEADLINE_APPROACHING": {
      const projectUrl = `${APP_URL}/projects/${payload.projectId}`;
      return {
        subject: `${payload.projectName} is due in ${payload.daysRemaining} day${payload.daysRemaining === 1 ? "" : "s"}`,
        html: layout({
          preheader: `Due ${new Date(payload.dueDate).toLocaleDateString()}`,
          heading: "Deadline approaching",
          body: `Hi ${payload.recipientName},<br/><br/><strong>${payload.projectName}</strong> is due on <strong>${new Date(payload.dueDate).toLocaleDateString()}</strong> — that's ${payload.daysRemaining} day${payload.daysRemaining === 1 ? "" : "s"} away.`,
          ctaLabel: "Review progress",
          ctaUrl: projectUrl,
        }),
      };
    }

    case "MISSING_DAILY_REPORT": {
      const projectUrl = `${APP_URL}/projects/${payload.projectId}`;
      return {
        subject: `Missing daily report — ${payload.projectName}`,
        html: layout({
          preheader: `No report submitted for ${new Date(payload.date).toLocaleDateString()}`,
          heading: "Daily report reminder",
          body: `Hi ${payload.recipientName},<br/><br/>You haven't submitted a daily report for <strong>${payload.projectName}</strong> on <strong>${new Date(payload.date).toLocaleDateString()}</strong> yet. Please log today's progress before end of day.`,
          ctaLabel: "Submit report",
          ctaUrl: `${projectUrl}?tab=logs`,
        }),
      };
    }

    case "PAYMENT_UPDATE": {
      const projectUrl = `${APP_URL}/projects/${payload.projectId}`;
      return {
        subject: `Payment recorded on ${payload.projectName}`,
        html: layout({
          preheader: `A payment of ${payload.amount} was recorded`,
          heading: "Payment recorded",
          body: `Hi ${payload.recipientName},<br/><br/>A payment of <strong>${payload.amount.toLocaleString()}</strong> was recorded on <strong>${payload.projectName}</strong>.<br/>Outstanding balance: <strong>${payload.outstandingBalance.toLocaleString()}</strong>.`,
          ctaLabel: "View finance",
          ctaUrl: `${projectUrl}?tab=finance`,
        }),
      };
    }
  }
}