import express from 'express';
const app = express();
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => {
  if (!process.env.ELTA_CHILD_PROCESS) {
    console.log(`Web server listening on port ${PORT}`);
  }
});
// Only disable TLS if absolutely necessary
if (process.env.DISABLE_TLS_VERIFICATION === 'true') {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
}
import './config.js';
import {createRequire} from 'module';
import path, {join} from 'path';
import {fileURLToPath, pathToFileURL} from 'url';
import {platform} from 'process';
import * as ws from 'ws';
import {readdirSync, statSync, unlinkSync, existsSync, readFileSync, rmSync, watch, stat, mkdirSync, writeFileSync} from 'fs';
import yargs from 'yargs';
import {spawn} from 'child_process';
import lodash from 'lodash';
import chalk from 'chalk';
import syntaxerror from 'syntax-error';
import {tmpdir} from 'os';
import {format} from 'util';
import pino from 'pino';
import {Boom} from '@hapi/boom';
import {makeWASocket, protoType, serialize} from './lib/simple.js';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import {mongoDB, mongoDBV2} from './lib/mongoDB.js';
import cloudDBAdapter from './lib/cloudDBAdapter.js';
import store from './lib/store.js';
import qrcode from 'qrcode-terminal';
import encryptionManager, { handleEncryptionError } from './lib/encryption-manager.js';
import renderSessionManager, { initializeRenderSession } from './render-config.js';

// FIXED IMPORTS FOR COMMONJS MODULES
import promotePkg from './plugins/promote.cjs';
const { promoteCommand, handlePromotionEvent } = promotePkg;

import demotePkg from './plugins/demote.cjs';
const { demoteCommand, handleDemotionEvent } = demotePkg;

const {proto} = (await import('@whiskeysockets/baileys')).default;
const {DisconnectReason, useMultiFileAuthState, MessageRetryMap, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, isJidBroadcast} = await import('@whiskeysockets/baileys');
const {CONNECTING} = ws;
const {chain} = lodash;

protoType();
serialize();

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString();
}; global.__dirname = function dirname(pathURL) {
  return path.dirname(global.__filename(pathURL, true));
}; global.__require = function require(dir = import.meta.url) {
  return createRequire(dir);
};

global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({...query, ...(apikeyqueryname ? {[apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name]} : {})})) : '');

global.timestamp = {start: new Date};
global.videoList = [];
global.videoListXXX = [];

const __dirname = global.__dirname(import.meta.url);

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse());
global.prefix = new RegExp('^[' + (opts['prefix'] || '*/i!#$%+£¢€¥^°=¶∆×÷π√✓©®:;?&.\\-.@aA').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']');

const defaultData = {
  users: {},
  chats: {},
  stats: {},
  msgs: {},
  sticker: {},
  settings: {}
};

global.db = new Low(
  /https?:\/\//.test(opts['db'] || '') 
    ? new cloudDBAdapter(opts['db']) 
    : new JSONFile(`${opts._[0] ? opts._[0] + '_' : ''}database.json`),
  defaultData
);

global.DATABASE = global.db;
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) {
    return new Promise((resolve) => setInterval(async function() {
      if (!global.db.READ) {
        clearInterval(this);
        resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
      }
    }, 1 * 1000));
  }
  if (global.db.data !== null) {
    return;
  }
  global.db.READ = true;
  await global.db.read().catch((error) => {
    });
  global.db.READ = null;
  global.db.data ||= {
    users: {},
    chats: {},
    stats: {},
    msgs: {},
    sticker: {},
    settings: {},
  };
  global.db.chain = chain(global.db.data);
};
loadDatabase();

const defaultChatGPTData = {
  sessions: {},
  users: {}
};

global.chatgpt = new Low(
  new JSONFile(path.join(__dirname, '/db/chatgpt.json')),
  defaultChatGPTData
);
global.loadChatgptDB = async function loadChatgptDB() {
  if (global.chatgpt.READ) {
    return new Promise((resolve) =>
      setInterval(async function() {
        if (!global.chatgpt.READ) {
          clearInterval(this);
          resolve( global.chatgpt.data === null ? global.loadChatgptDB() : global.chatgpt.data );
        }
      }, 1 * 1000));
  }
  if (global.chatgpt.data !== null) {
    return;
  }
  global.chatgpt.READ = true;
  await global.chatgpt.read().catch((error) => {
    });
  global.chatgpt.READ = null;
  global.chatgpt.data = {
    users: {},
    ...(global.chatgpt.data || {}),
  };
  global.chatgpt.chain = lodash.chain(global.chatgpt.data);
};
loadChatgptDB();

