# Ɔbɔfo

**Ɔbɔfo** — Akan (Twi/Fante) for *"messenger"* — gets you an **email and/or SMS**
the moment a specific person or group **messages or calls you on WhatsApp**,
without opening WhatsApp and without WhatsApp notifications turned on.

Like a traditional messenger, Ɔbɔfo links to your WhatsApp as a companion device
(a QR scan, exactly like WhatsApp Web), quietly watches every incoming message
and call, keeps only the ones from contacts on your **watchlist**, and delivers
those to you via Gmail and Arkesel SMS.

---

## How it works

```
WhatsApp (your account)
        │  companion-device link (Baileys)
        ▼
┌─────────────────────┐    match against     ┌──────────────┐
│       Ɔbɔfo         │───  watchlist.json ──▶│  Notifier    │──▶ 📧 Gmail
│    (this project)   │                       │              │──▶ 📱 Arkesel SMS
└─────────────────────┘                       └──────────────┘
```

- **`src/whatsapp.ts`** — owns the Baileys connection: pairing, auto-reconnect, and message/call events.
- **`src/matcher.ts`** — decides whether an event involves someone on your watchlist (by number, group name, or group JID).
- **`src/notifier.ts`** — sends the alert over Gmail email and Arkesel SMS; a failure in one channel never blocks the other.
- **`src/config.ts`** — loads `.env` + `watchlist.json` and normalizes phone numbers.
- **`src/index.ts`** — wires it together, formats alerts, and de-duplicates rapid repeats.

---

## Requirements

- **Node.js 18+**
- A **Gmail** account (for email alerts) and/or an **Arkesel** account (for SMS)
- A machine that stays **on 24/7** — a Raspberry Pi or a small VPS is ideal. On a
  laptop Ɔbɔfo only catches events while the machine is awake and online.

## Setup

```bash
npm install

cp .env.example .env                    # then fill in your credentials
cp watchlist.example.json watchlist.json # then list who to watch
```

### 1. Email alerts (Gmail)

1. Enable **2-Step Verification** on your Google account.
2. Create an **App Password**: <https://myaccount.google.com/apppasswords>
3. Put it in `.env` as `GMAIL_APP_PASSWORD` (a normal password will not work).

### 2. SMS alerts (Arkesel)

1. Create an account at <https://arkesel.com> and top up SMS credit.
2. Copy your **API key** (Dashboard → Settings → API Keys) into `ARKESEL_API_KEY`.
3. Register/approve a **Sender ID** (max 11 chars) and set it as `ARKESEL_SENDER_ID`.
4. Set `ALERT_SMS_TO` to your personal phone number(s).

> Only want one channel? Set `EMAIL_ENABLED=false` or `SMS_ENABLED=false`.

### 3. Choose who to watch — `watchlist.json`

```jsonc
{
  "numbers": ["+233241234567", "+15551234567"], // + / spaces / dashes are ignored
  "groups":  ["Family", "1203630000000000@g.us"], // by name OR by group JID
  "labels":  { "233241234567": "Mum", "15551234567": "Boss" } // nicer alert text
}
```

- **numbers** — full international format. A watched person also triggers an alert when they post in *any* group.
- **groups** — match by the group's exact name (case-insensitive) or by its JID.
- **labels** — optional friendly names so alerts read "Mum" instead of a raw number.

## Run

```bash
npm start
```

On the **first run**, a QR code prints in the terminal. Open WhatsApp on your
phone → **Settings → Linked Devices → Link a Device**, and scan it. The session
is saved under `auth/`, so you only do this once. The linked device keeps
receiving events even when your phone is offline.

Type-check anytime with `npm run typecheck`.

## Run 24/7 (Raspberry Pi / Linux server)

A ready-made systemd unit lives in [`deploy/obofo.service`](deploy/obofo.service):

```bash
sudo cp deploy/obofo.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now obofo
journalctl -u obofo -f   # first run: scan the QR from here
```

`Restart=always` brings it back after crashes and reboots.

---

## Notes & caveats

- **Terms of Service.** This uses WhatsApp's unofficial multi-device protocol
  (via [Baileys](https://github.com/WhiskeySockets/Baileys)). It is not endorsed
  by WhatsApp and, in principle, risks the account being flagged. It is widely
  used for low-volume personal automation; use your own judgement.
- **Secrets.** `.env`, `watchlist.json`, and `auth/` are git-ignored. The `auth/`
  folder is effectively a login to your WhatsApp — keep it private and never commit it.
- **Re-pairing.** If you unlink the device from your phone, delete `auth/` and run again.
