// By DranxX Creative
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

const STATUS_ALIASES = { public: 'public', ponly: 'ponly', pconly: 'ponly', gonly: 'gonly', gconly: 'gonly', self: 'self', selfonly: 'self' };

export function normalizeStatus(s) { return STATUS_ALIASES[s] || 'public'; }

export function saveConfig(cfg) {
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n', 'utf-8'); }
  catch (e) { console.error('[config] save failed:', e.message); }
}

export function reloadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw);
}

let _config = (() => {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); }
  catch { return { name: 'Template', owner: '', bot: '', prefix: '.', status: 'public', autoread: 'enable', loginMethod: 'qr', markdown: true }; }
})();

export default _config;
