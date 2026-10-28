// By DranxX Creative

import { areJidsSameUser } from 'baileys';
import { addPremiumUser, deletePremiumUser, listPremiumUsers } from '../lib/premiumStore.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function getTarget(message, args) {
  if (message.quoted?.sender) {
    return { jid: message.quoted.sender, consumedArgs: 0 };
  }

  const mentioned = message.mentionedJid?.[0];
  if (mentioned) {
    return { jid: mentioned, consumedArgs: 0 };
  }

  let hasNumberArg = false;
  for (const arg of args || []) {
    const stripped = arg.replace(/\D/g, '');
    if (stripped.length >= 7) {
      hasNumberArg = true;
      break;
    }
  }

  if (!hasNumberArg && message.chat && !message.chat.endsWith('@g.us')) {
    return { jid: message.chat, consumedArgs: 0 };
  }

  const raw = String(args?.[0] || '').replace(/[^0-9]/g, '');
  if (raw) {
    return { jid: `${raw}@s.whatsapp.net`, consumedArgs: 1 };
  }

  return { jid: null, consumedArgs: 0 };
}

function targetPhone(jid, groupMetadata) {
  if (!jid) return '';
  if (jid.endsWith('@s.whatsapp.net')) {
    return jid.split(':')[0].split('@')[0];
  }
  if (jid.endsWith('@lid') && groupMetadata?.participants) {
    const participant = groupMetadata.participants.find(item => areJidsSameUser(item.id, jid));
    if (participant?.phoneNumber) {
      return participant.phoneNumber.split(':')[0].split('@')[0];
    }
  }
  return '';
}

function replyMention(sock, message, text, mentions) {
  return sock.sendMessage(message.chat, {
    text,
    mentions
  }, {
    quoted: message,
    ephemeralExpiration: message.contextInfo?.expiration
  });
}

function mention(number) {
  return `@${number}`;
}

function phoneJid(number) {
  return `${number}@s.whatsapp.net`;
}

function parseDuration(str) {
  if (!str) return 0;
  let total = 0;
  const matches = str.matchAll(/(\d+)\s*(s|m|h|d)/gi);
  for (const match of matches) {
    const value = parseInt(match[1], 10);
    switch (match[2].toLowerCase()) {
      case 's': total += value; break;
      case 'm': total += value * 60; break;
      case 'h': total += value * 3600; break;
      case 'd': total += value * 86400; break;
    }
  }
  return total;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return 'Permanent';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}

function getDurationArg(args) {
  for (const arg of args) {
    if (/\d+\s*(s|m|h|d)/i.test(arg)) return arg;
  }
  return null;
}

// ── Plugin ────────────────────────────────────────────────────────────────

export default {
  command: ['addprem', 'delprem', 'listprem'],
  description: 'Kelola premium user',
  category: 'owner',

  handler: async (message, { commandName, args, isOwner, sock, groupMetadata }) => {
    if (!isOwner) return;

    // ── listprem ───────────────────────────────────────────────────────
    if (commandName === 'listprem') {
      const list = listPremiumUsers();
      if (!list.length) return message.reply('Tidak ada user premium.');

      const mentions = [];
      const now = Date.now();
      const text = list.map((entry, index) => {
        const number = entry.number || '';
        if (number) mentions.push(phoneJid(number));
        const remaining = entry.expiry ? formatDuration(Math.ceil((entry.expiry - now) / 1000)) : 'Permanent';
        return `${index + 1}. ${number ? mention(number) : entry.jid}\n   Sisa: ${remaining}\n   Kredit: ${entry.credits}`;
      }).join('\n\n');

      return replyMention(sock, message, `*Premium Users:*\n\n${text}`, mentions);
    }

    // ── addprem / delprem ──────────────────────────────────────────────
    const target = getTarget(message, args);
    if (!target.jid) return message.reply('Target wajib reply/tag/nomor.');

    const number = targetPhone(target.jid, groupMetadata);
    const mentions = number ? [phoneJid(number)] : [];

    if (commandName === 'addprem') {
      const durationSec = parseDuration(getDurationArg(args));
      const result = addPremiumUser(target.jid, groupMetadata, durationSec);
      if (!result.ok) return message.reply(result.error);
      const displayNumber = result.entry.number || number;
      const durText = durationSec > 0 ? formatDuration(durationSec) : 'permanent';
      const action = result.created ? 'added to premium' : 'premium duration updated';
      return replyMention(
        sock, message,
        `${displayNumber ? mention(displayNumber) : 'User'} ${action} (${durText}).\nCredits: ${result.entry.credits}.`,
        mentions
      );
    }

    if (commandName === 'delprem') {
      const result = deletePremiumUser(target.jid, groupMetadata);
      const displayNumber = result.entry?.number || number;
      if (!result.ok) {
        return replyMention(sock, message, `${displayNumber ? mention(displayNumber) : 'User'} ${result.error}`, mentions);
      }
      return replyMention(sock, message, `${displayNumber ? mention(displayNumber) : 'User'} removed from premium.`, mentions);
    }
  }
};
