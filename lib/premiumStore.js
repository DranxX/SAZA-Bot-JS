// By DranxX Creative
/**
 * Premium Store — SQLite-based premium user management.
 * Ported from drxai-js/lib/premiumStore.js
 */

import { getDB } from './sqlite.js';
import path from 'path';
import fs from 'fs';
import { areJidsSameUser } from 'baileys';

const DB_DIR = path.join(process.cwd(), 'db', 'premium');
const DB_PATH = path.join(DB_DIR, 'premium.db');

export const MONTHLY_PREMIUM_CREDITS = 10;

// ── DB init ───────────────────────────────────────────────────────────────

let db;
function open() {
  if (db && !fs.existsSync(DB_PATH)) { try { db.close?.(); } catch {} db = null; }
  if (db) return db;
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  db = getDB(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS premium (
      jid           TEXT PRIMARY KEY,
      number        TEXT NOT NULL,
      expiry        INTEGER,
      lid           TEXT,
      credits       INTEGER NOT NULL DEFAULT 10,
      credit_period TEXT NOT NULL,
      added_at      INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_premium_number ON premium(number);
    CREATE INDEX IF NOT EXISTS idx_premium_lid ON premium(lid);
  `);
  return db;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function jidNumber(jid) {
  return String(jid || '').split(':')[0].split('@')[0];
}

function phoneJid(num) {
  return num + '@s.whatsapp.net';
}

function phoneFromLid(jid, groupMetadata) {
  if (!String(jid || '').endsWith('@lid')) return null;
  if (!groupMetadata?.participants) return null;
  const participant = groupMetadata.participants.find(item => areJidsSameUser(item.id, jid));
  if (!participant?.phoneNumber) return null;
  return jidNumber(participant.phoneNumber);
}

function resolvePhone(jid, groupMetadata) {
  if (!jid) return null;
  if (jid.endsWith('@s.whatsapp.net')) return jidNumber(jid);
  if (jid.endsWith('@lid')) {
    const phone = phoneFromLid(jid, groupMetadata);
    if (phone) return phone;
    return null;
  }
  return jidNumber(jid);
}

function resolveTarget(jid, senderLid = null, groupMetadata = null) {
  const sourceJid = String(jid || '').trim();
  const sourceLid = String(senderLid || '').trim();
  const targetJid = sourceJid || sourceLid;
  if (!targetJid) return null;

  let number = null;
  let lid = null;

  if (sourceLid.endsWith('@lid')) lid = jidNumber(sourceLid);
  if (targetJid.endsWith('@lid')) {
    lid = jidNumber(targetJid);
    number = resolvePhone(targetJid, groupMetadata);
  } else {
    number = resolvePhone(targetJid, groupMetadata);
  }
  if (!lid && sourceJid.endsWith('@lid')) lid = jidNumber(sourceJid);

  return {
    jid: number ? phoneJid(number) : targetJid,
    number: number || null,
    lid: lid || null
  };
}

function sameEntry(entry, target) {
  if (entry?.jid && target?.jid && areJidsSameUser(entry.jid, target.jid)) return true;
  if (entry?.number && target?.number && entry.number === target.number) return true;
  if (entry?.lid && target?.lid && entry.lid === target.lid) return true;
  return false;
}

// ── Normalize & clean ─────────────────────────────────────────────────────

function normalizeEntry(entry, period) {
  if (!entry || typeof entry !== 'object') return false;
  let changed = false;

  if (!entry.credit_period || entry.credit_period !== period) {
    entry.credit_period = period;
    entry.credits = MONTHLY_PREMIUM_CREDITS;
    changed = true;
  }

  if (!Number.isInteger(entry.credits) || entry.credits < 0) {
    entry.credits = Math.max(0, parseInt(entry.credits, 10) || 0);
    changed = true;
  }

  if (!entry.added_at) {
    entry.added_at = Date.now();
    changed = true;
  }

  if (changed) entry.updated_at = Date.now();
  return changed;
}

function getList(period = currentPeriod()) {
  const rows = open().query('SELECT * FROM premium').all();
  let changed = false;

  for (const entry of rows) {
    changed = normalizeEntry(entry, period) || changed;
  }

  // Persist any normalization changes
  if (changed) {
    const upd = open().query(`
      UPDATE premium SET credit_period=?, credits=?, added_at=?, updated_at=? WHERE jid=?
    `);
    const txn = open().transaction(() => {
      for (const e of rows) upd.run(e.credit_period, e.credits, e.added_at, e.updated_at, e.jid);
    });
    txn();
  }
  return rows;
}

function cleanExpired() {
  const now = Date.now();
  open().query('DELETE FROM premium WHERE expiry IS NOT NULL AND expiry <= ?').run(now);
}

function getCleanList(period = currentPeriod()) {
  cleanExpired();
  return getList(period);
}

function findEntry(list, target) {
  return list.find(entry => sameEntry(entry, target)) || null;
}

// ── Public API ────────────────────────────────────────────────────────────

/** List all premium users (cleaned + normalized). */
export function listPremiumUsers() {
  const period = currentPeriod();
  const list = getCleanList(period);
  return list.map(entry => ({ ...entry }));
}

/**
 * Get premium profile for a user.
 * Returns full profile even if user is not premium (isPremium: false).
 */
export function getPremiumProfile(jid, senderLid = null, groupMetadata = null) {
  const target = resolveTarget(jid, senderLid, groupMetadata);
  const period = currentPeriod();
  const list = getCleanList(period);
  const entry = target ? findEntry(list, target) : null;

  if (!target) {
    return {
      isPremium: false, credits: 0, creditPeriod: period,
      number: '', jid: '', lid: null, expiry: null, addedAt: null, updatedAt: null
    };
  }

  if (!entry) {
    return {
      isPremium: false, credits: 0, creditPeriod: period,
      number: target.number || '', jid: target.jid, lid: target.lid,
      expiry: null, addedAt: null, updatedAt: null
    };
  }

  return {
    isPremium: true, credits: entry.credits, creditPeriod: entry.credit_period,
    number: entry.number, jid: entry.jid, lid: entry.lid,
    expiry: entry.expiry, addedAt: entry.added_at, updatedAt: entry.updated_at
  };
}

/**
 * Add or update a premium user.
 * @returns {{ ok: boolean, created?: boolean, entry?: object, error?: string }}
 */
export function addPremiumUser(jid, groupMetadata = null, durationSec = 0) {
  const target = resolveTarget(jid, null, groupMetadata);
  if (!target) return { ok: false, error: 'Target tidak valid.' };

  const period = currentPeriod();
  const list = getCleanList(period);
  const entry = findEntry(list, target);
  const expiry = durationSec > 0 ? Date.now() + durationSec * 1000 : null;

  const now = Date.now();
  const newLid = target.lid || null;

  if (entry) {
    // Update existing
    open().query(`
      UPDATE premium SET jid=?, number=?, expiry=?, lid=?, updated_at=?
      WHERE jid=?
    `).run(target.jid, target.number, expiry, newLid, now, entry.jid);

    // Re-read to get normalized data
    const updated = open().query('SELECT * FROM premium WHERE jid = ?').get(target.jid);
    normalizeEntry(updated, period);
    return { ok: true, created: false, entry: { ...updated, isPremium: true } };
  }

  // Insert new
  open().query(`
    INSERT INTO premium (jid, number, expiry, lid, credits, credit_period, added_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(target.jid, target.number, expiry, newLid, MONTHLY_PREMIUM_CREDITS, period, now, now);

  const created = open().query('SELECT * FROM premium WHERE jid = ?').get(target.jid);
  return { ok: true, created: true, entry: { ...created, isPremium: true } };
}

/**
 * Remove a premium user.
 */
export function deletePremiumUser(jid, groupMetadata = null) {
  const target = resolveTarget(jid, null, groupMetadata);
  if (!target) return { ok: false, error: 'Target tidak valid.' };

  const list = getCleanList(currentPeriod());
  const entry = findEntry(list, target);
  if (!entry) return { ok: false, error: 'User tidak ada di daftar premium.' };

  open().query('DELETE FROM premium WHERE jid = ?').run(entry.jid);
  return { ok: true, entry: { ...entry, isPremium: true } };
}

/**
 * Set premium credits to an absolute value.
 */
export function setPremiumCredits(jid, senderLid = null, groupMetadata = null, credits = 0) {
  const target = resolveTarget(jid, senderLid, groupMetadata);
  if (!target) return { ok: false, error: 'Target tidak valid.' };

  const list = getCleanList(currentPeriod());
  const entry = findEntry(list, target);
  if (!entry) return { ok: false, error: 'User belum premium.' };

  const val = Math.max(0, parseInt(credits, 10) || 0);
  open().query('UPDATE premium SET credits=?, updated_at=? WHERE jid=?').run(val, Date.now(), entry.jid);
  const updated = open().query('SELECT * FROM premium WHERE jid = ?').get(entry.jid);
  return { ok: true, entry: { ...updated, isPremium: true } };
}

/**
 * Add credits to a premium user.
 */
export function addPremiumCredits(jid, senderLid = null, groupMetadata = null, amount = 0) {
  const target = resolveTarget(jid, senderLid, groupMetadata);
  if (!target) return { ok: false, error: 'Target tidak valid.' };

  const list = getCleanList(currentPeriod());
  const entry = findEntry(list, target);
  if (!entry) return { ok: false, error: 'User belum premium.' };

  const newCredits = entry.credits + Math.max(0, parseInt(amount, 10) || 0);
  open().query('UPDATE premium SET credits=?, updated_at=? WHERE jid=?').run(newCredits, Date.now(), entry.jid);
  const updated = open().query('SELECT * FROM premium WHERE jid = ?').get(entry.jid);
  return { ok: true, entry: { ...updated, isPremium: true } };
}

/**
 * Remove credits from a premium user (floor at 0).
 */
export function removePremiumCredits(jid, senderLid = null, groupMetadata = null, amount = 0) {
  const target = resolveTarget(jid, senderLid, groupMetadata);
  if (!target) return { ok: false, error: 'Target tidak valid.' };

  const list = getCleanList(currentPeriod());
  const entry = findEntry(list, target);
  if (!entry) return { ok: false, error: 'User belum premium.' };

  const newCredits = Math.max(0, entry.credits - Math.max(0, parseInt(amount, 10) || 0));
  open().query('UPDATE premium SET credits=?, updated_at=? WHERE jid=?').run(newCredits, Date.now(), entry.jid);
  const updated = open().query('SELECT * FROM premium WHERE jid = ?').get(entry.jid);
  return { ok: true, entry: { ...updated, isPremium: true } };
}

/**
 * Consume a premium credit. Rejects if insufficient balance.
 */
export function consumePremiumCredit(jid, senderLid = null, groupMetadata = null, amount = 1) {
  const target = resolveTarget(jid, senderLid, groupMetadata);
  if (!target) return { ok: false, error: 'Target tidak valid.' };

  const list = getCleanList(currentPeriod());
  const entry = findEntry(list, target);
  if (!entry) return { ok: false, error: 'User belum premium.' };

  const cost = Math.max(1, parseInt(amount, 10) || 1);
  if (entry.credits < cost) {
    return { ok: false, error: 'Kredit tidak cukup.', entry: { ...entry, isPremium: true } };
  }

  const newCredits = entry.credits - cost;
  open().query('UPDATE premium SET credits=?, updated_at=? WHERE jid=?').run(newCredits, Date.now(), entry.jid);
  const updated = open().query('SELECT * FROM premium WHERE jid = ?').get(entry.jid);
  return { ok: true, entry: { ...updated, isPremium: true } };
}
