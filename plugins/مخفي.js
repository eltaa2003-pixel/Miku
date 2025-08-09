import baileys from '@whiskeysockets/baileys';
const { proto, generateWAMessageFromContent } = baileys;

let handler = async (message, { conn, text, participants }) => {
  // Check if sender is admin
  if (!participants.find(participant => participant.id === message.sender && participant.admin)) {
    return conn.reply(message.chat, "This command can only be used by group admins.", message);
  }
  
  let tagMessage;
  
  // If replying to a message, use that message as the tag message
  if (message.quoted) {
    tagMessage = message.quoted.text || "";
  } else {
    // If not replying to anything, use blank message
    tagMessage = "";
  }
  
  // Get all participant IDs for tagging (filter out bot's own ID)
  let participantIds = participants.map(participant => participant.id).filter(id => id !== conn.user.id);
  
  // Create message object with mentions
  const messageContent = {
    extendedTextMessage: {
      text: tagMessage,
      contextInfo: {
        mentionedJid: participantIds
      }
    }
  };
  
  // Generate WhatsApp message
  const waMessage = generateWAMessageFromContent(
    message.chat, 
    proto.Message.fromObject(messageContent), 
    {
      userJid: conn.user.id
    }
  );
  
  // Send the message
  await conn.relayMessage(message.chat, waMessage.message, {
    messageId: waMessage.key.id
  });
};

handler.help = ['broadcast'];
handler.tags = ['group'];
handler.command = ["مخفي"]; // Arabic command meaning "hidden"
handler.group = true;
handler.admin = true;

export default handler;