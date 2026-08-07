import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn("[email] RESEND_API_KEY is not set — emails will fail to send.");
}

export const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || "Architect Hub <notifications@architecthub.app>";

export async function sendEmail(params: { to: string; subject: string; html: string }) {
  const result = await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (result.error) {
    // Thrown (not just logged) so BullMQ registers this as a failed job and
    // retries with backoff instead of silently dropping the notification.
    throw new Error(`Resend error: ${result.error.message}`);
  }

  return result.data;
}
