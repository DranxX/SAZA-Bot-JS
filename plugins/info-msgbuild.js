// By DranxX Creative

const DEMOS = {
  text: {
    label: 'Format Teks',
    build: ai => ai.setTitle('Format Teks').setBody('*Ini teks tebal*\n_Ini teks miring_\n*_Ini tebal + miring_*\n~Ini teks dicoret~\n\nGunakan *bold* untuk penekanan,\n_italic_ untuk istilah asing.')
  },
  code: {
    label: 'Syntax Highlight',
    build: ai => ai.setTitle('Kode JavaScript').addCode('javascript', 'function formatUptime(detik) {\n  const jam = Math.floor(detik / 3600);\n  const menit = Math.floor((detik % 3600) / 60);\n  const sisa = detik % 60;\n  return `${jam}j ${menit}m ${sisa}d`;\n}\n\nconsole.log(formatUptime(3661));\n// → 1j 1m 1d')
  },
  table: {
    label: 'Tabel',
    build: ai => ai.setTitle('Daftar Command').addTable([['Command', 'Kategori', 'Fungsi'], ['.menu', 'Info', 'Tampilkan menu'], ['.ping', 'Utility', 'Cek respon bot'], ['.ai', 'AI', 'Chat dengan AI']])
  },
  combined: {
    label: 'Kombinasi',
    build: ai => ai.setTitle('Demo Kombinasi').addText('Pesan ini menggabungkan teks berformat dan code block:').addCode('javascript', 'const sapa = (nama) =>\n  `Halo, ${nama}!`;\n\nconsole.log(sapa("Dunia"));').addText('Semua dalam *satu* rich message.')
  },
  latex: {
    label: 'LaTeX Formula',
    build: ai => ai.setTitle('LaTeX Rendering')
      .addText('AIRich mendukung render *LaTeX formula* via inline entity.\n\nContoh: [E=mc^{2}|400|100]<https://latex.codecogs.com/png.latex?\\dpi{150}\\bg{white}E%3Dmc^{2}>')
      .addTip('Format: [label|width|height]<url PNG image> — LaTeX dirender sebagai gambar via codecogs. URL harus valid PNG.')
  }
};

const KEYS = Object.keys(DEMOS);
const FULL_MODES = ['button', 'buttonv2', 'carousel', 'airich', 'newlayout', 'all'];

export default {
  command: ['msgbuild', 'airich'],
  description: 'Demo AI Rich Response & Interactive Messages',
  category: 'info',

  handler: async (message, { sock, q, prefix, commandName }) => {
    const arg = (q || '').toLowerCase().trim();
    const chat = message.chat;

    // Full test modes
    if (FULL_MODES.includes(arg)) return runFullTest(message, sock, arg, chat);

    // Help or invalid arg — show as rich message
    if (!arg || arg === 'help' || !KEYS.includes(arg)) {
      const ai = sock.MsgAIRich();
      ai.setTitle('Message Builder');
      ai.addText('Demo fitur *AI Rich Response*.\n\n*Sub-perintah:*');
      for (const k of KEYS) ai.addText(`▸ ${prefix}${commandName} ${k} — ${DEMOS[k].label}`);
      ai.addText(`\n*Full test:* ${prefix}${commandName} [button|buttonv2|carousel|airich|newlayout|all]`);
      return ai.send(chat, { quoted: message });
    }

    // Single simple demo
    const demo = DEMOS[arg];
    const ai = sock.MsgAIRich();
    demo.build(ai);
    await ai.send(chat, { quoted: message });
  }
};

// ── Full test runner ────────────────────────────────────────────────────

