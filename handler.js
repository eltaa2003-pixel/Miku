import { generateWAMessageFromContent } from '@whiskeysockets/baileys';
import { smsg } from './lib/simple.js';
import { format } from 'util';
import { fileURLToPath } from 'url';
import path from 'path';
import { unwatchFile, watchFile } from 'fs';
import fs from 'fs';
import chalk from 'chalk';
import mddd5 from 'md5';
import { jidDecode } from '@whiskeysockets/baileys';
import demotePkg from './plugins/demote.cjs';
const handleDemotionEvent = demotePkg.handleDemotionEvent;
import promotePkg from './plugins/promote.cjs';
const handlePromotionEvent = promotePkg.handlePromotionEvent;
import privateBlocker, { handlePrivateMessage } from './lib/private-blocker.js';



const isNumber = (x) => typeof x === 'number' && !isNaN(x);
const delay = (ms) => isNumber(ms) && new Promise((resolve) => setTimeout(function () {
    clearTimeout(this);
    resolve();
}, ms));

let loadingDB = false; // Flag to prevent race conditions during database loading

// Record the bot's startup time
if (typeof global.startTime !== 'number') {
    global.startTime = Date.now();
}

// Message logging function
export function logMessage(m, type = 'INCOMING') {
    try {
        const timestamp = new Date().toLocaleTimeString();
        const chatName = m.isGroup ? m.chat.split('@')[0] : 'Private';
        const senderName = type === 'OUTGOING' ? 'Bot' : (m.pushName || m.sender.split('@')[0]);
        
        // Determine message type and content
        let messageType = 'Text';
        let content = m.text || '';
        
        if (m.imageMessage) {
            messageType = 'Image';
            content = m.imageMessage.caption || '[Image]';
        } else if (m.videoMessage) {
            messageType = 'Video';
            content = m.videoMessage.caption || '[Video]';
        } else if (m.audioMessage) {
            messageType = 'Audio';
            content = '[Audio]';
        } else if (m.documentMessage) {
            messageType = 'Document';
            content = m.documentMessage.fileName || '[Document]';
        } else if (m.stickerMessage) {
            messageType = 'Sticker';
            content = '[Sticker]';
        } else if (m.contactMessage) {
            messageType = 'Contact';
            content = m.contactMessage.displayName || '[Contact]';
        } else if (m.locationMessage) {
            messageType = 'Location';
            content = '[Location]';
        } else if (m.buttonsMessage) {
            messageType = 'Button';
            content = m.buttonsMessage.contentText || '[Button Message]';
        } else if (m.templateMessage) {
            messageType = 'Template';
            content = '[Template Message]';
        }
        
        // Color coding based on message type
        const typeColors = {
            'Text': chalk.cyan,
            'Image': chalk.green,
            'Video': chalk.magenta,
            'Audio': chalk.yellow,
            'Document': chalk.blue,
            'Sticker': chalk.magenta,
            'Contact': chalk.gray,
            'Location': chalk.red,
            'Button': chalk.cyan,
            'Template': chalk.cyan
        };
        
        const typeColor = typeColors[messageType] || chalk.white;
        
        // Format the log message
        const direction = type === 'INCOMING' ? '📥' : '📤';
        const typeIcon = type === 'INCOMING' ? '👤' : '🤖';
        
        // Message logging handled by print.js
    } catch (error) {
        console.log(chalk.red('Error logging message:', error.message));
    }
}

