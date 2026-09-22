import pino from 'pino';
import { loadConfig } from './config';
import { createNotifier, type Alert } from './notifier';
import { createMatcher, type Match } from './matcher';
import { createWhatsAppClient, type CallEvent } from './whatsapp';
import { extractText } from './message-utils';
import type { WAMessage } from '@whiskeysockets/baileys';

const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: { target: 'pino-pretty', options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' } },
});

/**
 * Simple time-based de-duplication. WhatsApp can deliver the same event twice on
 * reconnect, and rapid-fire messages from one person shouldn't each buzz your
 * phone. We suppress repeats from the same key within a short window.
 */
function createDeduper(windowSeconds: number) {
  const lastSeen = new Map<string, number>();
  return function isDuplicate(key: string): boolean {
    const now = Date.now();
    const previous = lastSeen.get(key);
    lastSeen.set(key, now);
    return previous !== undefined && now - previous < windowSeconds * 1000;
  };
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function main(): Promise<void> {
  const config = loadConfig();
  log.info(
    {
      numbers: config.watchlist.numbers.size,
      groups: config.watchlist.groupNames.size + config.watchlist.groupJids.size,
      email: config.email.enabled,
      sms: config.sms.enabled,
    },
    'Starting WhatsApp Watchdog',
  );

  const notifier = createNotifier(config, log);
  await notifier.verify(); // fail fast on bad email credentials

  const wa = createWhatsAppClient(log);
  const matcher = createMatcher(config.watchlist, wa.resolveGroupName);
  const isDuplicate = createDeduper(config.dedupeWindowSeconds);

  async function handleMessage(msg: WAMessage): Promise<void> {
    const chatJid = msg.key.remoteJid;
    if (!chatJid) return;

    // In a group the chat JID is the group; the person is in `participant`.
    const senderJid = msg.key.participant || chatJid;
    const hit = await matcher.match(chatJid, senderJid, msg.pushName);
    if (!hit) return;

    if (isDuplicate(`msg:${senderJid}`)) {
      log.debug({ who: hit.who }, 'duplicate message alert suppressed');
      return;
    }

    const text = extractText(msg.message);
    const preview = config.includePreview && text ? truncate(text, config.previewMaxChars) : '';

    await notifier.alert(buildMessageAlert(hit, preview));
    log.info({ who: hit.who, reason: hit.reason }, 'message alert dispatched');
  }

  async function handleCall(call: CallEvent): Promise<void> {
    const hit = await matcher.match(call.chatJid, call.from, undefined);
    if (!hit) return;

    if (isDuplicate(`call:${call.from}`)) {
      log.debug({ who: hit.who }, 'duplicate call alert suppressed');
      return;
    }

    await notifier.alert(buildCallAlert(hit, call.isVideo));
    log.info({ who: hit.who, video: call.isVideo }, 'call alert dispatched');
  }

  await wa.start({ onMessage: handleMessage, onCall: handleCall });
}

function buildMessageAlert(hit: Match, preview: string): Alert {
  const subject = `📱 WhatsApp message from ${hit.who}`;
  const lines = [`${hit.who} just messaged you on WhatsApp.`];
  if (preview) lines.push('', `"${preview}"`);
  lines.push('', `At ${new Date().toLocaleString()}.`);
  return { subject, body: lines.join('\n') };
}

function buildCallAlert(hit: Match, isVideo: boolean): Alert {
  const kind = isVideo ? 'video call' : 'call';
  return {
    subject: `📞 WhatsApp ${kind} from ${hit.who}`,
    body: `${hit.who} is ${kind === 'video call' ? 'video-' : ''}calling you on WhatsApp.\n\nAt ${new Date().toLocaleString()}.`,
  };
}

main().catch((err) => {
  log.error({ err: err?.message ?? err }, 'fatal error, shutting down');
  process.exit(1);
});
