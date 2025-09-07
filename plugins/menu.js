// Import necessary modules
import { promises as fsPromises, readFileSync } from "fs";
import { join } from "path";
import { xpRange } from "../lib/levelling.js";
import moment from "moment-timezone";
import os from "os";
import fs from "fs";
import path from "path";

// Load the video from config
const menuVideoUrl = "./menu_video.mp4";

// Simple cache for plugin scan results (expires after 5 minutes)
const pluginCache = {
  lastUpdated: 0,
  data: null,
};

// Define bot name
const botname = "Y U K I";

// Check if Yuki is available and active for this user
function isYukiActive(userId, conn) {
    // Check if user has activated Yuki
    const pairKey = `${conn.user?.id}:${userId}`;
    return global.yukiAllowedPairs && global.yukiAllowedPairs[pairKey] && global.yukiAllowedPairs[pairKey].active;
}

// Helper function to check if user is owner
function isUserOwner(userId) {
    try {
        const userNumber = userId.replace('@s.whatsapp.net', '');
        return global.owner && global.owner.some(ownerArray => ownerArray[0] === userNumber);
    } catch (error) {
        console.error('Error checking if user is owner:', error);
        return false;
    }
}

// Helper function to extract commands from plugin code
function extractCommands(content) {
    const commands = [];
    
    // Look for different command patterns
    const patterns = [
        // handler.command = ['command1', 'command2']
        /handler\.command\s*=\s*\[([^\]]+)\]/g,
        // handler.command = /^(command1|command2)$/i
        /handler\.command\s*=\s*\/\^?\(?([^$)]+)\)?\$?\/[gi]*/g,
        // .test() patterns like /^\.متع$/i.test(m.text)
        /\/\^\\?\.([^$\\\/]+)\$?\/[gi]*\.test\(/g,
        // Direct command checks like m.text === '.command'
        /m\.text\s*===?\s*['"]\\.?([^'"]+)['"]/g,
        // Regex test patterns
        /\/\^\.([^$\/]+)\$\/i\.test/g
    ];

    patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (match[1]) {
                // Split by | or , and clean up
                const foundCommands = match[1].split(/[|,]/).map(cmd => 
                    cmd.trim().replace(/['"]/g, '').replace(/\\/g, '')
                );
                commands.push(...foundCommands);
            }
        }
    });

    // Remove duplicates and filter out empty/invalid commands
    const uniqueCommands = [...new Set(commands)]
      .filter(cmd => cmd && cmd.length > 0 && cmd.length < 20)
      .map(cmd => cmd.startsWith('.') ? cmd : '.' + cmd);
  
    // Return all commands so nothing is omitted
    return uniqueCommands;
  }

