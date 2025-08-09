import privateBlocker, { getBlockedStats, getBlockedUsers, unblockUser, blockUser } from '../lib/private-blocker.js';
import chalk from 'chalk';

const handler = async (m, { conn, usedPrefix, command, args }) => {
    const isOwner = global.owner.map(([number]) => number).includes(m.sender.split('@')[0]);
    
    if (!isOwner) {
        return m.reply('*🚫 This command is only for owners*');
    }

    switch (command) {
        case 'blocklist':
        case 'blockedusers':
        case 'listblocked':
            await handleBlockList(m, conn);
            break;
            
        case 'blockstats':
        case 'blockstatistics':
            await handleBlockStats(m, conn);
            break;
            
        case 'unblock':
        case 'unblockuser':
            await handleUnblockUser(m, conn, args);
            break;
            
        case 'block':
        case 'blockuser':
            await handleBlockUser(m, conn, args);
            break;
            
        case 'clearblocks':
        case 'clearblocked':
            await handleClearBlocks(m, conn);
            break;
            
        case 'blockhelp':
        case 'blockerhelp':
            await handleBlockHelp(m, conn);
            break;
            
        default:
            await handleBlockHelp(m, conn);
            break;
    }
};

// Handle block list command
async function handleBlockList(m, conn) {
    const blockedUsers = getBlockedUsers();
    
    if (blockedUsers.length === 0) {
        return m.reply('*✅ No users are currently blocked*');
    }
    
    let message = `*🚫 BLOCKED USERS LIST*\n\n`;
    message += `*Total Blocked:* ${blockedUsers.length}\n\n`;
    
    blockedUsers.forEach((user, index) => {
        const userId = user.userId.split('@')[0];
        message += `${index + 1}. \`${userId}\`\n`;
        message += `   📅 Blocked: ${user.blockDate}\n\n`;
    });
    
    message += `\n*Commands:*\n`;
    message += `• \`${usedPrefix}unblock <number>\` - Unblock a user\n`;
    message += `• \`${usedPrefix}blockstats\` - View blocking statistics\n`;
    message += `• \`${usedPrefix}clearblocks\` - Clear all blocks`;
    
    await m.reply(message);
}

// Handle block statistics command
async function handleBlockStats(m, conn) {
    const stats = getBlockedStats();
    
    let message = `*📊 PRIVATE BLOCKER STATISTICS*\n\n`;
    message += `*Total Blocked Users:* ${stats.totalBlocked}\n`;
    message += `*Currently Blocked:* ${stats.currentlyBlocked}\n`;
    message += `*Block Threshold:* ${stats.blockThreshold} attempts\n`;
    message += `*Block Duration:* 24 hours\n\n`;
    
    message += `*System Status:* ${stats.currentlyBlocked > 0 ? '🟡 Active' : '🟢 Idle'}\n\n`;
    
    message += `*Commands:*\n`;
    message += `• \`${usedPrefix}blocklist\` - View blocked users\n`;
    message += `• \`${usedPrefix}blockhelp\` - Show all commands`;
    
    await m.reply(message);
}

// Handle unblock user command
async function handleUnblockUser(m, conn, args) {
    if (!args[0]) {
        return m.reply(`*❌ Please specify a user to unblock*\n\n*Usage:* \`${usedPrefix}unblock <number>\`\n*Example:* \`${usedPrefix}unblock 1234567890\``);
    }
    
    const userId = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    const success = unblockUser(userId);
    
    if (success) {
        await m.reply(`*✅ Successfully unblocked:* \`${args[0]}\``);
    } else {
        await m.reply(`*❌ User not found in blocked list:* \`${args[0]}\``);
    }
}

// Handle block user command
async function handleBlockUser(m, conn, args) {
    if (!args[0]) {
        return m.reply(`*❌ Please specify a user to block*\n\n*Usage:* \`${usedPrefix}block <number> [reason]\`\n*Example:* \`${usedPrefix}block 1234567890 Spam\``);
    }
    
    const userId = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    const reason = args.slice(1).join(' ') || 'Manual block by owner';
    
    blockUser(userId, reason);
    await m.reply(`*🚫 Successfully blocked:* \`${args[0]}\`\n*Reason:* ${reason}`);
}

// Handle clear all blocks command
async function handleClearBlocks(m, conn) {
    const count = privateBlocker.clearAllBlocks();
    await m.reply(`*🧹 Cleared ${count} blocked users*\n\n*All users can now message the bot in private (subject to blocking rules)*`);
}

// Handle help command
async function handleBlockHelp(m, conn) {
    let message = `*🚫 PRIVATE BLOCKER ADMIN COMMANDS*\n\n`;
    
    message += `*📋 List Commands:*\n`;
    message += `• \`${usedPrefix}blocklist\` - View all blocked users\n`;
    message += `• \`${usedPrefix}blockstats\` - View blocking statistics\n\n`;
    
    message += `*🔧 Management Commands:*\n`;
    message += `• \`${usedPrefix}block <number> [reason]\` - Manually block a user\n`;
    message += `• \`${usedPrefix}unblock <number>\` - Unblock a user\n`;
    message += `• \`${usedPrefix}clearblocks\` - Clear all blocked users\n\n`;
    
    message += `*ℹ️ Information:*\n`;
    message += `• Users are automatically blocked after 3 private message attempts\n`;
    message += `• Only owners can use the bot in private chats\n`;
    message += `• Blocked users cannot message the bot in private\n`;
    message += `• Blocks are permanent until manually removed\n\n`;
    
    message += `*🔒 Security:*\n`;
    message += `• This system prevents spam and unauthorized usage\n`;
    message += `• All blocking actions are logged\n`;
    message += `• Only owners can manage the blocking system`;
    
    await m.reply(message);
}

// Command aliases
handler.help = [
    'blocklist',
    'blockstats', 
    'unblock <number>',
    'block <number> [reason]',
    'clearblocks',
    'blockhelp'
];

handler.tags = ['admin', 'owner', 'blocker'];

handler.command = /^(blocklist|blockedusers|listblocked|blockstats|blockstatistics|unblock|unblockuser|block|blockuser|clearblocks|clearblocked|blockhelp|blockerhelp)$/i;

handler.owner = true;

export default handler; 