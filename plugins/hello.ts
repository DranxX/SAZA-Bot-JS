// By DranxX Creative
/**
 * Sample TypeScript plugin — demonstrates TS plugin support.
 * .hello .hi
 *
 * Works natively with Bun. For Node.js, install tsx:
 *   npm install -D tsx
 *   node --import tsx index.js
 */

interface PluginContext {
  sock: any;
  message: any;
  prefix: string;
  args: string[];
  q: string;
  budy: string;
  commandName: string;
  sender: string;
  senderPhone: string;
  isGroup: boolean;
  isOwner: boolean;
  ownerNum: string;
  botNum: string;
  groupMetadata: any;
  pushname: string;
  _receivedAt: number;
}

function mention(number: string) { return `@${number}`; }
function phoneJid(number: string) { return `${number}@s.whatsapp.net`; }

export default {
  command: ['hello', 'hi'],
  description: 'Sapa bot (TypeScript plugin demo)',
  category: 'info',

  handler: async (message: any, ctx: PluginContext) => {
    const { prefix, sender, senderPhone, sock } = ctx;
    const number = senderPhone;
    const displayTarget = number ? mention(number) : sender || '-';

    const text = `Halo ${displayTarget}! 👋\n\nIni plugin TypeScript.\nKetik ${prefix}menu untuk lihat command.`;

    if (number) {
      await sock.sendMessage(message.chat, { text, mentions: [phoneJid(number)] }, { quoted: message });
    } else {
      await message.reply(text);
    }
  }
};
