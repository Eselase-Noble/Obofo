import { numberFromJid, normalizeNumber } from './message-utils';

export interface Watchlist {
  numbers: Set<string>;
  groupNames: Set<string>;
  groupJids: Set<string>;
  labels: Record<string, string>;
}

/** A single WhatsApp watchlist row as stored in the DB. */
export interface WatchlistRow {
  type: string; // "number" | "group_name" | "group_jid"
  value: string;
  label?: string | null;
}

/** Turn a user's DB watchlist rows into the fast lookup structure the matcher uses. */
export function buildWatchlist(rows: WatchlistRow[]): Watchlist {
  const wl: Watchlist = {
    numbers: new Set(),
    groupNames: new Set(),
    groupJids: new Set(),
    labels: {},
  };
  for (const row of rows) {
    if (row.type === 'number') {
      const n = normalizeNumber(row.value);
      if (!n) continue;
      wl.numbers.add(n);
      if (row.label) wl.labels[n] = row.label;
    } else if (row.type === 'group_jid') {
      wl.groupJids.add(row.value);
    } else if (row.type === 'group_name') {
      wl.groupNames.add(row.value.trim().toLowerCase());
    }
  }
  return wl;
}

export interface Match {
  who: string;
  number?: string;
  group?: string;
  reason: 'number' | 'group-jid' | 'group-name' | 'group-participant';
}

export type GroupNameResolver = (jid: string) => Promise<string | undefined>;

/** Decides whether an incoming event concerns someone on this user's watchlist. */
export function createMatcher(watchlist: Watchlist, resolveGroupName: GroupNameResolver) {
  async function match(
    chatJid: string,
    senderJid: string | null | undefined,
    pushName?: string | null,
  ): Promise<Match | null> {
    const isGroup = chatJid.endsWith('@g.us');

    if (!isGroup) {
      const number = numberFromJid(chatJid);
      if (!watchlist.numbers.has(number)) return null;
      return { who: watchlist.labels[number] || pushName || `+${number}`, number, reason: 'number' };
    }

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
