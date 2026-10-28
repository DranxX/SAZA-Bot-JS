# Creating Plugins

A plugin is a `.js` (or `.ts`) file in the `plugins/` folder that exports a default object. The scanner auto-loads every file on startup. Chokidar reloads on file changes — no restart needed.

---

## Minimal Template

```js
// plugins/hello.js
export default {
  command: ['hello', 'hi'],
  description: 'Reply with a greeting',
  category: 'info',

  handler: async (message, ctx) => {
    const { prefix } = ctx;
    await message.reply(`Hello! Type ${prefix}menu to see all commands.`);
  }
};
```

Save, send `.hello`. Done.

---

## TypeScript Plugin

```ts
// plugins/hello.ts
interface PluginContext {
  sock: any;
  message: any;
  prefix: string;
  args: string[];
  q: string;
  budy: string;
  commandName: string;
  sender: string;
  senderPhone: string;
  isGroup: boolean;
  isOwner: boolean;
  ownerNum: string;
  botNum: string;
  groupMetadata: any;
  pushname: string;
  _receivedAt: number;
}

export default {
  command: ['hello', 'hi'],
  description: 'Reply with a greeting (TypeScript)',
  category: 'info',

  handler: async (message: any, ctx: PluginContext) => {
    const name = ctx.pushname || 'User';
    await message.reply(`Hello ${name}! 👋`);
  }
};
```

Bun: native. Node.js: install `tsx` (`npm i -D tsx && node --import tsx index.js`).

---

## Plugin Structure

| Property | Required | Type | Description |
|----------|-------|------|------------|
| `command` | ✅ | `string \| string[]` | Command name without prefix. Multi-alias: `['ping', 'p', 'status']` |
| `handler` | ✅ | `async (message, ctx)` | Called when command matches |
| `description` | ✅ | `string` | Shown in `.menu` |
| `category` | ✅ | `string` | `ai` / `info` / `utility` / `downloader` / `owner` / `hidden` |
| `before` | — | `async (message, ctx)` | Runs on **every** message, before command dispatch |
| `parallel` | — | `boolean` | Skip the command gate — always run in parallel (for light commands) |

---

## Context (`ctx`) — Second Handler Parameter

| Field | Type | Description |
|-------|------|------------|
| `sock` | `WASocket` | Raw Baileys socket — access all WhatsApp methods |
| `message` | `object` | Messages wrapper — `.reply()` `.react()` `.delete()` `.chat` `.sender` `.text` `.key` `.isGroup` `.quoted` `.mentionedJid` |
| `prefix` | `string` | Current command prefix (default `.`) |
| `args` | `string[]` | Arguments after command. `.ban @user 1h` → `['@user', '1h']` |
| `q` | `string` | All arguments joined with spaces |
| `budy` | `string` | Full message text including prefix |
| `commandName` | `string` | Matched command name |
| `sender` | `string` | Full sender JID (`628xxx@s.whatsapp.net`) |
| `senderPhone` | `string` | Resolved phone number (LID→phone via signalRepository, cached) |
| `isOwner` | `boolean` | Is the sender the owner? (LID-resolved, fromMe, or number match) |
| `isGroup` | `boolean` | Is this a group chat? |
| `ownerNum` | `string` | Owner number from config (plain digits) |
| `botNum` | `string` | Bot number from config (plain digits) |
| `groupMetadata` | `object` | Group metadata (cached 24h, auto-invalidated on participant/group update). Contains: `.id` `.subject` `.participants[]` `.participants[n].id` `.participants[n].phoneNumber` |
| `pushname` | `string` | Sender's WhatsApp display name |
| `_receivedAt` | `number` | `Date.now()` when message was received — for latency calculation |

---

## Sending Messages

### 1. Reply (most common)

```js
await message.reply('Hello world!');
await message.reply('*Bold* _italic_ ~strike~ `monospace`');
```

### 2. Reply with mention

```js
await sock.sendMessage(message.chat, {
  text: 'Hello @628xxx',
  mentions: ['628xxx@s.whatsapp.net']
}, { quoted: message });
```

### 3. Send to specific JID

```js
const dm = '628xxx@s.whatsapp.net';
const gc = '628xxx-xxx@g.us';
await sock.sendMessage(dm, { text: 'Hello' });
```

### 4. React to a message

```js
await message.react('❤️');
await message.react('😂');
```

