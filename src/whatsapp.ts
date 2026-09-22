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

  async function connect(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger: waLog,
      // Identify as a desktop companion; keep it stable so WhatsApp doesn't re-prompt.
      browser: Browsers.macOS('WhatsApp Watchdog'),
      // We only observe — no need to broadcast an "online" presence.
      markOnlineOnConnect: false,
      // Groups change subjects rarely; our own cache is enough.
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
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
          // The device was unlinked from the phone; the saved session is now useless.
          appLog.error('Logged out of WhatsApp. Delete the "auth" folder and re-run to pair again.');
          process.exit(1);
        }

        appLog.warn({ statusCode }, 'Connection closed — reconnecting…');
        void connect();
      }
    });

    // Fresh messages arrive with type "notify"; "append" is history/backfill we ignore.
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
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
  };
}
