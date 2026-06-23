import { normalizeJid } from '../lib/simple-jid.js';
import { ProfileDB } from '../lib/db-local.js';
import pkg from 'baileys-pro';
const { jidNormalizedUser } = pkg;

const medoBK9 = ProfileDB;

// ─── JID Utilities ────────────────────────────────────────────────────────────

const processJid = (jid) => {
    if (!jid) return null;
    return jid.includes('@lid') ? jid : normalizeJid(jid);
};

const extractUserId = (jid) => {
    if (!jid || typeof jid !== 'string') return null;
    return jid.split('@')[0].replace(/[^\d]/g, '');
};

const formatUserForMention = (jid) => {
    if (!jid) return { text: 'مستخدم غير معروف', jid: null };
    const userId = jid.split('@')[0];
    return {
        text: `@${userId}`,
        jidForMention: jid,
        jidS: `${userId}@s.whatsapp.net`,
        jidC: `${userId}@c.us`,
        jidLid: jid.includes('@lid') ? jid : null,
    };
};

const resolveTargetUser = (ctx) => {
    try {
        let targetJid = null;

        if (ctx.quoted?.sender) {
            targetJid = ctx.quoted.sender;
        } else if (ctx.mentionedJid?.length > 0) {
            targetJid = ctx.mentionedJid[0];
        } else if (ctx.text) {
            const match = ctx.text.match(/@(\d+)/);
            if (match) targetJid = `${match[1]}@s.whatsapp.net`;
        }

        if (!targetJid) return null;

        const cleanNumber = targetJid.split('@')[0].replace(/[^\d]/g, '');
        const mention = formatUserForMention(targetJid);

        return {
            id: cleanNumber,
            jid: targetJid,
            mention,
            possibleJids: [...new Set([
                targetJid,
                `${cleanNumber}@s.whatsapp.net`,
                `${cleanNumber}@c.us`,
            ])],
        };
    } catch (err) {
        console.error('Error resolving target user:', err);
        return null;
    }
};

// ─── Messaging ────────────────────────────────────────────────────────────────

const sendWithMention = async (ctx, text, targetUser) => {
    const mentions = targetUser
        ? [targetUser.jid.includes('@lid') ? targetUser.jid : `${targetUser.id}@s.whatsapp.net`]
        : [];

    try {
        await ctx.conn.sendMessage(ctx.chat, { text, mentions });
    } catch {
        await ctx.conn.sendMessage(ctx.chat, { text });
    }
};

// ─── Permission Check ─────────────────────────────────────────────────────────

const checkAdmin = async (ctx) => {
    if (!ctx.isGroup) {
        ctx.reply('هذا الأمر يعمل فقط في المجموعات');
        return false;
    }
    try {
        const meta = await ctx.conn.groupMetadata(ctx.chat);
        const admins = meta.participants
            .filter(p => p.admin)
            .map(p => processJid(p.id));

        if (!admins.includes(processJid(ctx.sender))) {
            ctx.reply('هذا الأمر يعمل فقط مع الإداريين');
            return false;
        }
        return true;
    } catch (err) {
        console.error('Error checking admin:', err);
        ctx.reply('حدث خطأ في التحقق من الصلاحيات');
        return false;
    }
};

// ─── Pending Confirmations ────────────────────────────────────────────────────

if (!global.pendingConfirmation) global.pendingConfirmation = {};

const setPendingConfirmation = (ctx, action) => {
    const key = `${ctx.chat}_${ctx.sender}`;
    global.pendingConfirmation[key] = { action, timestamp: Date.now() };
    setTimeout(() => { delete global.pendingConfirmation[key]; }, 60_000);
};

const consumePendingConfirmation = (ctx) => {
    const key = `${ctx.chat}_${ctx.sender}`;
    const pending = global.pendingConfirmation[key];
    if (!pending) return null;
    delete global.pendingConfirmation[key];
    return pending;
};

// ─── Command Handlers ─────────────────────────────────────────────────────────

