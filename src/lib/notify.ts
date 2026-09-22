import nodemailer, { type Transporter } from 'nodemailer';
import type { Alert } from './core/templates';

const ARKESEL_SEND_URL = 'https://sms.arkesel.com/api/v2/sms/send';

export interface Channel {
  type: string; // "email" | "sms"
  destination: string;
  enabled?: boolean;
}

// The platform's shared senders are configured once via env; recipients are per-user.
let mailer: Transporter | null = null;
function getMailer(): Transporter | null {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  if (!mailer) {
    mailer = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') },
    });
  }
  return mailer;
}

async function sendEmails(to: string[], alert: Alert): Promise<void> {
  const transport = getMailer();
  if (!transport || to.length === 0) return;
  await transport.sendMail({
    from: `"Ɔbɔfo" <${process.env.GMAIL_USER}>`,
    to: to.join(','),
    subject: alert.subject,
    text: alert.text,
    html: alert.html,
  });
}

async function sendSms(to: string[], alert: Alert): Promise<void> {
  if (!process.env.ARKESEL_API_KEY || to.length === 0) return;
  const res = await fetch(ARKESEL_SEND_URL, {
    method: 'POST',
    headers: { 'api-key': process.env.ARKESEL_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: process.env.ARKESEL_SENDER_ID,
      recipients: to,
      message: alert.sms.slice(0, 480),
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
  if (!res.ok || payload.status !== 'success') {
    throw new Error(`Arkesel SMS failed (${res.status}): ${payload.message ?? 'unknown error'}`);
  }
}

/** Deliver one alert to a user's enabled channels. Channel failures are isolated. */
export async function deliverAlert(
  channels: Channel[],
  alert: Alert,
): Promise<{ delivered: number; errors: string[] }> {
  const active = channels.filter((c) => c.enabled !== false && c.destination);
  const emails = active.filter((c) => c.type === 'email').map((c) => c.destination.trim());
  const numbers = active
    .filter((c) => c.type === 'sms')
    .map((c) => c.destination.replace(/\D/g, ''))
    .filter(Boolean);

  const errors: string[] = [];
  const results = await Promise.allSettled([sendEmails(emails, alert), sendSms(numbers, alert)]);
  for (const r of results) if (r.status === 'rejected') errors.push(String((r.reason as Error)?.message ?? r.reason));

  return { delivered: emails.length + numbers.length, errors };
}
