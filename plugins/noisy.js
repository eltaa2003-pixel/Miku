let handler = async (m, { conn, command, usedPrefix, text }) => {
    const chatSettings = global.db.data.chats[m.chat];
    if (!chatSettings) return;

    if (command === 'noisy') {
        chatSettings.noisy_to_dm = true;
        m.reply('Noisy-to-DM mode enabled. Bot responses will be sent to your private chat.');
    } else if (command === 'quiet') {
        chatSettings.noisy_to_dm = false;
        m.reply('Noisy-to-DM mode disabled. Bot responses will be sent to this chat.');
    }
};

handler.help = ['noisy', 'quiet'];
handler.tags = ['group'];
handler.command = /^(noisy|quiet)$/i;
handler.group = true;
handler.admin = true;

export default handler;