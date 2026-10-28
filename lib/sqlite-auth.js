// By DranxX Creative
import path from 'path';
import fs from 'fs';
import { BufferJSON, initAuthCreds, proto } from 'baileys';
import { getDB } from './sqlite.js';

const DB_DIR = path.join(process.cwd(), 'db', 'session');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = path.join(DB_DIR, 'session.db');

let db;
function open() {
  // Invalidate cache if DB file was deleted (clearSession)
  if (db && !fs.existsSync(DB_PATH)) {
    try { db.close?.(); } catch {}
    db = null;
  }
  if (db) return db;
  db = getDB(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_state (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS kv_store (type TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (type, id));
  `);
  return db;
}

function read(key) {
  const row = open().query('SELECT data FROM auth_state WHERE id = ?').get(key);
  if (!row) return null;
  try { return JSON.parse(row.data, BufferJSON.reviver); } catch { return null; }
}

function write(key, value) {
  open().query('INSERT OR REPLACE INTO auth_state (id, data) VALUES (?, ?)').run(key, JSON.stringify(value, BufferJSON.replacer));
}

export async function useSQLiteAuthState() {
  open();

  let creds = read('creds');
  if (!creds) {
    creds = initAuthCreds();
    write('creds', creds);
  }

  const keys = {
    get(type, ids) {
      if (!ids.length) return {};
      const ph = ids.map(() => '?').join(',');
      const rows = open().query(`SELECT id, data FROM kv_store WHERE type = ? AND id IN (${ph})`).all(type, ...ids);
      const out = {};
      for (const r of rows) {
        try {
          let value = JSON.parse(r.data, BufferJSON.reviver);
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          }
          out[r.id] = value;
        } catch {}
      }
      return out;
    },
    set(data) {
      // Baileys passes nested format: { type: { shortId: value } }
      // null values signal key deletion (libsignal.js:193: sessionUpdates[addr] = null)
      const d = open();
      const ins = d.query('INSERT OR REPLACE INTO kv_store (type, id, data) VALUES (?, ?, ?)');
      const del = d.query('DELETE FROM kv_store WHERE type = ? AND id = ?');
      const insertBatch = [];
      const deleteBatch = [];
      for (const [type, innerMap] of Object.entries(data)) {
        if (!innerMap || typeof innerMap !== 'object') continue;
        for (const [shortId, value] of Object.entries(innerMap)) {
          if (value === null) {
            deleteBatch.push([type, shortId]);
          } else {
            insertBatch.push([type, shortId, JSON.stringify(value, BufferJSON.replacer)]);
          }
        }
      }
      if (insertBatch.length || deleteBatch.length) {
        const txn = d.transaction(() => {
          for (const b of insertBatch) ins.run(...b);
          for (const b of deleteBatch) del.run(...b);
        });
        txn();
      }
    },
  };

  return {
    state: { creds, keys: { get: keys.get, set: keys.set } },
    saveCreds: () => {
      write('creds', creds);
    },
  };
}
