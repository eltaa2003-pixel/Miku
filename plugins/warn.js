import mongoose from 'mongoose';
import WarningModel from '../lib/Warning.js';
import pkg from 'baileys-pro';
const { proto, jidNormalizedUser } = pkg;
import { normalizeJid, extractUserFromJid } from '../lib/simple.js';

// Add database connection logic
const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb+srv://itachi3mk:mypassis1199@cluster0.zzyxjo3.mongodb.net/?retryWrites=true&w=majority'
      );
      console.log('✅ MongoDB connected successfully for warnings system');
    }
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
  }
};
connectDB();

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

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected!');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔁 MongoDB reconnected');
});

// Core functionality
const validateAdmin = async (ctx) => {
  try {
    const metadata = await ctx.conn.groupMetadata(ctx.chat);
    const isAdmin = metadata.participants.some(participant => {
      const isMatch = jidNormalizedUser(participant.id) === jidNormalizedUser(ctx.sender);
      const hasAdmin = participant.admin === 'admin' || participant.admin === 'superadmin';
      return isMatch && hasAdmin;
    });
    return isAdmin;
  } catch (error) {
    console.error('Admin validation error:', error);
    return false;
  }
};

const validateBotAdmin = async (ctx) => {
  try {
    const metadata = await ctx.conn.groupMetadata(ctx.chat);
    const botJid = ctx.conn.user.jid;
    return metadata.participants.some(
      participant => jidNormalizedUser(participant.id) === jidNormalizedUser(botJid) && (participant.admin === 'admin' || participant.admin === 'superadmin')
    );
  } catch (error) {
    console.error('Bot admin validation error:', error);
    return false;
  }
};

