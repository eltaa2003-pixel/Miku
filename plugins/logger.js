import fetch from 'node-fetch';

let handler = async (m, { conn, usedPrefix, command, args }) => {
    const user = global.db.data.users[m.sender];
    
    if (!user) return;
    
    switch (command) {
        case 'logon':
        case 'loggeron':
            global.enableMessageLogging = true;
            await m.reply('✅ Message logging enabled! You will now see all messages in the terminal.');
            break;
            
        case 'logoff':
        case 'loggeroff':
            global.enableMessageLogging = false;
            await m.reply('❌ Message logging disabled! Messages will no longer be shown in the terminal.');
            break;
            
        case 'logstatus':
        case 'loggerstatus':
            const status = global.enableMessageLogging ? '✅ Enabled' : '❌ Disabled';
            await m.reply(`📊 Message Logging Status: ${status}`);
            break;
            
        default:
            await m.reply(`
📋 *Message Logger Commands*

🔹 *${usedPrefix}logon* - Enable message logging
🔹 *${usedPrefix}logoff* - Disable message logging  
🔹 *${usedPrefix}logstatus* - Check logging status

Current Status: ${global.enableMessageLogging ? '✅ Enabled' : '❌ Disabled'}
            `);
            break;
    }
};

handler.help = ['logon', 'logoff', 'logstatus'];
handler.tags = ['owner'];
handler.command = /^(log(on|off|status)|logger(on|off|status))$/i;

// Only allow owner to use these commands
handler.owner = true;

export default handler; 