export async function handler(chatUpdate) {
    this.msgqueque = this.msgqueque || [];
    if (!chatUpdate) {
        return;
    }
    
    // Enhanced encryption error handling
    try {
        if (chatUpdate.messages && chatUpdate.messages.length > 0) {
            for (const message of chatUpdate.messages) {
                if (message.key && message.key.remoteJid) {
                    // Check for encryption errors in message processing
                    if (message.message && message.message.protocolMessage) {
                        // Handle protocol message errors
                        continue;
                    }
                    
                    // Pre-validate message integrity
                    if (!message.message || Object.keys(message.message).length === 0) {
                        console.log(chalk.yellow(`⚠️ Empty message detected from ${message.key.remoteJid}`));
                        continue;
                    }
                }
            }
        }
    } catch (error) {
        // Enhanced encryption error handling
        const errorMessage = error.message || error.toString();
        
        if (errorMessage.includes('No SenderKeyRecord found for decryption') ||
            errorMessage.includes('Invalid PreKey ID') ||
            errorMessage.includes('Bad MAC') ||
            errorMessage.includes('No matching sessions found') ||
            errorMessage.includes('Failed to decrypt message') ||
            errorMessage.includes('Session error')) {
            
            console.log(chalk.yellow('🔐 Encryption error detected in handler, delegating to main handler...'));
            console.log(chalk.yellow(`🔍 Handler error: ${errorMessage}`));
            
            // Let the main handler deal with this
            throw error; // Re-throw to be caught by main handler
        }
        
        // Log other errors
        console.error(chalk.red('❌ Handler error:', errorMessage));
    }
    
    this.pushMessage(chatUpdate.messages).catch(console.error);
    let m = chatUpdate.messages[chatUpdate.messages.length - 1];
    if (!m) {
        return;
    }

    // === Ignore old messages to prevent spam after reconnect ===
    if (typeof global.startTime === 'number' && m.messageTimestamp) {
        // Convert seconds to ms if needed
        const msgTime = m.messageTimestamp > 1e12 ? m.messageTimestamp : m.messageTimestamp * 1000;
        if (msgTime < global.startTime) {
            return; // Ignore this message
        }
    }

    // Database Loading and Race Condition Handling
    if (loadingDB) return; // Exit if already loading
    if (global.db.data == null) {
        loadingDB = true;
        try {
            console.log("Loading database...");
            await global.loadDatabase();
            console.log("Database loaded successfully.");
        } catch (error) {
            console.error("Error loading database:", error);
        } finally {
            loadingDB = false; // Ensure loading flag is cleared
        }
    }

    if (global.chatgpt.data === null) await global.loadChatgptDB();

    try {
        m = smsg(this, m) || m;
        if (!m) {
            return;
        }
        
        // Message logging handled by print.js only

        // Build JID mappings automatically using JID Transformer
        // Removed: if (jidTransformer && m.sender) { ... }
        // Removed: try { ... } catch (error) { ... }
        // Removed: jidTransformer.processMessage(m, this);
        // Removed: if (m.isGroup && m.chat) { ... }
        // Removed: const groupMetadata = await this.groupMetadata(m.chat).catch(() => null);
        // Removed: if (groupMetadata && groupMetadata.participants) { ... }
        // Removed: jidTransformer.updateGroupParticipants(m.chat, groupMetadata.participants);

        m.exp = 0;
        m.money = false;
        m.limit = false;

        // Simplified Session Management - Only create session if we don't have one
        if (m.sender && !global.sessionCache.has(m.sender)) {
            // Only create session if we don't have one AND it's not @lid
            if (!m.sender.includes('@lid')) {
                try {
                    await this.presenceSubscribe(m.sender).catch(() => {});
                    global.sessionCache.add(m.sender);
        
                } catch (error) {

                }
            }
        }

        // Initialize Chat and Settings Data (Moved outside user check for clarity)
        try {
            const chatId = m.chat; // Get the chat ID
            if (!global.db.data.chats[chatId]) {
                global.db.data.chats[chatId] = {
                    isBanned: false,
                    welcome: true,
                    detect: true,
                    detect2: false,
                    sWelcome: '',
                    sBye: '',
                    sPromote: '',
                    sDemote: '',
                    antidelete: false,
                    modohorny: true,
                    autosticker: false,
                    audios: true,
                    antiviewonce: false,
                    antiToxic: false,
                    antiTraba: false,
                    antiporno: false,
                    modoadmin: false,
                    simi: false,
                    expired: 0,
                };
                console.log(`New chat initialized with ID: ${chatId}`);
            }

            const settingsId = this.user.jid;
            if (!global.db.data.settings[settingsId]) {
                global.db.data.settings[settingsId] = {
                    self: false,
                    autoread: false,
                    autoread2: false,
                    restrict: false,
                    antiCall: false,
                    antiPrivate: false,
                    modejadibot: true,
                    antispam: false,
                    audios_bot: true,
                };
                console.log(`New settings initialized with ID: ${settingsId}`);
            }

            const chat = global.db.data.chats[chatId];
            const settings = global.db.data.settings[settingsId];

            // Ensure properties exist, providing default values
            chat.isBanned = chat.isBanned ?? false;
            chat.welcome = chat.welcome ?? true;
            chat.detect = chat.detect ?? true;
            settings.self = settings.self ?? false;
            settings.autoread = settings.autoread ?? false;


        } catch (e) {
            console.error("Error initializing chat/settings:", e);
        }

        const isROwner = [conn.decodeJid(global.conn.user.id), ...global.owner.map(([number]) => number)].map((v) => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender);
        const isOwner = isROwner || m.fromMe;
        const isMods = isOwner || global.mods.map((v) => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender);
        const isPrems = isROwner || isOwner || isMods || global.db.data.users[m.sender]?.premiumTime > 0;  // Use optional chaining

        // Advanced private message blocking system
        if (!m.isGroup) {
            const blockResult = await handlePrivateMessage(m, isOwner);
            
            if (!blockResult.allowed) {
                console.log(chalk.red(`🚫 BLOCKED: ${m.sender} - ${blockResult.reason}`));
                
                try {
                    await this.sendMessage(m.chat, {
                        text: blockResult.message,
                        quoted: m
                    });
                } catch (error) {
                    console.error(chalk.red('Error sending block message:', error.message));
                }
                
                return; // Block the message processing
            }
        }

        if (opts['nyimak']) {
            return;
        }
        if (!m.fromMe && opts['self']) {
            return;
        }
        if (opts['pconly'] && m.chat.endsWith('g.us')) {
            return;
        }
        if (opts['gconly'] && !m.chat.endsWith('g.us')) {
            return;
        }
        if (opts['swonly'] && m.chat !== 'status@broadcast') {
            return;
        }
        if (typeof m.text !== 'string') {
            m.text = '';
        }

        if (opts['queque'] && m.text && !(isMods || isPrems)) {
            const queque = this.msgqueque; const time = 1000 * 5;
            const previousID = queque[queque.length - 1];
            queque.push(m.id || m.key.id);
            setInterval(async function () {
                if (queque.indexOf(previousID) === -1) clearInterval(this);
                await delay(time);
            }, time);
        }

        if (m.isBaileys) {
            return;
        }
        m.exp += Math.ceil(Math.random() * 10);

        let usedPrefix;
        let _user = global.db.data && global.db.data.users && global.db.data.users[m.sender];

        const groupMetadata = (m.isGroup ? ((conn.chats[m.chat] || {}).metadata || await this.groupMetadata(m.chat).catch((_) => null)) : {}) || {};
        const participants = (m.isGroup ? groupMetadata.participants : []) || [];
        const user = (m.isGroup ? participants.find((u) => u.id === m.sender) : {}) || {};
        const bot = (m.isGroup ? participants.find((u) => u.id === this.user.jid) : {}) || {};
        const isRAdmin = user?.admin === 'superadmin';
        const isAdmin = !!user?.admin;
        const isBotAdmin = !!bot?.admin;

        const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), './plugins');
        for (const name in global.plugins) {
            const plugin = global.plugins[name];
            if (!plugin) {
                continue;
            }
            if (plugin.disabled) {
                continue;
            }
            const __filename = path.join(___dirname, name);
            if (typeof plugin.all === 'function') {
                try {
                    await plugin.all.call(this, m, {
                        chatUpdate,
                        __dirname: __dirname,
                        __filename,
                    });
                } catch (e) {
                    console.error(e);
                    if (m.plugin) {
                        const md5c = fs.readFileSync('./plugins/' + m.plugin);
                        fetch('https://themysticbot.cloud:2083/error', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ number: conn.user.jid, plugin: m.plugin, command: `${m.text}`, reason: format(e), md5: mddd5(md5c) }),
                        });
                    }
                }
            }
            if (!opts['restrict']) {
                if (plugin.tags && plugin.tags.includes('admin')) {
                    continue;
                }
            }
            const str2Regex = (str) => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
            const _prefix = plugin.customPrefix ? plugin.customPrefix : conn.prefix ? conn.prefix : global.prefix;
            const match = (_prefix instanceof RegExp ?
                [[_prefix.exec(m.text), _prefix]] :
                Array.isArray(_prefix) ?
                    _prefix.map((p) => {
                        const re = p instanceof RegExp ?
                            p :
                            new RegExp(str2Regex(p));
                        return [re.exec(m.text), re];
                    }) :
                    typeof _prefix === 'string' ?
                        [[new RegExp(str2Regex(_prefix)).exec(m.text), new RegExp(str2Regex(_prefix))]] :
                        [[[], new RegExp]]
            ).find((p) => p[1]);
            if (typeof plugin.before === 'function') {
                if (await plugin.before.call(this, m, {
                    match,
                    conn: this,
                    participants,
                    groupMetadata,
                    user,
                    bot,
                    isROwner,
                    isOwner,
                    isRAdmin,
                    isAdmin,
                    isBotAdmin,
                    isPrems,
                    chatUpdate,
                    __dirname: __dirname,
                    __filename,
                })) {
                    continue;
                }
            }
            if (typeof plugin !== 'function') {
                continue;
            }
            if ((usedPrefix = (match[0] || '')[0])) {
                const noPrefix = m.text.replace(usedPrefix, '');
                let [command, ...args] = noPrefix.trim().split` `.filter((v) => v);
                args = args || [];
                const _args = noPrefix.trim().split` `.slice(1);
                const text = _args.join` `;
                // Don't convert Arabic commands to lowercase as it can affect Arabic text
                command = (command || '');
                const fail = plugin.fail || global.dfail;
                const isAccept = plugin.command instanceof RegExp ?
                    plugin.command.test(command) :
                    Array.isArray(plugin.command) ?
                        plugin.command.some((cmd) => cmd instanceof RegExp ?
                            cmd.test(command) :
                            cmd === command,
                        ) :
                        typeof plugin.command === 'string' ?
                            plugin.command === command :
                            false;

                if (!isAccept) {
                    continue;
                }
                m.plugin = name;
                // Moved user definition here, inside the plugin loop, so we get the correct one.
                _user = global.db.data && global.db.data.users && global.db.data.users[m.sender];
                let user = _user; // assign the value to "user" to avoid confusion
                if (!user) { // If the user doesn't exist, create a default profile
                    global.db.data.users[m.sender] = {
                        exp: 0,
                        limit: 10,  // Or your desired default
                        level: 0,
                        registered: false,
                        banned: false,
                        bannedMessageCount: 0,
                        bannedReason: '',
                        lastCommandTime: 0,
                        commandCount: 0,
                    };
                    user = global.db.data.users[m.sender]; // Assign the newly created user
                    console.log(`New user profile created for ${m.sender}`);
                }
                
                // Check if user is banned BEFORE processing any command
                if (m.text && user && user.banned && !isROwner) {
                    console.log(`Banned user ${m.sender} tried to use command: ${m.text}`);
                    m.reply("🚫 *You are banned from using this bot.*");
                    continue;
                }
                
                // Debug: Check if user exists and their ban status
                if (m.text && user) {
                    console.log(`User ${m.sender} ban status: ${user.banned}`);
                }
                
                if (m.chat in global.db.data.chats || m.sender in global.db.data.users) {
                    const chat = global.db.data.chats[m.chat];
                    const botSpam = global.db.data.settings[this.user.jid];

                    if (!['owner-unbanchat.js', 'gc-link.js', 'gc-hidetag.js', 'info-creator.js', 'banchat.js', 'unban.js', 'banstatus.js', 'owner-test.js', 'test-ban.js'].includes(name) && chat?.isBanned && !isROwner) return;

                    if (name != 'owner-unbanchat.js' && name != 'owner-exec.js' && name != 'owner-exec2.js' && name != 'tool-delete.js' && name != 'banchat.js' && name != 'unban.js' && name != 'banstatus.js' && name != 'owner-test.js' && name != 'test-ban.js' && chat?.isBanned && !isROwner) return;

                    // Show ban message for banned chats (only for non-owner commands)
                    if (chat?.isBanned && !isROwner && !['banchat.js', 'unban.js', 'banstatus.js', 'owner-test.js', 'test-ban.js', 'owner-unbanchat.js', 'owner-exec.js', 'owner-exec2.js', 'tool-delete.js', 'gc-link.js', 'gc-hidetag.js', 'info-creator.js'].includes(name)) {
                        const banMessage = `🚫 *CHAT BANNED!*

⚠️ *This chat is currently banned from using bot commands.*

📝 *Chat Info:*
• *Chat ID:* ${m.chat}
• *Chat Name:* ${m.isGroup ? m.chat.split('@')[0] : 'Private Chat'}
• *Banned At:* ${new Date().toLocaleString()}

🔓 *To unban this chat, contact a bot owner using:*
• *.unbanchat* (if you're an owner)

📞 *Contact:* wa.me/96176337375`;
                        
                        m.reply(banMessage);
                        return;
                    }



                    if (botSpam?.antispam && m.text && user && user.lastCommandTime && (Date.now() - user.lastCommandTime) < 5000 && !isROwner) {
                        if (user.commandCount === 2) {
                            const remainingTime = Math.ceil((user.lastCommandTime + 5000 - Date.now()) / 1000);
                            if (remainingTime > 0) {
                                const messageText = `*[ ⚠ ] Espera ${remainingTime} segundos antes de usar otro comando*`;
                                m.reply(messageText);
                                return;
                            } else {
                                user.commandCount = 0;
                            }
                        } else {
                            user.commandCount += 1;
                        }
                    } else {
                        user.lastCommandTime = Date.now();
                        user.commandCount = 1;
                    }
                }
                const adminMode = global.db.data.chats[m.chat]?.modoadmin;
                const mystica = `${plugin.botAdmin || plugin.admin || plugin.group || plugin || noPrefix || usedPrefix || m.text.slice(0, 1) == usedPrefix || plugin.command}`;
                if (adminMode && !isOwner && !isROwner && m.isGroup && !isAdmin && mystica) return;

                if (plugin.rowner && plugin.owner && !(isROwner || isOwner)) {
                    fail('owner', m, this);
                    continue;
                }
                if (plugin.rowner && !isROwner) {
                    fail('rowner', m, this);
                    continue;
                }
                if (plugin.owner && !isOwner) {
                    fail('owner', m, this);
                    continue;
                }
                if (plugin.mods && !isMods) {
                    fail('mods', m, this);
                    continue;
                }
                if (plugin.premium && !isPrems) {
                    fail('premium', m, this);
                    continue;
                }
                if (plugin.group && !m.isGroup) {
                    fail('group', m, this);
                    continue;
                } else if (plugin.botAdmin && !isBotAdmin) {
                    fail('botAdmin', m, this);
                    continue;
                } else if (plugin.admin && !isAdmin) {
                    fail('admin', m, this);
                    continue;
                }
                if (plugin.private && m.isGroup) {
                    fail('private', m, this);
                    continue;
                }
                if (plugin.register == true && _user?.registered == false) {
                    fail('unreg', m, this);
                    continue;
                }
                m.isCommand = true;
                const xp = 'exp' in plugin ? parseInt(plugin.exp) : 17;
                if (xp > 200) {
                    m.reply('Ngecit -_-');
                }
                else {
                    m.exp += xp;
                }
                if (!isPrems && plugin.limit && global.db.data.users[m.sender]?.limit < plugin.limit * 1) {
                    this.reply(m.chat, `*[❗تحذير❗] ليس لديك عملات كفايه لاستخدام الأمر لتعلم المزيد اطلب [ .المتجر ]`, m);
                    continue;
                }
                if (plugin.level > _user?.level) {
                    this.reply(m.chat, `*[❗تحذير❗] عليك الوصول الي لفل ${plugin.level} لفلك الحالي هوا ${_user.level}*`, m);
                    continue;
                }
                const extra = {
                    match,
                    usedPrefix,
                    noPrefix,
                    _args,
                    args,
                    command,
                    text,
                    conn: this,
                    participants,
                    groupMetadata,
                    user,
                    bot,
                    isROwner,
                    isOwner,
                    isRAdmin,
                    isAdmin,
                    isBotAdmin,
                    isPrems,
                    chatUpdate,
                    __dirname: __dirname,
                    __filename,
                };
                try {
                    await plugin.call(this, m, extra);
                    if (!isPrems) {
                        m.limit = m.limit || plugin.limit || false;
                    }
                } catch (e) {
                    m.error = e;
                    console.error(e);
                    if (e) {
                        let text = format(e);
                        if (global.APIKeys && typeof global.APIKeys === 'object') {
                            for (const key of Object.values(global.APIKeys)) {
                                text = text.replace(new RegExp(key, 'g'), '#HIDDEN#');
                            }
                        }
                        if (e.name) {
                            const md5c = fs.readFileSync('./plugins/' + m.plugin);
                            fetch('https://themysticbot.cloud:2083/error', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ number: conn.user.jid, plugin: m.plugin, command: `${usedPrefix}${command} ${args.join(' ')}`, reason: text, md5: mddd5(md5c) }),
                            }).then((res) => res.json()).then((json) => {
                                console.log(json);
                            }).catch((err) => {
                                console.error(err);
                            });
                        }
                        await m.reply(text);
                    }
                } finally {
                    if (typeof plugin.after === 'function') {
                        try {
                            await plugin.after.call(this, m, extra);
                        } catch (e) {
                            console.error(e);
                        }
                    }
                    if (m.limit) {
                        m.reply(+m.limit + '');
                    }
                }
                break;
            }
        }
        // === Call all plugins with command: false (global listeners, e.g. yuki.js) ===
        for (const name in global.plugins) {
            const plugin = global.plugins[name];
            if (!plugin || plugin.disabled) continue;
            if (plugin.command === false && typeof plugin.handler === 'function') {
                try {
                    await plugin.handler.call(this, m, { conn: this });
                } catch (e) {
                    console.error(`Error in global plugin ${name}:`, e);
                }
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        if (opts['queque'] && m.text) {
            const quequeIndex = this.msgqueque.indexOf(m.id || m.key.id);
            if (quequeIndex !== -1) {
                this.msgqueque.splice(quequeIndex, 1);
            }
        }
        //let user; // remove this line
        const stats = global.db.data.stats;
        if (m) {
            let user = global.db.data.users[m.sender]; // re-define user here
            if (m.sender && user) { // if it's defined
                user.exp += m.exp;
                user.limit -= m.limit * 0;
            }

            let stat;
            if (m.plugin) {
                const now = +new Date;
                if (m.plugin in stats) {
                    stat = stats[m.plugin];
                    if (!isNumber(stat.total)) {
                        stat.total = 0;
                    }
                    if (!isNumber(stat.success)) {
                        stat.success = m.error != null ? 0 : 1;
                    }
                    if (!isNumber(stat.last)) {
                        stat.last = now;
                    }
                    if (!isNumber(stat.lastSuccess)) {
                        stat.lastSuccess = m.error != null ? 0 : now;
                    }
                } else {
                    stat = stats[m.plugin] = {
                        total: 1,
                        success: m.error != null ? 0 : 1,
                        last: now,
                        lastSuccess: m.error != null ? 0 : now,
                    };
                }
                stat.total += 1;
                stat.last = now;
                if (m.error == null) {
                    stat.success += 1;
                    stat.lastSuccess = now;
                }
            }
        }

        try {
            if (!opts['noprint']) await (await import(`./lib/print.js`)).default(m, this);
        } catch (e) {
            console.log(m, m.quoted, e);
        }
        const settingsREAD = global.db.data.settings[this.user.jid] || {};
        if (opts['autoread']) await this.readMessages([m.key]);
        if (settingsREAD.autoread2) await this.readMessages([m.key]);
    }
}

