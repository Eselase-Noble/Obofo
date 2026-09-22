import type { proto } from '@whiskeysockets/baileys';

/**
 * WhatsApp packs message content into one of many mutually-exclusive fields.
 * Collapse whichever one is present into a short human-readable string.
 */
export function extractText(message: proto.IMessage | null | undefined): string {
  if (!message) return '';
  const m = message;

  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage) return m.imageMessage.caption ? `[image] ${m.imageMessage.caption}` : '[image]';
  if (m.videoMessage) return m.videoMessage.caption ? `[video] ${m.videoMessage.caption}` : '[video]';
  if (m.documentMessage) return `[document] ${m.documentMessage.fileName ?? ''}`.trim();
  if (m.audioMessage) return m.audioMessage.ptt ? '[voice note]' : '[audio]';
  if (m.stickerMessage) return '[sticker]';
  if (m.contactMessage || m.contactsArrayMessage) return '[contact card]';
  if (m.locationMessage) return '[location]';
  if (m.reactionMessage) return `[reaction ${m.reactionMessage.text ?? ''}]`.trim();

  const wrapped =
    m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message;
  if (wrapped) return extractText(wrapped);

  return '[message]';
}

/** The bare number from a JID: "15551234567:12@s.whatsapp.net" -> "15551234567". */
export function numberFromJid(jid: string | null | undefined): string {
  if (!jid) return '';
  return jid.split('@')[0]!.split(':')[0]!.replace(/\D/g, '');
}

/** Reduce any phone-number-ish string to bare digits. */
export function normalizeNumber(input: unknown): string {
  return String(input ?? '').replace(/\D/g, '');
}
