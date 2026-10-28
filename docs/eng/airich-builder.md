# AIRich Builder — API Reference

`AIRich` is a **fluent builder** for creating WhatsApp AI Rich Responses (Meta AI style). Includes text formatting, syntax-highlighted code blocks, tables, images, video, products, reels, suggestions, and source citations.

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
  .setTitle('Search Results')
  .setBody('Results for: *lorem ipsum*')
  .addCode('console.log("hello world")', 'javascript')
  .addTable([
    ['File', 'Size'],
    ['index.js', '4.2 KB'],
    ['handler.js', '12.8 KB'],
  ])
  .addTip('Use .menu to see all commands.')
  .send(chatJid, { quoted: message });
```

## All Methods

### Metadata

| Method | Description |
|--------|------------|
| `.setTitle(text)` | Title (bold heading) |
| `.setSubtitle(text)` | Subtitle (italic) |
| `.setBody(text)` | Body text (supports markdown) |
| `.setFooter(text)` | Footer (italic at bottom) |
| `.setContextInfo(obj)` | WhatsApp context info (mentions, etc.) |
| `.addPayload(obj)` | Merge extra payload into relay options |

### Text & Code Content

| Method | Description |
|--------|------------|
| `.addText(text)` | Add a text paragraph (supports markdown, hyperlinks, citations, LaTeX) |
| `.addCode(language, code)` | Add a code block with syntax highlighting |
| `.addTable(rows)` | Add a table. `rows = [['H1', 'H2'], ['v1', 'v2']]`. First row = header |
| `.addTip(text)` | Shorthand: `💡 *Tip:* text` |
| `.addSuggest(texts, opts)` | Suggestion pills. `texts` can be a string or array. `opts.scroll` for HScroll |

### Media

| Method | Description |
|--------|------------|
| `.addImage(url)` | Add an image (URL, Buffer, or array) |
| `.addVideo(url)` | Add a video (URL, Buffer, object with `{url, duration, thumbnail}`, or array) |
| `.addReels(items)` | Add reel/instagram video cards. Each item has `username`, `thumbnail`, `url`, `like`, etc. |
| `.addProduct(data)` | Add product card(s). `data` can be an object or array. Has `title`, `brand`, `price`, `sale_price`, `image`, `url` |
| `.addPost(data)` | Add post card(s). `data` can be an object or array. Has `username`, `caption`, `thumbnail`, `like`, `comment`, `share` |

### Sources & Manual Sections

| Method | Description |
|--------|------------|
| `.addSource(sources)` | Add citation source. Format: `[['icon_url', 'link_url', 'label'], ...]` |
| `.addSubmessage(obj)` | Add a raw submessage directly |
| `.addSection(obj)` | Add a raw section directly |
| `.addNewLayout(type, data, extra)` | Add a manual layout section. `type`: `'Single'`, `'HScroll'`, `'ActionRow'` |

### Build & Send

| Method | Description |
|--------|------------|
| `.build(opts)` | Build the full protobuf object. Return has `.send()` and `.toMarkdown()` |
| `.send(jid, opts)` | Build + send via `relayMessage`. `opts.quoted` for reply context |
| `.run(jid, opts)` | Alias for `.send()` |

## Practical Examples

### 1. Simple Text Formatting

```js
await new AIRich(sock)
  .setTitle('Text Formatting')
  .setBody('*This is bold*\n_This is italic_\n*_This is bold + italic_*\n~This is strikethrough~')
  .send(message.chat, { quoted: message });
```

### 2. Code Block with Highlighting

```js
await new AIRich(sock)
  .setTitle('Code Example')
  .addCode('javascript',
    'function fibonacci(n) {\n' +
    '  if (n <= 1) return n;\n' +
    '  return fibonacci(n - 1) + fibonacci(n - 2);\n' +
    '}\n' +
    '\n' +
    'console.log(fibonacci(10)); // 55'
  )
  .addText('The function above calculates the *Fibonacci sequence*.')
  .send(message.chat, { quoted: message });
```

Supported languages: `javascript`, `typescript`, `python`, `java`, `golang`, `rust`, `cpp`, `c`, `php`, `html`, `css`, `bash`, `markdown`, `sql`, `json`.

### 3. Data Tables

```js
await new AIRich(sock)
  .setTitle('Leaderboard')
  .addTable([
    ['Rank', 'Name', 'Score'],
    ['🥇', 'Alice', '9,850'],
    ['🥈', 'Bob', '8,720'],
    ['🥉', 'Charlie', '7,150'],
  ])
  .send(message.chat, { quoted: message });
```

### 4. Mixed Content — Text + Code + Table + Tip + Suggest

```js
const ai = new AIRich(sock);

ai.setTitle('API v2 Documentation')
  .setBody('Available endpoints:');

ai.addTable([
  ['Method', 'Endpoint', 'Auth'],
  ['GET', '/api/users', 'Token'],
  ['POST', '/api/users', 'Token'],
  ['DELETE', '/api/users/:id', 'Admin'],
]);

