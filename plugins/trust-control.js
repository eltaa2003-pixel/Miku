// plugins/trust-control.js
const handler = async (m, { conn, args, usedPrefix, command }) => {
  // Only bot owners can manage the trusted list
  const senderId = m.sender && m.sender.split('@')[0];
  const owners = global.owner.map(([num]) => num.replace(/[^0-9]/g, ''));
  if (!owners.includes(senderId)) {
    return m.reply('❌ This command is for the bot owner(s) only.');
  }

  if (!global.db.data.trusted) {
    global.db.data.trusted = [];
  }

  const [action] = args;
  if (!/^(add|remove|list)$/i.test(action)) {
    return m.reply(
      `Usage: ${usedPrefix}trust <add|remove|list> @user\n` +
      `Example: ${usedPrefix}trust add @1234567890`
    );
  }

  if (/^list$/i.test(action)) {
    if (global.db.data.trusted.length === 0) {
      return m.reply('No users are currently trusted.');
    }
    const trustedList = global.db.data.trusted.map(user => `• @${user.split('@')[0]}`).join('\n');
    return m.reply(`👑 Trusted Users:\n\n${trustedList}`, null, { mentions: global.db.data.trusted });
  }

  const usersToModify = m.mentionedJid;
  if (!usersToModify || usersToModify.length === 0) {
    return m.reply('Please mention the user(s) to trust or untrust.');
  }

  if (/^add$/i.test(action)) {
    const addedUsers = [];
    const alreadyTrusted = [];
    for (const user of usersToModify) {
      if (!global.db.data.trusted.includes(user)) {
        global.db.data.trusted.push(user);
        addedUsers.push(user);
      } else {
        alreadyTrusted.push(user);
      }
    }
    let replyMsg = '';
    if (addedUsers.length > 0) {
      replyMsg += `✅ Added ${addedUsers.length} user(s) to the trusted list.\n`;
    }
    if (alreadyTrusted.length > 0) {
      replyMsg += `⚠️ ${alreadyTrusted.length} user(s) are already trusted.`;
    }
    m.reply(replyMsg.trim());
  } else if (/^remove$/i.test(action)) {
    const removedUsers = [];
    for (const user of usersToModify) {
      const index = global.db.data.trusted.indexOf(user);
      if (index > -1) {
        global.db.data.trusted.splice(index, 1);
        removedUsers.push(user);
      }
    }
    if (removedUsers.length > 0) {
      m.reply(`✅ Removed ${removedUsers.length} user(s) from the trusted list.`);
    } else {
      m.reply('None of the mentioned users were on the trusted list.');
    }
  }
};

handler.help = ['trust <add|remove|list> @user'];
handler.tags = ['owner'];
handler.command = /^(trust)$/i;
handler.rowner = true;

export default handler;