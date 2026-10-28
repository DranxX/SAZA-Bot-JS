// By DranxX Creative
import { getPlugin, getAllPlugins } from './lib/pluginLoader.js';
import { isBanned, addTemporaryBan } from './lib/banStore.js';
import { getPremiumProfile } from './lib/premiumStore.js';
import { cached as cachedLoad, invalidate } from './lib/singleflight.js';
import { check as checkAntispam, sweep as antispamSweep } from './lib/antispam.js';
import { run as gatedRun } from './lib/commandGate.js';
import config from './lib/config.js';

const ACTIVE_AI = new Map();

// ── Group metadata cache: single-flight + 24h TTL + stale fallback (per chat JID) ──
const GROUP_METADATA_TTL_MS = 86400000; // 24h
const registeredSocks = new WeakSet();

async function getGroupMetadata(sock, chatJid) {
  if (!registeredSocks.has(sock)) {
    registeredSocks.add(sock);
    sock.ev.on('group-participants.update', (update) => invalidate('gm:' + update.id));
    sock.ev.on('groups.update', (updates) => {
      for (const u of updates) invalidate('gm:' + u.id);
    });
  }
  return cachedLoad('gm:' + chatJid, GROUP_METADATA_TTL_MS, () => sock.groupMetadata(chatJid));
}

// Periodic cleanup of antispam tracking; unref so it never holds the process alive
setInterval(() => antispamSweep(), 5 * 60 * 1000).unref?.();

// ── LID→phone cache ──────────────────────────────────────────────────
const lidPhoneCache = new Map();

async function resolveLidPhone(sock, jid) {
  if (!jid?.endsWith('@lid')) return null;
  if (lidPhoneCache.has(jid)) return lidPhoneCache.get(jid);
  try {
    const pn = await sock.signalRepository?.lidMapping?.getPNForLID(jid);
    if (pn) { lidPhoneCache.set(jid, pn); return pn; }
  } catch {}
  lidPhoneCache.set(jid, null);
  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────
function cleanPhone(jid) { return (jid || '').replace(/@.*$/, '').replace(/:.*$/, ''); }

// ── Main handler ─────────────────────────────────────────────────────
export async function msgHandler(upsert, sock, message) {
  const _receivedAt = Date.now();
  try {
    if (!message?.sender) return;
    const text = message.text || '';

    const isGroup = message.isGroup;
    const sender = message.sender;

    let groupMetadata = null;
    if (isGroup) {
      try { groupMetadata = await getGroupMetadata(sock, message.chat); } catch {}
    }

    let cleanSender = cleanPhone(sender).replace(/\D/g, '');
    if (sender.endsWith('@lid')) {
      let resolved = null;
      if (groupMetadata?.participants) {
        const p = groupMetadata.participants.find(part => part.id && (part.id === sender || part.id.startsWith(cleanPhone(sender) + '@')));
        if (p?.phoneNumber) resolved = p.phoneNumber;
      }
      if (!resolved) {
        resolved = await resolveLidPhone(sock, sender);
      }
      if (resolved) cleanSender = cleanPhone(resolved).replace(/\D/g, '');
    }

    const ownerNum = String(config.owner || '').replace(/\D/g, '');
    const botNum = String(config.bot || '').replace(/\D/g, '');
    const isOwner = message.key.fromMe || cleanSender === ownerNum || cleanSender === botNum;

    for (const p of getAllPlugins()) {
      if (p.before) try { await p.before(message, { sock, text, isGroup, isOwner, config, budy: text }); } catch {}
    }

    if (!text) return;

    const status = config.status || 'public';
    if (status === 'self' && cleanSender !== botNum && cleanSender !== ownerNum) return;
    if (status === 'ponly' && isGroup) return;
    if (status === 'gonly' && !isGroup) return;

    // Ban check (silent)
    if (!isOwner) {
      const senderLid = sender.endsWith('@lid') ? sender : null;
      const banResult = isBanned(sender, senderLid, groupMetadata);
      if (banResult.banned) return;
    }

    const prefix = config.prefix || '.';
    let cmdName = '', args = [];
    if (text.startsWith(prefix)) {
      const parts = text.slice(prefix.length).trim().split(/\s+/);
      cmdName = parts[0]?.toLowerCase() || '';
      args = parts.slice(1);
    } else if (text.startsWith('$ ') && isOwner) {
      cmdName = '$'; args = [text.slice(2).trim()];
    }
    if (!cmdName) return;

    const plugin = getPlugin(cmdName);
    if (!plugin) return;

    // ── Tier resolve + anti-spam (per contact, sebelum mutation apa pun) ──
    let isPremium = false;
    if (!isOwner) {
      const pJid = cleanSender ? cleanSender + '@s.whatsapp.net' : sender;
      const senderLid = sender.endsWith('@lid') ? sender : null;
      isPremium = !!getPremiumProfile(pJid, senderLid, groupMetadata).isPremium;

      const raw = upsert?.messages?.[0];
      const msgTsMs = raw?.messageTimestamp ? Math.round(raw.messageTimestamp * 1000) : 0;
      const spam = checkAntispam(cleanSender, { isOwner, isPremium }, config, msgTsMs);
      if (!spam.allowed) {
        if (spam.ban) {
          addTemporaryBan(sender, groupMetadata, Math.ceil(spam.banMs / 1000), 'spam');
          return message.reply(`🚫 Kamu di-banned sementara (${Math.round(spam.banMs / 60000)} menit) karena spam command.`);
        }
        if (spam.warn) return message.reply('⚠️ Jangan spam command. Beri jeda sebentar antar command ya.');
        return;
      }
    }

    const ukey = cleanPhone(sender);
    if (plugin.category === 'ai') {
      const act = ACTIVE_AI.get(ukey);
      if (act && Date.now() - act < 300000) return message.reply('⏳ AI sedang memproses. Tunggu selesai dulu ya.');
      ACTIVE_AI.set(ukey, Date.now());
    }

    const ctx = { sock, message, prefix, args, q: args.join(' '), budy: text, commandName: cmdName, sender, isGroup, isOwner, ownerNum, botNum, groupMetadata, _receivedAt, senderPhone: cleanSender, pushname: message.pushName || '' };

    // Execution log
    const chatType = isGroup ? 'group' : 'dm';
    const logLine = `[${cmdName}] ${cleanSender} (${chatType})` + (args.length ? ' args: ' + args.join(' ') : '');
    console.log(logLine);

    const tier = (isOwner || isPremium) ? 'premium' : 'free';
    try {
      await gatedRun(cleanSender, tier, () => plugin.handler(message, ctx), config, { parallel: !!plugin.parallel });
    } catch (err) {
      if (err.code === 'EBUSY') await message.reply('⏳ Masih ada command yang diproses. Tunggu sebentar ya.').catch(() => {});
      else if (err.code === 'EQUEUEFULL') await message.reply('⏳ Antrean command penuh. Coba lagi sebentar lagi.').catch(() => {});
      else if (err.code === 'ETIMEDOUT') await message.reply('⏳ Command kamu kehabisan waktu menunggu antrean. Coba lagi ya.').catch(() => {});
      else {
        console.error('[' + cmdName + ']', err.message);
        await message.reply('Error: ' + err.message).catch(() => {});
      }
    } finally { if (plugin.category === 'ai') ACTIVE_AI.delete(ukey); }
  } catch (err) { console.error('[handler]', err.message); }
}
