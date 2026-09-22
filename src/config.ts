import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Watchlist {
  /** Normalized (digits-only) phone numbers we care about. */
  numbers: Set<string>;
  /** Lower-cased group subjects to match against. */
  groupNames: Set<string>;
  /** Fully-qualified group JIDs (…@g.us) to match directly. */
  groupJids: Set<string>;
  /** Optional friendly names, keyed by normalized number. */
  labels: Record<string, string>;
}

export interface EmailConfig {
  enabled: boolean;
  user?: string;
  appPassword: string;
  to: string[];
}

export interface SmsConfig {
  enabled: boolean;
  accountSid?: string;
  authToken?: string;
  from?: string;
  to?: string;
}

export interface Config {
  watchlist: Watchlist;
  watchlistPath: string;
  includePreview: boolean;
  previewMaxChars: number;
  dedupeWindowSeconds: number;
  email: EmailConfig;
  sms: SmsConfig;
}

/**
 * Reduce any phone-number-ish string to bare digits. WhatsApp identifies users
 * by their number without the leading "+", so "+1 (555) 123-4567" and
 * "15551234567" must compare equal.
 */
export function normalizeNumber(input: unknown): string {
  return String(input ?? '').replace(/\D/g, '');
}

/** Parse the loose set of truthy strings people put in env files. */
function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

function loadWatchlist(path: string): Watchlist {
  let raw: string;
  try {
    raw = readFileSync(resolve(path), 'utf8');
  } catch {
    throw new Error(
      `Could not read watchlist at "${path}". Copy watchlist.example.json to watchlist.json and edit it.`,
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Watchlist "${path}" is not valid JSON: ${(err as Error).message}`);
  }

  const rawGroups: string[] = parsed.groups ?? [];

  return {
    numbers: new Set<string>((parsed.numbers ?? []).map(normalizeNumber).filter(Boolean)),
    // A group entry is treated as a JID if it looks like one, otherwise as a subject to match by name.
    groupJids: new Set<string>(rawGroups.filter((g) => String(g).endsWith('@g.us'))),
    groupNames: new Set<string>(
      rawGroups.filter((g) => !String(g).endsWith('@g.us')).map((g) => String(g).trim().toLowerCase()),
    ),
    labels: Object.fromEntries(
      Object.entries<string>(parsed.labels ?? {}).map(([k, v]) => [normalizeNumber(k), String(v)]),
    ),
  };
}

/** Assemble the full runtime configuration from .env + the watchlist file. */
export function loadConfig(): Config {
  const watchlistPath = process.env.WATCHLIST_PATH || './watchlist.json';
  const watchlist = loadWatchlist(watchlistPath);

  const emailEnabled = bool(process.env.EMAIL_ENABLED);
  const smsEnabled = bool(process.env.SMS_ENABLED);

  // Refuse to start silently useless — the whole point is to deliver an alert somewhere.
  if (!emailEnabled && !smsEnabled) {
    throw new Error('Neither EMAIL_ENABLED nor SMS_ENABLED is true — no alert channel is configured.');
  }

  return {
    watchlist,
    watchlistPath,
    includePreview: bool(process.env.INCLUDE_MESSAGE_PREVIEW, true),
    previewMaxChars: Number(process.env.PREVIEW_MAX_CHARS || 200),
    dedupeWindowSeconds: Number(process.env.DEDUPE_WINDOW_SECONDS || 15),
    email: {
      enabled: emailEnabled,
      user: process.env.GMAIL_USER,
      // Google shows the app password in blocks of four; strip the spaces before use.
      appPassword: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, ''),
      to: (process.env.ALERT_EMAIL_TO || process.env.GMAIL_USER || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    },
    sms: {
      enabled: smsEnabled,
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      from: process.env.TWILIO_FROM_NUMBER,
      to: process.env.ALERT_SMS_TO,
    },
  };
}