async function handleTitlesCommand(ctx) {
    if (!(await checkAdmin(ctx))) return;

    try {
        const titles = await medoBK9.find({ groupId: ctx.chat });
        if (titles.length === 0) {
            return ctx.reply('لا يوجد ألقاب مسجلة حاليا ┇');
        }

        const mentions = [];
        let list = '';

        titles.forEach((entry, i) => {
            const userJid = entry.userId.includes('@') ? entry.userId : `${entry.userId}@s.whatsapp.net`;
            const mention = formatUserForMention(userJid);
            list += `${i + 1} ┇ ${mention.text} ┇ ${entry.bk9}\n`;
            mentions.push(mention.jidForMention);
        });

        try {
            await ctx.conn.sendMessage(ctx.chat, {
                text: `┇ عدد الألقاب المسجلة: ${titles.length}\n\n ┇الألقاب المسجلة:\n\n${list}`,
                mentions,
            });
        } catch {
            ctx.reply(`┇ عدد الألقاب المسجلة: ${titles.length}\n\n ┇الألقاب المسجلة:\n\n${list}`);
        }
    } catch (err) {
        console.error('handleTitlesCommand error:', err);
        ctx.reply('حدث خطأ في جلب الألقاب');
    }
}

async function handleRegisterCommand(ctx) {
    if (!(await checkAdmin(ctx))) return;

    const targetUser = resolveTargetUser(ctx);
    if (!targetUser) {
        return ctx.reply('منشن احد او رد على رسالته واكتب اللقب الذي تريد تسجيله');
    }

    const parts = ctx.text.trim().split(/\s+/);
    const title = parts.slice(1).filter(p => !p.startsWith('@')).join(' ').trim();

    if (!title) {
        return ctx.reply('مثال:\n .تسجيل @العضو جيرايا');
    }

    try {
        const existing = await medoBK9.findOne({ bk9: title, groupId: ctx.chat });
        if (existing) {
            const userJid = existing.userId.includes('@') ? existing.userId : `${existing.userId}@s.whatsapp.net`;
            const mention = formatUserForMention(userJid);
            return sendWithMention(
                ctx,
                `اللقب ${title} مأخوذ من طرف ${mention.text}`,
                { jid: userJid, id: existing.userId }
            );
        }

        await medoBK9.findOneAndUpdate(
            { userId: targetUser.id, groupId: ctx.chat },
            { bk9: title },
            { upsert: true, new: true }
        );
        ctx.reply(`┇ تم تسجيله بلقب ${title} بنجاح`);
    } catch (err) {
        console.error('handleRegisterCommand error:', err);
        ctx.reply(err.code === 11000 ? 'هذا اللقب مأخوذ بالفعل' : 'حدث خطأ في تسجيل اللقب');
    }
}

async function handleDeleteTitleCommand(ctx) {
    if (!(await checkAdmin(ctx))) return;

    const title = ctx.text.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!title) return ctx.reply('اكتب اللقب الذي تريد حذفه');

    try {
        const { deletedCount } = await medoBK9.deleteOne({ bk9: title, groupId: ctx.chat });
        ctx.reply(deletedCount > 0
            ? `┇ تم حذف اللقب ${title} بنجاح`
            : `اللقب ${title} غير مسجل لاحد اساسا`
        );
    } catch (err) {
        console.error('handleDeleteTitleCommand error:', err);
        ctx.reply('حدث خطأ في حذف اللقب');
    }
}

async function handleDeleteAllTitles(ctx) {
    if (!(await checkAdmin(ctx))) return;
    setPendingConfirmation(ctx, 'delete_all_titles');
    ctx.reply('⚠️ هل أنت متأكد أنك تريد حذف جميع الألقاب في هذه المجموعة؟\n\nالرجاء الرد بـ:\n1. نعم\n2. لا');
}

async function handleMyTitleCommand(ctx) {
    try {
        const userId = extractUserId(ctx.sender);
        const entry = await medoBK9.findOne({ userId, groupId: ctx.chat });
        ctx.reply(entry?.bk9 ? `┇ لقبك هو : ${entry.bk9}` : '┇ لم يتم تسجيلك بعد');
    } catch (err) {
        console.error('handleMyTitleCommand error:', err);
        ctx.reply('حدث خطأ في جلب لقبك');
    }
}

