# Creating Plugins

Plugin adalah file `.js` (atau `.ts`) di folder `plugins/` yang mengekspor default object. Scanner auto-load setiap file saat startup. Chokidar me-load ulang saat file berubah — tanpa restart.

---

## Template Minimal

```js
// plugins/halo.js
export default {
  command: ['halo', 'hi'],
  description: 'Balas dengan sapaan',
  category: 'info',

  handler: async (message, ctx) => {
    const { prefix } = ctx;
    await message.reply(`Halo! Ketik ${prefix}menu untuk lihat command.`);
  }
};
```

Simpan, kirim `.halo`. Selesai.

---

## TypeScript Plugin

```ts
// plugins/halo.ts
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
  command: ['halo', 'hi'],
  description: 'Balas dengan sapaan (TypeScript)',
  category: 'info',

  handler: async (message: any, ctx: PluginContext) => {
    const name = ctx.pushname || 'User';
    await message.reply(`Hello ${name}! 👋`);
  }
};
```

Bun: native. Node.js: install `tsx` (`npm i -D tsx && node --import tsx index.js`).

---

## Struktur Plugin

| Property | Wajib | Tipe | Keterangan |
|----------|-------|------|------------|
| `command` | ✅ | `string \| string[]` | Nama command tanpa prefix. Multi-alias: `['ping', 'p', 'status']` |
| `handler` | ✅ | `async (message, ctx)` | Dipanggil saat command cocok |
| `description` | ✅ | `string` | Muncul di `.menu` |
| `category` | ✅ | `string` | `ai` / `info` / `utility` / `downloader` / `owner` / `hidden` |
| `before` | — | `async (message, ctx)` | Dijalankan di **setiap** pesan, sebelum command dispatch |
| `parallel` | — | `boolean` | Lewati command gate — selalu paralel (untuk command ringan) |

---

## Context (`ctx`) — Parameter Kedua Handler

| Field | Tipe | Keterangan |
|-------|------|------------|
| `sock` | `WASocket` | Socket Baileys mentah — akses semua method WhatsApp |
| `message` | `object` | Wrapper Messages — `.reply()` `.react()` `.delete()` `.chat` `.sender` `.text` `.key` `.isGroup` `.quoted` `.mentionedJid` |
| `prefix` | `string` | Prefix command saat ini (default `.`) |
| `args` | `string[]` | Argumen setelah command. `.ban @user 1h` → `['@user', '1h']` |
| `q` | `string` | Semua argumen digabung spasi |
| `budy` | `string` | Teks pesan lengkap termasuk prefix |
| `commandName` | `string` | Nama command yang cocok |
| `sender` | `string` | JID pengirim lengkap (`628xxx@s.whatsapp.net`) |
| `senderPhone` | `string` | Nomor HP hasil resolve (LID→phone via signalRepository, cached) |
| `isOwner` | `boolean` | Apakah pengirim owner? (LID-resolved, fromMe, atau cocok nomor) |
| `isGroup` | `boolean` | Apakah ini grup? |
| `ownerNum` | `string` | Nomor owner dari config (plain digits) |
| `botNum` | `string` | Nomor bot dari config (plain digits) |
| `groupMetadata` | `object` | Metadata grup (cached 24 jam, auto-invalidasi saat participant/group update). Isinya: `.id` `.subject` `.participants[]` `.participants[n].id` `.participants[n].phoneNumber` |
| `pushname` | `string` | Nama tampilan WhatsApp pengirim |
| `_receivedAt` | `number` | `Date.now()` saat pesan diterima — buat hitung latency |

---

## Cara Kirim Pesan

### 1. Reply (paling umum)

```js
await message.reply('Halo dunia!');
await message.reply('*Bold* _italic_ ~strike~ `monospace`');
```

### 2. Reply dengan mention

```js
await sock.sendMessage(message.chat, {
  text: 'Halo @628xxx',
  mentions: ['628xxx@s.whatsapp.net']
}, { quoted: message });
```

### 3. Kirim ke JID spesifik

```js
const dm = '628xxx@s.whatsapp.net';
const gc = '628xxx-xxx@g.us';
await sock.sendMessage(dm, { text: 'Hello' });
```

### 4. React ke pesan

```js
await message.react('❤️');
await message.react('😂');
```

### 5. Delete pesan

```js
await message.delete();
```

### 6. Kirim gambar / video / dokumen

```js
// Gambar dari URL
await sock.sendMessage(message.chat, {
  image: { url: 'https://example.com/photo.jpg' },
  caption: 'Ini caption gambar'
});

// Dokumen dari buffer
import fs from 'fs';
const buf = fs.readFileSync('./file.pdf');
await sock.sendMessage(message.chat, {
  document: buf,
  fileName: 'dokumen.pdf',
  mimetype: 'application/pdf'
});
```

### 7. AIRich Response (Meta AI style)

