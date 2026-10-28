<p align="center">
  <img src="https://files.catbox.moe/l09mf0.png" width="120" alt="SazaBot" />
</p>
<h1 align="center">Saza-Bot Whatsapp</h1>
<p align="center">
  WhatsApp bot powered by <strong>@baileys</strong> — Supports JS + TS, Bun + npm.
  <br/>Just drop a <code>.js</code> or <code>.ts</code> file → auto-loaded. Commands work instantly.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/js-ESM-yellow" />
  <img src="https://img.shields.io/badge/ts-supported-blue" />
  <img src="https://img.shields.io/badge/npm-supported-red" />
  <img src="https://img.shields.io/badge/bun-supported-orange" />
  <img src="https://img.shields.io/badge/session-SQLite-green" />
  <img src="https://img.shields.io/badge/license-MIT-lightgrey" />
</p>

---
[`Versi Bahasa Indonesia`](README_ID.md)

## 📜 What is Saza?

**SAZA (Smart Assistant with Zero-delay Answer)** is a lightweight WhatsApp bot built on a _persistent connection_ and _multi-layer caching_ architecture. Once the initial connection is established, group metadata, identity resolution (LID → phone number), and plugins are cached in memory — so the first response is already fast, and subsequent messages are processed with almost no perceptible delay.

<table align="center">
  <tr>
    <td align="center">
      <img src="assets/ping.jpeg" width="200" alt="SazaBot ping — response speed">
      <br>
      <sub><b>Fast Answer</b></sub>
    </td>
    <td align="center">
      <img src="assets/airich.jpeg" height="200" alt="SazaBot AI Rich">
      <br>
      <sub><b>Meta AI Style</b></sub>
    </td>
  </tr>
</table>

<img src='https://i.imgur.com/LyHic3i.gif' width="100%"/>

## ⚡ Dual Runtime: Bun + npm

This project runs on **Bun** and **Node.js (npm)** with zero code changes. The SQLite backend auto-detects the runtime.

| | Bun | Node.js (npm) |
|---|---|---|
| **Command** | `bun --smol index.js` | `node index.js` |
| **SQLite** | `bun:sqlite` (built-in, no native addon) | `better-sqlite3` (C++ addon) |
| **TS Plugins** | ✅ Native — `.ts` works directly | ⚠️ Requires `tsx` |
| **Base RAM** | ~10-20MB lower (JSC vs V8) | Slightly higher |
| **Startup** | ~500ms | ~2-3 seconds |
| **Hot reload** | `bun --watch index.js` | Use `nodemon` |

```bash
# Node.js (npm | recommended)
npm install
node index.js
node index.js --memlog     # + RAM logging

# Bun
bun install
bun --smol index.js        # --smol = more aggressive GC
bun --smol index.js --memlog  # + RAM logging
```

### CLI Flags

| Flag | Description |
|------|-------------|
| `--smol` | (Bun only) More aggressive GC, lower peak RAM |
| `--memlog` | Show RSS/heap/external memory at startup & after connect |

---

## 📦 Install

### Environment

- **Node.js 18+** (recommended) or **Bun**
- **git** (for cloning)

```bash
git clone <repo-url> sazabot
cd sazabot
npm install          # or: bun install
nano config.json     # fill in owner, bot number, name
node index.js        # or: bun --smol index.js
```

The bot auto-creates the `db/` directory on first startup. Scan the QR code in the terminal (or use a pairing code).

### Switching Runtimes

```bash
# Bun → Node.js (npm)
rm bun.lock && npm install && npm start

# Node.js → Bun
rm package-lock.json && bun install && bun index.js
```

---

## 📖 Documentation

| Document | Description |
|-----|-------------|
| [`docs/eng/creating-plugins.md`](docs/eng/creating-plugins.md) | Complete plugin guide — context reference, sending messages, target resolution, premium integration, before hooks, hot-reload |
| [`docs/eng/airich-builder.md`](docs/eng/airich-builder.md) | **AIRich** — Meta AI-style rich response builder. Text formatting, code blocks with syntax highlighting, tables, images, video, products, reels, suggestions, source citations. Fluent API. |

---

## 📋 Config — `config.json`

Edit `config.json` before the first run. All fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Bot display name |
| `owner` | string | **Yes** | Your WhatsApp number — gets full access to owner commands. No `+`, no spaces (e.g. `6289876543210`) |
| `bot` | string | For pairing | Bot phone number. Used for pairing code + owner detection. |
| `prefix` | string | No | Command prefix, default `.` |
| `status` | string | No | `public` (default) — all chats. `ponly` — private only. `gonly` — groups only. `self` — owner+bot only. |
| `autoread` | string | No | `enable` (default) — auto mark messages as read. `disable` — leave unread. |
| `loginMethod` | string | No | `qr` (default) — scan QR in terminal. `pairs` — 8-digit code in WhatsApp app. |
| `pairscode` | string | No | Custom code for pairing (default `SAZA-SAZA`). Only used when `loginMethod` = `pairs`. |
| `markdown` | boolean | No | `true` (default) — WhatsApp natively renders `*bold*` `_italic_`. |

