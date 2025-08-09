let handler = async (m, { conn, usedPrefix, command }) => {
  if (!m.isGroup || !m.participant) throw `✳️ يمكن استخدام هذا الأمر فقط في المجموعات.`;
  const groupMetadata = await conn.groupMetadata(m.chat);
  const admins = groupMetadata.participants.filter(participant => participant.admin);
  const isAdmin = admins.some(admin => admin.id === m.sender);

  if (!isAdmin) throw `✳️ فقط المديرين يمكنهم استخدام هذا الأمر.`;

  if (!m.quoted) throw `✳️ يرجى الرد على الرسالة التي تريد حذفها.`;
  try {
      let delet = m.message.extendedTextMessage.contextInfo.participant;
      let bang = m.message.extendedTextMessage.contextInfo.stanzaId;
      return conn.sendMessage(m.chat, {
          delete: { remoteJid: m.chat, fromMe: false, id: bang, participant: delet },
      });
  } catch {
      return conn.sendMessage(m.chat, { delete: m.quoted.vM.key });
  }
}

handler.help = ['delete'];
handler.tags = ['group'];
handler.command = ['حذف'];
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

export default handler;
