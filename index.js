// By DranxX Creative

// ── Bungkam leak kunci crypto libsignal ──────────────────────
const _info = console.info;
console.info = (...a) => {
  const s = typeof a[0] === 'string' ? a[0] : '';
  if (s.includes('Closing session') || s.includes('SessionEntry')) return;
  _info.apply(console, a);
};

// ── Auto-recover dari session corrupt (Bad MAC) ──────────────
let _forceReconnect = false;
const _err = console.error;
console.error = (...a) => {
  const s = typeof a[0] === 'string' ? a[0] : '';
  if (s.includes('Bad MAC') || s.includes('Failed to decrypt')) {
    _forceReconnect = true;
    return;
  }
  _err.apply(console, a);
};

import WebSocket from 'ws';

// ── Patch WebSocket buat Bun ─────────────────────────────────
if (typeof Bun !== 'undefined') {
  const UNSUPPORTED = new Set(['upgrade', 'unexpected-response']);
  for (const method of ['on', 'addListener', 'once', 'off', 'removeListener']) {
    const orig = WebSocket.prototype[method];
    if (typeof orig !== 'function') continue;
    WebSocket.prototype[method] = function (event, ...rest) {
      if (UNSUPPORTED.has(event)) return this;
      return orig.call(this, event, ...rest);
    };
  }
}

// ── sharp memory tuning dihapus (native module gak bisa dibundle bun compile) ──

import fs from 'fs';
import path from 'path';
import {
  makeWASocket, DisconnectReason, fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore, Browsers
} from 'baileys';
import { useSQLiteAuthState } from './lib/sqlite-auth.js';
import qrcode from 'qrcode-terminal';
import chalk from 'chalk';
import Pino from 'pino';
import { Messages } from './lib/messages.js';
import { msgHandler } from './handler.js';
import { seen as seenMessage } from './lib/msgdedup.js';
import { loadAllPlugins, watchPlugins } from './lib/pluginLoader.js';
import { inject as injectBuilders } from './lib/messageBuilder.js';
import config from './lib/config.js';

const DB_DIR = path.join(process.cwd(), 'db', 'session');
const DB_PATH = path.join(DB_DIR, 'session.db');

const isBun = typeof Bun !== 'undefined';
const MEMLOG = process.argv.includes('--memlog');

let sock = null, reconnectAttempt = 0, qrRetries = 0, reconnectTimer = null, isConnecting = false, watchdogTimer = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function memReport() {
  const m = process.memoryUsage();
  const rssMB = Math.round(m.rss / 1024 / 1024);
  const heapMB = Math.round(m.heapUsed / 1024 / 1024);
  const extMB = Math.round((m.external || 0) / 1024 / 1024);
  return `RSS ${rssMB}MB | heap ${heapMB}MB | ext ${extMB}MB`;
}

function debounceReconnect(fn) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(fn, 2500);
}

async function clearSession() {
  try { fs.unlinkSync(DB_PATH); } catch {}
  try { fs.unlinkSync(DB_PATH + '-shm'); } catch {}
  try { fs.unlinkSync(DB_PATH + '-wal'); } catch {}
}

// ─── Pairing Code ────────────────────────────────────────────────────

async function requestPairing(socket) {
  const phone = config.bot || config.owner;
  if (!phone) {
    console.log('[boot] isi bot/owner di config.json dulu');
    return;
  }

  try {
    let custom = config.pairscode ? String(config.pairscode).replace(/[^A-Za-z0-9]/g, '') : undefined;
    if (custom && custom.length !== 8) {
      console.log('[boot] Warning: custom pairing code harus tepat 8 karakter');
      custom = undefined;
    }
    const code = await socket.requestPairingCode(phone, custom);
    const display = typeof code === 'string' ? (code.match(/.{1,4}/g)?.join('-') || code) : String(code);
    console.log('[boot] kode pairing:', display);
    return true;
  } catch (e) { console.log('[boot] pairing gagal:', e.message); return false; }
}

// ─── QR Display ──────────────────────────────────────────────────────

function showQR(qr) {
  qrRetries++;
  console.log('[boot] scan QR di bawah:');
  qrcode.generate(qr, { small: true }, s => console.log(s));
}

// ─── Koneksi ─────────────────────────────────────────────────────────

