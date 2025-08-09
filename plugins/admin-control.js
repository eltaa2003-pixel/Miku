// WhatsApp Admin Monitor Plugin
// Pure monitoring - watches for unauthorized admin changes and punishes them
// FIXED: Proper bot, owner, and group creator protection

import { jidDecode, areJidsSameUser } from 'baileys-pro';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

// MongoDB connection
if (!mongoose.connection.readyState) {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
  }).then(() => console.log('✅ Connected to MongoDB (admin-control)'))
    .catch((err) => console.error('❌ MongoDB connection error (admin-control):', err.message));
}

// GroupProtection model
const groupProtectionSchema = new mongoose.Schema({
  groupId: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: false },
  startedAt: { type: Date },
  stoppedAt: { type: Date }
});
const GroupProtection = mongoose.models.GroupProtection || mongoose.model('GroupProtection', groupProtectionSchema);

const adminMonitor = {
    isActive: false,
    sock: null,
    eventHandler: null,
    recentPunishments: {}, // Track recent punishments to avoid loops
    stats: {
        totalViolations: 0,
        totalPunishments: 0,
        startTime: null
    }
};

// Initialize admin monitor when plugin loads
function initializeAdminMonitor(sock) {
    if (adminMonitor.sock) {
        console.log('Admin Monitor already initialized - skipping...');
        return;
    }
    
    adminMonitor.sock = sock;
    
    // Create the event handler function for admin changes
    adminMonitor.eventHandler = async (update) => {
        if (adminMonitor.isActive) {
            await monitorAdminChanges(sock, update);
        }
    };
}

// Helper function to normalize JID formats for comparison
function normalizeJid(jid) {
    if (!jid) return null;

    // Extract the number part by removing non-digit characters from the user part of the JID
    const number = jid.split('@')[0].replace(/\D/g, '');
    if (!number) return { original: jid, number: null }; // Return original if no number found

    // Return number and different JID variations
    return {
        number: number,
        lid: number + '@lid',
        whatsapp: number + '@s.whatsapp.net',
        original: jid
    };
}

