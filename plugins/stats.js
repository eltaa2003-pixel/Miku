// plugins/stats.js
import os from 'os';

/**
 * Format milliseconds into a human‑readable uptime string.
 * @param {number} ms
 */
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (60 * 1000)) % 60;
  const hours   = Math.floor(ms / (60 * 60 * 1000)) % 24;
  const days    = Math.floor(ms / (24 * 60 * 60 * 1000));
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

const handler = async (m, { conn }) => {
  // Bot uptime (in ms) via process.uptime()
  const uptimeMs = process.uptime() * 1000;

  // Memory usage
  const memUsage = process.memoryUsage();
  const rssMb  = (memUsage.rss / 1024 / 1024).toFixed(1);
  const heapMb = (memUsage.heapUsed / 1024 / 1024).toFixed(1);

  // System memory
  const totalSysMb = (os.totalmem() / 1024 / 1024).toFixed(0);
  const freeSysMb  = (os.freemem() / 1024 / 1024).toFixed(0);

  // CPU load (1 minute average)
  const loadAvg = os.loadavg()[0].toFixed(2);

  // Commands executed (sum of totals from stats DB)
  let totalCommands = 0;
  try {
    const stats = global.db?.data?.stats || {};
    totalCommands = Object.values(stats)
      .reduce((sum, stat) => sum + (stat.total || 0), 0);
  } catch {
    // stats might be undefined if DB hasn't been initialised yet
    totalCommands = 0;
  }

  const message = [
    '📊 *Bot Statistics*',
    '',
    `• Uptime: ${formatUptime(uptimeMs)}`,
    `• Memory (RSS/Heap): ${rssMb} MB / ${heapMb} MB`,
    `• System Memory (Free/Total): ${freeSysMb} MB / ${totalSysMb} MB`,
    `• CPU load (1 min avg): ${loadAvg}`,
    `• Commands executed: ${totalCommands}`,
  ].join('\n');

  await m.reply(message);
};

handler.help = ['stats'];
handler.tags = ['info'];
handler.command = /^(stats|status)$/i;

export default handler;