```js
import { AIRich } from '../lib/messageBuilder.js';

await new AIRich(sock)
  .setTitle('Hasil Pencarian')
  .setBody('Berikut hasilnya:')
  .addCode('console.log("hello")', 'javascript')
  .addTable([['Key', 'Value'], ['name', 'SazaBot']])
  .addText('Teks biasa dengan *bold* _italic_')
  .send(message.chat, { quoted: message });
```

### 8. Reply dengan mention (helper)

```js
function mention(number) { return `@${number}`; }
function phoneJid(number) { return `${number}@s.whatsapp.net`; }

// Di dalam handler:
const number = ctx.senderPhone;
const text = `Halo ${mention(number)}!`;
await sock.sendMessage(message.chat, { text, mentions: [phoneJid(number)] }, { quoted: message });
```

### 9. Properti Helper `message`

Selain helper method, objek `message` juga memiliki beberapa properti hasil parsing berikut:

| Properti | Tipe | Deskripsi |
|----------|------|-----------|
| `message.text` | `string` | Konten teks yang diekstrak |
| `message.sender` | `string` | JID pengirim |
| `message.isGroup` | `boolean` | Apakah chat grup? |
| `message.chat` | `string` | JID chat (ternormalisasi) |
| `message.mentionedJid` | `string[]` | Array JID yang di-mention |
| `message.quoted` | `object \| null` | Objek quoted message |
| `message.quoted?.text` | `string` | Teks dari quoted message |
| `message.quoted?.sender` | `string` | Pengirim quoted message |

---

## Resolusi Target (reply/mention/nomor)

Pattern standar untuk command yang butuh target user (ban, addprem, info, dll):

```js
import { areJidsSameUser } from 'baileys';

function getTarget(message, args) {
  // 1. Reply pesan seseorang
  if (message.quoted?.sender) return message.quoted.sender;
  // 2. @mention pertama
  const mentioned = message.mentionedJid?.[0];
  if (mentioned) return mentioned;
  // 3. Nomor langsung dari args
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
  description: 'Lihat info user',
  category: 'info',

  handler: async (message, { args, groupMetadata, sock }) => {
    const targetJid = getTarget(message, args);
    if (!targetJid) return message.reply('Reply / @tag / ketik nomor user!');

    const number = targetPhone(targetJid, groupMetadata);
    await sock.sendMessage(message.chat, {
      text: `Info: @${number}`,
      mentions: [`${number}@s.whatsapp.net`]
    }, { quoted: message });
  }
};
```

---

## Integrasi Premium

Cek status premium dan konsumsi kredit di command AI / fitur berbayar:

```js
import { getPremiumProfile, consumePremiumCredit } from '../lib/premiumStore.js';

export default {
  command: ['ask'],
  description: 'Tanya AI (premium)',
  category: 'ai',

  handler: async (message, { q, sender, senderPhone, isOwner, groupMetadata }) => {
    if (!q) return message.reply('Tanya apa? Contoh: .ask jelaskan gravity');

    // Owner bebas biaya
    if (!isOwner) {
      const jid = senderPhone ? `${senderPhone}@s.whatsapp.net` : sender;
      const profile = getPremiumProfile(jid, null, groupMetadata);

      if (!profile.isPremium)
        return message.reply('Fitur ini khusus premium. Gunakan .profile untuk cek status.');

      const credit = consumePremiumCredit(jid, null, groupMetadata, 1);
      if (!credit.ok)
        return message.reply('Kredit habis! Tunggu reset bulan depan.');
    }

    // ...panggil API AI kamu di sini...
    const answer = '...';
    await message.reply(answer);
  }
};
```

---

## `before` Hook — Auto-React & Filter

`before` jalan di **setiap** pesan sebelum command detection. Cocok untuk: auto-reaction, spam filter, logging, moderation.

```js
// plugins/hidden-automod.js
const bannedWords = ['spam', 'scam'];

export default {
  command: ['automod'],
  description: 'Auto moderation',
  category: 'hidden',
  handler: async () => {},

  before: async (message, { budy, isOwner }) => {
    if (isOwner) return; // jangan filter owner

    const text = (budy || '').toLowerCase();

    // Auto-react
    if (['wkwk', 'haha', '😂'].some(w => text.includes(w))) {
      await message.react('😂').catch(() => {});
    }
    if (['sedih', ':(', '😢'].some(w => text.includes(w))) {
      await message.react('😢').catch(() => {});
    }

    // Delete spam
    if (bannedWords.some(w => text.includes(w))) {
      await message.delete().catch(() => {});
      await message.reply('⚠️ Pesan dihapus: mengandung kata terlarang.');
    }
  }
};
```

---

## Kategori & Menu

| Category | Section di `.menu` | Contoh |
|----------|-------------------|--------|
| `ai` | AI | Chat AI, search |
| `info` | Information | `.menu`, `.profile`, `.msgbuild` |
| `utility` | Utility | `.ping`, `.speed` |
| `downloader` | Downloader | `.tiktok`, `.ghdl` |
| `owner` | Owner (hanya muncul untuk owner) | `.ban`, `.addprem`, `.set`, `.setp` |
| `hidden` | Tidak muncul di menu | Auto-reaction, before hooks |

