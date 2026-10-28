// By DranxX Creative

const reacts = [
  { keys: ['wkwk', 'wkkw', 'haha', '😂', '🤣'], emoji: '😂' },
  { keys: ['anj', 'anjay', 'anjir'], emoji: '🗿' },
  { keys: ['bgst', 'bangsat'], emoji: '😡' },
  { keys: ['makasih', 'thx', 'thanks', 'tq'], emoji: '❤️' },
  { keys: ['sad', 'sedih', '😢', ':(', ':('], emoji: '😢' }
];

export default {
  command: ['autorespon'],
  description: 'Auto react emoji',
  category: 'hidden',
  handler: async () => { },

  before: async (message, { budy }) => {
    if (!budy) return;
    const text = budy.toLowerCase();

    for (const rule of reacts) {
      if (rule.keys.some(k => text.includes(k))) {
        message.react(rule.emoji).catch(() => { });
        break; // one reaction per message
      }
    }
  }
};