// Helper function to check if a JID is authorized (bot, owner, or group creator)
function isAuthorizedJID(jid, sock, groupCreator) {
    console.log('🔍 Checking authorization for JID:', jid);
    
    // Normalize the JID we're checking
    const normalizedJid = normalizeJid(jid);
    const normalizedBot = normalizeJid(sock.user.id);
    const normalizedCreator = groupCreator ? normalizeJid(groupCreator) : null;
    
    console.log('🔍 Normalized JIDs:', {
        checking: normalizedJid,
        bot: normalizedBot,
        creator: normalizedCreator
    });
    
    // Method 1: Check if it's the bot using areJidsSameUser
    let isBot = areJidsSameUser(jid, sock.user.id);
    
    // Method 1.1: Check if it's the bot by number comparison
    if (!isBot && normalizedJid && normalizedBot) {
        isBot = normalizedJid.number === normalizedBot.number;
        console.log('🔢 Bot number match:', isBot, `(${normalizedJid.number} === ${normalizedBot.number})`);
    }
    
    // Method 1.2: Direct check for the specific bot JID
    if (!isBot && jid === '160598054666324@lid') {
        isBot = true;
        console.log('🔢 Direct bot JID match: 160598054666324@lid');
    }
    
    // Method 1.3: Check if the JID is the bot by comparing the number part
    if (!isBot && normalizedJid && normalizedJid.number === '160598054666324') {
        isBot = true;
        console.log('🔢 Bot number match: 160598054666324');
    }
    
    console.log('📱 Is Bot (areJidsSameUser + number + direct):', isBot);
    
    // Method 2: Check if it's the group creator
    let isGroupCreator = groupCreator && areJidsSameUser(jid, groupCreator);
    
    // Method 2.1: Check if it's the group creator by number comparison
    if (!isGroupCreator && normalizedJid && normalizedCreator) {
        isGroupCreator = normalizedJid.number === normalizedCreator.number;
        console.log('🔢 Creator number match:', isGroupCreator, `(${normalizedJid.number} === ${normalizedCreator.number})`);
    }
    
    console.log('👑 Is Group Creator:', isGroupCreator);
    
    // Method 3: Check if it's a bot owner
    let isBotOwner = false;
    if (global.owner && Array.isArray(global.owner)) {
        const ownerNumbers = global.owner.map(([number]) => number.replace(/[^0-9]/g, ''));
        
        // Check by number comparison
        if (normalizedJid) {
            isBotOwner = ownerNumbers.includes(normalizedJid.number);
        }
        
        // Also check using areJidsSameUser with different formats
        if (!isBotOwner) {
            const ownerJids = ownerNumbers.map(num => [
                num + '@s.whatsapp.net',
                num + '@lid'
            ]).flat();
            
            isBotOwner = ownerJids.some(ownerJid => areJidsSameUser(jid, ownerJid));
        }
        
        console.log('🔧 Owner Numbers:', ownerNumbers);
        console.log('👥 Is Bot Owner:', isBotOwner);
    }
    
    // Method 4: Additional bot JID variations check
    const botJidVariations = [
        sock.user.id,
        sock.decodeJid(sock.user.id),
        '160598054666324@lid', // Add the specific bot JID
        '160598054666324@s.whatsapp.net' // Add the @s.whatsapp.net version
    ];
    
    // Add number-based variations
    if (normalizedBot) {
        botJidVariations.push(
            normalizedBot.lid,
            normalizedBot.whatsapp,
            normalizedBot.number + '@s.whatsapp.net',
            normalizedBot.number + '@lid'
        );
    }
    
    const isBotVariation = botJidVariations.some(botJid => {
        const match = areJidsSameUser(jid, botJid);
        console.log(`🤖 Checking bot variation ${botJid} vs ${jid}:`, match);
        return match;
    });
    
    // Additional check: if the JID number matches the bot number
    if (!isBotVariation && normalizedJid && normalizedJid.number === '160598054666324') {
        console.log('🔢 Bot variation by number match: 160598054666324');
        isBotVariation = true;
    }
    
    const authorized = isBot || isGroupCreator || isBotOwner || isBotVariation;
    
    console.log('✅ Final Authorization Result:', {
        jid,
        isBot,
        isGroupCreator,
        isBotOwner,
        isBotVariation,
        authorized
    });
    
    return authorized;
}

async function monitorAdminChanges(sock, update) {
    try {
        console.log('📨 Group participants update received:', update);
        
        const { id: groupId, participants, action, author } = update;
        
        // Only monitor promote/demote actions
        if (action !== 'promote' && action !== 'demote') {
            console.log('⏭️ Skipping - not promote/demote action');
            return;
        }
        
        // Skip if no author (WhatsApp system actions)
        if (!author) {
            console.log('⏭️ Skipping - no author (system action)');
            return;
        }
        
        // CRITICAL FIX: Skip if this is a bot-initiated punishment
        // Check if any of the participants were recently processed to avoid infinite loops
        const now = Date.now();
        const recentPunishmentKey = `${groupId}-${participants.join(',')}-${action}`;
        if (adminMonitor.recentPunishments && adminMonitor.recentPunishments[recentPunishmentKey]) {
            const timeSince = now - adminMonitor.recentPunishments[recentPunishmentKey];
            if (timeSince < 10000) { // Skip if within 10 seconds (increased from 5)
                console.log('🔄 Skipping - recent bot punishment detected');
                return;
            }
        }
        
        // Get group info
        const groupMetadata = await sock.groupMetadata(groupId);
        const creator = groupMetadata.owner;
        
        console.log('📋 Group Info:', {
            groupId,
            creator,
            author,
            action,
            participants,
            botJid: sock.user.id
        });
        
        // Check if author is authorized using our helper function
        const authorIsAuthorized = isAuthorizedJID(author, sock, creator);
        
        // If authorized, allow the action
        if (authorIsAuthorized) {
            console.log('✅ Authorized action - allowing');
            return;
        }
        
        // Count the violation
        adminMonitor.stats.totalViolations++;
        console.log('🚨 UNAUTHORIZED ACTION DETECTED!');
        
        // UNAUTHORIZED ACTION DETECTED - Execute punishment
        await punishUnauthorizedUser(sock, groupId, author, participants, action, creator);
        
    } catch (error) {
        console.error('❌ Error monitoring admin changes:', error);
    }
}