ai.addText('### Example Request');
ai.addCode('bash', 'curl -H "Authorization: Bearer $TOKEN" https://api.example.com/users');

ai.addTip('Use Bearer token in the Authorization header.');
ai.addSuggest(['View Full Docs', 'Example Response', 'Error Codes'], { scroll: true });

await ai.send(message.chat, { quoted: message });
```

### 5. Image + Product + Source

```js
await new AIRich(sock)
  .setTitle('Product Catalog')
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
  .addText('Bot update v1.2.0 has been released!')
  .build();  // ← returns an object with .send() method

// Send to multiple chats
await built.send('628xxx@s.whatsapp.net');
await built.send('628yyy-123456@g.us');
```

### 7. Full Showcase (all features)

```js
const ai = new AIRich(sock);

ai.setTitle('Message Builder v4.6')
  .setFooter('SazaBot Template')
  .addSuggest(['Bot Info', 'All Categories'], { scroll: true })
  .addTip('Pro Tip: Tap the suggestions below!')
  .addText('# Heading 1\n## Heading 2\n### Heading 3\n\n*Bold* _Italic_ ~Strikethrough~\nHyperlink: [Google](https://google.com)')
  .addCode('javascript', 'const bot = new SazaBot();\nbot.start();')
  .addTable([['DEV', 'ROLE', 'LINK'], ['SazaBot', 'Engine', '[GitHub](https://github.com)']])
  .addImage('https://files.catbox.moe/5da9um.png')
  .addSource([['https://files.catbox.moe/5da9um.png', 'https://github.com', 'Source Code']]);

await ai.send(message.chat, { quoted: message });
```

## Supported Markdown

| Syntax | Result |
|--------|-------|
| `*text*` | **Bold** |
| `_text_` | *Italic* |
| `*_text_*` | ***Bold Italic*** |
| `~text~` | ~~Strikethrough~~ |
| `# Heading 1` | Large heading |
| `## Heading 2` | Medium heading |
| `### Heading 3` | Small heading |
| `` `inline code` `` | Inline code |
| ` ```lang\ncode\n``` ` | Code block with highlighting |
| `[text](url)` | Hyperlink (trusted) |
| `[text](!url)` | Hyperlink (untrusted) |
| `[](url)` | Citation reference |
| `\| col1 \| col2 \|` | Table |

## Custom Manual Layout — `newLayout()`

For custom layouts beyond the builder methods:

```js
const { AIRich } = require('../lib/messageBuilder.js');
const ai = new AIRich(sock);

// Custom text
ai.addSubmessage({ messageType: 2, messageText: 'Manual text' });
ai.addSection(AIRich.newLayout('Single', {
  text: '# Manual Title',
  __typename: 'GenAIMarkdownTextUXPrimitive',
}));

// Custom code (with tokenizer)
const meta = AIRich.tokenizer('console.log(1)', 'javascript');
ai.addSubmessage({ messageType: 5, codeMetadata: { codeLanguage: 'javascript', codeBlocks: meta.codeBlock } });
ai.addSection(AIRich.newLayout('Single', {
  language: 'javascript',
  code_blocks: meta.unified_codeBlock,
  __typename: 'GenAICodeUXPrimitive',
}));

// Custom table
const tMeta = AIRich.toTableMetadata([['A', 'B'], ['1', '2']]);
ai.addSubmessage({ messageType: 4, tableMetadata: { rows: tMeta.rows } });
ai.addSection(AIRich.newLayout('Single', { rows: tMeta.unified_rows, __typename: 'GenATableUXPrimitive' }));

// HScroll (carousel)
ai.addSection(AIRich.newLayout('HScroll', [
  { title: 'Item 1', __typename: 'GenAIProductItemCardPrimitive' },
  { title: 'Item 2', __typename: 'GenAIProductItemCardPrimitive' },
]));

// ActionRow (horizontal suggestion pills)
ai.addSection(AIRich.newLayout('ActionRow', [
  { prompt_text: 'Option A', prompt_type: 'SUGGESTED_PROMPT', __typename: 'GenAIFollowUpSuggestionPillPrimitive' },
  { prompt_text: 'Option B', prompt_type: 'SUGGESTED_PROMPT', __typename: 'GenAIFollowUpSuggestionPillPrimitive' },
]));

await ai.send(chatJid, { quoted: message });
```

## How It Works

1. **Builder methods** (`addText`, `addCode`, etc.) push to 2 internal arrays: `_submessages` (protobuf payload) and `_sections` (UI layout view models)
2. **`.build()`** — resolves all promises (media), merges submessages + sections + context info into a single protobuf `botForwardedMessage > richResponseMessage`
3. **`.send(jid)`** — calls `sock.relayMessage(jid, proto, { messageId, additionalNodes })` with `additionalNodes` in `biz > interactive > native_flow` format — ensuring the message renders as AI Rich in WhatsApp
4. **`.build().toMarkdown()`** — converts submessages back to markdown string (for logging/fallback)
