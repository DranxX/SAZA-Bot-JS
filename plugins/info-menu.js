// By DranxX Creative
import config from '../lib/config.js';
import { getAllPlugins } from '../lib/pluginLoader.js';

const SECTIONS = [
  { title: 'AI', categories: ['ai'], order: ['ai', 'dai', 'sai', 'cai', 'mimo'] },
  { title: 'Information', categories: ['info', 'utility'], order: ['profile', 'menu', 'msgbuild', 'tourl', 'ping', 'speed'] },
  { title: 'Downloader', categories: ['downloader'], order: ['ghdl', 'tiktok'] }
];
const OWNER_ORDER = ['$', 'ban', 'unban', 'listban', 'addprem', 'delprem', 'listprem', 'get', 'set', 'setp', 'del', 'say', 'resend'];
const SUFFIXES = { ai: ', @tag <prompt>' };

export default {
  command: ['menu', 'help'],
  description: 'Tampilkan daftar semua command',
  category: 'info',
  handler: async (message, { prefix, isOwner, args }) => {
    const arg = (args[0] || '').toLowerCase().trim();
    if (!['', 'all', 'ai', 'info', 'information', 'downloader', 'owner'].includes(arg)) return;

    const plugins = getAllPlugins().filter(p => Array.isArray(p.command) && p.command.length && p.category !== 'hidden');
    const used = new Set(), all = [];

    for (const def of SECTIONS) {
      const list = plugins.filter(p => def.categories.includes(p.category)).sort((a, b) => {
        const ai = def.order.indexOf(a.command[0]), bi = def.order.indexOf(b.command[0]);
        const na = ai === -1 ? Number.MAX_SAFE_INTEGER : ai, nb = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
        return na !== nb ? na - nb : a.command[0].localeCompare(b.command[0]);
      });
      if (list.length) { list.forEach(p => used.add(p)); all.push({ title: def.title, key: def.title.toLowerCase(), plugins: list }); }
    }

    const extra = [...new Set(plugins.filter(p => !used.has(p) && p.category !== 'owner').map(p => p.category))].sort();
    for (const cat of extra) {
      const list = plugins.filter(p => !used.has(p) && p.category === cat).sort((a, b) => a.command[0].localeCompare(b.command[0]));
      if (list.length) all.push({ title: cat.charAt(0).toUpperCase() + cat.slice(1), key: cat.toLowerCase(), plugins: list });
    }

    if (isOwner) {
      const owner = plugins.filter(p => p.category === 'owner').sort((a, b) => {
        const ai = OWNER_ORDER.indexOf(a.command[0]), bi = OWNER_ORDER.indexOf(b.command[0]);
        const na = ai === -1 ? Number.MAX_SAFE_INTEGER : ai, nb = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
        return na !== nb ? na - nb : a.command[0].localeCompare(b.command[0]);
      });
      if (owner.length) all.push({ title: 'Owner', key: 'owner', plugins: owner });
    }

    let visible = all;
    if (arg && arg !== 'all') {
      const map = { ai: 'ai', info: 'information', information: 'information', downloader: 'downloader', owner: 'owner' };
      visible = map[arg] ? all.filter(s => s.key === map[arg]) : [];
    }
    if (!visible.length) return;

    const lines = ['╭─── ' + config.name + ' ───', '│', '│ Status: ' + config.status, '│ Prefix: ' + prefix];
    for (const s of visible) {
      lines.push('│', '│ *' + s.title + '*');
      for (const p of s.plugins) {
        const cmds = p.command.map(c => c === '$' ? c : prefix + c).join(', ');
        lines.push('│ ▸ ' + cmds + (SUFFIXES[p.command[0]] || ''));
      }
    }
    lines.push('│', '│ _Saza-Bot Template_', '╰────────────────');
    await message.reply(lines.join('\n'));
  }
};