### 5. Delete a message

```js
await message.delete();
```

### 6. Send image / video / document

```js
// Image from URL
await sock.sendMessage(message.chat, {
  image: { url: 'https://example.com/photo.jpg' },
  caption: 'Image caption'
});

// Document from buffer
import fs from 'fs';
const buf = fs.readFileSync('./file.pdf');
await sock.sendMessage(message.chat, {
  document: buf,
  fileName: 'document.pdf',
  mimetype: 'application/pdf'
});
```

### 7. AIRich Response (Meta AI style)

```js
import { AIRich } from '../lib/messageBuilder.js';

await new AIRich(sock)
  .setTitle('Search Results')
  .setBody('Here are the results:')
  .addCode('console.log("hello")', 'javascript')
  .addTable([['Key', 'Value'], ['name', 'SazaBot']])
  .addText('Plain text with *bold* _italic_')
  .send(message.chat, { quoted: message });
```

### 8. Reply with mention (helper)

```js
function mention(number) { return `@${number}`; }
function phoneJid(number) { return `${number}@s.whatsapp.net`; }

// Inside handler:
const number = ctx.senderPhone;
const text = `Hello ${mention(number)}!`;
await sock.sendMessage(message.chat, { text, mentions: [phoneJid(number)] }, { quoted: message });
```

### 9. Message Helper Properties

In addition to helper methods, the `message` object also has these parsed properties:

| Property | Type | Description |
|----------|------|-----------|
| `message.text` | `string` | Extracted text content |
| `message.sender` | `string` | Sender JID |
| `message.isGroup` | `boolean` | Is this a group chat? |
| `message.chat` | `string` | Chat JID (normalized) |
| `message.mentionedJid` | `string[]` | Array of mentioned JIDs |
| `message.quoted` | `object \| null` | Quoted message object |
| `message.quoted?.text` | `string` | Text from quoted message |
| `message.quoted?.sender` | `string` | Quoted message sender |

---

## Target Resolution (reply/mention/number)

Standard pattern for commands that need a target user (ban, addprem, info, etc.):

```js
import { areJidsSameUser } from 'baileys';

function getTarget(message, args) {
  // 1. Replied to someone's message
  if (message.quoted?.sender) return message.quoted.sender;
  // 2. First @mention
  const mentioned = message.mentionedJid?.[0];
  if (mentioned) return mentioned;
  // 3. Direct number from args
  const raw = String(args?.[0] || '').replace(/[^0-9]/g, '');
  if (raw) return `${raw}@s.whatsapp.net`;
  return null;
}

function targetPhone(jid, groupMetadata) {
  if (!jid) return '';
  if (jid.endsWith('@s.whatsapp.net')) return jid.split(':')[0].split('@')[0];
  if (jid.endsWith('@lid') && groupMetadata?.participants) {
    const p = groupMetadata.participants.find(item => areJidsSameUser(item.id, jid));
    if (p?.phoneNumber) return p.phoneNumber.split(':')[0].split('@')[0];
  }
  return '';
}

export default {
  command: ['info'],
  description: 'View user info',
  category: 'info',

  handler: async (message, { args, groupMetadata, sock }) => {
    const targetJid = getTarget(message, args);
    if (!targetJid) return message.reply('Reply / @tag / type the user number!');

    const number = targetPhone(targetJid, groupMetadata);
    await sock.sendMessage(message.chat, {
      text: `Info: @${number}`,
      mentions: [`${number}@s.whatsapp.net`]
    }, { quoted: message });
  }
};
```

---

## Premium Integration

Check premium status and consume credits in AI commands / paid features:

```js
import { getPremiumProfile, consumePremiumCredit } from '../lib/premiumStore.js';

export default {
  command: ['ask'],
  description: 'Ask AI (premium)',
  category: 'ai',

  handler: async (message, { q, sender, senderPhone, isOwner, groupMetadata }) => {
    if (!q) return message.reply('Ask what? Example: .ask explain gravity');

    // Owner is free
    if (!isOwner) {
      const jid = senderPhone ? `${senderPhone}@s.whatsapp.net` : sender;
      const profile = getPremiumProfile(jid, null, groupMetadata);

      if (!profile.isPremium)
        return message.reply('This feature is premium-only. Use .profile to check status.');

      const credit = consumePremiumCredit(jid, null, groupMetadata, 1);
      if (!credit.ok)
        return message.reply('Out of credits! Wait for next month reset.');
    }

    // ...call your AI API here...
    const answer = '...';
    await message.reply(answer);
  }
};
```

