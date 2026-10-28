# AIRich Builder — API Reference

`AIRich` adalah **fluent builder** untuk membuat WhatsApp AI Rich Response (Meta AI style). Berisi text formatting, syntax-highlighted code blocks, tabel, gambar, video, produk, reels, suggestions, dan source citations.

<p align="center">
 <img src="../../assets/airich.jpeg" height="200" alt="SazaBot AI Rich" />
  <br>
  <sub><b>Example</b></sub>
</p>

## Import

```js
import { AIRich } from '../lib/messageBuilder.js';
```

## Quick Start

```js
const ai = new AIRich(sock);

await ai
  .setTitle('Hasil Pencarian')
  .setBody('Berikut hasil untuk: *lorem ipsum*')
  .addCode('console.log("hello world")', 'javascript')
  .addTable([
    ['File', 'Ukuran'],
    ['index.js', '4.2 KB'],
    ['handler.js', '12.8 KB'],
  ])
  .addTip('Gunakan .menu untuk lihat semua command.')
  .send(chatJid, { quoted: message });
```

## Semua Method

### Metadata

| Method | Keterangan |
|--------|------------|
| `.setTitle(text)` | Judul (bold heading) |
| `.setSubtitle(text)` | Subtitle (italic) |
| `.setBody(text)` | Body text (mendukung markdown) |
| `.setFooter(text)` | Footer (italic di bawah) |
| `.setContextInfo(obj)` | WhatsApp context info (mentions, dll) |
| `.addPayload(obj)` | Merge extra payload ke relay options |

### Konten Teks & Kode

| Method | Keterangan |
|--------|------------|
| `.addText(text)` | Tambah paragraf teks (mendukung markdown, hyperlink, citation, LaTeX) |
| `.addCode(language, code)` | Tambah code block dengan syntax highlighting |
| `.addTable(rows)` | Tambah tabel. `rows = [['H1', 'H2'], ['v1', 'v2']]`. Baris pertama = header |
| `.addTip(text)` | Shorthand: `💡 *Tip:* text` |
| `.addSuggest(texts, opts)` | Suggestion pills. `texts` bisa string atau array. `opts.scroll` untuk HScroll |

### Media

| Method | Keterangan |
|--------|------------|
| `.addImage(url)` | Tambah gambar (URL, Buffer, atau array) |
| `.addVideo(url)` | Tambah video (URL, Buffer, object dengan `{url, duration, thumbnail}`, atau array) |
| `.addReels(items)` | Tambah reel/instagram video cards. Tiap item punya `username`, `thumbnail`, `url`, `like`, dll |
| `.addProduct(data)` | Tambah product card(s). `data` bisa object atau array. Punya `title`, `brand`, `price`, `sale_price`, `image`, `url` |
| `.addPost(data)` | Tambah post card(s). `data` bisa object atau array. Punya `username`, `caption`, `thumbnail`, `like`, `comment`, `share` |

### Sources & Sections Manual

| Method | Keterangan |
|--------|------------|
| `.addSource(sources)` | Tambah citation source. Format: `[['icon_url', 'link_url', 'label'], ...]` |
| `.addSubmessage(obj)` | Tambah raw submessage langsung |
| `.addSection(obj)` | Tambah raw section langsung |
| `.addNewLayout(type, data, extra)` | Tambah layout section manual. `type`: `'Single'`, `'HScroll'`, `'ActionRow'` |

### Build & Send

| Method | Keterangan |
|--------|------------|
| `.build(opts)` | Build full protobuf object. Return punya `.send()` dan `.toMarkdown()` |
| `.send(jid, opts)` | Build + kirim via `relayMessage`. `opts.quoted` untuk reply context |
| `.run(jid, opts)` | Alias `.send()` |

## Contoh Praktis

### 1. Format Teks Sederhana

```js
await new AIRich(sock)
  .setTitle('Format Teks')
  .setBody('*Ini teks tebal*\n_Ini teks miring_\n*_Ini tebal + miring_*\n~Ini teks dicoret~')
  .send(message.chat, { quoted: message });
```

### 2. Code Block dengan Highlight

```js
await new AIRich(sock)
  .setTitle('Contoh Kode')
  .addCode('javascript',
    'function fibonacci(n) {\n' +
    '  if (n <= 1) return n;\n' +
    '  return fibonacci(n - 1) + fibonacci(n - 2);\n' +
    '}\n' +
    '\n' +
    'console.log(fibonacci(10)); // 55'
  )
  .addText('Fungsi diatas menghitung *deret Fibonacci*.')
  .send(message.chat, { quoted: message });
```

Language yang didukung: `javascript`, `typescript`, `python`, `java`, `golang`, `rust`, `cpp`, `c`, `php`, `html`, `css`, `bash`, `markdown`, `sql`, `json`.

### 3. Tabel Data

```js
await new AIRich(sock)
  .setTitle('Leaderboard')
  .addTable([
    ['Rank', 'Nama', 'Score'],
    ['🥇', 'Alice', '9,850'],
    ['🥈', 'Bob', '8,720'],
    ['🥉', 'Charlie', '7,150'],
  ])
  .send(message.chat, { quoted: message });
```

### 4. Mixed Content — Teks + Kode + Tabel + Tip + Suggest

```js
const ai = new AIRich(sock);

ai.setTitle('Dokumentasi API v2')
  .setBody('Berikut endpoint yang tersedia:');

ai.addTable([
  ['Method', 'Endpoint', 'Auth'],
  ['GET', '/api/users', 'Token'],
  ['POST', '/api/users', 'Token'],
  ['DELETE', '/api/users/:id', 'Admin'],
]);

ai.addText('### Contoh Request');
ai.addCode('bash', 'curl -H "Authorization: Bearer $TOKEN" https://api.example.com/users');

ai.addTip('Gunakan token Bearer di header Authorization.');
ai.addSuggest(['Lihat Docs Lengkap', 'Contoh Response', 'Error Codes'], { scroll: true });

await ai.send(message.chat, { quoted: message });
```