// ---------------------------------------------------------------------------
// Extract tags from a plugin file.  Looks for assignments like:
//   handler.tags = ['admin', 'group']
// Returns an array of tags (lowercase).  If nothing is found, returns [].
function extractTags(content) {
  const tagPattern = /handler\.tags\s*=\s*\[([^\]]+)\]/m;
  const match = tagPattern.exec(content);
  if (match && match[1]) {
    return match[1]
      .split(/,/)
      .map(t => t.trim().replace(/['"]/g, '').toLowerCase())
      .filter(t => t.length > 0);
  }
  return [];
}
// Function to scan all plugins and categorize them
async function scanPlugins(userId) {
  const pluginDir = './plugins';
  const now = Date.now();

  // Return cached plugins if data exists and is fresh (< 5 minutes old)
  if (pluginCache.data && (now - pluginCache.lastUpdated) < 5 * 60_000) {
    return pluginCache.data;
  }
  const isOwner = isUserOwner(userId);
  const plugins = {
    admin: [],
    games: [],
    tools: [],
    owner: [],
    general: []
  };

  try {
    const files = fs.readdirSync(pluginDir).filter(file =>
      file.endsWith('.js') && file !== 'menu.js'
    );

    for (const file of files) {
      try {
        const filePath = path.join(pluginDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const pluginName = path.basename(file, '.js');
        
        // Check if plugin is owner-only
        const isOwnerOnly = content.includes('handler.owner = true') ||
                              content.includes('handler.owner=true') ||
                              content.includes('isROwner') ||
                              content.includes('owner: true');

        // Skip owner-only plugins for regular users
        if (isOwnerOnly && !isOwner) {
          continue;
        }

        // Extract commands and tags
        const commands = extractCommands(content);
        const tags = extractTags(content);

        // Determine category from metadata or fallback to heuristics
        let category = 'general';
        if (isOwnerOnly) {
          category = 'owner';
        } else if (tags.length) {
          if (tags.includes('owner') || tags.includes('creator')) {
            category = 'owner';
          } else if (tags.includes('admin') || tags.includes('group')) {
            category = 'admin';
          } else if (tags.includes('game') || tags.includes('games') || tags.includes('fun')) {
            category = 'games';
          } else if (tags.includes('tool') || tags.includes('tools') ||
                     tags.includes('utility') || tags.includes('media')) {
            category = 'tools';
          }
        } else {
          // Fallback: old keyword heuristic
          if (content.includes('admin') || content.includes('promote') ||
              content.includes('demote') || content.includes('kick') ||
              content.includes('ban')) {
            category = 'admin';
          } else if (content.includes('game') || pluginName.includes('ta3') ||
                     pluginName.includes('كت') || pluginName.includes('س') ||
                     content.includes('متع') || content.includes('سس')) {
            category = 'games';
          } else if (content.includes('sticker') || content.includes('image') ||
                     content.includes('hdr') || content.includes('dehaze') ||
                     content.includes('toimg') || content.includes('tovid')) {
            category = 'tools';
          }
        }

        plugins[category].push({ name: pluginName, commands, file });

      } catch (error) {
        console.error(`Error processing plugin ${file}:`, error);
      }
    }
  } catch (error) {
    console.error('Error scanning plugins:', error);
  }

  // Cache the scanned results
  pluginCache.data = plugins;
  pluginCache.lastUpdated = now;
  return plugins;
}

// Function to generate dynamic menus
function generateMenus(plugins) {
    const menus = {};

    // Admin Menu
    menus.adminsmenu = `✦ ───『 *المشرفين* 』─── 👾\n`;
    if (plugins.admin.length > 0) {
        plugins.admin.forEach(plugin => {
            menus.adminsmenu += `📁 *${plugin.name}:*\n`;
            plugin.commands.forEach(cmd => {
                menus.adminsmenu += `   ${cmd}\n`;
            });
            menus.adminsmenu += `\n`;
        });
    } else {
        menus.adminsmenu += `لا توجد إضافات إدارية متاحة\n`;
    }
    menus.adminsmenu += `╰──────────⳹`;

    // Games Menu
    menus.gamemenu = `✦ ───『 *الألعاب* 』─── ⚝\n`;
    if (plugins.games.length > 0) {
        plugins.games.forEach(plugin => {
            menus.gamemenu += `🎮 *${plugin.name}:*\n`;
            plugin.commands.forEach(cmd => {
                menus.gamemenu += `   ${cmd}\n`;
            });
            menus.gamemenu += `\n`;
        });
    } else {
        menus.gamemenu += `لا توجد ألعاب متاحة\n`;
    }
    menus.gamemenu += `╰──────────⳹`;

    // Tools Menu
    menus.toolsmenu = `✦ ───『 *أدوات مساعدة* 』─── 🛠️\n`;
    if (plugins.tools.length > 0) {
        plugins.tools.forEach(plugin => {
            menus.toolsmenu += `🔧 *${plugin.name}:*\n`;
            plugin.commands.forEach(cmd => {
                menus.toolsmenu += `   ${cmd}\n`;
            });
            menus.toolsmenu += `\n`;
        });
    } else {
        menus.toolsmenu += `لا توجد أدوات متاحة\n`;
    }
    menus.toolsmenu += `╰──────────⳹`;

    // Owner Menu
    menus.ownermenu = `✦ ───『 *أوامر المالك* 』─── 👑\n`;
    if (plugins.owner.length > 0) {
        plugins.owner.forEach(plugin => {
            menus.ownermenu += `👑 *${plugin.name}:*\n`;
            plugin.commands.forEach(cmd => {
                menus.ownermenu += `   ${cmd}\n`;
            });
            menus.ownermenu += `\n`;
        });
    } else {
        menus.ownermenu += `لا توجد أوامر مالك متاحة\n`;
    }
    menus.ownermenu += `╰──────────⳹`;

    // General Menu
    menus.generalmenu = `✦ ───『 *أوامر عامة* 』─── 📋\n`;
    if (plugins.general.length > 0) {
        plugins.general.forEach(plugin => {
            menus.generalmenu += `📄 *${plugin.name}:*\n`;
            plugin.commands.forEach(cmd => {
                menus.generalmenu += `   ${cmd}\n`;
            });
            menus.generalmenu += `\n`;
        });
    } else {
        menus.generalmenu += `لا توجد أوامر عامة متاحة\n`;
    }
    menus.generalmenu += `╰──────────⳹`;

    return menus;
}

// Main handler function
const handler = async (m, { conn, command, text, args, usedPrefix }) => {
    try {
        let glb = global.db.data.users;
        let usrs = glb[m.sender];
        let tag = `@${m.sender.split("@")[0]}`;
        let mode = global.opts["self"] ? "Private" : "Public";

        let { age, exp, limit, level, role, registered, credit } = glb[m.sender];
        let { min, xp, max } = xpRange(level, global.multiplier);
        let name = await conn.getName(m.sender);
        let premium = glb[m.sender].premiumTime;
        let prems = `${premium > 0 ? "Premium" : "Free"}`;
        let platform = os.platform();

        let ucpn = `${ucapan()}`;

        let _uptime = process.uptime() * 1000;
        let _muptime;
        if (typeof process.send === 'function') {
            process.send("uptime");
            _muptime = await new Promise(resolve => {
                process.once("message", resolve);
                setTimeout(resolve, 1000);
            }) * 1000;
        }
        let muptime = clockString(_muptime);
        let uptime = clockString(_uptime);

        // Scan plugins dynamically
        const plugins = await scanPlugins(m.sender);
        const totalPlugins = Object.values(plugins).reduce((sum, category) => sum + category.length, 0);
        
        let totalreg = Object.keys(glb).length;

        conn.gurumenu = conn.gurumenu ? conn.gurumenu : {};

        global.fcontact = {
            key: { fromMe: false, participant: `0@s.whatsapp.net`, remoteJid: 'status@broadcast' },
            message: {
                contactMessage: {
                    displayName: `${name}`,
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${name}\nitem1.TEL;waid=${m.sender.split('@')[0]}:${m.sender.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
                }
            }
        };

        // Get owner information dynamically from global.owner array
        const ownerList = global.owner.map(([number, name]) => `👤 ${name} (${number})`).join('\n');
        const isOwner = isUserOwner(m.sender);

        let menuOptions = `
╭───────⳹
│ ✨ *1.* قائمة المشرفين (${plugins.admin.length} إضافات)
│ 🎮 *2.* قائمة الالعاب (${plugins.games.length} ألعاب)
│ 🛠️ *3.* أدوات مساعدة (${plugins.tools.length} أدوات)
│ 📋 *4.* أوامر عامة (${plugins.general.length} أوامر)`;

        if (isOwner) {
            menuOptions += `\n│ 👑 *5.* أوامر المالك (${plugins.owner.length} أوامر)`;
        }

        menuOptions += `\n│ 🤖 *يوكي.* للذكاء الاصطناعي
╰───────⳹`;

        // Check if Yuki is active for this user
        const yukiActive = isYukiActive(m.sender, conn);
        
        let infoText;
        
        if (yukiActive) {
            // Yuki-powered menu
            infoText = `🤖 *يوكي - القائمة الذكية*

مرحباً ${name}! أنا يوكي، مساعدتك الذكية 💫

*${ucpn}*

乂───『 *معلوماتك* 』───乂
⛥ *الاسم:* ${name}
⛥ *المستوى:* ${level}
⛥ *الخبرة:* ${exp}
⛥ *الرتبة:* ${role}
⛥ *النوع:* ${prems}
╰──────────⳹

乂───『 *إحصائيات البوت* 』───乂
⛥ *الإضافات:* ${totalPlugins}
⛥ *المستخدمين:* ${totalreg}
⛥ *وقت التشغيل:* ${uptime}
╰──────────⳹

${menuOptions}

💡 *تفاعل معي:*
• اكتب رقم القائمة للوصول إليها
• اكتب ".يوكي إضافات" لشرح مفصل
• اكتب ".يوكي [سؤالك]" للمحادثة معي
• اكتب ".يوكي مساعدة" لكل أوامري

أنا هنا لمساعدتك! 😊`;
        } else {
            // Regular menu with Yuki activation prompt
            infoText = `${botname}
Hi ${name}, Senpai!

*${ucpn}*

乂───『 *U S E R*』───乂
⛥ *الاسم:* ${name}
⛥ *المستوى:* ${level}
⛥ *الخبرة:* ${exp}
⛥ *الرتبة:* ${role}
⛥ *النوع:* ${prems}
⛥ *المالك:* ${ownerList}
╰──────────⳹

乂───『 *B O T*』───乂
⛥ *الإضافات:* ${totalPlugins}
⛥ *المستخدمين:* ${totalreg}
⛥ *وقت التشغيل:* ${uptime}
⛥ *المنصة:* ${platform}
╰──────────⳹

${menuOptions}

🤖 *تفعيل يوكي الذكية:*
اكتب ".يوكي" لتفعيل المساعدة الذكية والحصول على تجربة أفضل!

💡 *نصيحة:* مع يوكي يمكنك الحصول على شرح مفصل لكل إضافة!`;
        }

        // React to the message
        await conn.sendMessage(m.chat, { react: { text: '🌀', key: m.key } });

        const { result, key, timeout } = await conn.sendMessage(m.chat, { 
            video: { url: "./menu_video.mp4" }, 
            caption: infoText.trim(), 
            gifPlayback: false, 
            gifAttribution: 0 
        });

        // Store the scanned plugins for this user session
        conn.gurumenu[m.sender] = {
            result,
            key,
            plugins,
            timeout: setTimeout(() => {
                conn.sendMessage(m.chat, { delete: key });
                delete conn.gurumenu[m.sender];
            }, 150 * 1000),
        };
    } catch (err) {
        console.error(err);
        m.reply('An error occurred while processing your request.');
    }
};

// Before handler function to catch user responses
handler.before = async (m, { conn }) => {
    try {
        conn.gurumenu = conn.gurumenu ? conn.gurumenu : {};
        if (m.isBaileys || !(m.sender in conn.gurumenu)) return;
        const { result, key, timeout, plugins } = conn.gurumenu[m.sender];
        if (!m.quoted || m.quoted.id !== key.id || !m.text) return;
        const choice = m.text.trim();

        const isOwner = isUserOwner(m.sender);
        const menus = generateMenus(plugins);

        const sendMenu = async (menuName) => {
            if (menus[menuName]) {
                await conn.sendMessage(m.chat, { 
                    image: { url: './menu.jpg' }, 
                    caption: menus[menuName] 
                });
            }
        };

        let menuOptions = {
            "1": "adminsmenu",
            "2": "gamemenu", 
            "3": "toolsmenu",
            "4": "generalmenu"
        };

        if (isOwner) {
            menuOptions["5"] = "ownermenu";
        }

        if (menuOptions[choice]) {
            await sendMenu(menuOptions[choice]);
        } else if (choice.toLowerCase() === 'يوكي' || choice.toLowerCase() === 'yuki') {
            // Check if Yuki is already active
            const yukiActive = isYukiActive(m.sender, conn);
            
            if (yukiActive) {
                await conn.sendMessage(m.chat, {
                    conversation: `🤖 *يوكي جاهزة!*

*الأوامر:*
• .يوكي [رسالة] - محادثة
• .يوكي ابحث [شي] - بحث Google
• .يوكي صورة [شي] - بحث صور
• .يوكي إضافات - قائمة الإضافات
• .يوكي مساعدة - كل الأوامر

جربي معي! 😊`
                });
            } else {
                await conn.sendMessage(m.chat, {
                    text: `🤖 *تفعيل يوكي*

اكتب ".يوكي" لتفعيل الذكاء الاصطناعي

*المميزات:*
• بحث Google وصور
• محادثة ذكية
• شرح الإضافات
• معالجة صور

اكتب ".يوكي" الآن! 🚀`
                });
            }
        } else if (/^\d+$/.test(choice)) {
            // Only reply if it's a number but not in menu
            const maxOptions = isOwner ? 5 : 4;
            m.reply(`Invalid choice. Please reply with a valid number (1-${maxOptions}) or "يوكي" for AI features.`);
        }

        // Add reaction to the message
        await conn.sendMessage(m.chat, { react: { text: '👍', key: m.key } });
    } catch (err) {
        console.error(err);
        m.reply('An error occurred while processing your request.');
    }
};

// Register the handler
handler.help = ["menu"];
handler.tags = ["main"];
handler.command = ['menu', 'اوامر','منيو'];
handler.limit = true;

export default handler;

// Utility functions
function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function clockString(ms) {
    let h = isNaN(ms) ? "--" : Math.floor(ms / 3600000);
    let m = isNaN(ms) ? "--" : Math.floor(ms / 60000) % 60;
    let s = isNaN(ms) ? "--" : Math.floor(ms / 1000) % 60;
    return [h, " H ", m, " M ", s, " S "].map(v => v.toString().padStart(2, 0)).join("");
}

function ucapan() {
    const time = moment.tz("Asia/Kolkata").format("HH");
    if (time >= 4 && time < 10) return "Good Morning 🌄";
    if (time >= 10 && time < 15) return "Good Afternoon ☀️";
    if (time >= 15 && time < 18) return "Good Evening 🌇";
    return "Good Night 🌙";
}
