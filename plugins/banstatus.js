const handler = async (m, { conn, isOwner }) => {
  try {
    // Check if user is owner
    if (!isOwner) {
      return m.reply('❌ *Access Denied*\nOnly bot owners can check ban status.');
    }

    // Initialize chat data if it doesn't exist
    if (!global.db.data.chats[m.chat]) {
      global.db.data.chats[m.chat] = {
        isBanned: false,
      };
    }

    const isBanned = global.db.data.chats[m.chat].isBanned;
    const status = isBanned ? '🚫 *BANNED*' : '✅ *ACTIVE*';
    const statusEmoji = isBanned ? '🔴' : '🟢';

    const statusMessage = `${statusEmoji} *Chat Ban Status*

📝 *Chat Info:*
• *Chat ID:* ${m.chat}
• *Chat Name:* ${m.isGroup ? m.chat.split('@')[0] : 'Private Chat'}
• *Status:* ${status}
• *Checked By:* @${m.sender.split('@')[0]}
• *Checked At:* ${new Date().toLocaleString()}

${isBanned ? '⚠️ *This chat is banned and cannot use bot commands.*' : '✅ *This chat is active and can use bot commands.*'}`;

    await m.reply(statusMessage);

  } catch (error) {
    await m.reply('❌ *Error occurred while checking ban status*\nPlease try again or contact the bot owner.');
  }
};

handler.help = ['banstatus'];
handler.tags = ['owner'];
handler.command = /^banstatus$/i;
handler.rowner = true;
handler.owner = true;

export default handler; 