### 5. Gambar + Produk + Source

```js
await new AIRich(sock)
  .setTitle('Katalog Produk')
  .addImage('https://files.catbox.moe/5da9um.png')
  .addProduct({
    title: 'SazaBot Premium',
    brand: 'SazaBot',
    price: 'Rp 50.000',
    sale_price: 'Rp 25.000',
    url: 'https://example.com',
    image: 'https://files.catbox.moe/5da9um.png',
  })
  .addSource([
    ['https://files.catbox.moe/5da9um.png', 'https://github.com', 'GitHub Repository'],
  ])
  .send(message.chat, { quoted: message });
```

### 6. Build Once, Send Many

```js
const built = new AIRich(sock)
  .setTitle('Announcement')
  .addText('Update bot v1.2.0 sudah rilis!')
  .build();  // ← return object dengan method .send()

// Kirim ke banyak chat
await built.send('628xxx@s.whatsapp.net');
await built.send('628yyy-123456@g.us');
```

### 7. Full Showcase (pakai semua fitur)

```js
const ai = new AIRich(sock);

ai.setTitle('Message Builder v4.6')
  .setFooter('SazaBot Template')
  .addSuggest(['Bot Info', 'All Categories'], { scroll: true })
  .addTip('Pro Tip: Tap suggestions di bawah!')
  .addText('# Heading 1\n## Heading 2\n### Heading 3\n\n*Bold* _Italic_ ~Strikethrough~\nHyperlink: [Google](https://google.com)')
  .addCode('javascript', 'const bot = new SazaBot();\nbot.start();')
  .addTable([['DEV', 'ROLE', 'LINK'], ['SazaBot', 'Engine', '[GitHub](https://github.com)']])
  .addImage('https://files.catbox.moe/5da9um.png')
  .addSource([['https://files.catbox.moe/5da9um.png', 'https://github.com', 'Source Code']]);

await ai.send(message.chat, { quoted: message });
```

## Markdown yang Didukung

| Syntax | Hasil |
|--------|-------|
| `*text*` | **Bold** |
| `_text_` | *Italic* |
| `*_text_*` | ***Bold Italic*** |
| `~text~` | ~~Strikethrough~~ |
| `# Heading 1` | Heading besar |
| `## Heading 2` | Heading medium |
| `### Heading 3` | Heading kecil |
| `` `inline code` `` | Inline code |
| ` ```lang\ncode\n``` ` | Code block dengan highlight |
| `[text](url)` | Hyperlink (trusted) |
| `[text](!url)` | Hyperlink (untrusted) |
| `[](url)` | Citation reference |
| `\| col1 \| col2 \|` | Tabel |

## Custom Layout Manual — `newLayout()`

Untuk layout kustom di luar builder methods:

```js
const { AIRich } = require('../lib/messageBuilder.js');
const ai = new AIRich(sock);

// Text custom
ai.addSubmessage({ messageType: 2, messageText: 'Teks manual' });
ai.addSection(AIRich.newLayout('Single', {
  text: '# Judul Manual',
  __typename: 'GenAIMarkdownTextUXPrimitive',
}));

// Code custom (dengan tokenizer)
const meta = AIRich.tokenizer('console.log(1)', 'javascript');
ai.addSubmessage({ messageType: 5, codeMetadata: { codeLanguage: 'javascript', codeBlocks: meta.codeBlock } });
ai.addSection(AIRich.newLayout('Single', {
  language: 'javascript',
  code_blocks: meta.unified_codeBlock,
  __typename: 'GenAICodeUXPrimitive',
}));

// Table custom
const tMeta = AIRich.toTableMetadata([['A', 'B'], ['1', '2']]);
ai.addSubmessage({ messageType: 4, tableMetadata: { rows: tMeta.rows } });
ai.addSection(AIRich.newLayout('Single', { rows: tMeta.unified_rows, __typename: 'GenATableUXPrimitive' }));

// HScroll (carousel)
ai.addSection(AIRich.newLayout('HScroll', [
  { title: 'Item 1', __typename: 'GenAIProductItemCardPrimitive' },
  { title: 'Item 2', __typename: 'GenAIProductItemCardPrimitive' },
]));

// ActionRow (suggestion pills horizontal)
ai.addSection(AIRich.newLayout('ActionRow', [
  { prompt_text: 'Option A', prompt_type: 'SUGGESTED_PROMPT', __typename: 'GenAIFollowUpSuggestionPillPrimitive' },
  { prompt_text: 'Option B', prompt_type: 'SUGGESTED_PROMPT', __typename: 'GenAIFollowUpSuggestionPillPrimitive' },
]));

await ai.send(chatJid, { quoted: message });
```

## Bagaimana Cara Kerjanya

1. **Builder methods** (`addText`, `addCode`, dll) push ke 2 array internal: `_submessages` (protobuf payload) dan `_sections` (UI layout view models)
2. **`.build()`** — resolve semua promises (media), gabung submessages + sections + context info ke satu protobuf `botForwardedMessage > richResponseMessage`
3. **`.send(jid)`** — panggil `sock.relayMessage(jid, proto, { messageId, additionalNodes })` dengan `additionalNodes` format `biz > interactive > native_flow` — memastikan pesan tampil sebagai AI Rich di WhatsApp
4. **`.build().toMarkdown()`** — konversi submessages kembali ke string markdown (untuk logging/fallback)
