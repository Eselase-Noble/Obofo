# Ɔbɔfo

Multi-tenant WhatsApp alerting. Users sign up, link their own WhatsApp (companion
device, like WhatsApp Web), pick which contacts/groups should alert them, and
receive an **email and/or SMS** whenever those contacts message or call — without
opening WhatsApp.

> **Akan for "messenger."** Ɔbɔfo carries word to you when the people you care about reach out.

## Architecture

Two processes share one PostgreSQL database:

- **Web (`next dev` / `next start`)** — sign-up, dashboard, and the *Link WhatsApp*
  flow (QR + pairing code). Writes each user's config to the DB.
- **Worker (`npm run worker`)** — a long-running process that owns one Baileys
  socket per user. It reconciles live sessions with the DB, resolves incoming
  messages/calls against each user's watchlist, and delivers alerts.

```
Browser ──▶ Next.js (web) ──▶ PostgreSQL ◀── Worker ──▶ WhatsApp (per user)
                                   │                        │
                                   └── watchlist, channels ─┘──▶ 📧 Gmail / 📱 Arkesel SMS
```

Key modules:

- `prisma/schema.prisma` — `User`, `WaSession`, `WatchlistEntry`, `AlertChannel`.
- `src/server/session-manager.ts` — multi-session Baileys manager (LID resolution, matching, delivery).
- `src/server/db-auth-state.ts` — Baileys auth store backed by Postgres (per-user).
- `src/lib/core/*` — matcher, templates, message utils (shared alert logic).
- `src/lib/notify.ts` — email (Gmail) + SMS (Arkesel) delivery.
- `src/app/**` — UI pages and API routes.

## Setup

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL + shared Gmail/Arkesel senders
npm run db:migrate        # create tables
```

Run both processes (two terminals):

```bash
npm run dev               # web on http://localhost:3000
npm run worker            # WhatsApp session worker
```

Sign up, open **Link WhatsApp**, scan the QR (or use the pairing code), then add
watched contacts and alert channels.

## Notes

- Uses the unofficial WhatsApp multi-device protocol via Baileys — requires
  Baileys `7.0.0-rc+`.
- Baileys credentials live in the database (`WaSession`), so there is no `auth/` folder.

## Related

The original single-user prototype lives on the **`single-user`** branch
(`git switch single-user`), preserved for reference.
