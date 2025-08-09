let handler = async (m, { conn, text, participants, isAdmin, isOwner, groupMetadata }) => {
    let users = participants.map(u => u.id).filter(v => v !== conn.user.jid)
    
    // Create the message text with mentions
    const messageText = `▢ Group : *${groupMetadata.subject}*\n▢ Members : *${participants.length}*${text ? `\n▢ Message : ${text}\n` : ''}\n┌───⊷ *MENTIONS*\n` +
      users.map(v => '▢ @' + v.replace(/@.+/, '')).join`\n` +
      '\n└──✪ YUKI ┃ ᴮᴼᵀ ✪──'
    
    // Send message with mentions
    conn.sendMessage(m.chat, {
      text: messageText,
      mentions: users
    })
  }
  
  handler.help = ['tagall']
  handler.tags = ['group']
  handler.command = ['tagall',"منشن"]
  handler.admin = true
  handler.group = true
  
  export default handler
  