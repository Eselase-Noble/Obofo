import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  type WAMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { prisma } from '../lib/db';
import { useDbAuthState } from './db-auth-state';
import { buildWatchlist, createMatcher } from '../lib/core/matcher';
import { extractText, numberFromJid } from '../lib/core/message-utils';
import { buildMessageAlert, buildCallAlert } from '../lib/core/templates';
import { deliverAlert } from '../lib/notify';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const waLog = pino({ level: 'silent' });

/** Live sockets keyed by userId. Presence here means "this user's session is running". */
const sockets = new Map<string, WASocket>();
/** Users mid-startup, to avoid double-starting from overlapping ticks. */
const starting = new Set<string>();
/** Group subject cache, shared across users (keyed by group JID). */
const groupNames = new Map<string, string>();

let cachedVersion: [number, number, number] | undefined;
async function waVersion() {
  if (!cachedVersion) cachedVersion = (await fetchLatestBaileysVersion()).version;
  return cachedVersion;
}

async function setSession(userId: string, data: Record<string, unknown>) {
  await prisma.waSession.update({ where: { userId }, data }).catch(() => {});
}

/** Pull the user's current watchlist + channels fresh so edits take effect live. */
async function loadContext(userId: string) {
  const [watchRows, channels] = await Promise.all([
    prisma.watchlistEntry.findMany({ where: { userId } }),
    prisma.alertChannel.findMany({ where: { userId, enabled: true } }),
  ]);
  return { watchlist: buildWatchlist(watchRows), channels };
}

export async function startSession(userId: string): Promise<void> {
  if (sockets.has(userId) || starting.has(userId)) return;
  starting.add(userId);
  try {
    const session = await prisma.waSession.findUnique({ where: { userId } });
    if (!session) return;

    const { state, saveCreds } = await useDbAuthState(userId);
    const sock = makeWASocket({
      version: await waVersion(),
      auth: state,
      logger: waLog,
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });
    sockets.set(userId, sock);

    sock.ev.on('creds.update', saveCreds);

    // Pairing-code linking (alternative to QR), if requested and not yet registered.
    if (session.linkMethod === 'code' && session.phoneNumber && !state.creds.registered) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(session.phoneNumber!.replace(/\D/g, ''));
          await setSession(userId, { pairingCode: code, status: 'linking' });
          log.info({ userId }, 'pairing code issued');
        } catch (err) {
          log.error({ userId, err: (err as Error).message }, 'requestPairingCode failed');
        }
      }, 3000);
    }

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && session.linkMethod !== 'code') {
        await setSession(userId, { qr, status: 'linking' });
      }

      if (connection === 'open') {
        await setSession(userId, { status: 'connected', qr: null, pairingCode: null, linkRequested: false });
        log.info({ userId }, 'session connected');
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
        sockets.delete(userId);

        if (statusCode === DisconnectReason.loggedOut) {
          // Wipe creds so the next link starts clean.
          await setSession(userId, { status: 'logged_out', creds: undefined, keys: undefined, qr: null, pairingCode: null });
          log.warn({ userId }, 'session logged out');
          return;
        }
        // Transient drop — reconnect shortly.
        log.warn({ userId, statusCode }, 'session closed, reconnecting');
        setTimeout(() => void startSession(userId), 2500);
      }
    });

    const resolveGroupName = async (jid: string) => {
      if (!jid.endsWith('@g.us')) return undefined;
      if (groupNames.has(jid)) return groupNames.get(jid);
      try {
        const meta = await sock.groupMetadata(jid);
        if (meta?.subject) groupNames.set(jid, meta.subject);
        return meta?.subject;
      } catch {
        return undefined;
      }
    };

    const resolvePnJid = async (jid: string | null | undefined) => {
      if (!jid || !jid.endsWith('@lid')) return undefined;
      try {
        const repo = (sock as unknown as {
          signalRepository?: { lidMapping?: { getPNForLID?: (l: string) => Promise<string | null> } };
        }).signalRepository;
        return (await repo?.lidMapping?.getPNForLID?.(jid)) || undefined;
      } catch {
        return undefined;
      }
    };

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe || !msg.message) continue;
        try {
          await handleMessage(userId, msg, resolveGroupName, resolvePnJid);
        } catch (err) {
          log.error({ userId, err: (err as Error).message }, 'handleMessage failed');
        }
      }
    });

    sock.ev.on('call', async (calls) => {
      for (const call of calls) {
        if (call.status !== 'offer') continue;
        try {
          await handleCall(userId, call, resolveGroupName, resolvePnJid);
        } catch (err) {
          log.error({ userId, err: (err as Error).message }, 'handleCall failed');
        }
      }
    });
  } finally {
    starting.delete(userId);
  }
}