---

## `before` Hook — Auto-React & Filter

`before` runs on **every** message before command detection. Great for: auto-reaction, spam filter, logging, moderation.

```js
// plugins/hidden-automod.js
const bannedWords = ['spam', 'scam'];

export default {
  command: ['automod'],
  description: 'Auto moderation',
  category: 'hidden',
  handler: async () => {},

  before: async (message, { budy, isOwner }) => {
    if (isOwner) return; // don't filter owner

    const text = (budy || '').toLowerCase();

    // Auto-react
    if (['lol', 'haha', '😂'].some(w => text.includes(w))) {
      await message.react('😂').catch(() => {});
    }
    if (['sad', ':(', '😢'].some(w => text.includes(w))) {
      await message.react('😢').catch(() => {});
    }

    // Delete spam
    if (bannedWords.some(w => text.includes(w))) {
      await message.delete().catch(() => {});
      await message.reply('⚠️ Message deleted: contains banned words.');
    }
  }
};
```

---

## Categories & Menu

| Category | Section in `.menu` | Examples |
|----------|-------------------|--------|
| `ai` | AI | AI chat, search |
| `info` | Information | `.menu`, `.profile`, `.msgbuild` |
| `utility` | Utility | `.ping`, `.speed` |
| `downloader` | Downloader | `.tiktok`, `.ghdl` |
| `owner` | Owner (only shown to owner) | `.ban`, `.addprem`, `.set`, `.setp` |
| `hidden` | Not shown in menu | Auto-reaction, before hooks |

---

## Full Examples

### 1. Ping Command (utility)

```js
// plugins/utility-ping.js
import os from 'os';

let lastCpu = null, cachedCpu = 0;

function sampleCpu() {
  const snap = os.cpus().reduce((a, c) => {
    const t = Object.values(c.times).reduce((s, v) => s + v, 0);
    a.idle += c.times.idle; a.total += t; return a;
  }, { idle: 0, total: 0 });
  if (lastCpu) {
    const dT = snap.total - lastCpu.total;
    const dI = snap.idle - lastCpu.idle;
    cachedCpu = dT > 0 ? (1 - dI / dT) * 100 : 0;
  }
  lastCpu = snap;
}
sampleCpu();
setInterval(sampleCpu, 3000);

export default {
  command: ['ping', 'stats', 'status'],
  description: 'Check bot speed + resources',
  category: 'utility',

  handler: async (message, { _receivedAt }) => {
    const speed = Date.now() - _receivedAt;
    const usedRam = os.totalmem() - os.freemem();
    const botRam = process.memoryUsage().rss;

    await message.reply(
      `*Pong!*\n\n` +
      `Speed: ${speed} ms\n` +
      `CPU Server: ${cachedCpu.toFixed(2)}%\n` +
      `CPU Bot: ${(process.cpuUsage().user / 1000000).toFixed(2)}%\n` +
      `RAM Server: ${(usedRam / 1024 ** 3).toFixed(2)} GB\n` +
      `RAM Bot: ${(botRam / 1024 ** 2).toFixed(2)} MB`
    );
  }
};
```

### 2. Owner-Only Command

```js
// plugins/owner-say.js
export default {
  command: ['say'],
  description: 'Send message as bot',
  category: 'owner',

  handler: async (message, { q, isOwner }) => {
    if (!isOwner) return;
    if (!q) return message.reply('Say what? Example: .say Hello everyone');
    await message.reply(q);
  }
};
```

### 3. Command with Sub-Arguments

```js
// plugins/info-profile.js
export default {
  command: ['profile'],
  description: 'View/edit profile',
  category: 'info',

  handler: async (message, { args, prefix }) => {
    const [sub] = args;

    switch (sub) {
      case 'me':
        return message.reply(`You: ${message.pushName}`);
      case 'bot':
        return message.reply('Bot: SazaBot v1.0');
      default:
        return message.reply(`Usage: ${prefix}profile [me|bot]`);
    }
  }
};
```

### 4. Downloader Command

