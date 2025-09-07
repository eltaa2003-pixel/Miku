import fs from 'fs';
import { normalizeJid, safeGroupOperation } from '../lib/simple.js';
import { areJidsSameUser } from '@whiskeysockets/baileys';

const handler = async (m, {conn, usedPrefix, text, participants}) => {
    try {
        const datas = global;
        
        if (!datas || !datas.db || !datas.db.data || !datas.db.data.users || !datas.db.data.users[m.sender]) {
            return conn.reply(m.chat, 'Database error. Please try again later.', m);
        }
        
        const idioma = datas.db.data.users[m.sender].language || global.defaultLenguaje || 'en';
        
        let _translate;
        try {
            const filePath = `./language/${idioma}.json`;
            if (fs.existsSync(filePath)) {
                _translate = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } else {
                const defaultPath = './language/en.json';
                if (fs.existsSync(defaultPath)) {
                    _translate = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
                }
            }
        } catch (fileError) {
            _translate = {
                plugins: {
                    gc_kick: {
                        texto1: ['Usage: ', 'number'],
                        texto2: 'Invalid number format',
                        texto3: 'User has been kicked'
                    }
                }
            };
        }
        
        const tradutor = _translate.plugins.gc_kick;
        
        const isAdmin = participants.find(p => areJidsSameUser(p.id, m.sender) && p.admin);
        if (!isAdmin) {
            return m.reply("❌ *فقط المشرفين يمكنهم استخدام هذا الأمر*");
        }

        const botAdmin = participants.find(p => areJidsSameUser(p.id, conn.user.id) && p.admin);
        if (!botAdmin) {
            return m.reply("❌ *عطيني اشراف طيب*");
        }
        
        let targets = [];
        
        let cleanNumber;
        let properJid;
        if (!text && !m.quoted) {
            return m.reply(`❌ *الرجاء تحديد العضو:*\n• الرد على رسالة العضو\n• منشن العضو\n• كتابة رقم العضو`);
        }
        try {
            if (m.mentionedJid && m.mentionedJid.length > 0) {
                cleanNumber = m.mentionedJid[0].replace(/@.*$/, '');
                properJid = cleanNumber + '@s.whatsapp.net';
                targets = [properJid];
            } else if (m.quoted?.sender) {
                cleanNumber = m.quoted.sender.replace(/@.*$/, '');
                properJid = cleanNumber + '@s.whatsapp.net';
                targets = [properJid];
            } else if (text) {
                const numberMatch = text.match(/@(\d+)/);
                if (numberMatch) {
                    cleanNumber = numberMatch[1];
                } else {
                    cleanNumber = text.replace(/[^\d]/g, '');
                }
                if (cleanNumber) {
                    properJid = cleanNumber + '@s.whatsapp.net';
                    targets = [properJid];
                }
            }
            if (!targets || targets.length === 0) {
                return m.reply("❌ *لم يتم العثور على أعضاء صالحين للإخراج*");
            }
            
            targets = targets.filter(target => {
                if (target.includes('@lid')) return true;
                if (target.includes('@s.whatsapp.net')) return true;
                if (/^\d+$/.test(target)) {
                    if (target.length > 13 || (target.length < 11 && target.length > 0)) {
                        return false;
                    }
                    return true;
                }
                return false;
            });
            
            targets = targets.map(target => {
                if (target && !target.includes('@lid') && !target.includes('@s.whatsapp.net') && !target.includes('@g.us')) {
                    if (/^\d+$/.test(target)) {
                        return target + '@s.whatsapp.net';
                    }
                }
                return target;
            });
            
            if (targets.length === 0) {
                return m.reply("❌ *لم يتم العثور على أعضاء صالحين للإخراج*");
            }
            
            const removedUsers = [];
            const failedUsers = [];
            
            for (const target of targets) {
                try {
                    if (!target.includes('@s.whatsapp.net') && !target.includes('@lid')) {
                        failedUsers.push({ jid: target, reason: 'تنسيق غير صحيح' });
                        continue;
                    }

                    const targetIsAdmin = participants.find(p => areJidsSameUser(p.id, target) && p.admin);
                    if (targetIsAdmin) {
                        failedUsers.push({ jid: target, reason: 'مشرف - لا يمكن إخراجه' });
                        continue;
                    }

                    if (areJidsSameUser(target, conn.user.id)) {
                        failedUsers.push({ jid: target, reason: 'البوت نفسه' });
                        continue;
                    }

                    const groupMetadata = await conn.groupMetadata(m.chat);
                    if (areJidsSameUser(target, groupMetadata.owner)) {
                        failedUsers.push({ jid: target, reason: 'مالك المجموعة' });
                        continue;
                    }
                    
                    await safeGroupOperation(conn, m.chat, [target], 'remove');
                    removedUsers.push(target);
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (operationError) {
                    failedUsers.push({ jid: target, reason: operationError.message || 'خطأ غير معروف' });
                }
            }
            
        } catch (operationError) {
            if (operationError.message?.includes('not-authorized')) {
                await conn.reply(m.chat, 'I don\'t have permission to kick this user.', m);
            } else if (operationError.message?.includes('participant-not-found')) {
                await conn.reply(m.chat, 'User not found in this group.', m);
            } else if (operationError.message?.includes('@lid')) {
                await conn.reply(m.chat, 'Cannot kick this user due to identifier format issues. Please try again later.', m);
            } else {
                await conn.reply(m.chat, 'An error occurred while trying to kick the user.', m);
            }
        }
        
    } catch (mainError) {
        await conn.reply(m.chat, 'An unexpected error occurred.', m);
    }
};

handler.help = ['kick', 'طرد', 'دزمها', 'انقلع', 'بنعالي'].map((v) => 'mention ' + v);
handler.tags = ['group'];
handler.command = /^(kick|طرد|دزمها|انقلع|بنعالي)$/i;
handler.group = true;
handler.admin = true;
handler.botAdmin = true;
handler.fail = null;

export default handler;