global.authFile = `MyninoSession`;
// Don't clean up session files on startup - they contain encryption keys

// Initialize Render session management before creating auth state
await initializeRenderSession();

const {state, saveState, saveCreds} = await useMultiFileAuthState(global.authFile);

const msgRetryCounterMap = (MessageRetryMap) => { };
const {version} = await fetchLatestBaileysVersion();
const connectionOptions = {
  // Removed deprecated printQRInTerminal option
  patchMessageBeforeSending: (message) => {
    const requiresPatch = !!( message.buttonsMessage || message.templateMessage || message.listMessage );
    if (requiresPatch) {
      message = {viewOnceMessage: {message: {messageContextInfo: {deviceListMetadataVersion: 2, deviceListMetadata: {}}, ...message}}};
    }
    return message;
  },
  getMessage: async (key) => {
    if (store) {
      const msg = await store.loadMessage(key.remoteJid, key.id);
      return conn.chats[key.remoteJid] && conn.chats[key.remoteJid].messages[key.id] ? conn.chats[key.remoteJid].messages[key.id].message : undefined;
    }
    return proto.Message.fromObject({});
  },
  msgRetryCounterMap,
  logger: pino({level: 'silent'}),
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, pino({level: 'silent'})),
  },
  // Simplified browser identification
  browser: ['Chrome (Linux)', '', ''],
  version,
  defaultQueryTimeoutMs: 60_000,
  // Session management options
  syncFullHistory: false,
  markOnlineOnConnect: false,
  fireInitQueries: false,
  generateHighQualityLinkPreview: false,
  emitOwnEvents: false,
  // Add connection timeout
  connectTimeoutMs: 30_000,
  // Add retry options
  retryRequestDelayMs: 1000,
  maxRetries: 3,
  // Session management improvements
  shouldIgnoreJid: jid => isJidBroadcast(jid),

  // Add session management
  sessionId: 'ELTA_BOT',
  // Enable proper message handling
  shouldSyncHistoryMessage: () => false,
  // Disable session timeout to preserve encryption keys
  sessionTimeoutMs: 0,
};

global.conn = makeWASocket(connectionOptions);
conn.isInit = false;
conn.well = false;
conn.logger.info(`Loading...\n`);

// Enhanced session management function with proper encryption key handling
const handleSessionCreation = async (jid) => {
  try {
    if (jid.includes('@lid')) {
      return;
    }
    
    // Step 1: Subscribe to presence (establishes basic session)
    await conn.presenceSubscribe(jid).catch(() => {});
    
    // Step 2: Request PreKey bundle to establish encryption
    try {
      await conn.requestPreKeyBundle(jid).catch(() => {});
    } catch (error) {
      // Silently handle PreKey bundle errors
    }
    
    // Step 3: Add to session cache
    global.sessionCache.add(jid);
    
    // Step 4: Force session refresh for problematic users
    setTimeout(async () => {
      try {
        if (!jid.includes('@lid')) {
          await conn.presenceSubscribe(jid).catch(() => {});
        }
      } catch (error) {
        // Silent error handling
      }
    }, 5000);
    
  } catch (error) {
    // Silent error handling for session creation
  }
};

// Session cache to track managed sessions
global.sessionCache = new Set();

// ⚠️ IMPORTANT: All session management functions are SILENT
// They should NEVER send messages to users - only establish encryption sessions
// This prevents unwanted messages and spam

// Global JID normalization utility
global.normalizeJid = (jid) => {
  if (!jid || typeof jid !== 'string') return jid;
  
  // Handle @lid format - these are special identifiers that WhatsApp uses
  // for contacts that don't want to share their phone numbers
  if (jid.includes('@lid')) {
    return jid; // Keep @lid as is - WhatsApp handles these internally
  }
  
  // Handle @c.us format (old format)
  if (jid.includes('@c.us')) {
    return jid.replace('@c.us', '@s.whatsapp.net');
  }
  
  // Handle @s.whatsapp.net format (current standard)
  if (jid.includes('@s.whatsapp.net')) {
    return jid;
  }
  
  // Handle @g.us format (groups)
  if (jid.includes('@g.us')) {
    return jid;
  }
  
  // If no suffix, assume it's a phone number and add @s.whatsapp.net
  if (!jid.includes('@')) {
    return jid + '@s.whatsapp.net';
  }
  
  return jid;
};

