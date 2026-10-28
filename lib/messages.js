// By DranxX Creative
import { getContentType, jidNormalizedUser } from 'baileys';

export function Messages(upsert, sock) {
  const { messages } = upsert;
  const m = messages[0];
  if (!m?.key) return null;

  m.id = m.key.id;
  m.isGroup = m.key.remoteJid.endsWith('@g.us');
  m.chat = jidNormalizedUser(m.key.remoteJid);
  m.sender = m.isGroup
    ? (m.key.participantAlt || m.key.participant || (m.key.fromMe ? sock.user?.id : m.key.remoteJid))
    : (m.key.fromMe ? sock.user?.id : m.key.remoteJid);
  m.sender = jidNormalizedUser(m.sender || '');

  if (!m.message) return m;

  // Unwrap ephemeral / view-once / document-with-caption wrappers
  if (m.message.ephemeralMessage) {
    m.message = m.message.ephemeralMessage.message;
    m.mtype = getContentType(m.message);
  }
  if (m.message.viewOnceMessageV2 || m.message.documentWithCaptionMessage) {
    m.message = m.message[m.message.viewOnceMessageV2 ? 'viewOnceMessageV2' : 'documentWithCaptionMessage'].message;
  }
  if (m.message.viewOnceMessageV2Extension) {
    m.message = m.message.viewOnceMessageV2Extension.message;
  }

  m.mtype = getContentType(m.message);
  m.type = m.mtype;

  // Dynamic text extraction — same as drxai-js
  try {
    const body = m.message[m.type];
    m.text = body?.caption || body?.text || body?.conversation || m.message?.conversation || '';
  } catch { m.text = ''; }

  const ci = m.message?.[m.mtype]?.contextInfo;
  m.mentionedJid = ci?.mentionedJid || [];

  try {
    if (ci?.stanzaId && ci?.quotedMessage) {
      const q = ci.quotedMessage;
      const qmtype = getContentType(q);
      m.quoted = { message: q, participant: ci.participant, sender: ci.participant };
      m.quoted.mtype = qmtype;
      m.quoted.text = q[qmtype]?.caption || q[qmtype]?.text || q.conversation || q.extendedTextMessage?.text || '';
      m.quoted.key = { id: ci.stanzaId, fromMe: sock.user?.id === ci.participant, remoteJid: m.chat };
    } else { m.quoted = null; }
  } catch { m.quoted = null; }

  m.reply = text => sock.sendMessage(m.chat, { text: String(text) }, { quoted: m });
  m.react = emoji => sock.sendMessage(m.chat, { react: { text: String(emoji), key: m.key } });
  m.delete = () => sock.sendMessage(m.chat, { delete: m.key });
  return m;
}
