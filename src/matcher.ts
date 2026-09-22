import type { Watchlist } from './config';
import { numberFromJid } from './message-utils';

/** The reason an event matched, used to build a readable alert. */
export interface Match {
  /** Best display name we have: friendly label > pushName > group subject > raw number. */
  who: string;
  /** The watched number, when the trigger was an individual contact. */
  number?: string;
  /** The group subject, when the trigger was a group. */
  group?: string;
  /** Why it matched — handy for logs. */
  reason: 'number' | 'group-jid' | 'group-name' | 'group-participant';
}

/** Resolves a group's subject from its JID; may hit the network, so results are cached upstream. */
export type GroupNameResolver = (jid: string) => Promise<string | undefined>;

/**
 * Decides whether an incoming event concerns someone on the watchlist. Group
 * subject lookups are async because Baileys fetches them from the server, so the
 * whole matcher is async.
 */
export function createMatcher(watchlist: Watchlist, resolveGroupName: GroupNameResolver) {
  /**
   * @param chatJid       Where the message/call lives: a user JID or a "…@g.us" group JID.
   * @param senderJid     The actual person who sent it (equals chatJid for 1:1 chats).
   * @param pushName      The sender's self-set display name, if WhatsApp provided one.
   */
  async function match(
    chatJid: string,
    senderJid: string | null | undefined,
    pushName?: string | null,
  ): Promise<Match | null> {
    const isGroup = chatJid.endsWith('@g.us');

    if (!isGroup) {
      const number = numberFromJid(chatJid);
      if (!watchlist.numbers.has(number)) return null;
      return {
        who: watchlist.labels[number] || pushName || `+${number}`,
        number,
        reason: 'number',
      };
    }

    // Group message: match on JID, on subject, or on a watched member who posted.
    const subject = await resolveGroupName(chatJid);
    const senderNumber = numberFromJid(senderJid);
    const nameHit = subject ? watchlist.groupNames.has(subject.toLowerCase()) : false;

    if (watchlist.groupJids.has(chatJid) || nameHit) {
      const sender = watchlist.labels[senderNumber] || pushName || `+${senderNumber}`;
      return {
        who: `${sender} in "${subject ?? chatJid}"`,
        group: subject ?? chatJid,
        reason: nameHit ? 'group-name' : 'group-jid',
      };
    }

    // Even if the group itself isn't watched, a watched person speaking in it still counts.
    if (watchlist.numbers.has(senderNumber)) {
      const sender = watchlist.labels[senderNumber] || pushName || `+${senderNumber}`;
      return {
        who: `${sender} in "${subject ?? chatJid}"`,
        number: senderNumber,
        group: subject ?? chatJid,
        reason: 'group-participant',
      };
    }

    return null;
  }

  return { match };
}