// Global function to check if JID is @lid
global.isLidContact = (jid) => {
  return jid && typeof jid === 'string' && jid.includes('@lid');
};

// Global function for immediate session creation with encryption key handling
global.createImmediateSession = async (jid) => {
  try {
    if (jid.includes('@lid')) {
      return;
    }
    
    // Step 1: Subscribe to presence immediately (silent)
    await conn.presenceSubscribe(jid).catch(() => {});
    
    // Step 2: Request PreKey bundle for encryption establishment
    try {
      await conn.requestPreKeyBundle(jid).catch(() => {});
    } catch (error) {
      // Handle PreKey bundle errors silently
    }
    
    // Step 3: Add to session cache
    global.sessionCache.add(jid);
    
    // Step 4: Additional session establishment for reliability
    setTimeout(async () => {
      try {
        if (!jid.includes('@lid')) {
          await conn.presenceSubscribe(jid).catch(() => {});
        }
      } catch (error) {
        // Silent error handling
      }
    }, 3000);
    
  } catch (error) {
    // Silent error handling for session creation
  }
};

// Global function to force session refresh for problematic users with encryption key refresh
global.forceSessionRefresh = async (jid) => {
  try {
    if (jid.includes('@lid')) {
      return;
    }
    
    // Remove from cache to force recreation
    global.sessionCache.delete(jid);
    
    // Recreate session with encryption key refresh
    await global.createImmediateSession(jid);
    
    // Additional encryption key refresh
    setTimeout(async () => {
      try {
        if (!jid.includes('@lid')) {
          await conn.presenceSubscribe(jid).catch(() => {});
          // Request fresh PreKey bundle
          await conn.requestPreKeyBundle(jid).catch(() => {});
        }
      } catch (error) {
        // Silent error handling
      }
    }, 2000);
    
  } catch (error) {
    // Silent error handling
  }
};

// Enhanced proactive session management with encryption key handling
const initializeSessionManagement = async () => {
  try {
    // Get all chats to establish sessions - use the correct method
    const chats = await conn.getChats ? await conn.getChats() : [];
    // If getChats is not available, we'll rely on dynamic session creation
    if (!conn.getChats) {
      // Set up periodic session refresh for existing sessions with encryption key refresh
      setInterval(async () => {
        try {
          for (const jid of global.sessionCache) {
            // Skip @lid contacts in refresh
            if (!jid.includes('@lid')) {
              await conn.presenceSubscribe(jid).catch(() => {});
              // Refresh PreKey bundles periodically
              await conn.requestPreKeyBundle(jid).catch(() => {});
            }
          }
        } catch (error) {
          // Silent error handling
        }
      }, 300000); // Refresh every 5 minutes (less aggressive)
      return;
    }
    
    // Enhanced session creation for all chat participants with encryption key handling
    for (const chat of chats) {
      try {
        if (chat.id.endsWith('@g.us')) {
          // Group chat - get participants
          const participants = await conn.groupMetadata(chat.id).catch(() => null);
          if (participants && participants.participants) {
            for (const participant of participants.participants) {
              // Skip @lid contacts as they don't need traditional session management
              if (!participant.id.includes('@lid')) {
                // Enhanced session creation for group participants with encryption
                await conn.presenceSubscribe(participant.id).catch(() => {});
                
                // Request PreKey bundle for encryption establishment
                try {
                  await conn.requestPreKeyBundle(participant.id).catch(() => {});
                } catch (error) {
                  // Handle PreKey bundle errors silently
                }
                
                global.sessionCache.add(participant.id);
              } else {
                // Handle @lid contacts differently
              }
            }
          }
        } else {
          // Individual chat - skip @lid contacts
          if (!chat.id.includes('@lid')) {
            // Enhanced session creation for individual chats with encryption
            await conn.presenceSubscribe(chat.id).catch(() => {});
            
            // Request PreKey bundle for encryption establishment
            try {
              await conn.requestPreKeyBundle(chat.id).catch(() => {});
            } catch (error) {
              // Handle PreKey bundle errors silently
            }
            
            global.sessionCache.add(chat.id);
          } else {
            // Handle @lid contacts differently
          }
        }
      } catch (error) {
        // Silent error handling
      }
    }
    
    // Set up periodic session refresh with enhanced encryption key management
    setInterval(async () => {
      try {
        for (const jid of global.sessionCache) {
          // Skip @lid contacts in refresh
          if (!jid.includes('@lid')) {
            await conn.presenceSubscribe(jid).catch(() => {});
            
            // Refresh PreKey bundles for encryption key maintenance
            try {
              await conn.requestPreKeyBundle(jid).catch(() => {});
            } catch (error) {
              // Handle PreKey bundle errors silently
            }
          }
        }
      } catch (error) {
        // Silent error handling
      }
    }, 120000); // Refresh every 2 minutes (more aggressive)
    
  } catch (error) {
    // Silent error handling
  }
};

