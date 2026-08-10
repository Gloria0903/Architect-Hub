import { Resend } from "resend";

let cachedClient: Resend | null = null;
let warnedMissingKey = false;

/**
 * Lazy singleton — deliberately does NOT construct Resend at module load
 * time. The old version called `new Resend(process.env.RESEND_API_KEY)`
 * at the top of the file, which throws synchronously if the key is
 * missing and crashes the entire worker process (including the unrelated
 * reminders worker) on import. This defers that failure to the moment an
 * email actually needs to send, matching the fail-soft pattern already
 * used in lib/redis.ts.
 */
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      // eslint-disable-next-line no-console
      console.warn("[email] RESEND_API_KEY is not set — emails will fail to send.");
    }
    return null;
  }
  if (!cachedClient) {
    cachedClient = new Resend(apiKey);
  }
  return cachedClient;
}

const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL || "Architect Hub <notifications@architecthub.app>";

export async function sendEmail(params: { to: string; subject: string; html: string }) {
  const client = getResendClient();
  if (!client) {
    // Thrown, not swallowed — BullMQ still registers this as a failed job
    // and retries with backoff, same as a real Resend API error would.
    // The notification isn't silently dropped if the key gets unset or
    // rotated badly in production; it just retries until someone fixes it.
    throw new Error("RESEND_API_KEY is not configured — cannot send email.");
  }

  const result = await client.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  return result.data;
}