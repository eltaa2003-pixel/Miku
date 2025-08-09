import { jidDecode } from '@whiskeysockets/baileys';
import { writeFileSync } from 'fs';

let handler = async (m, { conn, isROwner }) => {
  const actualSenderJid = m.key?.participant || m.key?.remoteJid || m.chat;
  let senderNumber = 'COULD_NOT_EXTRACT_NUMBER';
  let isActualOwner = false;

  if (actualSenderJid) {
    try {
      const decoded = jidDecode(actualSenderJid);
      senderNumber = decoded ? decoded.user : actualSenderJid.split('@')[0];
      isActualOwner = global.owner.some(ownerArray => ownerArray[0] === senderNumber);
    } catch (e) {
      console.error('ERROR: Failed to extract senderNumber from JID:', e);
    }
  }

  if (!isActualOwner) {
    return m.reply('You are not the owner!');
  }

  if (typeof process.send !== 'function') {
    return m.reply('❌ This command can only be used when running as a child process.');
  }

  // Send restart message before triggering the restart
  await m.reply('🔄 Restarting Bot...\nPlease wait a moment.');

  // Create a flag file to indicate a restart is in progress and where it was triggered
  const restartInfo = { chatId: m.chat, timestamp: Date.now() };
  writeFileSync('./restart.json', JSON.stringify(restartInfo, null, 2));

  // Trigger the restart via the process manager
  process.send('reset');
}

handler.help = ['restart']
handler.tags = ['owner']
handler.command = ['restart']
handler.owner = true 
export default handler