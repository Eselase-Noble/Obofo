/**
 * WhatsApp unlinks a companion device after roughly 14 days if the primary
 * phone never comes online to sync it. We track the last time our socket was
 * actually connected and warn before that window closes.
 *
 * Pure + isomorphic: safe to import in both server routes and client components.
 */
export const LINKED_DEVICE_MAX_OFFLINE_DAYS = 14;
/** Start warning once fewer than this many days remain. */
export const DEVICE_WARN_WITHIN_DAYS = 3;

export type DeviceRiskLevel = 'none' | 'ok' | 'warn' | 'expired';

export interface DeviceRisk {
  level: DeviceRiskLevel;
  /** Whole days since the device last synced, or null if never connected. */
  daysSince: number | null;
  /** Whole days left before the ~14-day auto-unlink, clamped at 0. */
  daysLeft: number | null;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Assess a session's linked-device health.
 * @param status          WaSession.status
 * @param lastConnectedAt when the socket last reached "connected"
 * @param now             injected for testability; defaults to current time
 */
export function deviceRisk(
  status: string,
  lastConnectedAt: Date | string | null | undefined,
  now: Date = new Date(),
): DeviceRisk {
  if (status === 'logged_out') return { level: 'expired', daysSince: null, daysLeft: 0 };
  if (status !== 'connected' || !lastConnectedAt) {
    return { level: 'none', daysSince: null, daysLeft: null };
  }

  const last = typeof lastConnectedAt === 'string' ? new Date(lastConnectedAt) : lastConnectedAt;
  const daysSince = Math.max(0, daysBetween(last, now));
  const daysLeft = Math.max(0, LINKED_DEVICE_MAX_OFFLINE_DAYS - daysSince);

  let level: DeviceRiskLevel = 'ok';
  if (daysLeft <= 0) level = 'expired';
  else if (daysLeft <= DEVICE_WARN_WITHIN_DAYS) level = 'warn';

  return { level, daysSince, daysLeft };
}
