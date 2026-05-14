// lib/autoBackup.js
import fs from 'fs';
import moment from 'moment-timezone';

// Function to perform the backup and send to owners
async function performBackup(conn) {
  const dbPath = './database.json';
  if (!fs.existsSync(dbPath)) return;

  const buffer = fs.readFileSync(dbPath);
  const timestamp = moment().format('YYYYMMDD_HHmmss');

  // Send to each owner
  for (const [num] of global.owner) {
    const jid = num.replace(/\D/g, '') + '@s.whatsapp.net';
    await conn.sendMessage(jid, {
      document: buffer,
      fileName: `bot-backup-${timestamp}.json`,
      mimetype: 'application/json'
    });
  }
  console.log(`[Backup] Database backup sent at ${timestamp}`);
}

// Schedule the next backup at a specific hour (e.g. 02:00 Asia/Beirut)
export function scheduleDailyBackup(conn, hour = 2) {
  if (global.dailyBackupTimeout) {
    clearTimeout(global.dailyBackupTimeout);
    global.dailyBackupTimeout = null;
  }
  if (global.dailyBackupInterval) {
    clearInterval(global.dailyBackupInterval);
    global.dailyBackupInterval = null;
  }

  const now = moment().tz('Asia/Beirut');
  let next = now.clone().hour(hour).minute(0).second(0).millisecond(0);

  // If the target time has already passed today, schedule for tomorrow
  if (next.isBefore(now)) next = next.add(1, 'day');

  const delay = next.diff(now);
  global.dailyBackupTimeout = setTimeout(async () => {
    await performBackup(global.conn || conn);
    // After the first run, repeat every 24 hours
    global.dailyBackupInterval = setInterval(() => performBackup(global.conn || conn), 24 * 60 * 60 * 1000);
  }, delay);

  console.log(`[Backup] Next automatic backup scheduled at ${next.format()}`);
}