async function punishUnauthorizedUser(sock, groupId, perpetrator, affectedUsers, action, groupCreator) {
    try {
        console.log(`🚨 PUNISHING UNAUTHORIZED ${action.toUpperCase()} by ${perpetrator}`);
        
        // ENHANCED PROTECTION: Double-check if perpetrator is authorized before punishing
        const perpetratorIsAuthorized = isAuthorizedJID(perpetrator, sock, groupCreator);
        
        if (perpetratorIsAuthorized) {
            console.log(`⚠️ PROTECTION TRIGGERED - Perpetrator is authorized: ${perpetrator}`);
            await sock.sendMessage(groupId, {
                text: `⚠️ **PROTECTION ACTIVE** ⚠️\n\n` +
                      `@${perpetrator.split('@')[0]} is authorized (bot/owner/creator) and cannot be punished.\n\n` +
                      `Authorized users are protected from automatic security actions.`,
                mentions: [perpetrator]
            });
            return;
        }
        
        // Mark this punishment to avoid infinite loops
        const punishmentKey = `${groupId}-${perpetrator}-demote`;
        if (!adminMonitor.recentPunishments) adminMonitor.recentPunishments = {};
        adminMonitor.recentPunishments[punishmentKey] = Date.now();
        
        // Also mark the original action to prevent re-processing
        const originalActionKey = `${groupId}-${affectedUsers.join(',')}-${action}`;
        adminMonitor.recentPunishments[originalActionKey] = Date.now();
        
        // Clean up old punishment records (older than 15 seconds)
        const now = Date.now();
        Object.keys(adminMonitor.recentPunishments).forEach(key => {
            if (now - adminMonitor.recentPunishments[key] > 15000) {
                delete adminMonitor.recentPunishments[key];
            }
        });
        
        // Use jidDecode for proper phone number display
        const perpetratorDecoded = jidDecode(perpetrator);
        const perpetratorNumberDisplay = perpetratorDecoded ? perpetratorDecoded.user : perpetrator.split('@')[0];
        
        // Send warning
        await sock.sendMessage(groupId, {
            text: `🚨 **SECURITY VIOLATION DETECTED** 🚨\n\n` +
                  `@${perpetratorNumberDisplay} made unauthorized ${action} action!\n\n` +
                  `⚡ Executing punishment...`,
            mentions: [perpetrator]
        });
        
        // Small delay for dramatic effect
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Demote the perpetrator immediately
        await sock.groupParticipantsUpdate(groupId, [perpetrator], 'demote');
        console.log(`✅ Demoted perpetrator: ${perpetrator}`);
        adminMonitor.stats.totalPunishments++;
        
        // If they promoted someone, demote that person too (but protect authorized users)
        if (action === 'promote') {
            const reversalMentions = [perpetrator];
            let reversedCount = 0;
            
            for (const user of affectedUsers) {
                // ENHANCED PROTECTION: Check if promoted user is authorized
                const userIsAuthorized = isAuthorizedJID(user, sock, groupCreator);
                
                if (userIsAuthorized) {
                    console.log(`⚠️ Skipping reversal - promoted user is authorized: ${user}`);
                    continue; // Skip demoting authorized users
                }
                
                // Mark this reversal to avoid infinite loops
                const reversalKey = `${groupId}-${user}-demote`;
                adminMonitor.recentPunishments[reversalKey] = Date.now();
                
                await sock.groupParticipantsUpdate(groupId, [user], 'demote');
                console.log(`✅ Reversed unauthorized promotion: ${user}`);
                adminMonitor.stats.totalPunishments++;
                reversalMentions.push(user);
                reversedCount++;
            }
            
            await sock.sendMessage(groupId, {
                text: `✅ **Justice Served!**\n\n` +
                      `• @${perpetratorNumberDisplay} has been demoted\n` +
                      `• ${reversedCount} unauthorized promotions reversed\n` +
                      `• Bot, owners, and group creator are protected\n` +
                      `• Only authorized users can manage admins`,
                mentions: reversalMentions
            });
        } else {
            await sock.sendMessage(groupId, {
                text: `✅ **Perpetrator Punished!**\n\n` +
                      `@${perpetratorNumberDisplay} has been demoted for unauthorized demote action!\n\n` +
                      `Only bot, owners, and group creator can manage admins.`,
                mentions: [perpetrator]
            });
        }
        
    } catch (error) {
        console.error('❌ Error executing punishment:', error);
        await sock.sendMessage(groupId, {
            text: `❌ Security enforcement failed: ${error.message}`
        });
    }
}