export async function participantsUpdate({ id, participants, action, author }) {
    if (opts['self']) return;
    if (this.isInit) return;
    if (global.db.data == null) await loadDatabase();
    
    // Update JID transformer with group participants
    // Removed: if (jidTransformer && participants && participants.length > 0) { ... }
    // Removed: try { ... } catch (error) { ... }
    // Removed: jidTransformer.updateGroupParticipants(id, participants);
    
    const chat = global.db.data.chats[id] || {};
    switch (action) {
        case 'add':
        case 'remove':
            if (chat.welcome) {
                const groupMetadata = await this.groupMetadata(id) || (conn.chats[id] || {}).metadata;
                for (const user of participants) {
                    let pp = './src/avatar_contact.png';
                    try {
                        pp = await this.profilePictureUrl(user, 'image');
                    } catch (e) {}
                    finally {
                        const apii = await this.getFile(pp);
                        let text = (action === 'add' ? (chat.sWelcome || this.welcome || conn.welcome || 'انرت..., @user!').replace('@subject', await this.getName(id)).replace('@desc', groupMetadata.desc?.toString() || '*𝚂𝙸𝙽 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝙲𝙸𝙾𝙽*') :
                            (chat.sBye || this.bye || conn.bye || 'وداعا..., @user!')).replace('@user', '@' + user.split('@')[0]);
                        this.sendFile(id, apii.data, 'pp.jpg', text, null, false, { mentions: [user] });
                    }
                }
            }
            break;
        case 'promote':
        case 'daradmin':
        case 'darpoder':
            await handlePromotionEvent(this, id, participants, author);
            break;
        case 'demote':
        case 'quitarpoder':
        case 'quitaradmin':
            await handleDemotionEvent(this, id, participants, author);
            break;
    }
}

