let handler = async (m, { conn, text, participants, isAdmin, isOwner, groupMetadata }) => {
    let users = participants.map(u => u.id).filter(v => v !== conn.user.jid)
    
    if (users.length > 50 && !isOwner) {
      const confirmButtons = {
        buttonText: 'Confirm',
        callbackId: 'tagall_confirm',
        url: null
      };
      return await m.reply(`⚠️ This group has ${users.length} members. Tagging everyone can be spammy. Owner can proceed.`);
    }
    
    const messageText = `▢ Group : *${groupMetadata.subject}*\n▢ Members : *${participants.length}*${text ? `\n▢ Message : ${text}\n` : ''}\n┌───⊷ *MENTIONS*\n` +
      users.map(v => '▢ @' + v.replace(/@.+/, '')).join`\n` +
      '\n└──✪ YUKI ┃ ᴮᴼᵀ ✪──'
    
    await conn.sendMessage(m.chat, {
      text: messageText,
      mentions: users
    });
  }
  
  handler.help = ['tagall']
  handler.tags = ['group']
  handler.command = ['tagall',"منشن"]
  handler.admin = true
  handler.group = true
  
  export default handler
  