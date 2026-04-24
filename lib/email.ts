// Transactional email. Uses Resend if RESEND_API_KEY is set, otherwise
// silently no-ops and returns `sent: false` so callers can fall back to
// showing the invite link in-app.
import { Resend } from "resend";

interface SendResult {
  sent: boolean;
  skipped?: "no-api-key" | "same-sender";
  error?: string;
}

export interface EmailAttachment {
  filename: string;
  // Resend accepts either `content` (Buffer/base64) or `path` (URL).
  content: Buffer;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  if (!apiKey) return { sent: false, skipped: "no-api-key" };

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });
    if (error) return { sent: false, error: error.message };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
