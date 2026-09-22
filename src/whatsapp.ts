import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WAMessage,
  type WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino, { type Logger } from 'pino';

/** A single incoming call, as surfaced by Baileys' "call" event. */
export interface CallEvent {
  chatJid: string; // caller JID (or group JID for a group call)
  from: string;
  isVideo: boolean;
  isGroup: boolean;
}

export interface WhatsAppHandlers {
  /** Called for each freshly received message (not history-sync backfill). */
  onMessage: (msg: WAMessage) => void | Promise<void>;
  /** Called once per incoming call when it starts ringing. */
  onCall: (call: CallEvent) => void | Promise<void>;
}

/**
 * Owns the WhatsApp (Baileys) connection: authentication, QR pairing, automatic
 * reconnection, and dispatch of message/call events to the supplied handlers.
 *
 * Auth state is persisted under `authDir` so you only scan the QR once; delete
 * that folder to force a fresh pairing.
 */
export function createWhatsAppClient(appLog: Logger, authDir = './auth') {
  // Baileys is chatty; give it its own quiet logger so it doesn't drown our logs.
  const waLog = pino({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' }) as unknown as Logger;

  let sock: WASocket | null = null;
  let handlers: WhatsAppHandlers | null = null;

  // Group subjects rarely change; cache them so we don't refetch on every message.
  const groupNameCache = new Map<string, string>();

  async function resolveGroupName(jid: string): Promise<string | undefined> {
    if (!jid.endsWith('@g.us')) return undefined;
    const cached = groupNameCache.get(jid);
    if (cached) return cached;
    if (!sock) return undefined;
    try {
      const meta = await sock.groupMetadata(jid);
      if (meta?.subject) groupNameCache.set(jid, meta.subject);
      return meta?.subject;
    } catch (err) {
      appLog.warn({ jid, err: (err as Error).message }, 'could not fetch group metadata');
      return undefined;
    }
  }

  // WhatsApp increasingly addresses people by a privacy "LID" (…@lid) that hides the
  // phone number. Turn a LID back into its phone-number JID so the watchlist can match.
  async function resolvePnJid(jid: string | null | undefined): Promise<string | undefined> {
    if (!jid || !jid.endsWith('@lid') || !sock) return undefined;
    try {
      const repo = (sock as unknown as { signalRepository?: { lidMapping?: { getPNForLID?: (l: string) => Promise<string | null> } } })
        .signalRepository;
      const pn = await repo?.lidMapping?.getPNForLID?.(jid);
      return pn || undefined;
    } catch (err) {
      appLog.debug({ jid, err: (err as Error).message }, 'LID→PN resolution failed');
      return undefined;
    }
  }

  async function connect(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger: waLog,
      // Announce as a standard desktop browser — WhatsApp is more reliable linking
      // a recognised client string than a custom device name.
      browser: Browsers.ubuntu('Chrome'),
      // We only observe — no need to broadcast an "online" presence.
      markOnlineOnConnect: false,
      // Groups change subjects rarely; our own cache is enough.
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    // Two ways to link this device (only runs until the account is registered):
    //   LINK_METHOD=qr   → print a rotating QR to scan (default)
    //   LINK_METHOD=code → request an 8-char code to type under
    //                      "Link a Device → Link with phone number instead"
    // The code route is handy when scanning a pasted QR isn't practical.
    const linkMethod = (process.env.LINK_METHOD || 'qr').toLowerCase();

    if (linkMethod === 'code' && !sock.authState.creds.registered) {
      const pairingNumber = (process.env.PAIRING_NUMBER || '').replace(/\D/g, '');
      if (!pairingNumber) {
        appLog.error('LINK_METHOD=code but PAIRING_NUMBER is unset (use full international digits, e.g. 233553851758).');
        process.exit(1);
      }
      // Let the websocket finish opening before asking WhatsApp for a code.
      setTimeout(async () => {
        try {
          const code = await sock!.requestPairingCode(pairingNumber);
          const pretty = code.match(/.{1,4}/g)?.join('-') ?? code;
          appLog.info(
            `Pairing code for +${pairingNumber}: ${pretty} — in WhatsApp: Linked Devices → Link a Device → "Link with phone number instead"`,
          );
        } catch (err) {
          appLog.error({ err: (err as Error).message }, 'failed to request pairing code');
        }
      }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Only draw the QR in QR mode; in code mode we show the pairing code instead.
      if (qr && linkMethod !== 'code') {
        appLog.info('Scan this QR code in WhatsApp → Settings → Linked Devices → Link a Device:');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        appLog.info('Connected to WhatsApp. Watching for messages and calls.');
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (loggedOut) {
          if (!state.creds.registered) {
            // 401 before we ever linked = WhatsApp refused the pairing, almost always
            // the temporary "Can't link new devices right now" rate-limit.
            appLog.error(
              { statusCode },
              'WhatsApp refused to link this device (401). This is the temporary "Can\'t link new devices right now" limit — wait ~30–60 min, update WhatsApp on the phone, then run again.',
            );
          } else {
            // We were linked before; the device has been unlinked from the phone.
            appLog.error({ statusCode }, 'Logged out — device unlinked. Delete the "auth" folder and re-run to pair again.');
          }
          process.exit(1);
        }

        appLog.warn({ statusCode }, 'Connection closed — reconnecting…');
        void connect();
      }
    });

    // Fresh messages arrive with type "notify"; "append" is history/backfill we ignore.
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // Visibility while testing: record every upsert, including its type and senders.
      appLog.debug(
        { type, count: messages.length, jids: messages.map((m) => m.key.remoteJid), fromMe: messages.map((m) => m.key.fromMe) },
        'messages.upsert event',
      );
      if (type !== 'notify' || !handlers) return;
      for (const msg of messages) {
        // Skip our own outgoing messages and empty envelopes.
        if (msg.key.fromMe || !msg.message) continue;
        try {
          await handlers.onMessage(msg);
        } catch (err) {
          appLog.error({ err: (err as Error).message }, 'onMessage handler threw');
        }
      }
    });

    sock.ev.on('call', async (calls) => {
      if (!handlers) return;
      for (const call of calls) {
        // "offer" is the initial ring; later states (accept/reject/timeout) are follow-ups we skip.
        if (call.status !== 'offer') continue;
        try {
          await handlers.onCall({
            chatJid: call.chatId ?? call.from,
            from: call.from,
            isVideo: Boolean(call.isVideo),
            isGroup: Boolean(call.isGroup),
          });
        } catch (err) {
          appLog.error({ err: (err as Error).message }, 'onCall handler threw');
        }
      }
    });
  }

  return {
    /** Register event handlers, then open the connection. */
    async start(h: WhatsAppHandlers): Promise<void> {
      handlers = h;
      await connect();
    },
    resolveGroupName,
    resolvePnJid,
  };
}
