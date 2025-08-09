import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getPhoneNumber, normalizeJid } from '../lib/simple-jid.js';
import pkg from 'baileys-pro';
const { jidNormalizedUser } = pkg;

// Load environment variables from .env file
dotenv.config({ path: './.env' });

// MongoDB URI from environment variables
const medoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/defaultdb';

// Connect to MongoDB with better error handling
const connectDB = async () => {
    try {
        await mongoose.connect(medoUri, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('Connected to MongoDB');
    } catch (medoError) {
        console.error('Error connecting to MongoDB:', medoError);
        process.exit(1);
    }
};

// Initialize connection
connectDB();

// Define the BK9 model
const medoBk9Schema = new mongoose.Schema({
    groupId: { type: String, required: true },
    userId: { type: String, required: true },
    bk9: { type: String, required: true }
}, {
    timestamps: true // Add timestamps for better tracking
});

// Create compound index for better query performance
medoBk9Schema.index({ groupId: 1, userId: 1 }, { unique: true });
medoBk9Schema.index({ groupId: 1, bk9: 1 }, { unique: true });

const medoBK9 = mongoose.model('BK9', medoBk9Schema);

// Helper to properly handle JIDs (preserve @lid format for baileys-pro compatibility)
const processJid = (jid) => {
    if (!jid) return null;
    // Keep @lid JIDs as-is for baileys-pro compatibility
    if (jid.includes('@lid')) {
        return jid;
    }
    // Use normalizeJid for other formats
    return normalizeJid(jid);
};

// Helper to format user for mention - ENHANCED VERSION
const formatUserForMention = (jid) => {
    if (!jid) return { text: 'مستخدم غير معروف', jid: null };
    
    // Extract the number part before @
    const userId = jid.split('@')[0];
    
    return {
        text: `@${userId}`,
        jidForMention: jid, // Original JID
        jidS: userId + '@s.whatsapp.net', // Standard format
        jidC: userId + '@c.us', // WhatsApp Web format
        jidLid: jid.includes('@lid') ? jid : null // LID format if applicable
    };
};

// Helper function to extract user ID from JID
function extractUserId(jid) {
    if (!jid) return null;
    if (typeof jid !== 'string') return null;
    
    // Extract clean number for database storage
    const cleanNumber = jid.split('@')[0].replace(/[^\d]/g, '');
    return cleanNumber;
}

// Enhanced user resolution function
const resolveTargetUser = (medoContext) => {
    try {
        console.log('Resolving target user...');
        console.log('Raw mentionedJid:', medoContext.mentionedJid);
        console.log('Raw quoted:', medoContext.quoted);
        
        let targetJid = null;
        
        // Check quoted message first
        if (medoContext.quoted && medoContext.quoted.sender) {
            targetJid = medoContext.quoted.sender;
            console.log('Found target from quoted message:', targetJid);
        }
        // Check mentions
        else if (medoContext.mentionedJid?.length > 0) {
            targetJid = medoContext.mentionedJid[0];
            console.log('Found target from mentions:', targetJid);
        }
        // Check if number is in the text (like @212790363086895)
        else if (medoContext.text) {
            const numberMatch = medoContext.text.match(/@(\d+)/);
            if (numberMatch) {
                targetJid = numberMatch[1] + '@s.whatsapp.net';
                console.log('Found target from text match:', targetJid);
            }
        }
        
        if (!targetJid) {
            console.log('No target JID found');
            return null;
        }
        
        // Extract clean number for database storage
        const cleanNumber = targetJid.split('@')[0].replace(/[^\d]/g, '');
        
        console.log('Original JID:', targetJid, 'Clean number:', cleanNumber);
        
        const mentionData = formatUserForMention(targetJid);
        
        return {
            id: cleanNumber,
            jid: targetJid, // Keep original format
            mention: mentionData,
            // Provide multiple JID formats to try
            possibleJids: [
                targetJid, // Original
                cleanNumber + '@s.whatsapp.net', // Standard
                cleanNumber + '@c.us', // WhatsApp Web
                ...(targetJid.includes('@lid') ? [targetJid] : [])
            ].filter((jid, index, arr) => arr.indexOf(jid) === index) // Remove duplicates
        };
        
    } catch (error) {
        console.error('Error resolving target user:', error);
        return null;
    }
};

// Helper function to send message with enhanced mention handling
const sendMessageWithMention = async (medoContext, text, targetUser) => {
    try {
        let finalMentions = [];
        
        if (targetUser) {
            // For @lid contacts, use the original JID format
            if (targetUser.jid.includes('@lid')) {
                finalMentions = [targetUser.jid];
            } else {
                // For regular contacts, try standard format first
                const standardJid = targetUser.id + '@s.whatsapp.net';
                finalMentions = [standardJid];
            }
        }
        
        console.log('Sending message with mentions:', finalMentions);
        
        try {
            await medoContext.conn.sendMessage(medoContext.chat, {
                text: text,
                mentions: finalMentions
            });
            console.log('Message sent successfully with mentions');
        } catch (mentionError) {
            console.log('Failed with mentions, sending without mentions. Error:', mentionError.message);
            // Fallback: send without mentions
            await medoContext.conn.sendMessage(medoContext.chat, {
                text: text
            });
            console.log('Message sent without mentions as fallback');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        medoContext.reply('حدث خطأ في إرسال الرسالة');
    }
};

// Helper function to check admin permissions
async function checkAdminPermission(medoContext) {
    if (!medoContext.isGroup) {
        medoContext.reply('هذا الأمر يعمل فقط في المجموعات');
        return false;
    }

    try {
        const groupMetadata = await medoContext.conn.groupMetadata(medoContext.chat);
        const groupAdmins = groupMetadata.participants
            .filter(participant => participant.admin)
            .map(admin => processJid(admin.id));

        const normalizedSender = processJid(medoContext.sender);
        if (!groupAdmins.includes(normalizedSender)) {
            medoContext.reply('هذا الأمر يعمل فقط مع الإداريين');
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error checking admin permission:', error);
        medoContext.reply('حدث خطأ في التحقق من الصلاحيات');
        return false;
    }
}

// Command handler functions
async function handleTitlesCommand(medoContext) {
    if (!(await checkAdminPermission(medoContext))) return;

    try {
        const medoTitles = await medoBK9.find({ groupId: medoContext.chat });
        console.log(`Found ${medoTitles.length} titles for group ${medoContext.chat}`);
        
        if (medoTitles.length === 0) {
            medoContext.reply('لا يوجد ألقاب مسجلة حاليا ┇');
        } else {
            let medoTitleList = '';
            let mentions = [];
            
            for (let i = 0; i < medoTitles.length; i++) {
                const medoTitle = medoTitles[i];
                const userId = medoTitle.userId; // This is a number string from DB

                // Reconstruct JID to use formatUserForMention, handling potential @lid format
                const userJid = userId.includes('@') ? userId : `${userId}@s.whatsapp.net`;
                const mentionData = formatUserForMention(userJid);

                medoTitleList += `${i + 1} ┇ ${mentionData.text} ┇ ${medoTitle.bk9}\n`;
                
                // Add the full JID to the mentions array to make the tag clickable
                // Use jidForMention which correctly holds the original or reconstructed JID
                mentions.push(mentionData.jidForMention);
            }

            console.log('Mentions array:', mentions);
            
            try {
                await medoContext.conn.sendMessage(medoContext.chat, {
                    text: `┇ عدد الألقاب المسجلة: ${medoTitles.length}\n\n ┇الألقاب المسجلة:\n\n${medoTitleList}`,
                    mentions: mentions
                });
                console.log('Titles message sent successfully with mentions');
            } catch (mentionError) {
                console.log('Failed to send with mentions, trying without:', mentionError.message);
                await medoContext.reply(`┇ عدد الألقاب المسجلة: ${medoTitles.length}\n\n ┇الألقاب المسجلة:\n\n${medoTitleList}`);
            }
        }
    } catch (error) {
        console.error('Error in handleTitlesCommand:', error);
        medoContext.reply('حدث خطأ في جلب الألقاب');
    }
}

async function handleRegisterCommand(medoContext) {
    if (!(await checkAdminPermission(medoContext))) return;

    const targetUser = resolveTargetUser(medoContext);
    if (!targetUser) {
        medoContext.reply('منشن احد او رد على رسالته واكتب اللقب الذي تريد تسجيله');
        return;
    }

    try {
        // Parse the text more carefully to extract only the title
        const medoTextParts = medoContext.text.trim().split(' ').filter(medoPart => medoPart.trim() !== '');
        console.log('Text parts:', medoTextParts);
        
        // Remove command and mention (@user) to get only the title
        let medoTitle = '';
        for (let i = 1; i < medoTextParts.length; i++) {
            const part = medoTextParts[i];
            // Skip mentions (parts starting with @)
            if (!part.startsWith('@')) {
                medoTitle += (medoTitle ? ' ' : '') + part;
            }
        }
        
        medoTitle = medoTitle.trim();
        console.log('Extracted title:', medoTitle);

        if (!medoTitle || !/\S/.test(medoTitle)) {
            medoContext.reply('مثال:\n .تسجيل @العضو جيرايا');
            return;
        }

        const medoExistingTitle = await medoBK9.findOne({ bk9: medoTitle, groupId: medoContext.chat });
        if (medoExistingTitle) {
            const userJid = medoExistingTitle.userId.includes('@') ? medoExistingTitle.userId : `${medoExistingTitle.userId}@s.whatsapp.net`;
            const mentionData = formatUserForMention(userJid);

            await sendMessageWithMention(
                medoContext,
                `اللقب ${medoTitle} مأخوذ من طرف ${mentionData.text}`,
                { jid: userJid, id: medoExistingTitle.userId, mention: mentionData }
            );
        } else {
            await medoBK9.findOneAndUpdate(
                { userId: targetUser.id, groupId: medoContext.chat },
                { bk9: medoTitle },
                { upsert: true, new: true }
            );
            medoContext.reply(`┇ تم تسجيله بلقب ${medoTitle} بنجاح`);
        }
    } catch (error) {
        console.error('Error in handleRegisterCommand:', error);
        if (error.code === 11000) {
            medoContext.reply('هذا اللقب مأخوذ بالفعل');
        } else {
            medoContext.reply('حدث خطأ في تسجيل اللقب');
        }
    }
}

async function handleDeleteTitleCommand(medoContext) {
    if (!(await checkAdminPermission(medoContext))) return;

    const medoTextParts = medoContext.text.trim().split(' ').filter(medoPart => medoPart.trim() !== '');
    const medoDeleteTitle = medoTextParts.slice(1).join(' ').trim();

    if (!medoDeleteTitle || !/\S/.test(medoDeleteTitle)) {
        medoContext.reply('اكتب اللقب الذي تريد حذفه');
        return;
    }

    try {
        const medoDeleteResult = await medoBK9.deleteOne({ bk9: medoDeleteTitle, groupId: medoContext.chat });

        if (medoDeleteResult.deletedCount > 0) {
            medoContext.reply(`┇ تم حذف اللقب ${medoDeleteTitle} بنجاح`);
        } else {
            medoContext.reply(`اللقب ${medoDeleteTitle} غير مسجل لاحد اساسا`);
        }
    } catch (error) {
        console.error('Error in handleDeleteTitleCommand:', error);
        medoContext.reply('حدث خطأ في حذف اللقب');
    }
}

// Add a global object to manage pending confirmations if it doesn't exist.
if (!global.pendingConfirmation) global.pendingConfirmation = {};

async function handleDeleteAllTitles(medoContext) {
    if (!(await checkAdminPermission(medoContext))) return;

    const confirmationKey = `${medoContext.chat}_${medoContext.sender}`;
    global.pendingConfirmation[confirmationKey] = {
        action: 'delete_all_titles',
        timestamp: Date.now()
    };

    // Automatically cancel the request after 60 seconds to prevent it from staying pending forever.
    setTimeout(() => {
        if (global.pendingConfirmation[confirmationKey]) {
            delete global.pendingConfirmation[confirmationKey];
            console.log(`Confirmation for ${confirmationKey} timed out.`);
        }
    }, 60000);

    await medoContext.reply('⚠️ هل أنت متأكد أنك تريد حذف جميع الألقاب في هذه المجموعة؟\n\nالرجاء الرد بـ:\n1. نعم\n2. لا');
}

async function handleMyTitleCommand(medoContext) {
    try {
        const medoSenderId = extractUserId(medoContext.sender);
        const medoUserTitle = await medoBK9.findOne({ userId: medoSenderId, groupId: medoContext.chat });

        medoUserTitle && medoUserTitle.bk9
            ? medoContext.reply(`┇ لقبك هو : ${medoUserTitle.bk9}`)
            : medoContext.reply('┇ لم يتم تسجيلك بعد');
    } catch (error) {
        console.error('Error in handleMyTitleCommand:', error);
        medoContext.reply('حدث خطأ في جلب لقبك');
    }
}

async function handleGetTitleCommand(medoContext) {
    try {
        console.log('handleGetTitleCommand called');
        
        const targetUser = resolveTargetUser(medoContext);
        if (!targetUser) {
            medoContext.reply('منشن احد او رد على رسالته لمعرفة لقبه');
            return;
        }

        console.log('Searching for user:', targetUser.id, 'in group:', medoContext.chat);
        const medoQuotedUserTitle = await medoBK9.findOne({ userId: targetUser.id, groupId: medoContext.chat });
        console.log('Found title:', medoQuotedUserTitle);

        if (medoQuotedUserTitle && medoQuotedUserTitle.bk9) {
            await sendMessageWithMention(
                medoContext,
                `┇ لقب ${targetUser.mention.text} هو : ${medoQuotedUserTitle.bk9}`,
                targetUser
            );
        } else {
            await sendMessageWithMention(
                medoContext,
                `┇ ${targetUser.mention.text} لم يتم تسجيله بعد`,
                targetUser
            );
        }
    } catch (error) {
        console.error('Error in handleGetTitleCommand:', error);
        medoContext.reply('حدث خطأ في جلب اللقب');
    }
}

async function handleCheckTitleCommand(medoContext) {
    const medoTextParts = medoContext.text.trim().split(' ').filter(medoPart => medoPart.trim() !== '');

    if (medoTextParts.length < 2) {
        medoContext.reply('اكتب لقب للتحقق منه');
        return;
    }

    const medoCheckTitle = medoTextParts.slice(1).join(' ').trim();
    
    try {
        const medoCheckResult = await medoBK9.findOne({ bk9: medoCheckTitle, groupId: medoContext.chat });

        if (medoCheckResult) {
            const userJid = medoCheckResult.userId.includes('@') ? medoCheckResult.userId : `${medoCheckResult.userId}@s.whatsapp.net`;
            const mentionData = formatUserForMention(userJid);
            
            await sendMessageWithMention(
                medoContext,
                `اللقب ${medoCheckTitle} مأخوذ من طرف ${mentionData.text}`,
                { jid: userJid, id: medoCheckResult.userId, mention: mentionData }
            );
        } else {
            medoContext.reply(`اللقب ${medoCheckTitle} متوفر`);
        }
    } catch (error) {
        console.error('Error in handleCheckTitleCommand:', error);
        medoContext.reply('حدث خطأ في التحقق من اللقب');
    }
}

// Main handler function
let medoHandler = async function (medoContext, { conn: medoConn, text: medoText, command: medoCommand }) {
    try {
        // First, check if there is a pending confirmation from this user.
        const confirmationKey = `${medoContext.chat}_${medoContext.sender}`;
        const userResponse = medoText ? medoText.trim().toLowerCase() : '';

        if (global.pendingConfirmation && global.pendingConfirmation[confirmationKey]) {
            const validResponses = ['1', '2', 'نعم', 'لا'];
            if (validResponses.includes(userResponse)) {
                const pendingAction = global.pendingConfirmation[confirmationKey].action;
                delete global.pendingConfirmation[confirmationKey]; // Consume the confirmation

                if (pendingAction === 'delete_all_titles') {
                    if (userResponse === '1' || userResponse === 'نعم') {
                        if (!(await checkAdminPermission(medoContext))) return;
                        try {
                            const { deletedCount } = await medoBK9.deleteMany({ groupId: medoContext.chat });
                            medoContext.reply(deletedCount > 0 ? `✅ تم حذف جميع الألقاب بنجاح (${deletedCount}).` : 'ℹ️ لا توجد ألقاب لحذفها.');
                        } catch (error) {
                            console.error('Error deleting all titles:', error);
                            medoContext.reply('حدث خطأ أثناء حذف الألقاب.');
                        }
                    } else {
                        medoContext.reply('تم إلغاء العملية.');
                    }
                    return; // Stop further processing
                }
            }
        }

        // If there's no command, exit early.
        if (!medoCommand) return;

        // Ensure database connection for regular commands.
        if (mongoose.connection.readyState !== 1) {
            await connectDB();
        }

        console.log('Command received:', medoCommand);
        console.log('Group ID:', medoContext.chat);

        switch (medoCommand) {
            case 'الالقاب':
            case 'الألقاب':
                await handleTitlesCommand(medoContext);
                break;
            case 'تسجيل':
                await handleRegisterCommand(medoContext);
                break;
            case 'حذف_لقب':
                await handleDeleteTitleCommand(medoContext);
                break;
            case 'حذف_جميع_الالقاب':
                await handleDeleteAllTitles(medoContext);
                break;
            case 'لقبي':
                await handleMyTitleCommand(medoContext);
                break;
            case 'لقبه':
                await handleGetTitleCommand(medoContext);
                break;
            case 'لقب':
                await handleCheckTitleCommand(medoContext);
                break;
        }
    } catch (error) {
        console.error('Error handling command:', error);
        medoContext.reply('حدث خطأ اثناء معالجة الأمر');
    }
};

// Fixed command array to match switch cases
medoHandler.command = ['الالقاب', 'الألقاب', 'تسجيل', 'لقبي', 'لقبه', 'حذف_لقب', 'لقب', 'حذف_جميع_الالقاب'];
medoHandler.tags = ['BK9'];

medoHandler.all = async function (medoContext) {
    const confirmationKey = `${medoContext.chat}_${medoContext.sender}`;
    const userResponse = medoContext.text ? medoContext.text.trim().toLowerCase() : '';

    if (global.pendingConfirmation && global.pendingConfirmation[confirmationKey]) {
        const validResponses = ['1', '2', 'نعم', 'لا'];
        if (validResponses.includes(userResponse)) {
            const pendingAction = global.pendingConfirmation[confirmationKey].action;
            delete global.pendingConfirmation[confirmationKey]; // Consume the confirmation

            if (pendingAction === 'delete_all_titles') {
                if (userResponse === '1' || userResponse === 'نعم') {
                    if (!(await checkAdminPermission(medoContext))) return;
                    try {
                        const { deletedCount } = await medoBK9.deleteMany({ groupId: medoContext.chat });
                        medoContext.reply(deletedCount > 0 ? `✅ تم حذف جميع الألقاب بنجاح (${deletedCount}).` : 'ℹ️ لا توجد ألقاب لحذفها.');
                    } catch (error) {
                        console.error('Error deleting all titles:', error);
                        medoContext.reply('حدث خطأ أثناء حذف الألقاب.');
                    }
                } else {
                    medoContext.reply('تم إلغاء العملية.');
                }
            }
        }
    }
};

export default medoHandler;