async function connect() {
  if (isConnecting) return;
  isConnecting = true;

  try {
    if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

    const _filteredInfo = console.info;
    console.info = () => {};

    if (sock) {
      try {
        sock.ev.removeAllListeners();
        sock.ws?.close?.();
      } catch {}
      sock = null;
    }

    const { state, saveCreds } = await useSQLiteAuthState();
    let pairingCodeRequested = false;

    const registered = state.creds.registered;
    console.log(registered ? '[boot] restore session...' : '[boot] session baru — perlu login');

    let version;
    try { const { version: v } = await fetchLatestBaileysVersion(); version = v; } catch {}

    const logger = Pino({ level: 'silent' });

    if (MEMLOG) console.log('[boot] mem sebelum socket:', memReport());

    sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      emitOwnEvents: true,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: undefined,
      keepAliveIntervalMs: 25000,
      generateHighQualityLinkPreview: false,
      appStateMacVerification: { patch: false, snapshot: false },
      patchMessageBeforeSending: (msg) => {
        const isInteractive = !!(
          msg.buttonsMessage || msg.templateMessage || msg.listMessage ||
          msg.interactiveMessage || msg.nativeFlowMessage
        );
        if (isInteractive && !msg.viewOnceMessage) {
          msg = {
            viewOnceMessage: {
              message: {
                messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {} },
                ...msg,
              },
            },
          };
        }
        return msg;
      },
      ...(version ? { version } : {}),
    });

    console.info = _filteredInfo;

    sock.ev.on('creds.update', saveCreds);
    injectBuilders(sock);

    let _loginShown = false;

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr && !_loginShown) {
        _loginShown = true;
        if (qrRetries >= 10) { qrRetries = 0; _loginShown = false; await clearSession(); return connect(); }

        if (config.loginMethod === 'pairs') {
          if (!pairingCodeRequested) {
            pairingCodeRequested = true;
            await requestPairing(sock);
          }
        } else {
          showQR(qr);
        }
      }

      if (connection === 'open') {
        reconnectAttempt = 0; qrRetries = 0;
        _loginShown = false;
        _forceReconnect = false;
        console.log('[boot] connected');
        state.creds.registered = true;
        saveCreds();
        if (MEMLOG) console.log('[boot] mem setelah connect:', memReport());

        if (watchdogTimer) clearInterval(watchdogTimer);
        watchdogTimer = setInterval(async () => {
          if (_forceReconnect) {
            _forceReconnect = false;
            console.log('[boot] session corrupt — hapus & reconnect...');
            await clearSession();
            clearInterval(watchdogTimer);
            watchdogTimer = null;
            debounceReconnect(connect);
          }
        }, 5000);
      }

      if (connection === 'close') {
        if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; }
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          console.log('[boot] logged out — clearing session...');
          await clearSession();
          reconnectAttempt = 0; qrRetries = 0; _loginShown = false;
          debounceReconnect(connect);
          return;
        }
        if (code === DisconnectReason.restartRequired) { _loginShown = false; debounceReconnect(connect);
          return;
        }
        if (!state.creds.registered) {
          console.log('[boot] linking...');
          _loginShown = false;
          debounceReconnect(connect);
          return;
        }
        const delay = Math.min(3000 * Math.pow(2, reconnectAttempt), 60000);
        reconnectAttempt++;
        console.log('[boot] disconnect — reconnect dalam', delay / 1000, 'dtk');
        await sleep(delay);
        debounceReconnect(connect);
      }
    });

    sock.ev.on('messages.upsert', async upsert => {
      if (upsert.type !== 'notify') return;
      for (const raw of upsert.messages) {
        if (!raw.key?.remoteJid) continue;
        if (raw.key.remoteJid === 'status@broadcast') continue;
        if (seenMessage(raw.key.remoteJid + '\u0000' + raw.key.id)) continue;
        const age = (Date.now() / 1000) - (raw.messageTimestamp || 0);
        if (age > 60 && !raw.key.fromMe) continue;

        const msg = Messages({ messages: [raw], type: upsert.type }, sock);
        if (!msg) continue;
        if (msg.mtype === 'protocolMessage') continue;
        if (!msg.text && !raw.key.fromMe) continue;

        const tags = {
          conversation: 'msg', extendedTextMessage: 'msg', imageMessage: 'img',
          videoMessage: 'vid', stickerMessage: 'sticker', reactionMessage: 'react',
          audioMessage: 'audio', documentMessage: 'doc', contactMessage: 'contact',
          locationMessage: 'loc', protocolMessage: 'proto',
        };
        const tag = raw.key.fromMe ? 'self' : (tags[msg.mtype] || msg.mtype || 'msg');
        const sender = msg.pushName || msg.sender;
        const preview = msg.text?.slice(0, 80) || msg.mtype || '(no content)';
        console.log(`[${tag}]`, preview, '|', sender);

        if (msg.mtype === 'reactionMessage' || msg.mtype === 'stickerMessage') continue;
        if (!msg.text) continue;
        try { await msgHandler({ messages: [raw], type: upsert.type }, sock, msg); } catch {}
      }
    });

    sock.ev.on('call', async calls => {
      for (const c of calls) if (c.status === 'offer') await sock.rejectCall(c.id, c.from);
    });

  } catch (err) {
    console.log('[boot] koneksi error:', err.message);
    debounceReconnect(connect);
  } finally {
    isConnecting = false;
  }
}

async function start() {
  const C = chalk.cyan;
  const B = C('│');
  const L = C('╭──────────────────────────────╮');
  const R = C('╰──────────────────────────────╯');

  const saza = C.blueBright('Saza') + chalk.gray('-') + C.yellowBright('Bot');
  const drx  = chalk.white('DranxX Creative');
  const mit  = chalk.dim.italic('MIT License');

  console.log(L);
  console.log(B + '           ' + saza + '           ' + B);
  console.log(B + '        ' + drx + '       ' + B);
  console.log(B + '         ' + mit + '          ' + B);
  console.log(R);
  const rt = isBun ? chalk.green('bun') : chalk.yellow('node');
  console.log(chalk.gray('  runtime: ' + rt + ' | login: ' + config.loginMethod + ' | prefix: ' + config.prefix));
  if (MEMLOG) console.log('[boot] mem startup:', memReport());
  await loadAllPlugins();
  watchPlugins();
  await connect();
  process.on('SIGINT', () => { if (sock) try { sock.ws?.close?.(); } catch {} process.exit(0); });
}

start().catch(err => { console.error('[fatal]', err.message); process.exit(1); });
