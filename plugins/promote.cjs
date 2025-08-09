const isAdmin = require('../lib/isAdmin.cjs');

let handler = async (m, { conn }) => {
    let mentionedJids = m.mentionedJid || [];
    let userToPromote = [];
    // Check for mentioned users
    if (mentionedJids && mentionedJids.length > 0) {
        userToPromote = mentionedJids;
    }
    // Check for replied message
    else if (m.quoted && m.quoted.sender) {
        userToPromote = [m.quoted.sender];
    }
    if (userToPromote.length === 0) {
        await conn.sendMessage(m.chat, {
            text: 'Please mention the user or reply to their message to promote!'
        });
        return;
    }
    try {
        await conn.groupParticipantsUpdate(m.chat, userToPromote, "promote");
        const usernames = await Promise.all(userToPromote.map(async jid => `@${jid.split('@')[0]}`));
        const promoterJid = m.sender;
        const promotionMessage = `*『 GROUP PROMOTION 』*\n\n` +
            `👥 *Promoted User${userToPromote.length > 1 ? 's' : ''}:*\n` +
            `${usernames.map(name => `• ${name}`).join('\n')}\n\n` +
            `👑 *Promoted By:* @${promoterJid.split('@')[0]}\n\n` +
            `📅 *Date:* ${new Date().toLocaleString()}`;
        await conn.sendMessage(m.chat, {
            text: promotionMessage,
            mentions: [...userToPromote, promoterJid]
        });
    } catch (error) {
        console.error('Error in promote command:', error);
        await conn.sendMessage(m.chat, { text: 'Failed to promote user(s)!' });
    }
};

handler.help = ['promote', 'ترقيه', 'ترقية'];
handler.tags = ['group'];
handler.command = ['promote', 'ترقيه', 'ترقية'];
handler.admin = true;
handler.group = true;
handler.botAdmin = true;

module.exports = {
  default: handler,
  handlePromotionEvent
};

// Keep the event handler for group-participants.update
async function handlePromotionEvent(sock, groupId, participants, author) {
    try {
        const promotedUsernames = await Promise.all(participants.map(async jid => {
            return `@${jid.split('@')[0]}`;
        }));
        let promotedBy;
        let mentionList = [...participants];
        if (author && author.length > 0 && author !== sock.user.id) {
            const authorJid = author;
            promotedBy = `@${authorJid.split('@')[0]}`;
            mentionList.push(authorJid);
        } else {
            promotedBy = 'System (WhatsApp did not provide the admin info)';
        }
        const promotionMessage = `*『 GROUP PROMOTION 』*\n\n` +
            `👥 *Promoted User${participants.length > 1 ? 's' : ''}:*\n` +
            `${promotedUsernames.map(name => `• ${name}`).join('\n')}\n\n` +
            `👑 *Promoted By:* ${promotedBy}\n\n` +
            `📅 *Date:* ${new Date().toLocaleString()}`;
        await sock.sendMessage(groupId, {
            text: promotionMessage,
            mentions: mentionList
        });
    } catch (error) {
        console.error('Error handling promotion event:', error);
    }
}