if (!opts['test']) {
  if (global.db) {
    // Store interval references globally
    global.dbInterval = setInterval(async () => {
      if (global.stopped === 'close' || !conn?.user) return;
      if (global.db.data) await global.db.write();
      if (opts['autocleartmp'] && (global.support || {}).find) {
        const tmp = [tmpdir(), 'tmp', 'jadibts'];
        tmp.forEach((filename) => spawn('find', [filename, '-amin', '3', '-type', 'f', '-delete']));
      }
    }, 120 * 1000); // Increased from 60s to 120s to reduce I/O operations
  }
}

if (opts['server']) (await import('./server.js')).default(global.conn, PORT);

function clearTmp() {
  const tmp = [tmpdir(), join(__dirname, './tmp')];
  const filename = [];
  
  tmp.forEach((dirname) => {
    try {
      // Ensure directory exists before trying to read it
      if (!existsSync(dirname)) {
        mkdirSync(dirname, { recursive: true });
        return;
      }
      
      readdirSync(dirname).forEach((file) => filename.push(join(dirname, file)));
    } catch (error) {
      // Silently handle directory errors
      console.log(chalk.yellow(`⚠️ Could not access directory: ${dirname}`));
    }
  });
  
  return filename.map((file) => {
    try {
      const stats = statSync(file);
      if (stats.isFile() && (Date.now() - stats.mtimeMs >= 1000 * 60 * 3)) return unlinkSync(file); // 3 minutes
      return false;
    } catch (error) {
      // Silently handle file errors
      return false;
    }
  });
}

function purgeSession() {
  let prekey = []
  let directorio = readdirSync("./MyninoSession")
  let filesFolderPreKeys = directorio.filter(file => {
    if (file.startsWith('pre-key-')) {
      try {
        const filePath = `./MyninoSession/${file}`;
        const stats = statSync(filePath);
        // Only delete pre-keys older than 24 hours
        return (Date.now() - stats.mtimeMs) > (24 * 60 * 60 * 1000);
      } catch (e) {
        return false;
      }
    }
    return false;
  })
  
  filesFolderPreKeys.forEach(files => {
    unlinkSync(`./MyninoSession/${files}`)
    console.log(`Deleted old pre-key: ${files}`)
  })
}

function purgeSessionSB() {
try {
let listaDirectorios = readdirSync('./jadibts/');
let SBprekey = []
listaDirectorios.forEach(directorio => {
if (statSync(`./jadibts/${directorio}`).isDirectory()) {
let DSBPreKeys = readdirSync(`./jadibts/${directorio}`).filter(fileInDir => {
return fileInDir.startsWith('pre-key-') /*|| fileInDir.startsWith('app-') || fileInDir.startsWith('session-')*/
})
SBprekey = [...SBprekey, ...DSBPreKeys]
DSBPreKeys.forEach(fileInDir => {
unlinkSync(`./jadibts/${directorio}/${fileInDir}`)
})
}
})
if (SBprekey.length === 0) return;
} catch (err) {
if (!process.env.ELTA_CHILD_PROCESS) {
console.log(chalk.bold.red(`=> Something went wrong during deletion, files not deleted`))
}
}}

function purgeOldFiles() {
  const directories = ['./MyninoSession/', './jadibts/'];
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000); // Changed from 1 hour to 24 hours
  directories.forEach(dir => {
    try {
      if (!existsSync(dir)) return;
      const files = readdirSync(dir);
      files.forEach(file => {
        // NEVER delete encryption keys
        if (file.startsWith('pre-key-') || file.startsWith('session-') || 
            file.startsWith('sender-key-') || file === 'creds.json') {
          return; // Skip encryption keys
        }
        
        const filePath = path.join(dir, file);
        try {
          const stats = statSync(filePath);
          if (stats.isFile() && stats.mtimeMs < oneDayAgo) {
            unlinkSync(filePath);
            if (!process.env.ELTA_CHILD_PROCESS) {
              console.log(chalk.bold.green(`File ${file} successfully deleted`));
            }
          }
        } catch (err) {
          if (!process.env.ELTA_CHILD_PROCESS) {
            console.log(chalk.bold.red(`File ${file} not deleted: ${err.message}`));
          }
        }
      });
    } catch (err) {
      if (!process.env.ELTA_CHILD_PROCESS) {
        console.log(chalk.bold.red(`Error accessing directory ${dir}: ${err.message}`));
      }
    }
  });
}

