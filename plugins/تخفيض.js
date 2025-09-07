import fs from 'fs';
import { normalizeJid, safeGroupOperation } from '../lib/simple.js'; // Import the helper functions

        const handler = async (m, {conn, usedPrefix, text}) => {
            
    try {
        const datas = global;
        
        // Add safety check for global.db
        if (!datas || !datas.db || !datas.db.data || !datas.db.data.users || !datas.db.data.users[m.sender]) {
            console.error('Database structure is incomplete');
            return conn.reply(m.chat, 'Database error. Please try again later.', m);
        }
        
        const idioma = datas.db.data.users[m.sender].language || global.defaultLenguaje || 'en';
        
        // Add safety check for file reading
        let _translate;
        try {
            const filePath = `./language/${idioma}.json`;
            if (fs.existsSync(filePath)) {
                _translate = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } else {
                console.warn(`Language file not found: ${filePath}, using default`);
                // Try the correct language directory path
                const defaultPath = './language/en.json';
                if (fs.existsSync(defaultPath)) {
                    _translate = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
                } else {
                    console.warn(`Default language file not found: ${defaultPath}, using fallback`);
                }
            }
        } catch (fileError) {
            console.error('Error reading language file:', fileError);
            // Fallback translations
            _translate = {
                plugins: {
                    gc_demote: {
                        texto1: ['Usage: ', 'number'],
                        texto2: 'Invalid number format',
                        texto3: 'User has been demoted'
                    }
                }
            };
        }
        
        const tradutor = _translate.plugins.gc_demote;
        
        let number;
        let user;
        
        // Enhanced parsing to handle @lid mentions
        if (!text && !m.quoted) {
            return conn.reply(m.chat, `${tradutor.texto1[0]} ${usedPrefix}تخفيض @tag*\n*┠≽ ${usedPrefix}تخفيض ${tradutor.texto1[1]}`, m);
        }
        
        try {
            // Priority 1: Check mentionedJid first (most reliable)
            if (m.mentionedJid && m.mentionedJid.length > 0) {
                user = m.mentionedJid[0];
            }
            // Priority 2: Check quoted message
            else if (m.quoted?.sender) {
                user = m.quoted.sender;
            }
            // Priority 3: Parse text content
            else if (text) {
                // Check if it's a @lid mention
                if (text.includes('@lid')) {
                    const lidMatch = text.match(/(\d+@lid)/);
                    if (lidMatch) {
                        user = lidMatch[1]; // Keep the full @lid identifier
                    }
                } else if (text.match(/@/g) && !isNaN(text.split('@')[1])) {
                    // Regular @mention
                    number = text.split('@')[1];
                    user = normalizeJid(number);
                } else if (text.match(/\d+@lid/)) {
                    // @lid number without @ symbol at the beginning
                    const lidMatch = text.match(/(\d+@lid)/);
                    if (lidMatch) {
                        user = lidMatch[1];
                    }
                } else if (!isNaN(text)) {
                    // Plain number
                    number = text;
                    user = normalizeJid(number);
                }
            }
            
            // Enhanced validation for @lid vs regular numbers
            if (number && !user.includes('@lid')) {
                if (number.length > 13 || (number.length < 11 && number.length > 0)) {
                    return conn.reply(m.chat, tradutor.texto2, m);
                }
            }
            
            // Additional validation: Check if the JID format is correct
            if (user && !user.includes('@lid') && !user.includes('@s.whatsapp.net') && !user.includes('@g.us')) {
                // If it's not a @lid and doesn't have proper domain, add @s.whatsapp.net
                if (/^\d+$/.test(user)) {
                    user = user + '@s.whatsapp.net';
                }
            }
            
            // Ensure we have a valid user to demote
            if (!user) {
                return conn.reply(m.chat, `${tradutor.texto1[0]} ${usedPrefix}تخفيض @tag*`, m);
            }
            
            // OWNER PROTECTION: Check if user is an owner or the bot itself
            const userNumber = user.split('@')[0];
            const botNumber = conn.user.id.split(':')[0];
            
            // Check if user is an owner
            const isOwner = global.owner.some(ownerArray => {
                const ownerNumber = ownerArray[0].replace('+', ''); // Remove + if present
                return userNumber === ownerNumber;
            });
            
            // Check if user is the bot itself
            const isBot = userNumber === botNumber;
            
            if (isOwner) {
                return conn.reply(m.chat, '❌ Cannot demote an owner! Owners are protected from demotion.', m);
            }
            
            if (isBot) {
                return conn.reply(m.chat, '❌ Cannot demote the bot itself!', m);
            }
            
            // Use the safe group operation function
            await safeGroupOperation(conn, m.chat, [user], 'demote');
            
            // No success message - silent operation
            
        } catch (operationError) {
            console.error('Error in demote operation:', operationError);
            
            // Provide more specific error messages
            if (operationError.message?.includes('not-authorized')) {
                await conn.reply(m.chat, 'I don\'t have permission to demote this user.', m);
            } else if (operationError.message?.includes('participant-not-found')) {
                await conn.reply(m.chat, 'User not found in this group.', m);
            } else if (operationError.message?.includes('@lid')) {
                await conn.reply(m.chat, 'Cannot demote this user due to identifier format issues. Please try again later.', m);
            } else {
                await conn.reply(m.chat, 'An error occurred while trying to demote the user.', m);
            }
        }
        
    } catch (mainError) {
        console.error('Main handler error:', mainError);
        await conn.reply(m.chat, 'An unexpected error occurred.', m);
    }
};

handler.help = ['demote', 'تخفيض'].map((v) => 'mention ' + v);
handler.tags = ['group'];
handler.command = /^(demote|quitarpoder|quitaradmin|تخفيض)$/i;
handler.group = true;
handler.admin = true;
handler.botAdmin = true;
handler.fail = null;

export default handler;