import path from 'path';
import fs from 'fs';
import { areJidsSameUser } from 'baileys';
import { getDB } from './sqlite.js';

const DB_DIR = path.join(process.cwd(), 'db', 'banned');
const DB_PATH = path.join(DB_DIR, 'banned.db');

let db;
function open() {
  if (db && !fs.existsSync(DB_PATH)) { try { db.close?.(); } catch {} db = null; }
  if (db) return db;
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  db = getDB(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS banned (
      jid    TEXT PRIMARY KEY,
      number TEXT NOT NULL,
      expiry INTEGER,
      lid    TEXT,
      reason TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_banned_number ON banned(number);
    CREATE INDEX IF NOT EXISTS idx_banned_lid ON banned(lid);
  `);
  return db;
}

function jidNumber(jid) {
  return String(jid || '').split(':')[0].split('@')[0];
}

function phoneJid(num) {
  return num + '@s.whatsapp.net';
}

function lidToPhone(jid, groupMetadata) {
  if (!jid || !jid.endsWith('@lid')) return null;
  if (groupMetadata?.participants) {
    const p = groupMetadata.participants.find(p => areJidsSameUser(p.id, jid));
    if (p?.phoneNumber) return p.phoneNumber.split(':')[0].split('@')[0];
  }
  return null;
}

function resolvePhone(jid, groupMetadata) {
  if (!jid) return null;
  if (jid.endsWith('@s.whatsapp.net')) return jidNumber(jid);
  if (jid.endsWith('@lid')) {
    const phone = lidToPhone(jid, groupMetadata);
    if (phone) return phone;
    return null;
  }
  return jidNumber(jid);
}

function isSameTarget(entry, jid, phoneNum, lidNum) {
  if (areJidsSameUser(entry.jid, jid)) return true;
  if (phoneNum && entry.number === phoneNum) return true;
  if (lidNum && entry.lid === lidNum) return true;
  return false;
}

function cleanExpired() {
  const now = Date.now();
  open().query('DELETE FROM banned WHERE expiry IS NOT NULL AND expiry <= ?').run(now);
}

export function isBanned(senderJid, senderLid, groupMetadata) {
  const now = Date.now();
  const phoneNumber = jidNumber(senderJid);

  let lidNumber = null;
  if (senderLid) {
    lidNumber = jidNumber(senderLid);
  } else if (senderJid?.endsWith('@lid')) {
    lidNumber = phoneNumber;
  }

  let resolvedPhone = phoneNumber;
  if (senderJid?.endsWith('@lid') && groupMetadata?.participants) {
    const p = groupMetadata.participants.find(p => areJidsSameUser(p.id, senderJid));
    if (p?.phoneNumber) resolvedPhone = p.phoneNumber.split(':')[0].split('@')[0];
  }

  const rows = open().query('SELECT * FROM banned').all();

  const entry = rows.find(e => {
    if (areJidsSameUser(e.jid, senderJid)) return true;
    if (senderLid && areJidsSameUser(e.jid, senderLid)) return true;
    if (e.number === phoneNumber) return true;
    if (resolvedPhone && e.number === resolvedPhone) return true;
    if (lidNumber && e.lid === lidNumber) return true;
    return false;
  });

  if (!entry) return { banned: false };

  if (entry.expiry && entry.expiry <= now) {
    open().query('DELETE FROM banned WHERE jid = ?').run(entry.jid);
    return { banned: false };
  }

  return { banned: true, entry };
}

export function addBan(jid, groupMetadata, durationSec = 0) {
  cleanExpired();

  const phone = resolvePhone(jid, groupMetadata);
  const displayNum = phone || jidNumber(jid);
  const targetJid = phone ? phoneJid(phone) : jid;
  const lidNum = jid.endsWith('@lid') ? jidNumber(jid) : null;
  const expiry = durationSec > 0 ? Date.now() + durationSec * 1000 : null;

  const rows = open().query('SELECT * FROM banned').all();
  const existing = rows.find(e => isSameTarget(e, jid, phone, lidNum));

  const newJid = phone ? phoneJid(phone) : jid;
  const newNumber = phone || displayNum;
  const reason = existing?.reason || null;

  open().query('INSERT OR REPLACE INTO banned (jid, number, expiry, lid, reason) VALUES (?, ?, ?, ?, ?)')
    .run(newJid, newNumber, expiry, lidNum || null, reason);

  return {
    ok: true,
    created: !existing,
    entry: { jid: newJid, number: newNumber, expiry, lid: lidNum || null, reason }
  };
}

export function addTemporaryBan(jid, groupMetadata, durationSec = 180, reason = 'spam') {
  cleanExpired();

  const phone = resolvePhone(jid, groupMetadata);
  const displayNum = phone || jidNumber(jid);
  const newJid = phone ? phoneJid(phone) : jid;
  const lidNum = jid.endsWith('@lid') ? jidNumber(jid) : null;

  const rows = open().query('SELECT * FROM banned').all();
  const existing = rows.find(e => isSameTarget(e, jid, phone, lidNum));

  const newExpiry = Date.now() + durationSec * 1000;
  const expiry = (existing?.expiry && existing.expiry > newExpiry) ? existing.expiry : newExpiry;

  open().query('INSERT OR REPLACE INTO banned (jid, number, expiry, lid, reason) VALUES (?, ?, ?, ?, ?)')
    .run(newJid, displayNum, expiry, lidNum || null, reason);

  return { ok: true, entry: { jid: newJid, number: displayNum, expiry, lid: lidNum || null, reason } };
}

export function removeBan(jid, groupMetadata) {
  cleanExpired();

  const phone = resolvePhone(jid, groupMetadata);
  const displayNum = phone || jidNumber(jid);
  const lidNum = jid.endsWith('@lid') ? jidNumber(jid) : null;

  const rows = open().query('SELECT * FROM banned').all();
  const idx = rows.findIndex(e => isSameTarget(e, jid, phone, lidNum));

  if (idx === -1) return { ok: false, error: 'User tidak ada di daftar ban.' };

  const entry = rows[idx];
  open().query('DELETE FROM banned WHERE jid = ?').run(entry.jid);
  return { ok: true, entry };
}

export function listBans() {
  cleanExpired();
  return open().query('SELECT * FROM banned').all();
}