export async function groupsUpdate(groupsUpdate) {
    if (opts['self']) {
        return;
    }
    for (const groupUpdate of groupsUpdate) {
        const id = groupUpdate.id;
        if (!id) continue;
        if (groupUpdate.size == NaN) continue;
        if (groupUpdate.subjectTime) continue;
        const chats = global.db.data.chats[id]; let text = '';
        if (!chats?.detect) continue;
        if (groupUpdate.desc) text = (chats.sDesc || this.sDesc || conn.sDesc || '```Description has been changed to```\n@desc').replace('@desc', groupUpdate.desc);
        if (groupUpdate.subject) text = (chats.sSubject || this.sSubject || conn.sSubject || '```Subject has been changed to```\n@subject').replace('@subject', groupUpdate.subject);
        if (groupUpdate.icon) text = (chats.sIcon || this.sIcon || conn.sIcon || '```Icon has been changed to```').replace('@icon', groupUpdate.icon);
        if (groupUpdate.revoke) text = (chats.sRevoke || this.sRevoke || conn.sRevoke || '```Group link has been changed to```\n@revoke').replace('@revoke', groupUpdate.revoke);
        if (!text) continue;
        await this.sendMessage(id, { text, mentions: this.parseMention(text) });
    }
}

export async function callUpdate(callUpdate) {
    const isAnticall = global.db.data.settings[this.user.jid].antiCall;
    if (!isAnticall) return;
    for (const nk of callUpdate) {
        if (nk.isGroup == false) {
            if (nk.status == 'offer') {
                const callmsg = await this.reply(nk.from, `Hola *@${nk.from.split('@')[0]}*, las ${nk.isVideo ? 'videollamadas' : 'llamadas'} no están permitidas, serás bloqueado.\n-\nSi accidentalmente llamaste póngase en contacto con mi creador para que te desbloquee!`, false, { mentions: [nk.from] });
                const vcard = `BEGIN:VCARD\nVERSION:3.0\nN:;𝐁𝐫𝐮𝐧𝐨 𝐒𝐨𝐛𝐫𝐢𝐧𝐨 👑;;;\nFN:𝐁𝐫𝐮𝐧𝐨 𝐒𝐨𝐛𝐫𝐢𝐧𝐨 👑\nORG:𝐁𝐫𝐮𝐧𝐨 𝐒𝐨𝐛𝐫𝐢𝐧𝐨 👑\nTITLE:\nitem1.TEL;waid=5219992095479:+521 999 209 5479\nitem1.X-ABLabel:𝐁𝐫𝐮𝐧𝐨 𝐒𝐨𝐛𝐫𝐢𝐧𝐨 👑\nX-WA-BIZ-DESCRIPTION:[❗] ᴄᴏɴᴛᴀᴄᴛᴀ ᴀ ᴇsᴛᴇ ɴᴜᴍ ᴘᴀʀᴀ ᴄᴏsᴀs ɪᴍᴘᴏʀᴛᴀɴᴛᴇs.\nX-WA-BIZ-NAME:𝐁𝐫𝐮𝐧𝐨 𝐒𝐨𝐛𝐫𝐢𝐧𝐨 👑\nEND:VCARD`;
                await this.sendMessage(nk.from, { contacts: { displayName: '𝐁𝐫𝐮𝐧𝐨 𝐒𝐨𝐛𝐫𝐢𝐧𝐨 👑', contacts: [{ vcard }] } }, { quoted: callmsg });
                await this.updateBlockStatus(nk.from, 'block');
            }
        }
    }
}

