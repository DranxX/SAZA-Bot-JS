// By DranxX Creative
import config, { saveConfig } from '../lib/config.js';

export default {
  command: ['setp', 'setprefix'],
  description: 'Ganti prefix command bot',
  category: 'owner',
  handler: async (message, { q, isOwner }) => {
    if (!isOwner) return;
    const p = (q || '').trim();
    if (!p) return message.reply(`Masukkan prefix baru.\nContoh: ${config.prefix}setp !`);
    if (/\s/.test(p)) return message.reply('Prefix tidak boleh mengandung spasi.');
    if (p === config.prefix) return message.reply(`Prefix sudah "${p}".`);
    const old = config.prefix;
    config.prefix = p;
    saveConfig(config);
    await message.reply(`Prefix diubah dari "${old}" ke "${p}".`);
  }
};
