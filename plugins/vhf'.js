import pkg from '@whiskeysockets/baileys';
const { proto } = pkg;

let handler = async (m, { conn, participants }) => {
    // Check if the sender is an admin
    if (!participants.find(p => p.id === m.sender && p.admin)) {
        return conn.reply(m.chat, 'This command can only be used by group admins.', m);
    }

    // Get the group metadata
    const groupMetadata = await conn.groupMetadata(m.chat);
    const groupInviteLink = await conn.groupInviteCode(m.chat);

    // Create the response message
    const responseMessage = `Group Link: https://chat.whatsapp.com/${groupInviteLink}`;

    // Send the response message
    await conn.reply(m.chat, responseMessage, m);
};

handler.help = ['link'];
handler.tags = ['group'];
handler.command = ['link','رابط'];
handler.group = true; // Restrict to group chats
handler.admin = true; // Restrict to admins only

export default handler;