```js
// plugins/downloader-gh.js
export default {
  command: ['ghdl'],
  description: 'Download from GitHub release',
  category: 'downloader',

  handler: async (message, { q }) => {
    if (!q) return message.reply('Enter a GitHub URL!\nExample: .ghdl https://github.com/user/repo');

    try {
      const res = await fetch(`https://api.github.com/repos/${q.replace('https://github.com/', '')}/releases/latest`);
      const data = await res.json();
      if (!data?.assets?.length) return message.reply('No releases found.');

      await message.reply(
        `*${data.name}*\n\n` +
        data.assets.map(a => `📦 ${a.name} (${(a.size / 1024 / 1024).toFixed(1)} MB)\n${a.browser_download_url}`).join('\n\n')
      );
    } catch (e) {
      await message.reply(`Error: ${e.message}`);
    }
  }
};
```

### 5. Shell Exec (owner only)

```js
// plugins/owner-exec.js
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export default {
  command: ['$'],
  description: 'Execute terminal commands',
  category: 'owner',

  handler: async (message, { q }) => {
    if (!q) return message.reply('Enter a command!\nExample: $ ls -la');
    try {
      const { stdout, stderr } = await execPromise(q, { timeout: 30000, maxBuffer: 500 * 1024 });
      const output = (stdout || stderr || 'Done (no output).').trim();
      await message.reply(output.slice(0, 4000));
    } catch (e) {
      await message.reply(`*ERROR*\n\n${e.message}`);
    }
  }
};
```

---

## Hot-Reload

Chokidar watches the `plugins/` folder for `add`, `change`, `unlink` events. Edit file → save → instantly updated, no restart. Reloads are debounced (150 ms per file, last event wins) and every file is syntax-checked (Bun transpiler scan) before import — a broken file keeps the previously loaded version.

---

## Runtime Guards — Anti-Spam, Command Gate & Cache

Three guards run in the handler before your plugin executes.

### Anti-spam (per contact)

Sliding window per sender number. Above `maxWarn` in `windowMs` → one warning, further commands dropped; at `maxBan` → temporary ban through the ban store.

```json
"antispam": { "enabled": true, "windowMs": 30000, "maxWarn": 4, "maxBan": 5, "banMs": 300000, "exemptOwner": true, "exemptPremium": false }
```

Use it manually inside a plugin:

```js
import { check } from '../lib/antispam.js';

const d = check(senderPhone, { isOwner, isPremium }, config);
if (!d.allowed) return; // d.warn / d.ban tell you why
```

### Command gate (queue vs parallel per tier)

- Free tier: max `maxConcurrentFree` running commands per contact; overflow is queued (`maxQueue`, `queueTimeoutMs`) or rejected when `freeMode` is `'reject'`.
- Premium/owner: run immediately in parallel — no queue. Anti-spam still applies to every tier.
- Opt out per plugin with `parallel: true` (light commands like ping).

```json
"commandGate": { "enabled": true, "maxConcurrentFree": 1, "freeMode": "queue", "maxQueue": 3, "queueTimeoutMs": 30000 }
```

### Single-flight + TTL cache

`lib/singleflight.js` collapses concurrent fetches per key, caches with TTL, and serves the stale value when a refresh fails. The handler uses it for group metadata (24h TTL, auto-invalidated on participant/group updates).

```js
import { cached, invalidate } from '../lib/singleflight.js';

const meta = await cached('gm:' + chatJid, 86400000, () => sock.groupMetadata(chatJid));
invalidate('gm:' + chatJid); // force refresh
```

---

## Best Practices

1. **One plugin per file** — except for aliases (`['ping', 'stats']`)
2. **Use the right `category`** — keeps `.menu` organized
3. **Guard with `isOwner`** for admin commands — never hardcode numbers
4. **Use `senderPhone`** (not `sender`) for real phone number identification — already resolved from LID
5. **Use `groupMetadata.participants`** for LID→phone resolution in groups
6. **Use `ownerNum` / `botNum`** from ctx for bypass protection
7. **Call `getTarget()` + `targetPhone()`** for commands that need a target user
8. **Try-catch in handler** — don't crash the bot
9. **Use `_receivedAt`** to calculate command latency
10. **`category: 'hidden'`** if plugin only needs a `before` hook without a command
11. **Prefix `owner-`** in filename for owner commands (convention)
12. **Prefix `hidden-`** in filename for auto-reaction/moderation (convention)
