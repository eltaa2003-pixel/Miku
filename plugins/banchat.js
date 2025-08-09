import fs from 'fs';

const handler = async (m, { conn, isOwner }) => {
  try {
    // Check if user is owner
    if (!isOwner) {
      return m.reply('❌ *Access Denied*\nOnly bot owners can ban chats.');
    }

    // Initialize chat data if it doesn't exist
    if (!global.db.data.chats[m.chat]) {
      global.db.data.chats[m.chat] = {
        isBanned: false,
        // Add other default chat properties as needed
      };
    }

    // Check if chat is already banned
    if (global.db.data.chats[m.chat].isBanned) {
      return m.reply('⚠️ *Chat is already banned!*');
    }

    // Ban the chat
    global.db.data.chats[m.chat].isBanned = true;
    
    // Database automatically saves when data is modified

    // Send confirmation message
    const banMessage = `🚫 *Chat Banned Successfully!*

📝 *Chat Info:*
• *Chat ID:* ${m.chat}
• *Chat Name:* ${m.isGroup ? m.chat.split('@')[0] : 'Private Chat'}
• *Banned By:* @${m.sender.split('@')[0]}
• *Banned At:* ${new Date().toLocaleString()}

⚠️ *Note:* This chat is now banned and cannot use bot commands.
Only bot owners can unban this chat using *.unbanchat*`;

    await m.reply(banMessage);

    // Log the ban action

  } catch (error) {
    await m.reply('❌ *Error occurred while banning chat*\nPlease try again or contact the bot owner.');
  }
};

// Add before property to run this check before other commands
handler.before = async function (m, { conn, isOwner, isROwner }) {
  // Skip if message doesn't start with command prefix
  if (!m.text || !m.text.startsWith('.')) return;
  
  // Skip if user is owner or rowner (they can always use commands)
  if (isOwner || isROwner) return;
  
  // Initialize chat data if it doesn't exist
  if (!global.db.data.chats[m.chat]) {
    global.db.data.chats[m.chat] = {
      isBanned: false,
    };
  }
  
  // Check if chat is banned
  if (global.db.data.chats[m.chat].isBanned) {
    // Block the command by throwing an error or returning false
    await m.reply('🚫 *Chat Banned*\n\nThis chat has been banned from using bot commands.\nOnly bot owners can unban this chat.');
    throw new Error('Chat is banned');
  }
};

handler.help = ['banchat'];
handler.tags = ['owner'];
handler.command = /^banchat$/i;
handler.rowner = true;
handler.owner = true;

export default handler;