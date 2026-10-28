// By DranxX Creative
import os from 'os';

const fmt = (v, u) => v.toFixed(2) + u;

let lastCpu = null, cachedCpu = 0;
function sampleCpu() {
  const snap = os.cpus().reduce((a, c) => { const t = Object.values(c.times).reduce((s, v) => s + v, 0); a.idle += c.times.idle; a.total += t; return a; }, { idle: 0, total: 0 });
  if (lastCpu) { const dT = snap.total - lastCpu.total, dI = snap.idle - lastCpu.idle; cachedCpu = dT > 0 ? (1 - dI / dT) * 100 : 0; }
  lastCpu = snap;
}
sampleCpu(); setInterval(sampleCpu, 3000);

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  const parts = []; if (d) parts.push(d + 'd'); if (h) parts.push(h + 'h'); if (m) parts.push(m + 'm'); parts.push(s + 's'); return parts.join(' ');
}

export default {
  command: ['ping', 'stats', 'status'],
  description: 'Cek kecepatan respon bot',
  category: 'utility',
  handler: async (message, { _receivedAt }) => {
    const totalRam = os.totalmem(), usedRam = totalRam - os.freemem(), botRam = process.memoryUsage().rss;
    const pUsage = process.cpuUsage();
    const botCpu = ((pUsage.user + pUsage.system) / 1000 / os.cpus().length / (process.uptime() * 1000)) * 100;
    const speed = Date.now() - _receivedAt;
    const msg = '*Pong!*\n\nSpeed: ' + speed + ' ms\n\nCPU Server: ' + fmt(cachedCpu, '%') + '\nCPU Bot: ' + fmt(Math.min(botCpu, 100), '%') + '\n\nRAM Server: ' + fmt(usedRam / 1024 ** 3, ' GB') + ' / ' + fmt(totalRam / 1024 ** 3, ' GB') + ' (' + fmt((usedRam / totalRam) * 100, '%') + ')\nRAM Bot: ' + fmt(botRam / 1024 ** 2, ' MB') + '\n\nUptime: ' + fmtUptime(process.uptime());
    await message.reply(msg);
  }
};