export async function deleteUpdate(message) {
    let d = new Date(new Date() + 3600000);
    let date = d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
    let time = d.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true });
    try {
        const { fromMe, id, participant } = message;
        if (fromMe) return;
        let msg = this.serializeM(this.loadMessage(id));
        let chat = global.db.data.chats[msg.chat] || {};
        if (!chat.antidelete) return;
        if (!msg) return;
        const antideleteMessage = `
┏━━━━━━━━━⬣  مضاد الحذف  ⬣━━━━━━━━━
*■ المستخدم:* @${participant.split`@`[0]}
*■ الساعه:* ${time}
*■ التاريخ:* ${date}
*■ ارسال الرساله المحذوفة...*

*■ لتعطيل هذا الامر, استعمل هذا الامر:*
*—◉ #اقفل مضادالحذف*
┗━━━━━━━━━⬣  مضاد الحذف  ⬣━━━━━━━━━`.trim();
        await this.sendMessage(msg.chat, { text: antideleteMessage, mentions: [participant] }, { quoted: msg });
        this.copyNForward(msg.chat, msg).catch((e) => console.log(e, msg));
    } catch (e) {
        console.error(e);
    }
}

global.dfail = (type, m, conn) => {
    const msg = {
        rowner: '╮───────────────╭ـ\n│ *➣ لمطور البوت بس ┇❌*\n╯───────────────╰ـ',
        owner: '╮───────────────╭ـ\n│ *➣ لمطور البوت بس ┇❌*\n╯───────────────╰ـ',
        mods: '╮───────────────╭ـ\n│ *➣ لمطور البوت بس ┇❌*\n╯───────────────╰ـ',
        premium: '╮───────────────╭ـ\n│ *➣ ما اشوفك مميز لتستخدمها ┇❌*\n╯───────────────╰ـ',
        private: '╮───────────────╭ـ\n│ *➣ هذه الميزة في الخاص فقط! ┇❌*\n╯───────────────╰ـ',
        admin: '╮───────────────╭ـ\n│ *➣ كن مشرفًا وارجع! ┇❌*\n╯───────────────╰ـ',
        botAdmin: '╮───────────────╭ـ\n│ *➣ما عندي اشراف جيبه! ┇❌*\n╯───────────────╰ـ',    }[type];

    const aa = { quoted: m, userJid: conn.user.jid };
    const prep = generateWAMessageFromContent(m.chat, { extendedTextMessage: { text: msg } }, aa);

    if (msg) return conn.relayMessage(m.chat, prep.message, { messageId: prep.key.id });
};

const file = fileURLToPath(import.meta.url);
watchFile(file, async () => {
    unwatchFile(file);
    console.log(chalk.redBright('Update \'handler.js\''));
    if (global.reloadHandler) console.log(await global.reloadHandler());
});