// By DranxX Creative
import config, { normalizeStatus, saveConfig } from '../lib/config.js';

const INFO = { public: 'group & chat pribadi', ponly: 'hanya chat pribadi', gonly: 'hanya grup', self: 'hanya owner' };

export default {
  command: ['set'],
  description: 'Ganti mode bot: public, ponly, gonly, self',
  category: 'owner',
  handler: async (message, { q, isOwner, prefix }) => {
    if (!isOwner) return;
    const s = (q || '').trim().toLowerCase();
    if (!s) return message.reply(`Masukkan status.\nContoh: ${prefix}set public\n\nPilihan: public, ponly, gonly, self`);
    const ns = normalizeStatus(s);
    if (ns === 'public' && s !== 'public') return message.reply('Status tidak valid. Pilih: public, ponly, gonly, self.');
    if (ns === config.status) return message.reply(`Status sudah "${ns}" (${INFO[ns]}).`);
    config.status = ns;
    saveConfig(config);
    await message.reply(`Status diubah ke "${ns}" (${INFO[ns]}).`);
  }
};