**Example:**
```json
{
  "name": "MyBot",
  "bot": "6281234567890",
  "owner": "6289876543210",
  "prefix": ".",
  "status": "public",
  "autoread": "enable",
  "loginMethod": "qr",
  "pairscode": "SAZA-SAZA",
  "markdown": true
}
```

### Login Methods

**QR Code** (default):
```
[boot] scan the QR code below:
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▄▄▄▄▄ █ ▀▀▄ ██▄██ ▄▄▄▄▄ █
█ █   █ ███ ▄▄ ▄  █ █   █ █
█ █▄▄▄█ █ ▄▄ █▄▄███ █▄▄▄█ █
█▄▄▄▄▄▄▄█ █ ▀ █▄▀ █▄▄▄▄▄▄▄█
█   ██ ▄█   █▄▄█▀ ▄▄ ▄█▀  █
██▀▀▀██▄▄▄▀█▄▀█ ▄█▄ ▄▄ █▀▄█
██▄▀█▄▄▄ █ █  █▀  ▀ ▄█▄█▄ █
█▄▄ ▀ ▀▄▄▄▄▄  █▄ ▄ █ ▄█▄▀ █
█▄▄▄██▄▄▄▀▄█ ▀██  ▄▄▄  ▀ ▄█
█ ▄▄▄▄▄ █▀▄█▄█▄▀▀ █▄█ ▀▄▀ █
█ █   █ ██  ▀ ██▄▄▄▄  ▄▄ ██
█ █▄▄▄█ █  ▀▄ ▄ █▄▄█▀  █▄▄█
█▄▄▄▄▄▄▄█▄▄▄▄████▄▄▄██▄██▄█
...
```
WhatsApp → Settings → Linked Devices → Link a Device → scan.

**Pairing Code:**
```
[boot] pairing code: SAZA-SAZA
[boot] enter this code in WhatsApp → Linked Devices
```
---

## 📋 Commands

| Command | Category | Description |
|---------|----------|-------------|
| `.ping` | utility | Speed, CPU, RAM |
| `.menu` / `.help` | info | Command list by category |
| `.profile` | info | Your premium status + credits |
| `.msgbuild` / `.airich` | info | Inspect message builder |
| `$ <command>` | owner | Execute terminal commands (owner only) |
| `.set <public\|self\|ponly\|gonly>` | owner | Change status mode |
| `.setp <prefix>` / `.setprefix` | owner | Change command prefix |
| `.ban <target> [duration]` | owner | Ban user (d/h/m/days, default permanent) |
| `.unban <target>` | owner | Unban user |
| `.listban` / `.banlist` | owner | Show all banned users |
| `.addprem <target> [duration]` | owner | Add premium user |
| `.delprem <target>` | owner | Remove premium user |
| `.listprem` | owner | Show all premium users |
| `.hello` / `.hi` | info | TypeScript plugin demo |

---

### Log Format

Messages are tagged by type in the console:

| Tag | Message Type | Executes Command? |
|-----|-------------|---------------------|
| `[msg]` | Conversation / extended text | ✅ Yes |
| `[react]` | Reaction emoji (🍥) | ❌ Skipped |
| `[sticker]` | Sticker | ❌ Skipped |
| `[img]` | Image with caption | ✅ Yes (caption) |
| `[vid]` | Video with caption | ✅ Yes (caption) |
| `[audio]` | Voice note | ❌ Skipped |
| `[doc]` | Document with caption | ✅ Yes (caption) |
| `[self]` | Message from bot's own phone | ❌ No command execution |

---

### Ban System (`lib/banStore.js`)

SQLite-based with multi-alias matching (JID + LID + phone number). Expired bans auto-cleaned on read.

**Commands:** `.ban @user [duration]` \| `.unban @user` \| `.listban`

```text
.ban @user 1h       → ban for 1 hour
.ban @user 30m      → ban for 30 minutes
.ban @user 7d       → ban for 7 days
.ban @user          → permanent ban
.unban @user        → remove ban
```

Target via: reply to user's message, `@user` mention, or type their number directly.

### Premium System (`lib/premiumStore.js`)

SQLite-based with 10 credits/month. Credits auto-reset on first access after the monthly boundary (lazy reset — no cron). Multi-alias matching.

**Commands:** `.addprem @user [duration]` \| `.delprem @user` \| `.listprem`

```text
.addprem @user 30d  → premium 30 days, 10 credits
.addprem @user      → permanent premium
.listprem           → show all premium users with credits
```
---

### Session Management (`lib/sqlite-auth.js`)

