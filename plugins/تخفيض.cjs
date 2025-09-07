const isAdmin = require('../lib/isAdmin.cjs');

let handler = async (m, { conn }) => {
    let mentionedJids = m.mentionedJid || [];
    let userToDemote = [];
    if (mentionedJids && mentionedJids.length > 0) {
        userToDemote = mentionedJids;
    } else if (m.quoted && m.quoted.sender) {
        userToDemote = [m.quoted.sender];
    }
    if (userToDemote.length === 0) {
        await conn.sendMessage(m.chat, {
            text: 'Please mention the user or reply to their message to demote!'
        });
        return;
    }
    try {
        await conn.groupParticipantsUpdate(m.chat, userToDemote, "demote");
        const usernames = await Promise.all(userToDemote.map(async jid => `@${jid.split('@')[0]}`));
        const demoterJid = m.sender;
        const demotionMessage = `*『 GROUP DEMOTION 』*\n\n` +
            `👤 *Demoted User${userToDemote.length > 1 ? 's' : ''}:*\n` +
            `${usernames.map(name => `• ${name}`).join('\n')}\n\n` +
            `👑 *Demoted By:* @${demoterJid.split('@')[0]}\n\n` +
            `📅 *Date:* ${new Date().toLocaleString()}`;
        await conn.sendMessage(m.chat, {
            text: demotionMessage,
            mentions: [...userToDemote, demoterJid]
        });
    } catch (error) {
        console.error('Error in demote command:', error);
        await conn.sendMessage(m.chat, { text: 'Failed to demote user(s)!' });
    }
};

handler.help = ['demote', 'تخفيض'];
handler.tags = ['group'];
handler.command = ['demote', 'تخفيض'];
handler.admin = true;
handler.group = true;
handler.botAdmin = true;

module.exports = {
  default: handler,
  handleDemotionEvent
};

// Keep the event handler for group-participants.update
async function handleDemotionEvent(sock, groupId, participants, author) {
    try {
        const demotedUsernames = await Promise.all(participants.map(async jid => {
            return `@${jid.split('@')[0]}`;
        }));
        let demotedBy;
        let mentionList = [...participants];
        if (author && author.length > 0 && author !== sock.user.id) {
            const authorJid = author;
            demotedBy = `@${authorJid.split('@')[0]}`;
            mentionList.push(authorJid);
        } else {
            demotedBy = 'System (WhatsApp did not provide the admin info)';
        }
        const demotionMessage = `*『 GROUP DEMOTION 』*\n\n` +
            `👤 *Demoted User${participants.length > 1 ? 's' : ''}:*\n` +
            `${demotedUsernames.map(name => `• ${name}`).join('\n')}\n\n` +
            `👑 *Demoted By:* ${demotedBy}\n\n` +
            `📅 *Date:* ${new Date().toLocaleString()}`;
        await sock.sendMessage(groupId, {
            text: demotionMessage,
            mentions: mentionList
        });
    } catch (error) {
        console.error('Error handling demotion event:', error);
    }
}