async function runFullTest(m, sock, mode, chat) {
  const AIRC = sock.MsgAIRich.AIRich;

  if (mode === 'button' || mode === 'all') {
    await sock.MsgButton()
      .setTitle('Title Message').setSubtitle('Subtitle Message')
      .setBody('Body Message').setFooter('Footer Message')
      .setImage('https://files.catbox.moe/5da9um.png')
      .addReply('Menu', '.menu', { icon: 'DEFAULT' }).addReply('Profile', '.profile', { icon: 'REVIEW' })
      .addUrl('Website', 'https://example.com', true, { icon: 'PROMOTION' })
      .addCopy('Copy Code', 'SAZA-2026', { icon: 'DOCUMENT' })
      .addSelection('Pilih Kategori').makeSection('Main Menu')
      .makeRow('HOT', 'Downloader', 'Download social media', '.dl')
      .makeRow('FAST', 'AI Chat', 'Chat dengan AI', '.ai')
      .send(chat, { quoted: m });
    if (mode !== 'all') return;
  }

  if (mode === 'buttonv2' || mode === 'all') {
    await sock.MsgButtonV2()
      .setTitle('Title Message').setSubtitle('Subtitle Message')
      .setBody('Body Message').setFooter('Footer Message')
      .setThumbnail('https://files.catbox.moe/5da9um.png')
      .addButton('Menu', '.menu').addButton('Profile', '.profile')
      .send(chat);
    if (mode !== 'all') return;
  }

  if (mode === 'carousel' || mode === 'all') {
    await sock.MsgCarousel()
      .setBody('Product List').setFooter('Swipe untuk lihat')
      .addCard(await sock.MsgButton().setTitle('Burger').setBody('Burger terenak').setFooter('$5')
        .setImage('https://files.catbox.moe/5da9um.png').addReply('Buy', '.buy burger').toCard())
      .addCard(await sock.MsgButton().setTitle('Pizza').setBody('Pizza mozzarella').setFooter('$7')
        .setImage('https://files.catbox.moe/5da9um.png').addReply('Buy', '.buy pizza').toCard())
      .send(chat, { quoted: m });
    if (mode !== 'all') return;
  }

  if (mode === 'airich' || mode === 'all') {
    await sock.MsgAIRich()
      .setTitle('Message Builder v4.6').setFooter('SazaBot Template')
      .addSuggest(['Bot Info', 'All Categories', 'Active Settings'], { scroll: true })
      .addTip('Pro Tip: Tap suggestions below to navigate quickly!')
      .addText('# Message Builder Showcase\n## Dynamic GenAI Layout\n### Interactive Elements\n* **Hyperlink**: Visit [Google](https://google.com)\n* **Citation**: [](https://www.rizzy.eu.org)')
      .addCode('javascript', 'class SazaBot {\n  static init() {\n    console.log("Premium WhatsApp Bot active!");\n  }\n}')
      .addTable([['DEVELOPER', 'ROLE', 'LINK'], ['SazaBot', 'Core Engine', '[GitHub](https://github.com)']])
      .addSource([['https://files.catbox.moe/5da9um.png', 'https://github.com', 'GitHub Source']])
      .addImage('https://files.catbox.moe/5da9um.png')
      .send(chat, { quoted: m });
    if (mode !== 'all') return;
  }

  if (mode === 'newlayout' || mode === 'all') {
    const rich = sock.MsgAIRich();
    rich.setTitle('newLayout() Demo').setFooter('SazaBot Template');
    rich.addSubmessage({ messageType: 2, messageText: 'Manual text via newLayout' });
    rich.addSection(AIRC.newLayout('Single', { text: '# Manual Text Section\nAdded via `AIRich.newLayout()`.', __typename: 'GenAIMarkdownTextUXPrimitive' }));
    const meta = AIRC.tokenizer('// newLayout code demo\nrich.addNewLayout("Single", data);', 'javascript');
    rich.addSubmessage({ messageType: 5, codeMetadata: { codeLanguage: 'javascript', codeBlocks: meta.codeBlock } });
    rich.addSection(AIRC.newLayout('Single', { language: 'javascript', code_blocks: meta.unified_codeBlock, __typename: 'GenAICodeUXPrimitive' }));
    const tMeta = AIRC.toTableMetadata([['METHOD', 'LAYOUT', 'USE CASE'], ['newLayout("Single")', 'Single', 'Text, Code'], ['newLayout("HScroll")', 'HScroll', 'Carousel'], ['newLayout("ActionRow")', 'ActionRow', 'Suggestions']]);
    rich.addSubmessage({ messageType: 4, tableMetadata: { title: '', rows: tMeta.rows } });
    rich.addSection(AIRC.newLayout('Single', { rows: tMeta.unified_rows, __typename: 'GenATableUXPrimitive' }));
    rich.addSection(AIRC.newLayout('ActionRow', [{ prompt_text: 'Single', prompt_type: 'SUGGESTED_PROMPT', __typename: 'GenAIFollowUpSuggestionPillPrimitive' }, { prompt_text: 'HScroll', prompt_type: 'SUGGESTED_PROMPT', __typename: 'GenAIFollowUpSuggestionPillPrimitive' }, { prompt_text: 'ActionRow', prompt_type: 'SUGGESTED_PROMPT', __typename: 'GenAIFollowUpSuggestionPillPrimitive' }]));
    await rich.send(chat, { quoted: m });
  }
}
