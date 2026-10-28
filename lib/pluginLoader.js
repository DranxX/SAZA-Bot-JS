// By DranxX Creative
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const PLUGINS_DIR = path.join(process.cwd(), 'plugins');

const commandMap = new Map();
const pluginFiles = new Map();
const plugins = [];
let pluginVersion = 0;

// Bun: transpiler scan validates syntax without executing; Node relies on import() failure.
function syntaxCheck(code, filePath) {
  if (typeof Bun !== 'undefined') {
    try {
      const loader = filePath.endsWith('.ts') ? 'tsx' : 'js';
      new Bun.Transpiler({ loader }).scan(code);
      return null;
    } catch (e) { return e.message; }
  }
  return null;
}

async function loadPlugin(filePath) {
  try {
    const code = fs.readFileSync(filePath, 'utf-8');
    const syntaxErr = syntaxCheck(code, filePath);
    if (syntaxErr) {
      console.error('[plugin]', path.basename(filePath), 'syntax error:', String(syntaxErr).split('\n')[0]);
      return;
    }
    const mod = await import(pathToFileURL(filePath).href + '?t=' + Date.now());
    const p = mod.default;
    if (!p?.command || !p?.handler) { console.log('[plugin] skip', path.basename(filePath)); return; }

    const old = pluginFiles.get(filePath);
    if (old) { plugins.splice(plugins.indexOf(old), 1); old.command.forEach(c => commandMap.delete(c)); }

    const cmds = Array.isArray(p.command) ? p.command : [p.command];
    p.command = cmds;
    cmds.forEach(c => commandMap.set(c, p));
    pluginFiles.set(filePath, p);
    plugins.push(p);
    pluginVersion++;
    console.log('[plugin]', path.basename(filePath), '→', cmds.join(', '));
  } catch (err) { console.error('[plugin]', path.basename(filePath), err.message); }
}

function unloadPlugin(filePath) {
  const p = pluginFiles.get(filePath);
  if (!p) return;
  plugins.splice(plugins.indexOf(p), 1);
  p.command.forEach(c => commandMap.delete(c));
  pluginFiles.delete(filePath);
  pluginVersion++;
}

async function loadAllPlugins() {
  if (!fs.existsSync(PLUGINS_DIR)) fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
  for (const f of files) await loadPlugin(path.join(PLUGINS_DIR, f));
  console.log('[plugin]', plugins.length, 'plugins,', commandMap.size, 'commands');
}

async function watchPlugins() {
  let c; try { c = (await import('chokidar')).default; } catch { return null; }
  const w = c.watch('./plugins', { ignored: /(^|[\/\\])\..*/, persistent: true, ignoreInitial: true });
  const ext = (fp) => fp.endsWith('.js') || fp.endsWith('.ts');
  // Debounce per file, last event wins — editors that save via unlink+add stay consistent.
  const pending = new Map();
  const schedule = (fp, action) => {
    const t = pending.get(fp);
    if (t) clearTimeout(t);
    pending.set(fp, setTimeout(() => {
      pending.delete(fp);
      if (action === 'load') loadPlugin(path.resolve(fp));
      else unloadPlugin(path.resolve(fp));
    }, 150));
  };
  w.on('add', fp => { if (ext(fp)) schedule(fp, 'load'); });
  w.on('change', fp => { if (ext(fp)) schedule(fp, 'load'); });
  w.on('unlink', fp => { if (ext(fp)) schedule(fp, 'unload'); });
  return w;
}

function getPlugin(c) { return commandMap.get(c); }
function getAllPlugins() { return plugins; }
function getPluginVersion() { return pluginVersion; }
export { loadAllPlugins, watchPlugins, getPlugin, getAllPlugins, getPluginVersion, commandMap, pluginVersion };
