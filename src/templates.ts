import type { Match } from './matcher';

/** One alert, rendered for every channel: email (rich + plain) and SMS. */
export interface Alert {
  subject: string;
  /** Plain-text email body (fallback for clients that don't render HTML). */
  text: string;
  /** Rich HTML email body. */
  html: string;
  /** Short single-message SMS body. */
  sms: string;
}

const BRAND = 'Ɔbɔfo';

/** Escape user-controlled text (sender names, message previews) before HTML embedding. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function longDate(when: Date): string {
  return when.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function shortTime(when: Date): string {
  return when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Wraps the alert-specific content in a responsive, email-client-safe shell
 * (table layout + inline styles — the only thing Gmail/Outlook reliably honour).
 */
function shell(opts: {
  subject: string;
  preheader: string;
  eyebrow: string;
  eyebrowBg: string;
  eyebrowColor: string;
  headlineHtml: string;
  bodyHtml: string;
  who: string;
  when: Date;
}): string {
  const { subject, preheader, eyebrow, eyebrowBg, eyebrowColor, headlineHtml, bodyHtml, who, when } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#eef0f3;-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f3;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.08);">
        <tr><td style="background:linear-gradient(135deg,#128C7E,#075E54);padding:22px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">${BRAND}</td>
            <td align="right" style="font-size:12px;color:rgba(255,255,255,0.82);">WhatsApp alerts</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px 32px 8px;">
          <span style="display:inline-block;background:${eyebrowBg};color:${eyebrowColor};font-size:11px;font-weight:700;padding:6px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:0.6px;">${escapeHtml(eyebrow)}</span>
          <h1 style="margin:18px 0 0;font-size:22px;line-height:1.3;color:#0f172a;font-weight:700;">${headlineHtml}</h1>
          ${bodyHtml}
          <div style="margin-top:22px;font-size:13px;color:#64748b;">&#128336;&nbsp;${escapeHtml(longDate(when))}</div>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;">
          <div style="background:#f8fafc;border:1px solid #eef0f3;border-radius:12px;padding:14px 16px;font-size:13px;line-height:1.5;color:#475569;">
            You're receiving this because <strong style="color:#334155;">${escapeHtml(who)}</strong> is on your ${BRAND} watchlist — no need to open WhatsApp.
          </div>
        </td></tr>
        <tr><td style="background:#0b1120;padding:18px 32px;text-align:center;">
          <div style="font-size:12px;color:#94a3b8;line-height:1.5;">Sent by <strong style="color:#e2e8f0;">${BRAND}</strong>, your WhatsApp messenger.</div>
        </td></tr>
      </table>
      <div style="font-size:11px;color:#94a3b8;margin-top:14px;">${BRAND} · WhatsApp message &amp; call alerts</div>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Alert for an incoming WhatsApp message. */
export function buildMessageAlert(hit: Match, preview: string): Alert {
  const when = new Date();
  const who = hit.who;
  const subject = `📱 WhatsApp message from ${who}`;

  const previewHtml = preview
    ? `<div style="margin-top:20px;border-left:4px solid #128C7E;background:#f0fdf9;border-radius:0 10px 10px 0;padding:14px 18px;font-size:15px;line-height:1.55;color:#134e4a;">${escapeHtml(preview)}</div>`
    : `<div style="margin-top:20px;font-size:14px;color:#94a3b8;font-style:italic;">Message received (no text preview available).</div>`;

  const html = shell({
    subject,
    preheader: preview || `New WhatsApp message from ${who}`,
    eyebrow: 'New message',
    eyebrowBg: '#dcfce7',
    eyebrowColor: '#166534',
    headlineHtml: `${escapeHtml(who)} messaged you`,
    bodyHtml: previewHtml,
    who,
    when,
  });

  const text = [
    `${BRAND} — WhatsApp alert`,
    ``,
    `${who} messaged you on WhatsApp.`,
    preview ? `\n"${preview}"` : `\n(no text preview available)`,
    ``,
    `Time: ${longDate(when)}`,
    `You're receiving this because ${who} is on your ${BRAND} watchlist.`,
  ].join('\n');

  const smsPreview = preview ? `: "${truncate(preview, 90)}"` : '';
  const sms = `${BRAND} 🔔 WhatsApp from ${who}${smsPreview} — ${shortTime(when)}`;

  return { subject, text, html, sms };
}

/** Alert for an incoming WhatsApp call. */
export function buildCallAlert(hit: Match, isVideo: boolean): Alert {
  const when = new Date();
  const who = hit.who;
  const kind = isVideo ? 'video call' : 'voice call';
  const icon = isVideo ? '📹' : '📞';
  const subject = `${icon} WhatsApp ${kind} from ${who}`;

  const bodyHtml = `<div style="margin-top:20px;border-left:4px solid #4f46e5;background:#eef2ff;border-radius:0 10px 10px 0;padding:14px 18px;font-size:15px;line-height:1.55;color:#3730a3;">${icon}&nbsp; Incoming ${escapeHtml(kind)} — ${escapeHtml(who)} is calling you right now.</div>`;

  const html = shell({
    subject,
    preheader: `${who} is ${kind === 'video call' ? 'video-' : ''}calling you on WhatsApp`,
    eyebrow: 'Incoming call',
    eyebrowBg: '#e0e7ff',
    eyebrowColor: '#3730a3',
    headlineHtml: `${escapeHtml(who)} is calling you`,
    bodyHtml,
    who,
    when,
  });

  const text = [
    `${BRAND} — WhatsApp alert`,
    ``,
    `${who} is ${kind === 'video call' ? 'video-' : ''}calling you on WhatsApp (${kind}).`,
    ``,
    `Time: ${longDate(when)}`,
    `You're receiving this because ${who} is on your ${BRAND} watchlist.`,
  ].join('\n');

  const sms = `${BRAND} ${icon} WhatsApp ${kind} from ${who} — ${shortTime(when)}`;

  return { subject, text, html, sms };
}
