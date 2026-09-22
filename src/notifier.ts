import nodemailer, { type Transporter } from 'nodemailer';
import twilio from 'twilio';
import type { Logger } from 'pino';
import type { Config } from './config';

export interface Alert {
  subject: string;
  body: string;
}

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

  let sms: ReturnType<typeof twilio> | null = null;
  if (config.sms.enabled) {
    const { accountSid, authToken, from, to } = config.sms;
    if (!accountSid || !authToken || !from || !to) {
      throw new Error('SMS_ENABLED is true but Twilio SID / token / from / to are incomplete.');
    }
    sms = twilio(accountSid, authToken);
  }

  async function sendEmail({ subject, body }: Alert): Promise<void> {
    if (!mailer) return;
    await mailer.sendMail({
      from: `"WhatsApp Watchdog" <${config.email.user}>`,
      to: config.email.to.join(','),
      subject,
      text: body,
    });
    log.info({ to: config.email.to }, 'email alert sent');
  }

  async function sendSms({ subject, body }: Alert): Promise<void> {
    if (!sms) return;
    await sms.messages.create({
      from: config.sms.from!,
      to: config.sms.to!,
      // Keep it to a couple of SMS segments; the full detail is in the email.
      body: `${subject}\n${body}`.slice(0, 480),
    });
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
    // Twilio offers no free "dry run"; its credentials are validated on the first real send.
  }

  return { alert, verify };
}
