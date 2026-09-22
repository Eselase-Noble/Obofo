import 'dotenv/config';
import pino from 'pino';
import { reconcile } from './session-manager';

const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: { target: 'pino-pretty', options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' } },
});

const TICK_MS = Number(process.env.WORKER_TICK_MS || 4000);

/**
 * The Ɔbɔfo worker: a long-running process that owns every user's WhatsApp socket.
 * It polls the database on an interval and reconciles running sessions with the
 * users who want one (link requested, or previously linked). Run it alongside the
 * Next.js app: `npm run worker`.
 */
async function main() {
  log.info({ tickMs: TICK_MS }, 'Ɔbɔfo worker starting');
  await reconcile().catch((err) => log.error({ err: err.message }, 'initial reconcile failed'));
  setInterval(() => {
    reconcile().catch((err) => log.error({ err: err.message }, 'reconcile tick failed'));
  }, TICK_MS);
}

main().catch((err) => {
  log.error({ err: err?.message ?? err }, 'worker fatal');
  process.exit(1);
});