---

## Contoh Lengkap

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
  description: 'Cek kecepatan + resource bot',
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
  description: 'Kirim pesan sebagai bot',
  category: 'owner',

  handler: async (message, { q, isOwner }) => {
    if (!isOwner) return;
    if (!q) return message.reply('Mau bilang apa? Contoh: .say Halo semua');
    await message.reply(q);
  }
};
```

### 3. Command dengan Sub-Argumen

```js
// plugins/info-profile.js
export default {
  command: ['profile'],
  description: 'Lihat/ubah profil',
  category: 'info',

  handler: async (message, { args, prefix }) => {
    const [sub] = args;

    switch (sub) {
      case 'me':
        return message.reply(`Kamu: ${message.pushName}`);
      case 'bot':
        return message.reply('Bot: SazaBot v1.0');
      default:
        return message.reply(`Gunakan: ${prefix}profile [me|bot]`);
    }
  }
};
```

### 4. Downloader Command

```js
// plugins/downloader-gh.js
export default {
  command: ['ghdl'],
  description: 'Download dari GitHub release',
  category: 'downloader',

  handler: async (message, { q }) => {
    if (!q) return message.reply('Masukkan URL GitHub!\nContoh: .ghdl https://github.com/user/repo');

    try {
      const res = await fetch(`https://api.github.com/repos/${q.replace('https://github.com/', '')}/releases/latest`);
      const data = await res.json();
      if (!data?.assets?.length) return message.reply('Gak ada release.');

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
    if (!q) return message.reply('Masukkan command!\nContoh: $ ls -la');
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

Chokidar mengawasi folder `plugins/` untuk event `add`, `change`, `unlink`. Edit file → save → langsung update, tanpa restart. Reload di-debounce (150 ms per file, event terakhir menang) dan setiap file di-cek syntax-nya (Bun transpiler scan) sebelum import — file rusak tidak menggantikan plugin lama.

---

## Runtime Guards — Anti-Spam, Command Gate & Cache

Tiga guard jalan di handler sebelum plugin kamu dieksekusi.

### Anti-spam (per contact)

Sliding window per nomor pengirim. Lewat `maxWarn` dalam `windowMs` → satu warning, command berikutnya di-drop; mencapai `maxBan` → ban sementara via ban store.

```json
"antispam": { "enabled": true, "windowMs": 30000, "maxWarn": 4, "maxBan": 5, "banMs": 300000, "exemptOwner": true, "exemptPremium": false }
```

Bisa dipakai manual di dalam plugin:

```js
import { check } from '../lib/antispam.js';

const d = check(senderPhone, { isOwner, isPremium }, config);
if (!d.allowed) return; // d.warn / d.ban menjelaskan alasannya
```

### Command gate (antre vs paralel per tier)

- Free: maksimal `maxConcurrentFree` command jalan bersamaan per contact; kelebihan masuk antrean (`maxQueue`, `queueTimeoutMs`) atau ditolak kalau `freeMode` `'reject'`.
- Premium/owner: langsung paralel tanpa antre. Anti-spam tetap berlaku di semua tier.
- Opt-out per plugin dengan `parallel: true` (command ringan seperti ping).

```json
"commandGate": { "enabled": true, "maxConcurrentFree": 1, "freeMode": "queue", "maxQueue": 3, "queueTimeoutMs": 30000 }
```

### Single-flight + TTL cache

`lib/singleflight.js` menggabungkan fetch konkuren per key jadi satu panggilan, cache dengan TTL, dan menyajikan nilai lama saat refresh gagal. Handler memakainya untuk group metadata (TTL 24 jam, auto-invalidate saat participants/group update).

```js
import { cached, invalidate } from '../lib/singleflight.js';

const meta = await cached('gm:' + chatJid, 86400000, () => sock.groupMetadata(chatJid));
invalidate('gm:' + chatJid); // paksa refresh
```

---

## Best Practices

1. **Satu plugin satu file** — kecuali alias (`['ping', 'stats']`)
2. **`category` tepat** — biar `.menu` terorganisir
3. **Guard `isOwner`** untuk command admin — jangan hardcode nomor
4. **Gunakan `senderPhone`** (bukan `sender`) untuk identifikasi nomor asli — sudah di-resolve dari LID
5. **Gunakan `groupMetadata.participants`** untuk LID→phone resolution di grup
6. **Gunakan `ownerNum` / `botNum`** dari ctx untuk bypass proteksi
7. **Panggil `getTarget()` + `targetPhone()`** untuk command yang butuh target user
8. **Try-catch di handler** — jangan bikin bot crash
9. **Gunakan `_receivedAt`** untuk hitung latency command
10. **`category: 'hidden'`** jika plugin hanya butuh `before` hook tanpa command
11. **Prefix `owner-`** di nama file untuk command owner (konvensi)
12. **Prefix `hidden-`** di nama file untuk auto-reaction/moderation (konvensi)