- Session stored in `db/session/session.db` (SQLite, single file)
- On logout: auto-clear session, reconnect, show new QR
- **Bad MAC recovery:** If encryption keys are corrupted (Bad MAC error), the bot auto-clears the session & shows a new QR — no manual restart needed
- Exponential backoff: 3s → 6s → 12s → ... → max 60s
- Reconnect debounced: prevents duplicate reconnect loops
- WAL + SHM files auto-cleaned on session reset

---

## 💾 RAM & Performance

Baileys (WhatsApp Web library) dominates memory at ~80-150MB regardless of runtime. Bun's advantages:

| Aspect | Savings |
|------|---------|
| Baseline JSC vs V8 | ~10-20MB lower |
| `bun:sqlite` vs `better-sqlite3` | No native addon overhead |
| `--smol` flag | More aggressive GC, lower peak |
| `generateHighQualityLinkPreview: false` | Avoids loading image processing deps |

For most bots, the RAM difference is marginal since Baileys' crypto state is the bottleneck. Bun's main advantages are **startup speed** (~500ms vs 2-3 seconds) and **native TS support**.

---

## 📁 Directory Structure

```
template-jsts-bun/
├── index.js                 # Entry point — connect, reconnect, message loop
├── handler.js               # Message pipeline — command dispatch, ban check
├── config.json              # Bot settings
├── package.json             # Dual Bun + npm scripts
├── README.md
│
├── db/                      # SQLite databases (auto-created)
│   ├── session/session.db   # WhatsApp multi-device session
│   ├── banned/banned.db     # Banned users list
│   └── premium/premium.db   # Premium users
│
├── lib/
│   ├── sqlite.js            # SQLite wrapper — auto-detect Bun/Node
│   ├── sqlite-auth.js       # Baileys auth state via SQLite
│   ├── messages.js          # Message parser + helpers (.reply/.react/.delete)
│   ├── messageBuilder.js    # Interactive message builder
│   ├── pluginLoader.js      # JS+TS scanner + chokidar hot-reload
│   ├── config.js            # Config loader & saver
│   ├── banStore.js          # Ban system (SQLite)
│   └── premiumStore.js      # Premium system (SQLite)
│
└── plugins/
    ├── hello.ts             # TypeScript plugin demo
    ├── utility-ping.js      # .ping .stats .status
    ├── info-menu.js         # .menu .help
    ├── info-profile.js      # .profile
    ├── info-msgbuild.js     # .msgbuild .airich
    ├── owner-ban.js         # .ban .unban .listban
    ├── owner-premium.js     # .addprem .delprem .listprem
    ├── owner-exec.js        # $ (shell exec, owner only)
    ├── owner-set.js         # .set (status mode)
    ├── owner-setprefix.js   # .setp .setprefix
    └── hidden-autorespon.js # Auto-react (before hook)
```

---

## 🏗 Architecture

### Startup Flow

```
start()
  ├── loadAllPlugins()          → scan plugins/*.js + plugins/*.ts
  ├── watchPlugins()            → chokidar hot-reload (add/change/unlink)
  └── connect()
        ├── fetchLatestBaileysVersion()   → protocol version
        ├── useSQLiteAuthState()          → session from db/session/
        ├── makeWASocket()                → Baileys v7 WhatsApp Web socket
        │     ├── makeCacheableSignalKeyStore()  → Bun compat (async keys)
        │     └── generateHighQualityLinkPreview: false  → save RAM
        └── sock.ev handler
              ├── connection.update  → QR, loggedOut, reconnect
              ├── messages.upsert    → Messages() → msgHandler()
              ├── messages.update    → (internal)
              └── call               → auto-reject
```

### Message Pipeline

```
Incoming message (messages.upsert, type: notify)
  │
  ├── Skip if >60s old, status@broadcast, or no remoteJid
  ├── Unwrap ephemeral / viewOnce / documentWithCaption wrappers
  └── Messages() wrapper
        ├── Resolve sender (participantAlt for groups, LID→phone)
        ├── Extract text / caption / reaction content
        ├── Build quoted message if present
        └── Attach .reply() .react() .delete() helpers
              │
              ▼
        msgHandler()
          ├── Status filter (public / ponly / gonly / self)
          ├── LID → phone resolution (cached)
          ├── Owner detection (fromMe || number match)
          ├── Ban check (silent drop if banned)
          ├── Run all plugin before() hooks
          ├── Prefix detection (prefix or "$ " for owner)
          ├── Plugin lookup
          ├── AI concurrency guard (if category: ai)
          └── Execute plugin.handler(message, ctx)
```
<img src='https://i.imgur.com/LyHic3i.gif' width="100%"/>


## 📄 License

MIT — Free for personal & commercial use. Base built by **[@DranxX](https://github.com/DranXX)** and with contribution **[@RizzyFuzz](https://github.com/rizzbrew)**.

Powered by [Baileys](https://github.com/WhiskeySockets/Baileys) v7 · SQLite via `bun:sqlite` / `better-sqlite3`