// Simple function to check if a user is authorized (for command usage)
async function isAuthorizedAdmin(conn, groupId, userId) {
    try {
        const groupMetadata = await conn.groupMetadata(groupId);
        const creator = groupMetadata.owner;
        
        // Use our enhanced authorization check
        return isAuthorizedJID(userId, conn, creator);
    } catch (error) {
        console.error('❌ Error checking authorization:', error);
        return false;
    }
}

// Control functions
async function startProt() {
    if (adminMonitor.isActive) {
        console.log('⚠️  Admin Protection is already running!');
        return false;
    }
    if (!adminMonitor.sock) {
        console.log('❌ Socket not initialized. Call initialize() first.');
        return false;
    }
    // Add the event listener
    adminMonitor.sock.ev.on('group-participants.update', adminMonitor.eventHandler);
    adminMonitor.isActive = true;
    adminMonitor.stats.startTime = new Date();
    // Save to MongoDB
    try {
      const groupId = adminMonitor.sock.user.id;
      await GroupProtection.findOneAndUpdate(
        { groupId },
        { isActive: true, startedAt: new Date(), stoppedAt: null },
        { upsert: true, new: true }
      );
      console.log('🟢 Group protection status saved to DB:', groupId);
    } catch (err) {
      console.error('❌ Failed to save group protection status:', err.message);
    }
    console.log('🟢 Admin Protection STARTED - Now watching for unauthorized admin changes');
    return true;
}

async function stopProt() {
    if (!adminMonitor.isActive) {
        console.log('⚠️  Admin Protection is already stopped!');
        return false;
    }
    // Remove the event listener
    if (adminMonitor.sock && adminMonitor.eventHandler) {
        adminMonitor.sock.ev.off('group-participants.update', adminMonitor.eventHandler);
    }
    adminMonitor.isActive = false;
    // Save to MongoDB
    try {
      const groupId = adminMonitor.sock.user.id;
      await GroupProtection.findOneAndUpdate(
        { groupId },
        { isActive: false, stoppedAt: new Date() },
        { upsert: true, new: true }
      );
      console.log('🔴 Group protection status updated in DB:', groupId);
    } catch (err) {
      console.error('❌ Failed to update group protection status:', err.message);
    }
    console.log('🔴 Admin Protection STOPPED - No longer monitoring admin changes');
    return true;
}

function getProtStatus() {
    const uptime = adminMonitor.stats.startTime ? 
        Math.floor((new Date() - adminMonitor.stats.startTime) / 1000) : 0;
    
    return {
        status: adminMonitor.isActive ? '🟢 ACTIVE' : '🔴 STOPPED',
        isActive: adminMonitor.isActive,
        uptime: formatUptime(uptime),
        stats: {
            totalViolations: adminMonitor.stats.totalViolations,
            totalPunishments: adminMonitor.stats.totalPunishments,
            startTime: adminMonitor.stats.startTime
        }
    };
}

