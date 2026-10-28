// By DranxX Creative

import { areJidsSameUser } from 'baileys';
import { getPremiumProfile } from '../lib/premiumStore.js';

function getTarget(message, args) {
  if (message.quoted?.sender) return message.quoted.sender;
  const mentioned = message.mentionedJid?.[0];
  if (mentioned) return mentioned;
  const raw = String(args?.[0] || '').replace(/[^0-9]/g, '');
  if (raw) return `${raw}@s.whatsapp.net`;
  return null;
}

function targetPhone(jid, groupMetadata) {
  if (!jid) return '';
  if (jid.endsWith('@s.whatsapp.net')) return jid.split(':')[0].split('@')[0];
  if (jid.endsWith('@lid') && groupMetadata?.participants) {
    const p = groupMetadata.participants.find(item => areJidsSameUser(item.id, jid));
    if (p?.phoneNumber) return p.phoneNumber.split(':')[0].split('@')[0];
  }
  return '';
}

function replyMention(sock, message, text, mentions) {
  return sock.sendMessage(message.chat, { text, mentions }, { quoted: message, ephemeralExpiration: message.contextInfo?.expiration });
}

function mention(number) { return `@${number}`; }
function phoneJid(number) { return `${number}@s.whatsapp.net`; }

export default {
  command: ['profile'],
  description: 'Lihat profil user',
  category: 'info',

  handler: async (message, { args, isOwner, sock, groupMetadata, sender, senderPhone }) => {
    const senderLid = sender?.endsWith('@lid') ? sender : null;
    const selfJid = senderPhone ? `${senderPhone}@s.whatsapp.net` : sender;
    const targetJid = isOwner ? (getTarget(message, args) || selfJid) : selfJid;
    const profile = getPremiumProfile(targetJid, isOwner ? null : senderLid, groupMetadata);
    const number = profile.number || targetPhone(targetJid, groupMetadata);
    const displayTarget = number ? mention(number) : profile.jid || targetJid || '-';
    const text = [
      `Profile ${displayTarget}`,
      '',
      `Premium: ${profile.isPremium ? 'Ya' : 'Tidak'}`,
      `Kredit: ${profile.credits}`
    ].join('\n');

    if (number) return replyMention(sock, message, text, [phoneJid(number)]);
    return message.reply(text);
  }
};