async function handleMessage(
  userId: string,
  msg: WAMessage,
  resolveGroupName: (jid: string) => Promise<string | undefined>,
  resolvePnJid: (jid: string | null | undefined) => Promise<string | undefined>,
) {
  const chatJid = msg.key.remoteJid;
  if (!chatJid) return;
  const isGroup = chatJid.endsWith('@g.us');

  const rawSender = msg.key.participant || chatJid;
  const senderPn =
    msg.key.participantAlt ||
    (!isGroup ? msg.key.remoteJidAlt : undefined) ||
    (await resolvePnJid(rawSender)) ||
    rawSender;
  const effectiveChatJid = isGroup ? chatJid : senderPn;

  const { watchlist, channels } = await loadContext(userId);
  const matcher = createMatcher(watchlist, resolveGroupName);
  const hit = await matcher.match(effectiveChatJid, senderPn, msg.pushName);
  if (!hit) return;

  const preview = extractText(msg.message).slice(0, 200);
  const alert = buildMessageAlert(hit, preview);
  const { delivered, errors } = await deliverAlert(channels, alert);
  log.info({ userId, who: hit.who, delivered, errors }, 'message alert delivered');
}

async function handleCall(
  userId: string,
  call: { from: string; chatId?: string; isVideo?: boolean; isGroup?: boolean },
  resolveGroupName: (jid: string) => Promise<string | undefined>,
  resolvePnJid: (jid: string | null | undefined) => Promise<string | undefined>,
) {
  const fromPn = (await resolvePnJid(call.from)) || call.from;
  const effectiveChatJid = call.isGroup ? call.chatId ?? call.from : fromPn;

  const { watchlist, channels } = await loadContext(userId);
  const matcher = createMatcher(watchlist, resolveGroupName);
  const hit = await matcher.match(effectiveChatJid, fromPn, undefined);
  if (!hit) return;

  const alert = buildCallAlert(hit, Boolean(call.isVideo));
  const { delivered, errors } = await deliverAlert(channels, alert);
  log.info({ userId, who: hit.who, delivered, errors }, 'call alert delivered');
}

export async function stopSession(userId: string): Promise<void> {
  const sock = sockets.get(userId);
  if (!sock) return;
  sockets.delete(userId);
  try {
    sock.end(undefined);
  } catch {
    /* ignore */
  }
}

/**
 * Reconcile running sockets with desired state in the DB. A session should run if the
 * user asked to link (linkRequested) or has previously stored credentials.
 */
export async function reconcile(): Promise<void> {
  const sessions = await prisma.waSession.findMany({
    select: { userId: true, linkRequested: true, creds: true },
  });
  const desired = new Set<string>();
  for (const s of sessions) {
    const want = s.linkRequested || s.creds != null;
    if (want) {
      desired.add(s.userId);
      if (!sockets.has(s.userId)) await startSession(s.userId);
    }
  }
  // Stop sockets whose users no longer want a session.
  for (const userId of sockets.keys()) {
    if (!desired.has(userId)) await stopSession(userId);
  }
}
