import pino from 'pino';
import { loadConfig } from './config';
import { createNotifier } from './notifier';
import { createMatcher } from './matcher';
import { createWhatsAppClient, type CallEvent } from './whatsapp';
import { extractText } from './message-utils';
import { buildMessageAlert, buildCallAlert } from './templates';
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
    'Starting Ɔbɔfo',
  );

  const notifier = createNotifier(config, log);
  await notifier.verify(); // fail fast on bad email credentials

  const wa = createWhatsAppClient(log);
  const matcher = createMatcher(config.watchlist, wa.resolveGroupName);
  const isDuplicate = createDeduper(config.dedupeWindowSeconds);

  async function handleMessage(msg: WAMessage): Promise<void> {
    const chatJid = msg.key.remoteJid;
    if (!chatJid) return;
    const isGroup = chatJid.endsWith('@g.us');

    // The person who sent it — but WhatsApp may give a privacy LID (…@lid) that hides
    // the number. Recover the phone-number JID from the alt fields, or the LID mapping.
    const rawSender = msg.key.participant || chatJid;
    const senderPn =
      msg.key.participantAlt ||
      (!isGroup ? msg.key.remoteJidAlt : undefined) ||
      (await wa.resolvePnJid(rawSender)) ||
      rawSender;

    // Match a 1:1 chat by the sender's phone JID; a group still by the group JID.
    const effectiveChatJid = isGroup ? chatJid : senderPn;

    log.debug({ chatJid, rawSender, senderPn, pushName: msg.pushName }, 'incoming message');
    const hit = await matcher.match(effectiveChatJid, senderPn, msg.pushName);
    if (!hit) {
      log.debug({ effectiveChatJid, senderPn }, 'message did not match watchlist — no alert');
      return;
    }

    if (isDuplicate(`msg:${senderPn}`)) {
      log.debug({ who: hit.who }, 'duplicate message alert suppressed');
      return;
    }

    const text = extractText(msg.message);
    const preview = config.includePreview && text ? truncate(text, config.previewMaxChars) : '';

    await notifier.alert(buildMessageAlert(hit, preview));
    log.info({ who: hit.who, reason: hit.reason }, 'message alert dispatched');
  }

  async function handleCall(call: CallEvent): Promise<void> {
    // Recover the caller's phone JID if WhatsApp addressed them by LID.
    const fromPn = (await wa.resolvePnJid(call.from)) || call.from;
    const effectiveChatJid = call.isGroup ? call.chatJid : fromPn;
    const hit = await matcher.match(effectiveChatJid, fromPn, undefined);
    if (!hit) return;

    if (isDuplicate(`call:${fromPn}`)) {
      log.debug({ who: hit.who }, 'duplicate call alert suppressed');
      return;
    }

    await notifier.alert(buildCallAlert(hit, call.isVideo));
    log.info({ who: hit.who, video: call.isVideo }, 'call alert dispatched');
  }

  await wa.start({ onMessage: handleMessage, onCall: handleCall });
}

main().catch((err) => {
  log.error({ err: err?.message ?? err }, 'fatal error, shutting down');
  process.exit(1);
});