// Improved session cleanup function
function cleanupSession() {
  try {
    const sessionDir = './MyninoSession';
    if (existsSync(sessionDir)) {
      const files = readdirSync(sessionDir);
      files.forEach(file => {
        // Only delete temporary/cache files, keep ALL encryption keys
        if (file.startsWith('app-state-') || file.startsWith('baileys_store_')) {
          const filePath = `${sessionDir}/${file}`;
          if (existsSync(filePath)) {
            unlinkSync(filePath);
            if (!process.env.ELTA_CHILD_PROCESS) {
              console.log(chalk.yellow(`🗑️ Cleaned up temp file: ${file}`));
            }
          }
        }
        // KEEP: creds.json, pre-key-*.json, session-*.json, sender-key-*.json
      });
      } else {
      }
  } catch (error) {
    if (!process.env.ELTA_CHILD_PROCESS) {
      console.log(chalk.yellow('⚠️ Session cleanup error:', error.message));
    }
  }
}

async function connectionUpdate(update) {
  const { connection, lastDisconnect, isNewLogin, qr } = update;
  global.stopped = connection;
  
  if (isNewLogin) {
    conn.isInit = true;
  }

  const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;
  // QR Code handling with debug
  if (qr) {
    if (!process.env.ELTA_CHILD_PROCESS) {
      console.log(chalk.yellow('📱 Scan this QR code with your WhatsApp app:'));
      try {
        qrcode.generate(qr, { small: true });
        } catch (error) {
        }
    }
    return;
  }

  // Connection state debugging
  if (connection === 'connecting') {
    }
  
  if (connection === 'open') {
    global.reconnectAttempts = 0;
    global.startTime = Date.now();
    
    if (!process.env.ELTA_CHILD_PROCESS) {
      console.log(chalk.green('✅ Successfully connected to WhatsApp'));
      console.log(chalk.cyan(`👤 Connected as: ${conn.user?.name || 'Unknown'}`));
      console.log(chalk.cyan(`📱 Phone: ${conn.user?.id || 'Unknown'}`));
    }

    // Check for restart flag file
    if (existsSync('./restart.json')) {
      try {
        const restartInfo = JSON.parse(readFileSync('./restart.json'));
        const { chatId, timestamp } = restartInfo;
        const timeSinceRestart = Date.now() - timestamp;

        // Only send message if restart was recent (e.g., within 2 minutes)
        if (timeSinceRestart < 120000) {
          await conn.sendMessage(chatId, { text: 'Enhanced Yuki initialized successfully! 🚀' });
        }
        
        // Clean up the flag file
        unlinkSync('./restart.json');
      } catch (e) {
        console.error('Error handling restart notification:', e);
        // Still try to delete the file to prevent issues
        if (existsSync('./restart.json')) {
          unlinkSync('./restart.json');
        }
      }
    }
    
    // Initialize encryption key manager
    encryptionManager.initialize().then(() => {
      encryptionManager.logKeyStats();
    }).catch(error => {
      console.error(chalk.red('❌ Failed to initialize encryption manager:', error.message));
    });
    
    // Initialize proactive session management after connection
    setTimeout(() => {
      initializeSessionManagement();
    }, 5000); // Wait 5 seconds after connection to ensure everything is ready
    
    // Log @lid detection info
    // Test @lid functionality
    const testJids = [
      '1234567890@s.whatsapp.net',
      '1234567890@lid',
      '1234567890@c.us',
      '1234567890'
    ];
    
    testJids.forEach(jid => {
      const normalized = global.normalizeJid(jid);
      const isLid = global.isLidContact(jid);
      });
    
    // Set status after successful connection (with timeout protection)
    setTimeout(async () => {
      try {
        // Add timeout to prevent hanging
        const statusPromise = conn.updateProfileStatus('Hey there! I am using WhatsApp.');
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Status update timeout')), 10000)
        );
        
        await Promise.race([statusPromise, timeoutPromise]);
        
        if (!process.env.ELTA_CHILD_PROCESS) {
          console.log(chalk.green('✅ Status updated successfully'));
        }
      } catch (error) {
        if (!process.env.ELTA_CHILD_PROCESS) {
          console.log(chalk.yellow('⚠️ Could not update profile status:', error.message));
        }
      }
    }, 5000);
  }

  if (connection === 'close') {
    let reconnectAttempts = global.reconnectAttempts || 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    
    if (code && code !== DisconnectReason.loggedOut && conn?.ws.socket == null) {
      reconnectAttempts++;
      global.reconnectAttempts = reconnectAttempts;
      
      if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
        if (!process.env.ELTA_CHILD_PROCESS) {
          console.log(chalk.red(`Connection error: ${code}. Attempting to reconnect (${reconnectAttempts})...`));
        }
        setTimeout(async () => {
          try {
            await global.reloadHandler(true);
            global.timestamp.connect = new Date();
          } catch (error) {
            // Handle error silently
          }
        }, Math.min(30000, 2000 * reconnectAttempts));
      } else {
        if (!process.env.ELTA_CHILD_PROCESS) {
          console.log(chalk.red('Max reconnect attempts reached. Resetting session...'));
        }
        cleanupSession();
        process.send('reset');
      }
      return;
    }
    
    if (code === DisconnectReason.loggedOut) {
      cleanupSession();
    }
    
    setTimeout(() => {
      process.send('reset');
    }, 3000);
  }
}

