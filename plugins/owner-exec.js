// By DranxX Creative
/**
 * Shell command execution (owner only).
 * $ ls -la
 * $ cat file.txt
 */

import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export default {
  command: ['$'],
  description: 'Execute terminal commands',
  category: 'owner',
  handler: async (message, { q }) => {
    if (!q) return message.reply('Masukkan command!\nContoh: $ ls');
    try {
      const { stdout, stderr } = await execPromise(q, { timeout: 30000, maxBuffer: 1024 * 500 });
      const output = (stdout || stderr || 'Done (no output).').trim();
      await message.reply(output.slice(0, 4000));
    } catch (e) {
      await message.reply(`*ERROR*\n\n${e.message}`);
    }
  }
};