const resolveTargetUser = (ctx) => {
  try {
    console.log('Resolving target user...');
    console.log('Raw mentionedJid:', ctx.mentionedJid);
    console.log('Raw quoted:', ctx.quoted);
    
    let targetJid = null;
    
    // Check quoted message first
    if (ctx.quoted && ctx.quoted.sender) {
      targetJid = ctx.quoted.sender;
      console.log('Found target from quoted message:', targetJid);
    }
    // Check mentions
    else if (ctx.mentionedJid?.length > 0) {
      targetJid = ctx.mentionedJid[0];
      console.log('Found target from mentions:', targetJid);
    }
    // Check if number is in the text (like @212790363086895)
    else if (ctx.text) {
      const numberMatch = ctx.text.match(/@(\d+)/);
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

async function handleAddWarning(ctx, reason) {
  try {
    console.log('Starting warning process...');
    
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected, state:', mongoose.connection.readyState);
      return ctx.reply('❌ خطأ في الاتصال بقاعدة البيانات');
    }

    // Admin validation
    const isAdmin = await validateAdmin(ctx);
    console.log('Admin check result:', isAdmin);
    if (!isAdmin) {
      return ctx.reply('⚠️ تحتاج صلاحيات المشرفين لهذا الأمر');
    }

    // User resolution
    const targetUser = resolveTargetUser(ctx);
    console.log('Target user resolved:', targetUser);
    if (!targetUser) {
      return ctx.reply('⚠️ يرجى تحديد مستخدم عن طريق الرد أو المنشن');
    }

    // Check if user is trying to warn themselves
    if (targetUser.jid === ctx.sender) {
      return ctx.reply('⚠️ لا يمكنك إنذار نفسك');
    }

    // Validate required fields
    if (!targetUser.id || !ctx.chat) {
      console.error('Missing required fields - targetUser.id:', targetUser.id, 'ctx.chat:', ctx.chat);
      return ctx.reply('❌ خطأ في البيانات المطلوبة');
    }

    console.log('Attempting database operation...');
    console.log('User ID:', targetUser.id, 'Group ID:', ctx.chat);

    // Database operation with better error handling
    let userWarnings;
    try {
      userWarnings = await WarningModel.findOneAndUpdate(
        { userId: targetUser.id, groupId: ctx.chat },
        {
          $push: {
            warnings: {
              cause: reason || '❌ لم يتم تقديم سبب',
              date: new Date(),
              issuer: ctx.sender
            }
          }
        },
        { new: true, upsert: true }
      );
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      
      // Handle duplicate key error specifically
      if (dbError.code === 11000) {
        console.log('Duplicate key error detected, attempting to find existing record...');
        try {
          // Try to find the existing record and update it
          userWarnings = await WarningModel.findOne({ userId: targetUser.id, groupId: ctx.chat });
          if (userWarnings) {
            // Add the warning to existing record
            userWarnings.warnings.push({
              cause: reason || '❌ لم يتم تقديم سبب',
              date: new Date(),
              issuer: ctx.sender
            });
            await userWarnings.save();
            console.log('Successfully updated existing record');
          } else {
            // If no record found, there might be an index issue
            throw new Error('فشل في العثور على السجل الموجود. قد تحتاج إلى إعادة تشغيل البوت لإصلاح قاعدة البيانات.');
          }
        } catch (fallbackError) {
          console.error('Fallback operation also failed:', fallbackError);
          throw new Error(`خطأ في قاعدة البيانات: ${fallbackError.message}`);
        }
      } else {
        throw new Error(`Database error: ${dbError.message}`);
      }
    }

    console.log('Database operation successful, warnings count:', userWarnings.warnings.length);

    // Send notification with proper mention
    const warningCount = userWarnings.warnings.length;
    const lastWarning = userWarnings.warnings[warningCount - 1];
    
    console.log('Sending message with mentions:', targetUser.possibleJids);
    console.log('Message text will include:', targetUser.mention.text);
    
    // Enhanced mention handling for @lid contacts
    let finalMentions = [];
    
    // For @lid contacts, use the original JID format
    if (targetUser.jid.includes('@lid')) {
      finalMentions = [targetUser.jid];
    } else {
      // For regular contacts, try standard format first
      const standardJid = targetUser.id + '@s.whatsapp.net';
      finalMentions = [standardJid];
    }
    
    console.log('Final mentions array:', finalMentions);
    
    try {
      await ctx.conn.sendMessage(ctx.chat, {
        text: `🔔 *إنذار لـ ${targetUser.mention.text}*\n\n📊 العدد: ${warningCount}/3\n📝 السبب: ${lastWarning.cause}\n🕒 التاريخ: ${new Date(lastWarning.date).toLocaleString('ar-EG')}\n🚨 تحذير: عند الوصول لـ 3 إنذارات سيتم الطرد`,
        mentions: finalMentions
      });
      console.log('Message sent successfully with mentions:', finalMentions);
    } catch (mentionError) {
      console.log('Failed with mentions:', finalMentions, 'Error:', mentionError.message);
      // Fallback: send without mentions
      await ctx.conn.sendMessage(ctx.chat, {
        text: `🔔 *إنذار لـ ${targetUser.mention.text}*\n\n📊 العدد: ${warningCount}/5\n📝 السبب: ${lastWarning.cause}\n🕒 التاريخ: ${new Date(lastWarning.date).toLocaleString('ar-EG')}\n🚨 تحذير: عند الوصول لـ 5 إنذارات سيتم الطرد`
      });
      console.log('Message sent without mentions as fallback');
    }

    // Auto-moderation check
    if (warningCount >= 3) {
        try {
        const isBotAdmin = await validateBotAdmin(ctx);
        if (isBotAdmin) {
          console.log('Attempting to remove user:', targetUser.jid);
          // Use safe group operation that handles @lid JIDs properly
          await ctx.conn.safeGroupOperation(
            ctx.chat,
            [targetUser.jid],
            'remove'
          );
          
          // Use the same mention logic for kick message
          const kickMentions = targetUser.jid.includes('@lid') ? [targetUser.jid] : [targetUser.id + '@s.whatsapp.net'];
          
          await ctx.conn.sendMessage(ctx.chat, {
            text: `تم طرد ${targetUser.mention.text} لتجاوز الحد الأقصى للإنذارات (3/3)`,
            mentions: kickMentions
          });
          
          // Clear warnings after kick
          await WarningModel.deleteOne({ 
            userId: targetUser.id, 
            groupId: ctx.chat 
          });
        } else {
          await ctx.conn.sendMessage(ctx.chat, {
            text: '⚠️ البوت يحتاج صلاحيات إدارية للطرد التلقائي'
          });
        }
      } catch (removeError) {
        console.error('Removal failed:', removeError);
        await ctx.reply('❌ فشل طرد العضو - تأكد من صلاحيات البوت');
      }
    }
  } catch (error) {
    console.error('[FULL ERROR] handleAddWarning:', error);
    console.error('Error stack:', error.stack);
    await ctx.reply(`❌ فشل إضافة الإنذار: ${error.message}`);
  }
}

async function handleViewWarnings(ctx, targetUserId) {
  try {
    console.log('Viewing warnings for user:', targetUserId);
    
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected');
      return ctx.reply('❌ خطأ في الاتصال بقاعدة البيانات');
    }

    const warnings = await WarningModel.findOne({
      userId: targetUserId,
      groupId: ctx.chat
    }).catch(dbError => {
      console.error('Database query failed:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    });

    if (!warnings?.warnings?.length) {
      return ctx.conn.sendMessage(ctx.chat, {
        text: '✔️ لا يوجد إنذارات مسجلة لهذا المستخدم'
      }, {
        mentions: [ctx.sender]
      });
    }

    let message = '╭─🚨 سجل الإنذارات ─╮\n';
    message += `📊 العدد الكلي: ${warnings.warnings.length}/5\n\n`;
    
    // Get all unique issuers for mentions
    const issuers = warnings.warnings.map(warn => warn.issuer);
    const uniqueIssuers = [...new Set(issuers)];
    
    warnings.warnings.forEach((warn, index) => {
      const issuerMention = formatUserForMention(warn.issuer);
      message += `${index + 1}. ⚠️ ${warn.cause}\n`;
      message += `   📅 ${new Date(warn.date).toLocaleString('ar-EG')}\n`;
      message += `   👤 بواسطة: ${issuerMention.text}\n\n`;
    });
    
    message += '╰────────────────╯';

    await ctx.conn.sendMessage(ctx.chat, {
      text: message
    }, {
      mentions: uniqueIssuers
    });
  } catch (error) {
    console.error('Display warnings error:', error);
    await ctx.reply(`❌ فشل عرض الإنذارات: ${error.message}`);
  }
}

async function handleDeleteOneWarning(ctx) {
  try {
    console.log('Deleting one warning...');
    
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      return ctx.reply('❌ خطأ في الاتصال بقاعدة البيانات');
    }

    // Admin validation
    const isAdmin = await validateAdmin(ctx);
    if (!isAdmin) {
      return ctx.reply('⚠️ تحتاج صلاحيات المشرفين لهذا الأمر');
    }

    // User resolution
    const targetUser = resolveTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ يرجى تحديد مستخدم عن طريق الرد أو المنشن');
    }

    // Find user warnings
    const userWarnings = await WarningModel.findOne({
      userId: targetUser.id,
      groupId: ctx.chat
    }).catch(dbError => {
      console.error('Database query failed:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    });

    if (!userWarnings?.warnings?.length) {
      return ctx.reply('✔️ لا يوجد إنذارات لحذفها');
    }

    // Remove the last warning
    userWarnings.warnings.pop();
    await userWarnings.save();

    const remainingCount = userWarnings.warnings.length;

    // If no warnings left, delete the document
    if (remainingCount === 0) {
      await WarningModel.deleteOne({ 
        userId: targetUser.id, 
        groupId: ctx.chat 
      });
    }

    // Use consistent mention logic
    const deleteMentions = targetUser.jid.includes('@lid') ? [targetUser.jid] : [targetUser.id + '@s.whatsapp.net'];
    
    await ctx.conn.sendMessage(ctx.chat, {
      text: `✅ تم حذف آخر إنذار من ${targetUser.mention.text}\n📊 الإنذارات المتبقية: ${remainingCount}/5`,
      mentions: deleteMentions
    });

  } catch (error) {
    console.error('Delete one warning error:', error);
    await ctx.reply(`❌ فشل حذف الإنذار: ${error.message}`);
  }
}

async function handleClearAllWarnings(ctx) {
  try {
    console.log('Clearing all warnings...');
    
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      return ctx.reply('❌ خطأ في الاتصال بقاعدة البيانات');
    }

    // Admin validation
    const isAdmin = await validateAdmin(ctx);
    if (!isAdmin) {
      return ctx.reply('⚠️ تحتاج صلاحيات المشرفين لهذا الأمر');
    }

    // User resolution
    const targetUser = resolveTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ يرجى تحديد مستخدم عن طريق الرد أو المنشن');
    }

    // Delete all warnings for the user
    const result = await WarningModel.deleteOne({
      userId: targetUser.id,
      groupId: ctx.chat
    }).catch(dbError => {
      console.error('Database deletion failed:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    });

    if (result.deletedCount === 0) {
      return ctx.reply('✔️ لا يوجد إنذارات لحذفها');
    }

    // Use consistent mention logic
    const clearMentions = targetUser.jid.includes('@lid') ? [targetUser.jid] : [targetUser.id + '@s.whatsapp.net'];
    
    await ctx.conn.sendMessage(ctx.chat, {
      text: `✅ تم حذف جميع إنذارات ${targetUser.mention.text}`,
      mentions: clearMentions
    });

  } catch (error) {
    console.error('Clear all warnings error:', error);
    await ctx.reply(`❌ فشل حذف الإنذارات: ${error.message}`);
  }
}

// Command router
export const warningHandler = async (ctx, { command }) => {
  try {
    console.log('Warning handler called with command:', command);
    console.log('Context details:', {
      isGroup: ctx.isGroup,
      sender: ctx.sender,
      chat: ctx.chat,
      text: ctx.text,
      quoted: !!ctx.quoted,
      mentionedJid: ctx.mentionedJid
    });

    if (!ctx.isGroup) {
      return ctx.reply('🚫 هذا الأمر يعمل فقط في المجموعات');
    }

    switch (command) {
      case 'test-warn':
        // Test command to debug the warning system
        const testUser = resolveTargetUser(ctx);
        const testAdmin = await validateAdmin(ctx);
        
        let debugMessage = `🧪 Test Results:
Admin: ${testAdmin}
Is Group: ${ctx.isGroup}
Command: ${command}
DB State: ${mongoose.connection.readyState}
Sender: ${ctx.sender}
Chat: ${ctx.chat}
Quoted: ${!!ctx.quoted}
MentionedJid Count: ${ctx.mentionedJid?.length || 0}`;

        if (testUser) {
          debugMessage += `\n\n🔍 Target User Data:
ID: ${testUser.id}
Original JID: ${testUser.jid}
Mention Text: ${testUser.mention.text}
Possible JIDs: ${JSON.stringify(testUser.possibleJids)}`;

          // Test all possible mention formats
          for (let i = 0; i < testUser.possibleJids.length; i++) {
            const testJid = testUser.possibleJids[i];
            try {
              await ctx.conn.sendMessage(ctx.chat, {
                text: `🧪 Test ${i + 1}: Trying to mention ${testUser.mention.text} with JID: ${testJid}`
              }, {
                mentions: [testJid]
              });
              console.log(`Test ${i + 1} sent successfully with JID:`, testJid);
            } catch (error) {
              console.log(`Test ${i + 1} failed with JID:`, testJid, 'Error:', error.message);
            }
          }
          
          // Send debug info
          ctx.reply(debugMessage);
        } else {
          ctx.reply(debugMessage + '\n\n❌ No target user found');
        }
        break;
        
      case 'انذار':
        // Extract reason from the full text, removing the command part
        const fullText = ctx.text || '';
        const textParts = fullText.split(' ');
        const reason = textParts.slice(1).join(' ').trim();
        console.log('Warning reason:', reason);
        await handleAddWarning(ctx, reason);
        break;
        
      case 'انذاراتي':
        const myUserId = ctx.sender.split('@')[0];
        await handleViewWarnings(ctx, myUserId);
        break;
        
      case 'انذاراته':
        const targetUser = resolveTargetUser(ctx);
        if (!targetUser) {
          return ctx.reply('⚠️ حدد مستخدمًا أولاً عن طريق الرد أو المنشن');
        }
        await handleViewWarnings(ctx, targetUser.id);
        break;
        
      case 'حذف-انذار':
      case 'حذف_انذار':
        await handleDeleteOneWarning(ctx);
        break;
        
      case 'حذف-انذاراته':
      case 'حذف_انذاراته':
        await handleClearAllWarnings(ctx);
        break;
        
      default:
        ctx.reply('⚠️ أمر غير معروف');
    }
  } catch (error) {
    console.error('Command handler error:', error);
    console.error('Error stack:', error.stack);
    await ctx.reply(`❌ حدث خطأ غير متوقع: ${error.message}`);
  }
};

// Metadata
warningHandler.command = ['انذار', 'انذاراتي', 'انذاراته', 'حذف-انذار', 'حذف_انذار', 'حذف-انذاراته', 'حذف_انذاراته', 'test-warn'];
warningHandler.tags = ['الإنذارات'];
warningHandler.help = [
  {
    command: 'انذار',
    description: 'إضافة إنذار لعضو (للمشرفين) - استخدام: .انذار @المستخدم [السبب]'
  },
  {
    command: 'انذاراتي',
    description: 'عرض إنذاراتك الخاصة'
  },
  {
    command: 'انذاراته',
    description: 'عرض إنذارات عضو آخر - استخدام: .انذاراته @المستخدم'
  },
  {
    command: 'حذف-انذار / حذف_انذار',
    description: 'حذف آخر إنذار من عضو (للمشرفين) - استخدام: .حذف-انذار @المستخدم'
  },
  {
    command: 'حذف-انذاراته / حذف_انذاراته',
    description: 'حذف جميع إنذارات عضو (للمشرفين) - استخدام: .حذف-انذاراته @المستخدم'
  }
];

export default warningHandler;