// Cleanup function for graceful shutdown (called by process manager)
let isShuttingDown = false;

function cleanup() {
  if (global.conn) {
    global.conn.ws.close();
  }
  // Clear all intervals
  clearInterval(global.dbInterval);
  clearInterval(global.cleanupInterval);
  clearInterval(global.purgeInterval);
  clearInterval(global.purgeSBInterval);
  clearInterval(global.purgeOldFilesInterval);
  clearInterval(global.statusInterval);
  }

// Simple signal handlers for cleanup only (process manager handles exit)
process.on('SIGTERM', () => {
  if (!isShuttingDown) {
    isShuttingDown = true;
    cleanup();
  }
});

process.on('SIGINT', () => {
  if (!isShuttingDown) {
    isShuttingDown = true;
    cleanup();
  }
});

process.on('uncaughtException', (err) => {
  if (!process.env.ELTA_CHILD_PROCESS) {
    console.error(chalk.red('❌ Uncaught Exception:'), err);
  }
  // Don't exit immediately, let the connection handler deal with it
});

process.on('unhandledRejection', (reason, promise) => {
  if (!process.env.ELTA_CHILD_PROCESS) {
    console.error(chalk.red('❌ Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  }
  // Don't exit immediately, let the connection handler deal with it
});

let isInit = true;
let handler = await import('./handler.js');
global.reloadHandler = async function(restatConn) {
  try {
    const Handler = await import(`./handler.js?update=${Date.now()}`).catch((error) => {
      return null;
    });
    if (Object.keys(Handler || {}).length) {
      handler = Handler;
      }
  } catch (e) {
    }
  
  if (restatConn) {
    const oldChats = global.conn.chats;
    console.log(`Reconnecting with ${Object.keys(oldChats).length} chats`);
    
    try {
      global.conn.ws.close();
      } catch (error) {
      }
    
    conn.ev.removeAllListeners();
    global.conn = makeWASocket(connectionOptions, {chats: oldChats});
    isInit = true;
  }
  
  if (!isInit) {
    conn.ev.off('messages.upsert', conn.handler);
    conn.ev.off('group-participants.update', conn.participantsUpdate);
    conn.ev.off('groups.update', conn.groupsUpdate);
    conn.ev.off('message.delete', conn.onDelete);
    conn.ev.off('call', conn.onCall);
    conn.ev.off('connection.update', conn.connectionUpdate);
    conn.ev.off('creds.update', conn.credsUpdate);
  }

  // Enhanced event handlers with comprehensive encryption error handling
  conn.handler = async (chatUpdate) => {
    try {
      await handler.handler.call(global.conn, chatUpdate);
    } catch (error) {
      // Enhanced encryption error handling
      const errorMessage = error.message || error.toString();
      
      if (errorMessage.includes('No SenderKeyRecord found for decryption') ||
          errorMessage.includes('Invalid PreKey ID') ||
          errorMessage.includes('Bad MAC') ||
          errorMessage.includes('No matching sessions found') ||
          errorMessage.includes('Failed to decrypt message') ||
          errorMessage.includes('Session error')) {
        
        console.log(chalk.yellow('🔐 Encryption error detected in message handler'));
        console.log(chalk.yellow(`🔍 Error details: ${errorMessage}`));
        
        // Extract JID from multiple possible sources
        let jid = null;
        let messageInfo = '';
        
        if (chatUpdate.messages && chatUpdate.messages.length > 0) {
          const message = chatUpdate.messages[0];
          if (message.key) {
            jid = message.key.remoteJid || message.key.participant;
            messageInfo = `Message ID: ${message.key.id}`;
          }
        }
        
        // Try to extract JID from error message if not found
        if (!jid && errorMessage.includes('@')) {
          const jidMatch = errorMessage.match(/([0-9]+@[a-z.]+)/);
          if (jidMatch) {
            jid = jidMatch[1];
          }
        }
        
        if (jid) {
          console.log(chalk.yellow(`🔧 Attempting recovery for JID: ${jid} ${messageInfo}`));
          const recovered = await handleEncryptionError(error, jid);
          
          if (recovered) {
            console.log(chalk.green(`✅ Successfully recovered session for ${jid}`));
          } else {
            console.log(chalk.red(`❌ Failed to recover session for ${jid}`));
          }
        } else {
          console.log(chalk.red('❌ Could not extract JID from error context'));
        }
        
        return; // Don't process this message further
      }
      
      // Log other errors with more context
      console.error(chalk.red('❌ Error in message handler:'));
      console.error(chalk.red(`   Error: ${errorMessage}`));
      if (chatUpdate.messages && chatUpdate.messages.length > 0) {
        const message = chatUpdate.messages[0];
        console.error(chalk.red(`   Message from: ${message.key?.remoteJid || 'unknown'}`));
        console.error(chalk.red(`   Message ID: ${message.key?.id || 'unknown'}`));
      }
    }
  };
  
  conn.participantsUpdate = handler.participantsUpdate.bind(global.conn);
  conn.groupsUpdate = handler.groupsUpdate.bind(global.conn);
  conn.onDelete = handler.deleteUpdate.bind(global.conn);
  conn.onCall = handler.callUpdate.bind(global.conn);
  conn.connectionUpdate = connectionUpdate.bind(global.conn);
  conn.credsUpdate = saveCreds.bind(global.conn, true);

  const currentDateTime = new Date();
  const messageDateTime = new Date(conn.ev);
  if (currentDateTime >= messageDateTime) {
    const chats = Object.entries(conn.chats).filter(([jid, chat]) => !jid.endsWith('@g.us') && chat.isChats).map((v) => v[0]);
  } else {
    const chats = Object.entries(conn.chats).filter(([jid, chat]) => !jid.endsWith('@g.us') && chat.isChats).map((v) => v[0]);
  }

  conn.ev.on('messages.upsert', conn.handler);
  conn.ev.on('group-participants.update', conn.participantsUpdate);
  conn.ev.on('groups.update', conn.groupsUpdate);
  conn.ev.on('message.delete', conn.onDelete);
  conn.ev.on('call', conn.onCall);
  conn.ev.on('connection.update', conn.connectionUpdate);
  conn.ev.on('creds.update', conn.credsUpdate);
  
  isInit = false;
  return true;
};

async function handleGroupParticipantUpdate(sock, update) {
    if (!process.env.ELTA_CHILD_PROCESS) {
        console.log('Group participant update:', JSON.stringify(update, null, 2));
    }
    try {
        const { id, participants, action, author } = update;
        // Check if it's a group
        if (!id.endsWith('@g.us')) return;
        // Handle promotion events
        if (action === 'promote') {
            await handlePromotionEvent(sock, id, participants, author);
            return;
        }
        // Handle demotion events
        if (action === 'demote') {
            await handleDemotionEvent(sock, id, participants, author);
            return;
        }
        // ... you can add more group participant event handling here if needed ...
    } catch (err) {
        console.error('Error in handleGroupParticipantUpdate:', err);
    }
}

const pluginFolder = join(__dirname, './plugins');
// Only load .js files from the plugins folder (exclude .cjs files as they're handled separately)
const pluginFilter = (filename) => /\.js$/.test(filename) && !filename.endsWith('.cjs');
global.plugins = {};
async function filesInit() {
  // Check if directory exists
  if (!existsSync(pluginFolder)) {
    return;
  }
  
  const allFiles = readdirSync(pluginFolder);
  const pluginFiles = allFiles.filter(pluginFilter);
  for (const filename of pluginFiles) {
    try {
      const file = global.__filename(join(pluginFolder, filename));
      const module = await import(file);
      global.plugins[filename] = module.default || module;
      } catch (e) {
      delete global.plugins[filename];
    }
  }
  console.log(`Loaded ${pluginFiles.length} plugins`);
}
filesInit().then(() => {
  console.log('Plugins initialized successfully');
}).catch((error) => {
  console.error('Error initializing plugins:', error);
});

global.reload = async (_ev, filename) => {
  if (pluginFilter(filename)) {
    const dir = global.__filename(join(pluginFolder, filename), true);
    if (filename in global.plugins) {
      if (existsSync(dir)) conn.logger.info(` updated plugin - '${filename}'`);
      else {
        conn.logger.warn(`deleted plugin - '${filename}'`);
        return delete global.plugins[filename];
      }
    } else conn.logger.info(`new plugin - '${filename}'`);
    const err = syntaxerror(readFileSync(dir), filename, {
      sourceType: 'module',
      allowAwaitOutsideFunction: true,
    });
    if (err) conn.logger.error(`syntax error while loading '${filename}'\n${format(err)}`);
    else {
      try {
        const module = (await import(`${global.__filename(dir)}?update=${Date.now()}`));
        global.plugins[filename] = module.default || module;
      } catch (e) {
        conn.logger.error(`error require plugin '${filename}\n${format(e)}'`);
      } finally {
        global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));
      }
    }
  }
};
Object.freeze(global.reload);
watch(pluginFolder, global.reload);
await global.reloadHandler();
async function _quickTest() {
  const test = await Promise.all([
    spawn('ffmpeg'),
    spawn('ffprobe'),
    spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
    spawn('convert'),
    spawn('magick'),
    spawn('gm'),
    spawn('find', ['--version']),
  ].map((p) => {
    return Promise.race([
      new Promise((resolve) => {
        p.on('close', (code) => {
          resolve(code !== 127);
        });
      }),
      new Promise((resolve) => {
        p.on('error', (_) => resolve(false));
      })]);
  }));
  const [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find] = test;
  const s = global.support = {ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find};
  Object.freeze(global.support);
  }

global.cleanupInterval = setInterval(async () => {
  if (global.stopped === 'close' || !conn?.user) return;
  const a = await clearTmp();
  if (!process.env.ELTA_CHILD_PROCESS) {
    console.log(chalk.cyanBright(`\nAUTOCLEARTMP\n\nFILES DELETED ✅\n\n`));
  }
}, 180000);

global.purgeInterval = setInterval(async () => {
  if (global.stopped === 'close' || !conn?.user) return;
  await purgeSession();
  if (!process.env.ELTA_CHILD_PROCESS) {
    console.log(chalk.cyanBright(`\nAUTOPURGESESSIONS\n\nOLD FILES DELETED ✅\n\n`));
  }
}, 1000 * 60 * 60 * 6); // Changed from 1 hour to 6 hours

global.purgeSBInterval = setInterval(async () => {
  if (global.stopped === 'close' || !conn?.user) return;
  await purgeSessionSB();
  if (!process.env.ELTA_CHILD_PROCESS) {
    console.log(chalk.cyanBright(`\nAUTO_PURGE_SESSIONS_SUB-BOTS\n\nFILES DELETED ✅\n\n`));
  }
}, 1000 * 60 * 60);

global.purgeOldFilesInterval = setInterval(async () => {
  if (global.stopped === 'close' || !conn?.user) return;
  await purgeOldFiles();
  if (!process.env.ELTA_CHILD_PROCESS) {
    console.log(chalk.cyanBright(`\nAUTO_PURGE_OLDFILES\n\nFILES DELETED ✅\n\n`));
  }
}, 1000 * 60 * 60);

global.statusInterval = setInterval(async () => {
  if (global.stopped === 'close' || !conn?.user) return;
  // Update status less frequently to improve performance
  const bio = `Hey there! I am using WhatsApp.`;
  try {
    // Add timeout to prevent hanging
    const statusPromise = conn.updateProfileStatus(bio);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Status update timeout')), 10000)
    );
    
    await Promise.race([statusPromise, timeoutPromise]);
  } catch (error) {
    // Silently handle errors to avoid spam
    if (!process.env.ELTA_CHILD_PROCESS) {
      console.log(chalk.yellow('⚠️ Status update failed:', error.message));
    }
  }
}, 7200000); // Update every 2 hours instead of every hour

function clockString(ms) {
  const d = isNaN(ms) ? '--' : Math.floor(ms / 86400000);
  const h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
  const m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
  const s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
  return [d, ' day(s) ', h, ' hour(s) ', m, ' minute(s) ', s, ' second(s) '].map((v) => v.toString().padStart(2, '0')).join('');
}

_quickTest().catch(console.error);