async function handleGetTitleCommand(ctx) {
    const targetUser = resolveTargetUser(ctx);
    if (!targetUser) return ctx.reply('منشن احد او رد على رسالته لمعرفة لقبه');

    try {
        const entry = await medoBK9.findOne({ userId: targetUser.id, groupId: ctx.chat });
        const message = entry?.bk9
            ? `┇ لقب ${targetUser.mention.text} هو : ${entry.bk9}`
            : `┇ ${targetUser.mention.text} لم يتم تسجيله بعد`;
        await sendWithMention(ctx, message, targetUser);
    } catch (err) {
        console.error('handleGetTitleCommand error:', err);
        ctx.reply('حدث خطأ في جلب اللقب');
    }
}

async function handleCheckTitleCommand(ctx) {
    const title = ctx.text.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!title) return ctx.reply('اكتب لقب للتحقق منه');

    try {
        const entry = await medoBK9.findOne({ bk9: title, groupId: ctx.chat });
        if (entry) {
            const userJid = entry.userId.includes('@') ? entry.userId : `${entry.userId}@s.whatsapp.net`;
            const mention = formatUserForMention(userJid);
            await sendWithMention(
                ctx,
                `اللقب ${title} مأخوذ من طرف ${mention.text}`,
                { jid: userJid, id: entry.userId }
            );
        } else {
            ctx.reply(`اللقب ${title} متوفر`);
        }
    } catch (err) {
        console.error('handleCheckTitleCommand error:', err);
        ctx.reply('حدث خطأ في التحقق من اللقب');
    }
}

// ─── Confirmation Handler ─────────────────────────────────────────────────────

const CONFIRM_YES = new Set(['1', 'نعم']);
const CONFIRM_VALID = new Set(['1', '2', 'نعم', 'لا']);

async function handleConfirmation(ctx, response) {
    const pending = consumePendingConfirmation(ctx);
    if (!pending) return false;

    const normalized = response.trim().toLowerCase();
    if (!CONFIRM_VALID.has(normalized)) return false;

    if (pending.action === 'delete_all_titles') {
        if (CONFIRM_YES.has(normalized)) {
            if (!(await checkAdmin(ctx))) return true;
            try {
                const { deletedCount } = await medoBK9.deleteMany({ groupId: ctx.chat });
                ctx.reply(deletedCount > 0
                    ? `✅ تم حذف جميع الألقاب بنجاح (${deletedCount}).`
                    : 'ℹ️ لا توجد ألقاب لحذفها.'
                );
            } catch (err) {
                console.error('Error deleting all titles:', err);
                ctx.reply('حدث خطأ أثناء حذف الألقاب.');
            }
        } else {
            ctx.reply('تم إلغاء العملية.');
        }
    }

    return true;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

const COMMANDS = {
    'الالقاب': handleTitlesCommand,
    'الألقاب': handleTitlesCommand,
    'تسجيل': handleRegisterCommand,
    'حذف_لقب': handleDeleteTitleCommand,
    'حذف_جميع_الالقاب': handleDeleteAllTitles,
    'لقبي': handleMyTitleCommand,
    'لقبه': handleGetTitleCommand,
    'لقب': handleCheckTitleCommand,
};

let medoHandler = async function (ctx, { text, command }) {
    try {
        // Handle pending confirmation first
        if (text && await handleConfirmation(ctx, text)) return;

        if (!command) return;

        const handler = COMMANDS[command];
        if (handler) await handler(ctx);
    } catch (err) {
        console.error('Command handler error:', err);
        ctx.reply('حدث خطأ اثناء معالجة الأمر');
    }
};

medoHandler.command = Object.keys(COMMANDS);
medoHandler.tags = ['BK9'];

medoHandler.all = async function (ctx) {
    if (ctx.text) await handleConfirmation(ctx, ctx.text);
};

export default medoHandler;