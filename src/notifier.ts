import nodemailer, { type Transporter } from 'nodemailer';
import type { Logger } from 'pino';
import type { Config } from './config';
import type { Alert } from './templates';

/** Arkesel SMS v2 endpoint — Ghanaian SMS gateway. */
const ARKESEL_SEND_URL = 'https://sms.arkesel.com/api/v2/sms/send';

export interface Notifier {
  /** Deliver an alert on every configured channel. Channel failures are isolated. */
  alert(alert: Alert): Promise<void>;
  /** Fail fast at startup if a channel is misconfigured. */
  verify(): Promise<void>;
}

/**
 * Builds a notifier over the configured channels. Email and SMS are independent:
 * a disabled channel is simply absent, and a runtime failure in one never
 * prevents the other from firing.
 */
export function createNotifier(config: Config, log: Logger): Notifier {
  let mailer: Transporter | null = null;
  if (config.email.enabled) {
    if (!config.email.user || !config.email.appPassword || config.email.to.length === 0) {
      throw new Error('EMAIL_ENABLED is true but GMAIL_USER / GMAIL_APP_PASSWORD / ALERT_EMAIL_TO are incomplete.');
    }
    mailer = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.email.user, pass: config.email.appPassword },
    });
  }

  // SMS goes through Arkesel over plain HTTPS, so there's no client object to build —
  // we just validate that the required settings are present up front.
  if (config.sms.enabled) {
    const { apiKey, sender, to } = config.sms;
    if (!apiKey || !sender || to.length === 0) {
      throw new Error('SMS_ENABLED is true but ARKESEL_API_KEY / ARKESEL_SENDER_ID / ALERT_SMS_TO are incomplete.');
    }
  }

  async function sendEmail({ subject, text, html }: Alert): Promise<void> {
    if (!mailer) return;
    await mailer.sendMail({
      from: `"Ɔbɔfo" <${config.email.user}>`,
      to: config.email.to.join(','),
      subject,
      text,
      html,
    });
    log.info({ to: config.email.to }, 'email alert sent');
  }

  async function sendSms({ sms }: Alert): Promise<void> {
    if (!config.sms.enabled) return;

    const res = await fetch(ARKESEL_SEND_URL, {
      method: 'POST',
      headers: {
        'api-key': config.sms.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: config.sms.sender,
        recipients: config.sms.to,
        // Keep it to a couple of SMS segments; the full detail is in the email.
        message: sms.slice(0, 480),
      }),
    });

    // Arkesel returns 200 with a JSON status; treat anything else as a failure.
    const payload = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
    if (!res.ok || payload.status !== 'success') {
      throw new Error(`Arkesel SMS failed (${res.status}): ${payload.message ?? 'unknown error'}`);
    }
    log.info({ to: config.sms.to }, 'sms alert sent');
  }

  async function alert(a: Alert): Promise<void> {
    const results = await Promise.allSettled([sendEmail(a), sendSms(a)]);
    for (const r of results) {
      if (r.status === 'rejected') {
        log.error({ err: (r.reason as Error)?.message ?? r.reason }, 'alert channel failed');
      }
    }
  }

  async function verify(): Promise<void> {
    if (mailer) {
      await mailer.verify();
      log.info('Gmail SMTP connection verified.');
    }
    // Arkesel offers no free "dry run"; the API key is validated on the first real send.
  }

  return { alert, verify };
}