function resetStats() {
    adminMonitor.stats.totalViolations = 0;
    adminMonitor.stats.totalPunishments = 0;
    adminMonitor.stats.startTime = adminMonitor.isActive ? new Date() : null;
    console.log('📊 Statistics reset');
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

// Main handler function
const handler = async (m, { conn, command, text, args, usedPrefix }) => {
    
    try {
        // Initialize monitor if not already done
        if (!adminMonitor.sock && conn) {
            initializeAdminMonitor(conn);
        }
        
        const groupId = m.chat;
        const senderId = m.sender;
        
        // Only respond in groups
        if (!groupId || !groupId.includes('@g.us')) {
            return m.reply('❌ This command can only be used in groups!');
        }
        
        // Check if user is authorized to use protection commands
        const authorized = await isAuthorizedAdmin(conn, groupId, senderId);
        
        // Handle different commands
        switch(command.toLowerCase()) {
            case 'startprot':
            case 'start-prot':
                if (!authorized) {
                    return m.reply('❌ Only bot, owners, and group creator can control protection settings!');
                }
                
                const started = await startProt();
                const startMsg = started ? 
                    '🟢 **Admin Protection STARTED**\n\nNow monitoring for unauthorized admin changes!\n\n✅ Protected: Bot, Owners, Group Creator' :
                    '⚠️ Admin Protection is already running!';
                return m.reply(startMsg);
                
            case 'stopprot':
            case 'stop-prot':
                if (!authorized) {
                    return m.reply('❌ Only bot, owners, and group creator can control protection settings!');
                }
                
                const stopped = await stopProt();
                const stopMsg = stopped ? 
                    '🔴 **Admin Protection STOPPED**\n\nNo longer monitoring admin changes.' :
                    '⚠️ Admin Protection is already stopped!';
                return m.reply(stopMsg);
                
            case 'protstatus':
            case 'prot-status':
            case 'protectionstatus':
                if (!authorized) {
                    return m.reply('❌ Only bot, owners, and group creator can view protection status!');
                }
                
                const status = getProtStatus();
                const statusMsg = `📊 **Admin Protection Status**\n\n` +
                                `Status: ${status.status}\n` +
                                `Uptime: ${status.uptime}\n` +
                                `Violations Detected: ${status.stats.totalViolations}\n` +
                                `Punishments Executed: ${status.stats.totalPunishments}\n\n` +
                                `🛡️ **Protected Users:**\n• Bot\n• Bot Owners\n• Group Creator`;
                return m.reply(statusMsg);
                
            case 'resetstats':
            case 'reset-stats':
                if (!authorized) {
                    return m.reply('❌ Only bot, owners, and group creator can reset statistics!');
                }
                
                resetStats();
                const resetMsg = '📊 **Statistics Reset**\n\nAll violation and punishment counters have been reset to zero.';
                return m.reply(resetMsg);
                
            default:
                const helpMsg = `❓ Unknown command: ${command}\n\nAvailable commands:\n• ${usedPrefix}startprot\n• ${usedPrefix}stopprot\n• ${usedPrefix}protstatus\n• ${usedPrefix}resetstats`;
                return m.reply(helpMsg);
        }
        
    } catch (error) {
        console.error('❌ Error in admin control handler:', error);
        console.error('Error stack:', error.stack);
        return m.reply(`❌ An error occurred while processing your request: ${error.message}`);
    }
};

// Initialize the monitor when the plugin loads
if (typeof global !== 'undefined' && global.conn && !global.adminMonitorInitialized) {
    try {
        initializeAdminMonitor(global.conn);
        global.adminMonitorInitialized = true;
        console.log('✅ Admin monitor initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize admin monitor:', error);
    }
}

// Plugin metadata
handler.help = ['startprot', 'stopprot', 'protstatus', 'resetstats'];
handler.tags = ['security']; // Removed 'admin' tag to prevent skipping
handler.command = /^(startprot|start-prot|stopprot|stop-prot|protstatus|prot-status|protectionstatus|resetstats|reset-stats)$/i;
handler.group = true; // Only works in groups
handler.admin = false; // We handle authorization manually
handler.botAdmin = false; // We handle this manually too

export default handler;0