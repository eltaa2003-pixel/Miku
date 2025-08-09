import path from 'path'
import { toAudio } from './converter.js'
import chalk from 'chalk'
import fetch from 'node-fetch'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const PhoneNumber = require('awesome-phonenumber')
import fs from 'fs'
import util from 'util'
import { fileTypeFromBuffer } from 'file-type'
import { format } from 'util'
import { fileURLToPath } from 'url'
import store from './store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Normalize JID to handle both @c.us and @lid formats
 * @param {String} jid 
 * @returns {String}
 */
function normalizeJid(jid) {
  if (!jid || typeof jid !== 'string') return jid;
  
  // Handle @lid identifiers
  if (jid.includes('@lid')) {
    // Keep @lid as is - WhatsApp should handle internally
    return jid;
  }
  
  // Handle standard formats
  if (jid.includes('@s.whatsapp.net')) return jid;
  if (jid.includes('@g.us')) return jid;
  if (jid.includes('@c.us')) return jid.replace('@c.us', '@s.whatsapp.net');
  
  // Add default domain for phone numbers
  if (/^\d+$/.test(jid)) return jid + '@s.whatsapp.net';
  
  return jid;
}

/**
 * Enhanced decodeJid function with @lid support
 * @param {String} jid 
 * @returns {String}
 */
function enhancedDecodeJid(jid) {
  if (!jid || typeof jid !== 'string') return (!nullish(jid) && jid) || null;
  
  // Handle @lid identifiers - don't decode, keep as is
  if (jid.includes('@lid')) {
    return jid.trim();
  }
  
  // Use original decodeJid logic for other formats
  return jid.decodeJid();
}

/**
 * Safe group participant operations with @lid handling
 * @param {Object} conn - WhatsApp connection
 * @param {String} groupJid - Group JID
 * @param {Array} participants - Array of participant JIDs
 * @param {String} action - 'add', 'remove', 'promote', 'demote'
 * @returns {Promise}
 */
async function safeGroupOperation(conn, groupJid, participants, action) {
  const normalizedParticipants = participants.map(p => normalizeJid(p));
  
  try {
    // First attempt with normalized JIDs
    const result = await conn.groupParticipantsUpdate(groupJid, normalizedParticipants, action);
    return result;
  } catch (error) {
    // If it fails, try with original JIDs (might be @lid that needs special handling)
    console.warn(`Group operation ${action} failed with normalized JIDs, trying original:`, error.message);
    
    try {
      return await conn.groupParticipantsUpdate(groupJid, participants, action);
    } catch (secondError) {
      console.error(`Group operation ${action} failed completely:`, secondError);
      throw secondError;
    }
  }
}

// Helper function to safely extract user from @lid or regular JID
function extractUserFromJid(jid) {
  if (!jid || typeof jid !== 'string') return null;
  
  if (jid.includes('@lid')) {
    // For @lid, try to extract the user part before @lid
    const lidMatch = jid.match(/^(.+)@lid$/);
    return lidMatch ? lidMatch[1] : jid;
  }
  
  // For regular JIDs, extract user part
  const parts = jid.split('@');
  return parts[0];
}

/**
 * Check if a user is an owner using the same logic as handler.js
 * @param {String} userJid - The user's JID to check
 * @param {Object} conn - WhatsApp connection object
 * @returns {Boolean}
 */
function isOwner(userJid, conn) {
  if (!userJid || !conn) return false;
  
  // Use the same logic as handler.js
  const ownerJids = [conn.decodeJid(conn.user.id), ...global.owner.map(([number]) => number)].map((v) => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
  
  return ownerJids.includes(userJid);
}

/**
 * Check if a user is the bot itself
 * @param {String} userJid - The user's JID to check
 * @param {Object} conn - WhatsApp connection object
 * @returns {Boolean}
 */
function isBot(userJid, conn) {
  if (!userJid || !conn) return false;
  
  const botJid = conn.decodeJid(conn.user.id);
  return userJid === botJid;
}

// Export the functions for use in plugins
export { normalizeJid, enhancedDecodeJid, safeGroupOperation, extractUserFromJid, isOwner, isBot };

/**
 * @type {import('baileys-pro')}
 */
const {
  default: _makeWaSocket,
  makeWALegacySocket,
  proto,
  downloadContentFromMessage,
  jidDecode,
  areJidsSameUser,
  generateForwardMessageContent,
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  WAMessageStubType,
  extractMessageContent,
  getDevice,
  WA_DEFAULT_EPHEMERAL
} = (await import('baileys-pro')).default

export function makeWASocket(connectionOptions, options = {}) {
  /**
   * @type {import('baileys-pro').WASocket | import('baileys-pro').WALegacySocket}
   */
  let conn = (global.opts['legacy'] ? makeWALegacySocket : _makeWaSocket)(connectionOptions)

  // Store original sendMessage method
  const originalSendMessage = conn.sendMessage.bind(conn)
  
  // Override sendMessage to add logging
  conn.sendMessage = async function(jid, message, options = {}) {
    try {
      const result = await originalSendMessage(jid, message, options)
      
      // Log outgoing message
      if (result && result.key) {
        try {
          // Import print function dynamically to avoid circular imports
          const printModule = await import('./print.js')
          const print = printModule.default
          
          // Create a mock message object for logging
          const mockMessage = {
            key: result.key,
            message: result.message || message,
            messageTimestamp: Math.floor(Date.now() / 1000),
            fromMe: true,
            sender: conn.user?.jid || '',
            chat: jid,
            text: message.conversation || message.text || message.caption || '',
            mtype: Object.keys(message)[0] || 'text',
            msg: message[Object.keys(message)[0]] || message,
            isCommand: false,
            exp: 0,
            mentionedJid: options.mentions || []
          }
          
          // Call print function to log the outgoing message
          await print(mockMessage, conn)
        } catch (logError) {
          // Silent error handling for logging
        }
      }
      
      return result
    } catch (error) {
      throw error
    }
  }

  let sock = Object.defineProperties(conn, {
    chats: {
      value: { ...(options.chats || {}) },
      writable: true,
    },
    decodeJid: {
      value(jid) {
        return enhancedDecodeJid(jid);
      },
    },
    normalizeJid: {
      value(jid) {
        return normalizeJid(jid);
      },
    },
    safeGroupOperation: {
      /**
       * Safe group participant operations with @lid handling
       * @param {String} groupJid - Group JID
       * @param {Array} participants - Array of participant JIDs
       * @param {String} action - 'add', 'remove', 'promote', 'demote'
       * @returns {Promise}
       */
      async value(groupJid, participants, action) {
        return await safeGroupOperation(conn, groupJid, participants, action);
      },
    },
    extractUserFromJid: {
      /**
       * Helper function to safely extract user from @lid or regular JID
       * @param {String} jid
       * @returns {String|null}
       */
      value(jid) {
        return extractUserFromJid(jid);
      },
    },
    logger: {
      get() {
        return {
          info(...args) {
            console.log(
              chalk.bold.bgRgb(51, 204, 51)('INFO '),
              `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
              chalk.cyan(format(...args))
            )
          },
          error(...args) {
            console.log(
              chalk.bold.bgRgb(247, 38, 33)('ERROR '),
              `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
              chalk.rgb(255, 38, 0)(format(...args))
            )
          },
          warn(...args) {
            console.log(
              chalk.bold.bgRgb(255, 153, 0)('WARNING '),
              `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
              chalk.redBright(format(...args))
            )
          },
          trace(...args) {
            console.log(
              chalk.grey('TRACE '),
              `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
              chalk.white(format(...args))
            )
          },

        }
      },
      enumerable: true,
    },
    getFile: {
      /**
       * getBuffer hehe
       * @param {fs.PathLike} PATH
       * @param {Boolean} saveToFile
       */
      async value(PATH, saveToFile = false) {
        let res, filename
        const data = Buffer.isBuffer(PATH)
          ? PATH
          : PATH instanceof ArrayBuffer
            ? PATH.toBuffer()
            : /^data:.*?\/.*?;base64,/i.test(PATH)
              ? Buffer.from(PATH.split`,`[1], 'base64')
              : /^https?:\/\//.test(PATH)
                ? await (res = await fetch(PATH)).buffer()
                : fs.existsSync(PATH)
                  ? ((filename = PATH), fs.readFileSync(PATH))
                  : typeof PATH === 'string'
                    ? PATH
                    : Buffer.alloc(0)
        if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer')
        const type = (await fileTypeFromBuffer(data)) || {
          mime: 'application/octet-stream',
          ext: '.bin',
        }
        if (data && saveToFile && !filename)
          (filename = path.join(__dirname, '../tmp/' + new Date() * 1 + '.' + type.ext)),
            await fs.promises.writeFile(filename, data)
        return {
          res,
          filename,
          ...type,
          data,
          deleteFile() {
            return filename && fs.promises.unlink(filename)
          },
        }
      },
      enumerable: true,
    },
    waitEvent: {
      /**
       * waitEvent
       * @param {String} eventName
       * @param {Boolean} is
       * @param {Number} maxTries
       */
      value(eventName, is = () => true, maxTries = 25) {
        //Idk why this exist?
        return new Promise((resolve, reject) => {
          let tries = 0
          let on = (...args) => {
            if (++tries > maxTries) reject('Max tries reached')
            else if (is()) {
              conn.ev.off(eventName, on)
              resolve(...args)
            }
          }
          conn.ev.on(eventName, on)
        })
      },
    },
    sendFile: {
      /**
       * Send Media/File with Automatic Type Specifier
       * @param {String} jid
       * @param {String|Buffer} path
       * @param {String} filename
       * @param {String} caption
       * @param {import('baileys-pro').proto.WebMessageInfo} quoted
       * @param {Boolean} ptt
       * @param {Object} options
       */
      async value(jid, path, filename = '', caption = '', quoted, ptt = false, options = {}) {
        let type = await conn.getFile(path, true)
        let { res, data: file, filename: pathFile } = type
        if ((res && res.status !== 200) || file.length <= 65536) {
          try {
            throw { json: JSON.parse(file.toString()) }
          } catch (e) {
            if (e.json) throw e.json
          }
        }
        const fileSize = fs.statSync(pathFile).size / 1024 / 1024
        if (fileSize >= 1800) throw new Error(' ✳️  El tamaño del archivo es demasiado grande\n\n')
        let opt = {}
        if (quoted) opt.quoted = quoted
        if (!type) options.asDocument = true
        let mtype = '',
          mimetype = options.mimetype || type.mime,
          convert
        if (/webp/.test(type.mime) || (/image/.test(type.mime) && options.asSticker))
          mtype = 'sticker'
        else if (/image/.test(type.mime) || (/webp/.test(type.mime) && options.asImage))
          mtype = 'image'
        else if (/video/.test(type.mime)) mtype = 'video'
        else if (/audio/.test(type.mime))
          (convert = await toAudio(file, type.ext)),
            (file = convert.data),
            (pathFile = convert.filename),
            (mtype = 'audio'),
            (mimetype = options.mimetype || 'audio/ogg; codecs=opus')
        else mtype = 'document'
        if (options.asDocument) mtype = 'document'

        delete options.asSticker
        delete options.asLocation
        delete options.asVideo
        delete options.asDocument
        delete options.asImage

        let message = {
          ...options,
          caption,
          ptt,
          mimetype,
          fileName: filename || pathFile.split('/').pop(),
        }
        
        // Use proper message structure for baileys-pro
        if (mtype === 'image') {
          message.imageMessage = { url: pathFile }
        } else if (mtype === 'video') {
          message.videoMessage = { url: pathFile }
        } else if (mtype === 'audio') {
          message.audioMessage = { url: pathFile }
        } else if (mtype === 'sticker') {
          message.stickerMessage = { url: pathFile }
        } else {
          message.documentMessage = { url: pathFile }
        }
        /**
         * @type {import('baileys-pro').proto.WebMessageInfo}
         */
        let m
        try {
          m = await conn.sendMessage(jid, message, { ...opt, ...options })
        } catch (e) {
          console.error(e)
          m = null
        } finally {
          if (!m)
            m = await conn.sendMessage(jid, { ...message, [mtype]: file }, { ...opt, ...options })
          file = null // releasing the memory
          return m
        }
      },
      enumerable: true,
    },
    sendContact: {
      /**
       * Send Contact with @lid support
       * @param {String} jid
       * @param {String[][]|String[]} data
       * @param {import('baileys-pro').proto.WebMessageInfo} quoted
       * @param {Object} options
       */
      async value(jid, data, quoted, options) {
        if (!Array.isArray(data[0]) && typeof data[0] === 'string') data = [data]
        let contacts = []
        
        for (let [number, name] of data) {
          // Clean number but preserve @lid if present
          if (!number.includes('@lid')) {
            number = number.replace(/[^0-9]/g, '')
          }
          
          let njid = number.includes('@') ? normalizeJid(number) : number + '@s.whatsapp.net'
          
          try {
            let biz = (await conn.getBusinessProfile(njid).catch(_ => null)) || {}
            let vcard = `
BEGIN:VCARD
VERSION:3.0
N:;${name.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')};;;;
FN:${name.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')}
TEL;type=CELL;type=VOICE;waid=${number.replace('@s.whatsapp.net', '').replace('@lid', '')}:${number.includes('@lid') ? number : PhoneNumber('+' + number).getNumber('international')}${
              biz.description
                ? `
X-WA-BIZ-NAME:${(conn.chats[njid]?.vname || conn.getName(njid) || name).replace(/\\/g, '\\\\').replace(/\n/g, '\\n')}
X-WA-BIZ-DESCRIPTION:${biz.description.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')}
`.trim()
                : ''
            }
END:VCARD
`.trim()
            contacts.push({ vcard, displayName: name })
          } catch (error) {
            console.warn('Error creating contact for:', njid, error.message);
            // Create basic vcard without phone validation for @lid
            let vcard = `
BEGIN:VCARD
VERSION:3.0
N:;${name.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')};;;;
FN:${name.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')}
END:VCARD
`.trim()
            contacts.push({ vcard, displayName: name })
          }
        }
        
        return await conn.sendMessage(
          jid,
          {
            ...options,
            contacts: {
              ...options,
              displayName:
                (contacts.length >= 2 ? `${contacts.length} kontak` : contacts[0].displayName) ||
                null,
              contacts,
            },
          },
          { quoted, ...options }
        )
      },
      enumerable: true,
    },
    reply: {
      /**
       * Reply to a message
       * @param {String} jid
       * @param {String|Buffer} text
       * @param {import('baileys-pro').proto.WebMessageInfo} quoted
       * @param {Object} options
       */
      async value(jid, text = '', quoted, options) {
        const result = Buffer.isBuffer(text)
          ? await conn.sendFile(jid, text, 'file', '', quoted, false, options)
          : await conn.sendMessage(jid, { text: text }, { quoted, ...options })
        
        // Note: Logging is already handled by the overridden sendMessage method
        return result
      },
    },
    sendButton:  {
      async value(jid, text = '', footer = '', buffer, buttons, copy, urls, quoted, options) {
          let img, video
          if (buffer) {
            if (/^https?:\/\//i.test(buffer)) {
                try {
                    const response = await fetch(buffer)
                    const contentType = response.headers.get('content-type')
                    if (/^image\//i.test(contentType)) {
                        img = await prepareWAMessageMedia({ image: { url: buffer } }, { upload: conn.waUploadToServer })
                    } else if (/^video\//i.test(contentType)) {
                        video = await prepareWAMessageMedia({ video: { url: buffer } }, { upload: conn.waUploadToServer })
                    } else {
                        console.error("Filetype not supported", contentType)
                    }
                } catch (error) {
                    console.error("Failed to detect File type", error)
                }
            } else {
                try {
                    const type = await conn.getFile(buffer)
                   if (/^image\//i.test(type.mime)) {
                        img = await prepareWAMessageMedia({ image: { url: buffer } }, { upload: conn.waUploadToServer })
                    } else if (/^video\//i.test(type.mime)) {
                        video = await prepareWAMessageMedia({ video: { url: buffer } }, { upload: conn.waUploadToServer })
                    }
                } catch (error) {
                    console.error("Error getting file type", error);
                }
            }
        }
  
          const newbtns = buttons.map(btn => ({
              name: 'quick_reply',
              buttonParamsJson: JSON.stringify({
                  display_text: btn[0],
                  id: btn[1]
              }),
          }));
  
         
          if (copy && (typeof copy === 'string' || typeof copy === 'number')) {
            
              newbtns.push({
                  name: 'cta_copy',
                  buttonParamsJson: JSON.stringify({
                      display_text: 'Copy',
                      copy_code: copy
                  })
              });
          }
  
          
          if (urls && Array.isArray(urls)) {
              urls.forEach(url => {
                  newbtns.push({
                      name: 'cta_url',
                      buttonParamsJson: JSON.stringify({
                          display_text: url[0],
                          url: url[1],
                          merchant_url: url[1]
                      })
                  })
              })
          }
  
  
          const interactiveMessage = {
              body: { text: text },
              footer: { text: footer },
              header: {
                  hasMediaAttachment: false,
                  imageMessage: img ? img.imageMessage : null,
                  videoMessage: video ? video.videoMessage : null
              },
              nativeFlowMessage: {
                  buttons: newbtns,
                  messageParamsJson: ''
              }
          }
  
                
          let msgL = generateWAMessageFromContent(jid, {
              viewOnceMessage: {
                  message: {
                      interactiveMessage } } }, { userJid: conn.user.jid, quoted })
          
         conn.relayMessage(jid, msgL.message, { messageId: msgL.key.id, ...options })
              
      }
  }, 
    //---
    sendList: {
      async value(jid, title, text, buttonText, buffer, listSections, quoted, options = {}) {
        let img, video
          if (/^https?:\/\//i.test(buffer)) {
              try {
                  
                  const response = await fetch(buffer)
                  const contentType = response.headers.get('content-type')
                  if (/^image\//i.test(contentType)) {
                      img = await prepareWAMessageMedia({ image: { url: buffer } }, { upload: conn.waUploadToServer })
                  } else if (/^video\//i.test(contentType)) {
                      video = await prepareWAMessageMedia({ video: { url: buffer } }, { upload: conn.waUploadToServer })
                  } else {
                      console.error("File Type Not Supported", contentType)
                  }
              } catch (error) {
                  console.error("Error getting File type", error)
              }
          } else {
              
              try {
                  const type = await conn.getFile(buffer)
                 if (/^image\//i.test(type.mime)) {
                      img = await prepareWAMessageMedia({ image: { url: buffer } }, { upload: conn.waUploadToServer })
                  } else if (/^video\//i.test(type.mime)) {
                      video = await prepareWAMessageMedia({ video: { url: buffer } }, { upload: conn.waUploadToServer })
                  }
              } catch (error) {
                  console.error("Error getting file type", error);
              }
          }
  
    const sections = [...listSections]
          
          const message = {
              interactiveMessage: {
                  header: {title: title, 
                  hasMediaAttachment: false,
                  imageMessage: img ? img.imageMessage : null,
                  videoMessage: video ? video.videoMessage : null 
                     } ,
                  body: {text: text}, 
                  nativeFlowMessage: {
                      buttons: [
                          {
                              name: 'single_select',
                              buttonParamsJson: JSON.stringify({
                                  title: buttonText,
                                  sections
                              })
                          }
                      ],
                      messageParamsJson: ''
                  }
              }
          };
          
          let msgL = generateWAMessageFromContent(jid, {
              viewOnceMessage: {
                  message} }, { userJid: conn.user.jid, quoted })
          
          
          conn.relayMessage(jid, msgL.message, { messageId: msgL.key.id, ...options })
  
      }
  },
    //--
    sendListM: {
      async value(jid, button, rows, quoted, options = {}) {
        const sections = [
          {
            title: button.title,
            rows: [...rows],
          },
        ]
        const listMessage = {
          text: button.description,
          footer: button.footerText,
          mentions: await conn.parseMention(button.description),
          title: '',
          buttonText: button.buttonText,
          sections,
        }
        conn.sendMessage(jid, listMessage, {
          quoted,
        })
      },
    },

    /**
     *status
     */
    updateProfileStatus: {
      async value(status) {
        return conn.query({
          tag: 'iq',
          attrs: {
            to: 's.whatsapp.net',
            type: 'set',
            xmlns: 'status',
          },
          content: [
            {
              tag: 'status',
              attrs: {},
              content: Buffer.from(status, 'utf-8'),
            },
          ],
        })
      },
    },
    /**
     * Send Payment
     */
    sendPayment: {
      async value(jid, amount, currency, text = '', from, options) {
        const requestPaymentMessage = {
          amount: {
            currencyCode: currency || 'USD',
            offset: 0,
            value: amount || 9.99,
          },
          expiryTimestamp: 0,
          amount1000: (amount || 9.99) * 1000,
          currencyCodeIso4217: currency || 'USD',
          requestFrom: from || '0@s.whatsapp.net',
          noteMessage: {
            extendedTextMessage: {
              text: text || 'Example Payment Message',
            },
          },
          //background: !!image ? file : undefined
        }
        return conn.relayMessage(jid, { requestPaymentMessage }, { ...options })
      },
    },
    /**
     * Send Poll
     */
    sendPoll: {
      async value(jid, name = '', optiPoll, options) {
        if (!Array.isArray(optiPoll[0]) && typeof optiPoll[0] === 'string') optiPoll = [optiPoll]
        if (!options) options = {}
        const pollMessage = {
          name: name,
          options: optiPoll.map(btn => ({
            optionName: (!nullish(btn[0]) && btn[0]) || '',
          })),
          selectableOptionsCount: 1,
        }
        return conn.relayMessage(jid, { pollCreationMessage: pollMessage }, { ...options })
      },
    },
    /**
     * Send Fake Poll Results
     */
    sendFakePoll: {
      async value(jid, name = '', options = [], votes = [], quoted, messageOptions = {}) {
        if (!Array.isArray(options) || options.length === 0) {
          throw new Error('Options must be a non-empty array')
        }
        
        let formattedVotes = options.map((opt, index) => {
          const optName = typeof opt === 'string' ? opt : opt.optionName || ''
          const voteCount = Array.isArray(votes) && votes[index] ? 
            (Array.isArray(votes[index]) ? votes[index][1] : votes[index]) : 
            Math.floor(Math.random() * 20) + 1 
            
          return [optName, voteCount]
        })
        
        const message = {
          pollResult: {
            name: name || 'Poll Results',
            votes: formattedVotes
          }
        }
        
        return conn.sendMessage(jid, message, {
          quoted,
          ...messageOptions
        })
      },
      enumerable: true,
    },
    //--
    sendHydrated: {
      /**
       *
       * @param {String} jid
       * @param {String} text
       * @param {String} footer
       * @param {fs.PathLike} buffer
       * @param {String|string[]} url
       * @param {String|string[]} urlText
       * @param {String|string[]} call
       * @param {String|string[]} callText
       * @param {String[][]} buttons
       * @param {import('baileys-pro').proto.WebMessageInfo} quoted
       * @param {Object} options
       */
      async value(
        jid,
        text = '',
        footer = '',
        buffer,
        url,
        urlText,
        call,
        callText,
        buttons,
        quoted,
        options
      ) {
        let type
        if (buffer)
          try {
            ;(type = await conn.getFile(buffer)), (buffer = type.data)
          } catch {
            buffer = buffer
          }
        if (
          buffer &&
          !Buffer.isBuffer(buffer) &&
          (typeof buffer === 'string' || Array.isArray(buffer))
        )
          (options = quoted),
            (quoted = buttons),
            (buttons = callText),
            (callText = call),
            (call = urlText),
            (urlText = url),
            (url = buffer),
            (buffer = null)
        if (!options) options = {}
        let templateButtons = []
        if (url || urlText) {
          if (!Array.isArray(url)) url = [url]
          if (!Array.isArray(urlText)) urlText = [urlText]
          templateButtons.push(
            ...(url
              .map((v, i) => [v, urlText[i]])
              .map(([url, urlText], i) => ({
                index: templateButtons.length + i + 1,
                urlButton: {
                  displayText: (!nullish(urlText) && urlText) || (!nullish(url) && url) || '',
                  url: (!nullish(url) && url) || (!nullish(urlText) && urlText) || '',
                },
              })) || [])
          )
        }
        if (call || callText) {
          if (!Array.isArray(call)) call = [call]
          if (!Array.isArray(callText)) callText = [callText]
          templateButtons.push(
            ...(call
              .map((v, i) => [v, callText[i]])
              .map(([call, callText], i) => ({
                index: templateButtons.length + i + 1,
                callButton: {
                  displayText: (!nullish(callText) && callText) || (!nullish(call) && call) || '',
                  phoneNumber: (!nullish(call) && call) || (!nullish(callText) && callText) || '',
                },
              })) || [])
          )
        }
        if (buttons.length) {
          if (!Array.isArray(buttons[0])) buttons = [buttons]
          templateButtons.push(
            ...(buttons.map(([text, id], index) => ({
              index: templateButtons.length + index + 1,
              quickReplyButton: {
                displayText: (!nullish(text) && text) || (!nullish(id) && id) || '',
                id: (!nullish(id) && id) || (!nullish(text) && text) || '',
              },
            })) || [])
          )
        }
        let message = {
          ...options,
          [buffer ? 'caption' : 'text']: text || '',
          footer,
          templateButtons,
          ...(buffer
            ? options.asLocation && /image/.test(type.mime)
              ? {
                  location: {
                    ...options,
                    jpegThumbnail: buffer,
                  },
                }
              : {
                  [/video/.test(type.mime)
                    ? 'video'
                    : /image/.test(type.mime)
                      ? 'image'
                      : 'document']: buffer,
                }
            : {}),
        }
        return await conn.sendMessage(jid, message, {
          quoted,
          upload: conn.waUploadToServer,
          ...options,
        })
      },
      enumerable: true,
    },
    //---

    sendHydrated2: {
      /**
       *
       * @param {String} jid
       * @param {String} text
       * @param {String} footer
       * @param {fs.PathLike} buffer
       * @param {String|string[]} url
       * @param {String|string[]} urlText
       * @param {String|string[]} url2
       * @param {String|string[]} urlText2
       * @param {String[][]} buttons
       * @param {import('baileys-pro').proto.WebMessageInfo} quoted
       * @param {Object} options
       */
      async value(
        jid,
        text = '',
        footer = '',
        buffer,
        url,
        urlText,
        url2,
        urlText2,
        buttons,
        quoted,
        options
      ) {
        let type
        if (buffer)
          try {
            ;(type = await conn.getFile(buffer)), (buffer = type.data)
          } catch {
            buffer = buffer
          }
        if (
          buffer &&
          !Buffer.isBuffer(buffer) &&
          (typeof buffer === 'string' || Array.isArray(buffer))
        )
          (options = quoted),
            (quoted = buttons),
            (buttons = callText),
            (callText = call),
            (call = urlText),
            (urlText = url),
            (url = buffer),
            (buffer = null)
        if (!options) options = {}
        let templateButtons = []
        if (url || urlText) {
          if (!Array.isArray(url)) url = [url]
          if (!Array.isArray(urlText)) urlText = [urlText]
          templateButtons.push(
            ...(url
              .map((v, i) => [v, urlText[i]])
              .map(([url, urlText], i) => ({
                index: templateButtons.length + i + 1,
                urlButton: {
                  displayText: (!nullish(urlText) && urlText) || (!nullish(url) && url) || '',
                  url: (!nullish(url) && url) || (!nullish(urlText) && urlText) || '',
                },
              })) || [])
          )
        }
        if (url2 || urlText2) {
          if (!Array.isArray(url2)) url2 = [url2]
          if (!Array.isArray(urlText2)) urlText2 = [urlText2]
          templateButtons.push(
            ...(url2
              .map((v, i) => [v, urlText2[i]])
              .map(([url2, urlText2], i) => ({
                index: templateButtons.length + i + 1,
                urlButton: {
                  displayText: (!nullish(urlText2) && urlText2) || (!nullish(url2) && url2) || '',
                  url: (!nullish(url2) && url2) || (!nullish(urlText2) && urlText2) || '',
                },
              })) || [])
          )
        }
        if (buttons.length) {
          if (!Array.isArray(buttons[0])) buttons = [buttons]
          templateButtons.push(
            ...(buttons.map(([text, id], index) => ({
              index: templateButtons.length + index + 1,
              quickReplyButton: {
                displayText: (!nullish(text) && text) || (!nullish(id) && id) || '',
                id: (!nullish(id) && id) || (!nullish(text) && text) || '',
              },
            })) || [])
          )
        }
        let message = {
          ...options,
          [buffer ? 'caption' : 'text']: text || '',
          footer,
          templateButtons,
          ...(buffer
            ? options.asLocation && /image/.test(type.mime)
              ? {
                  location: {
                    ...options,
                    jpegThumbnail: buffer,
                  },
                }
              : {
                  [/video/.test(type.mime)
                    ? 'video'
                    : /image/.test(type.mime)
                      ? 'image'
                      : 'document']: buffer,
                }
            : {}),
        }
        return await conn.sendMessage(jid, message, {
          quoted,
          upload: conn.waUploadToServer,
          ...options,
        })
      },
      enumerable: true,
    },
    ///-----

    cMod: {
      /**
       * cMod
       * @param {String} jid
       * @param {import('baileys-pro').proto.WebMessageInfo} message
       * @param {String} text
       * @param {String} sender
       * @param {*} options
       * @returns
       */
      value(jid, message, text = '', sender = conn.user.jid, options = {}) {
        if (options.mentions && !Array.isArray(options.mentions))
          options.mentions = [options.mentions]
        let copy = message.toJSON()
        delete copy.message.messageContextInfo
        delete copy.message.senderKeyDistributionMessage
        let mtype = Object.keys(copy.message)[0]
        let msg = copy.message
        let content = msg[mtype]
        if (typeof content === 'string') msg[mtype] = text || content
        else if (content.caption) content.caption = text || content.caption
        else if (content.text) content.text = text || content.text
        if (typeof content !== 'string') {
          msg[mtype] = { ...content, ...options }
          msg[mtype].contextInfo = {
            ...(content.contextInfo || {}),
            mentionedJid: options.mentions || content.contextInfo?.mentionedJid || [],
          }
        }
        if (copy.participant) sender = copy.participant = sender || copy.participant
        else if (copy.key.participant)
          sender = copy.key.participant = sender || copy.key.participant
        if (copy.key.remoteJid.includes('@s.whatsapp.net')) sender = sender || copy.key.remoteJid
        else if (copy.key.remoteJid.includes('@broadcast')) sender = sender || copy.key.remoteJid
        copy.key.remoteJid = jid
        copy.key.fromMe = areJidsSameUser(sender, conn.user.id) || false
        return proto.WebMessageInfo.fromObject(copy)
      },
      enumerable: true,
    },
    sendSlide: {
      async value(
        jid,
        text = "",
        footer = "",
        slides = [],
        quoted = {},
        options = {},
      ) {
        const isAndroid = (await getDevice(quoted?.id)) === "android";
        const pr = proto.Message.InteractiveMessage || {};
        const array = [];
        
        const ephemeral = options.ephemeral || WA_DEFAULT_EPHEMERAL;
        
        for (const [txt, ftr, header, thumbnailUrl, buttons] of slides.slice(0, 7)) {
          if (!Array.isArray(buttons)) {
            console.error("Buttons should be an array:", buttons);
            continue;
          }
          
          if (!isAndroid) {
            return await conn.sendButton(
              jid,
              txt,
              footer,
              thumbnailUrl,
              buttons,
              quoted,
            );
          }
          
          try {
            const mediaMessage = await prepareWAMessageMedia(
              {
                [/.+\.mp4/i.test(thumbnailUrl) ? "video" : "image"]: {
                  url: thumbnailUrl,
                },
              },
              {
                upload: conn.waUploadToServer,
              },
            );
            
            array.push({
              body: {
                text: txt,
              },
              footer: {
                text: ftr,
              },
              header: {
                title: header,
                subtitle: "",
                hasMediaAttachment: true,
                ...mediaMessage,
              },
              nativeFlowMessage: {
                buttons: buttons.map(([display_text, btn, name]) => {
                  const params = {
                    display_text: display_text,
                  };
                  if (name === "cta_copy") {
                    params.copy_code = btn;
                  } else if (name === "cta_url") {
                    params.url = btn;
                    params.merchant_url = btn;
                  } else {
                    params.id = btn;
                  }
                  return {
                    name: name,
                    buttonParamsJson: JSON.stringify(params),
                  };
                }),
              },
            });
          } catch (e) {
            console.error("Error preparing media message for:", txt, e);
          }
        }
        
        const msg = await generateWAMessageFromContent(
          jid,
          {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadata: {},
                  deviceListMetadataVersion: 2,
                },
                interactiveMessage: {
                  body: {
                    text: text,
                  },
                  footer: {
                    text: footer,
                  },
                  header: {
                    hasMediaAttachment: false,
                  },
                  carouselMessage: {
                    cards: array,
                  },
                },
              },
            },
          },
          {
            quoted: quoted,
            ephemeralExpiration: ephemeral,
          },
        );
        
        await conn.relayMessage(jid, msg.message, {
          messageId: msg.key.id,
        });
        
        return msg;
      },
      enumerable: true,
    },
    
    sendButtonCta: {
      async value(jid, messages, quoted = {}, options) {
        return messages.length > 1
          ? await conn.sendCarousel(jid, messages, quoted, options)
          : await conn.sendNCarousel(jid, ...messages?.[0], quoted, options);
      },
      enumerable: true,
    },
    
    sendCarousel: {
      async value(jid, messages, quoted = {}, options) {
        const ucapan = global.author || "";
        const wm = options.wm || global.packname || "YUKI";
        const author = global.author || "";
        const botdate =  new Date().toLocaleDateString();
        const ephemeral = options.ephemeral || 0;
        
        const ctxMod = (conn, text, options) => {
          return {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2,
            }
          };
        };
        
        const _ = {
          chain: (arr) => ({
            filter: (fn) => _.chain(arr.filter(fn)),
            flatMap: (fn) => _.chain(arr.flatMap(fn)),
            map: (fn) => _.chain(arr.map(fn)),
            value: () => arr
          }),
          filter: (arr, fn) => arr.filter(fn),
          flatMap: (arr, fn) => arr.flatMap(fn),
          map: (arr, fn) => arr.map(fn),
          isEmpty: (obj) => !obj || (Array.isArray(obj) ? obj.length === 0 : Object.keys(obj).length === 0)
        };
        
        const defaultText = ucapan;
        
        if (messages.length > 1) {
          const cards = await Promise.all(
            messages.map(
              async ([
                text = "",
                footer = "",
                buffer = null,
                buttons = [],
                copy = null,
                urls = null,
                list = null,
              ]) => {
                let img, video, document;
                
                if (buffer) {
                  if (/^https?:\/\//i.test(buffer)) {
                    try {
                      const response = await fetch(buffer);
                      const contentType = response.headers.get("content-type");
                      
                      if (/^image\//i.test(contentType)) {
                        img = await prepareWAMessageMedia(
                          { image: { url: buffer } },
                          { upload: conn.waUploadToServer, ...options }
                        );
                      } else if (/^video\//i.test(contentType)) {
                        video = await prepareWAMessageMedia(
                          { video: { url: buffer } },
                          { upload: conn.waUploadToServer, ...options }
                        );
                      } else if (/^(application|text|audio|document)\//i.test(contentType)) {
                        document = await prepareWAMessageMedia(
                          { document: { url: buffer }, mimetype: contentType },
                          { upload: conn.waUploadToServer, ...options }
                        );
                      } else {
                        console.error("Incompatible MIME type:", contentType);
                      }
                    } catch (error) {
                      console.error("Failed to get MIME type:", error);
                    }
                  } else {
                    try {
                      const type = await conn.getFile(buffer);
                      
                      if (/^image\//i.test(type.mime)) {
                        img = await prepareWAMessageMedia(
                          { image: type?.data },
                          { upload: conn.waUploadToServer, ...options }
                        );
                      } else if (/^video\//i.test(type.mime)) {
                        video = await prepareWAMessageMedia(
                          { video: type?.data },
                          { upload: conn.waUploadToServer, ...options }
                        );
                      } else if (/^(application|text|audio|document)\//i.test(type.mime)) {
                        document = await prepareWAMessageMedia(
                          { document: type?.data, mimetype: type.mime },
                          { upload: conn.waUploadToServer, ...options }
                        );
                      } else {
                        console.error("Incompatible MIME type:", type.mime);
                      }
                    } catch (error) {
                      console.error("Failed to get file type:", error);
                    }
                  }
                }
                
                const sources = [
                  {
                    data: buttons,
                    name: "quick_reply",
                    getParams: (btn) => ({
                      display_text: btn?.[0] || "",
                      id: btn?.[1] || "",
                    }),
                  },
                  {
                    data: copy,
                    name: "cta_copy",
                    getParams: (cpy) => ({
                      display_text: cpy?.[0] || "",
                      copy_code: cpy?.[1] || "",
                    }),
                  },
                  {
                    data: urls,
                    name: "cta_url",
                    getParams: (url) => ({
                      display_text: url?.[0] || "",
                      url: url?.[1] || "",
                      merchant_url: url?.[1] || "",
                    }),
                  },
                  {
                    data: list,
                    name: "single_select",
                    getParams: (lister) => ({
                      title: lister?.[0] || "",
                      sections: lister?.[1] || [],
                    }),
                  },
                ];
                
                const dynamicButtons = _.chain(sources)
                  .filter((source) => !_.isEmpty(source.data))
                  .flatMap(({ data, name, getParams }) =>
                    _.map(data, (item) => ({
                      name: name,
                      buttonParamsJson: JSON.stringify(getParams(item)),
                    }))
                  )
                  .value();
                
                return {
                  body: {
                    text: text || ucapan,
                  },
                  footer: {
                    text: footer || wm,
                  },
                  header: {
                    title: "",
                    subtitle: botdate,
                    hasMediaAttachment:
                      img?.imageMessage ||
                      video?.videoMessage ||
                      document?.documentMessage
                        ? true
                        : false,
                    imageMessage: img?.imageMessage || null,
                    videoMessage: video?.videoMessage || null,
                    documentMessage: document?.documentMessage || null,
                  },
                  nativeFlowMessage: {
                    buttons: dynamicButtons.filter(Boolean),
                    messageParamsJson: "",
                  },
                  ...ctxMod(conn, text, options),
                };
              }
            )
          );
          
          const messageContent = {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadata: {},
                  deviceListMetadataVersion: 2,
                },
                interactiveMessage: {
                  body: {
                    text: ucapan,
                  },
                  footer: {
                    text: wm,
                  },
                  header: {
                    title: author,
                    subtitle: botdate,
                    hasMediaAttachment: false,
                  },
                  carouselMessage: {
                    cards: cards,
                  },
                  ...ctxMod(conn, messages[0][0] || defaultText, options),
                },
              },
            },
          };
          
          const msgsr = await generateWAMessageFromContent(
            jid,
            messageContent,
            {
              quoted: quoted,
              ephemeralExpiration: ephemeral,
            }
          );
          
          await conn.relayMessage(jid, msgsr.message, {
            messageId: msgsr.key.id,
          });
          
          return msgsr;
        } else {
          return await conn.sendNCarousel(
            jid,
            ...messages?.[0],
            quoted,
            options
          );
        }
      },
      enumerable: true,
    },
    
    sendNCarousel: {
      async value(
        jid,
        text = "",
        footer = "",
        buffer = null,
        buttons = [],
        copy = null,
        urls = null,
        list = null,
        quoted = {},
        options = {}
      ) {
        const ucapan = global.author || "";
        const wm = options.wm || global.packname || "YUKI";
        const ephemeral = options.ephemeral || 0;
        
        const ctxMod = (conn, text, options) => {
          return {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2,
            }
          };
        };
        
        const _ = {
          chain: (arr) => ({
            filter: (fn) => _.chain(arr.filter(fn)),
            flatMap: (fn) => _.chain(arr.flatMap(fn)),
            map: (fn) => _.chain(arr.map(fn)),
            value: () => arr
          }),
          filter: (arr, fn) => arr.filter(fn),
          flatMap: (arr, fn) => arr.flatMap(fn),
          map: (arr, fn) => arr.map(fn),
          isEmpty: (obj) => !obj || (Array.isArray(obj) ? obj.length === 0 : Object.keys(obj).length === 0)
        };
        
        let img, video, document;
        
        if (buffer) {
          if (/^https?:\/\//i.test(buffer)) {
            try {
              const response = await fetch(buffer);
              const contentType = response.headers.get("content-type");
              
              if (/^image\//i.test(contentType)) {
                img = await prepareWAMessageMedia(
                  { image: { url: buffer } },
                  { upload: conn.waUploadToServer, ...options }
                );
              } else if (/^video\//i.test(contentType)) {
                video = await prepareWAMessageMedia(
                  { video: { url: buffer } },
                  { upload: conn.waUploadToServer, ...options }
                );
              } else if (/^(application|text|audio|document)\//i.test(contentType)) {
                document = await prepareWAMessageMedia(
                  { document: { url: buffer }, mimetype: contentType },
                  { upload: conn.waUploadToServer, ...options }
                );
              } else {
                console.error("Incompatible MIME type:", contentType);
              }
            } catch (error) {
              console.error("Failed to get MIME type:", error);
            }
          } else {
            try {
              const type = await conn.getFile(buffer);
              
              if (/^image\//i.test(type.mime)) {
                img = await prepareWAMessageMedia(
                  { image: type?.data },
                  { upload: conn.waUploadToServer, ...options }
                );
              } else if (/^video\//i.test(type.mime)) {
                video = await prepareWAMessageMedia(
                  { video: type?.data },
                  { upload: conn.waUploadToServer, ...options }
                );
              } else if (/^(application|text|audio|document)\//i.test(type.mime)) {
                document = await prepareWAMessageMedia(
                  { document: type?.data, mimetype: type.mime },
                  { upload: conn.waUploadToServer, ...options }
                );
              } else {
                console.error("Incompatible MIME type:", type.mime);
              }
            } catch (error) {
              console.error("Failed to get file type:", error);
            }
          }
        }
        
        const sources = [
          {
            data: buttons,
            name: "quick_reply",
            getParams: (btn) => ({
              display_text: btn?.[0] || "",
              id: btn?.[1] || "",
            }),
          },
          {
            data: copy,
            name: "cta_copy",
            getParams: (cpy) => ({
              display_text: cpy?.[0] || "",
              copy_code: cpy?.[1] || "",
            }),
          },
          {
            data: urls,
            name: "cta_url",
            getParams: (url) => ({
              display_text: url?.[0] || "",
              url: url?.[1] || "",
              merchant_url: url?.[1] || "",
            }),
          },
          {
            data: list,
            name: "single_select",
            getParams: (lister) => ({
              title: lister?.[0] || "",
              sections: lister?.[1] || [],
            }),
          },
        ];
        
        const dynamicButtons = _.chain(sources)
          .filter((source) => !_.isEmpty(source.data))
          .flatMap(({ data, name, getParams }) =>
            _.map(data, (item) => ({
              name: name,
              buttonParamsJson: JSON.stringify(getParams(item)),
            }))
          )
          .value();
        
        const interactiveMessage = {
          body: {
            text: text || ucapan,
          },
          footer: {
            text: footer || wm,
          },
          header: {
            hasMediaAttachment:
              img?.imageMessage || video?.videoMessage || document?.documentMessage ? true : false,
            imageMessage: img?.imageMessage || null,
            videoMessage: video?.videoMessage || null,
            documentMessage: document?.documentMessage || null,
          },
          nativeFlowMessage: {
            buttons: dynamicButtons.filter(Boolean),
            messageParamsJson: "",
          },
          ...ctxMod(conn, text, options),
        };
        
        const messageContent = {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
              },
              interactiveMessage: interactiveMessage,
            },
          },
        };
        
        const msgs = await generateWAMessageFromContent(
          jid,
          messageContent,
          {
            quoted: quoted,
            ephemeralExpiration: ephemeral,
          }
        );
        
        await conn.relayMessage(jid, msgs.message, {
          messageId: msgs.key.id,
        });
        
        return msgs;
      },
      enumerable: true,
    },
    
    copyNForward: {
      /**
       * Exact Copy Forward
       * @param {String} jid
       * @param {import('baileys-pro').proto.WebMessageInfo} message
       * @param {Boolean|Number} forwardingScore
       * @param {Object} options
       */
      async value(jid, message, forwardingScore = true, options = {}) {
        let vtype
        if (options.readViewOnce && message.message.viewOnceMessage?.message) {
          vtype = Object.keys(message.message.viewOnceMessage.message)[0]
          delete message.message.viewOnceMessage.message[vtype].viewOnce
          message.message = proto.Message.fromObject(
            JSON.parse(JSON.stringify(message.message.viewOnceMessage.message))
          )
          message.message[vtype].contextInfo = message.message.viewOnceMessage.contextInfo
        }
        let mtype = Object.keys(message.message)[0]
        let m = generateForwardMessageContent(message, !!forwardingScore)
        let ctype = Object.keys(m)[0]
        if (forwardingScore && typeof forwardingScore === 'number' && forwardingScore > 1)
          m[ctype].contextInfo.forwardingScore += forwardingScore
        m[ctype].contextInfo = {
          ...(message.message[mtype].contextInfo || {}),
          ...(m[ctype].contextInfo || {}),
        }
        m = generateWAMessageFromContent(jid, m, {
          ...options,
          userJid: conn.user.jid,
        })
        await conn.relayMessage(jid, m.message, {
          messageId: m.key.id,
          additionalAttributes: { ...options },
        })
        return m
      },
      enumerable: true,
    },
    fakeReply: {
      /**
       * Fake Replies
       * @param {String} jid
       * @param {String|Object} text
       * @param {String} fakeJid
       * @param {String} fakeText
       * @param {String} fakeGroupJid
       * @param {String} options
       */
      value(jid, text = '', fakeJid = this.user.jid, fakeText = '', fakeGroupJid, options) {
        return conn.reply(jid, text, {
          key: {
            fromMe: areJidsSameUser(fakeJid, conn.user.id),
            participant: fakeJid,
            ...(fakeGroupJid ? { remoteJid: fakeGroupJid } : {}),
          },
          message: { conversation: fakeText },
          ...options,
        })
      },
    },
    downloadM: {
      /**
       * Download media message
       * @param {Object} m
       * @param {String} type
       * @param {fs.PathLike | fs.promises.FileHandle} saveToFile
       * @returns {Promise<fs.PathLike | fs.promises.FileHandle | Buffer>}
       */
      async value(m, type, saveToFile) {
        let filename
        if (!m || !(m.url || m.directPath)) return Buffer.alloc(0)
        const stream = await downloadContentFromMessage(m, type)
        let buffer = Buffer.from([])
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk])
        }
        if (saveToFile) ({ filename } = await conn.getFile(buffer, true))
        return saveToFile && fs.existsSync(filename) ? filename : buffer
      },
      enumerable: true,
    },
    parseMention: {
      /**
       * Enhanced parseMention with @lid support and phone number parsing
       * @param {String} text
       * @returns {Array<String>}
       */
      value(text = '') {
        // Parse both regular mentions and @lid mentions
        const regularMentions = [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net')
        const lidMentions = [...text.matchAll(/@([0-9]+@lid)/g)].map(v => v[1])
        
        // Parse phone numbers with country codes and formatting
        const phoneNumberMentions = []
        const phoneRegex = /@(\+?[0-9\s\(\)\-\.]{7,20})/g
        let phoneMatch
        
        while ((phoneMatch = phoneRegex.exec(text)) !== null) {
          const rawPhone = phoneMatch[1]
          
          // Skip if it's already a simple number (handled by regularMentions)
          if (/^[0-9]{5,16}$/.test(rawPhone)) continue
          
          try {
            // Clean the phone number
            let cleanedPhone = rawPhone.replace(/[^\d\+]/g, '')
            
            // Handle US numbers specifically
            if (cleanedPhone.startsWith('+1') || (cleanedPhone.length === 10 && /^[2-9]\d{2}[2-9]\d{6}$/.test(cleanedPhone))) {
              if (!cleanedPhone.startsWith('1')) {
                cleanedPhone = '1' + cleanedPhone.replace(/^\+?1?/, '')
              } else {
                cleanedPhone = cleanedPhone.replace(/^\+/, '')
              }
              phoneNumberMentions.push(cleanedPhone + '@s.whatsapp.net')
            } else {
              // For other international numbers
              cleanedPhone = cleanedPhone.replace(/^\+/, '')
              if (cleanedPhone.length >= 7 && cleanedPhone.length <= 15) {
                phoneNumberMentions.push(cleanedPhone + '@s.whatsapp.net')
              }
            }
          } catch (error) {
            console.warn('Error parsing phone number:', rawPhone, error.message)
          }
        }
        
        return [...regularMentions, ...lidMentions, ...phoneNumberMentions]
      },
      enumerable: true,
    },
    getName: {
      value(jid, withoutContact = false) {
        jid = this.decodeJid(jid)
        if (withoutContact) return ''
        let v = this.chats[jid]
        let number = jid.replace(/@.+/, '')
        let name = v ? (v.name || v.subject || v.vname || v.notify || v.verifiedName) : null
        try {
          return name || (new PhoneNumber('+' + number).getNumber('international') || number)
        } catch {
          return name || number
        }
      },
      enumerable: true
    },
    loadMessage: {
      /**
       *
       * @param {String} messageID
       * @returns {import('baileys-pro').proto.WebMessageInfo}
       */
      value(messageID) {
        return Object.entries(conn.chats)
          .filter(([_, { messages }]) => typeof messages === 'object')
          .find(([_, { messages }]) =>
            Object.entries(messages).find(([k, v]) => k === messageID || v.key?.id === messageID)
          )?.[1].messages?.[messageID]
      },
      enumerable: true,
    },
    sendGroupV4Invite: {
      /**
       * sendGroupV4Invite
       * @param {String} jid
       * @param {*} participant
       * @param {String} inviteCode
       * @param {Number} inviteExpiration
       * @param {String} groupName
       * @param {String} caption
       * @param {Buffer} jpegThumbnail
       * @param {*} options
       */
      async value(
        jid,
        participant,
        inviteCode,
        inviteExpiration,
        groupName = 'unknown subject',
        caption = 'Invitation to join my WhatsApp group',
        jpegThumbnail,
        options = {}
      ) {
        const msg = proto.Message.fromObject({
          groupInviteMessage: proto.GroupInviteMessage.fromObject({
            inviteCode,
            inviteExpiration: parseInt(inviteExpiration) || +new Date(new Date() + 3 * 86400000),
            groupJid: jid,
            groupName: (groupName ? groupName : await conn.getName(jid)) || null,
            jpegThumbnail: Buffer.isBuffer(jpegThumbnail) ? jpegThumbnail : null,
            caption,
          }),
        })
        const message = generateWAMessageFromContent(participant, msg, options)
        await conn.relayMessage(participant, message.message, {
          messageId: message.key.id,
          additionalAttributes: { ...options },
        })
        return message
      },
      enumerable: true,
    },
    processMessageStubType: {
      /**
       * to process MessageStubType
       * @param {import('baileys-pro').proto.WebMessageInfo} m
       */
      async value(m) {
        if (!m.messageStubType) return
        const chat = conn.decodeJid(
          m.key.remoteJid || m.message?.senderKeyDistributionMessage?.groupId || ''
        )
        if (!chat || chat === 'status@broadcast') return
        const emitGroupUpdate = update => {
          ev.emit('groups.update', [{ id: chat, ...update }])
        }
        switch (m.messageStubType) {
          case WAMessageStubType.REVOKE:
          case WAMessageStubType.GROUP_CHANGE_INVITE_LINK:
            emitGroupUpdate({ revoke: m.messageStubParameters[0] })
            break
          case WAMessageStubType.GROUP_CHANGE_ICON:
            emitGroupUpdate({ icon: m.messageStubParameters[0] })
            break
          default: {
            console.log({
              messageStubType: m.messageStubType,
              messageStubParameters: m.messageStubParameters,
              type: WAMessageStubType[m.messageStubType],
            })
            break
          }
        }
        const isGroup = chat.endsWith('@g.us')
        if (!isGroup) return
        let chats = conn.chats[chat]
        if (!chats) chats = conn.chats[chat] = { id: chat }
        chats.isChats = true
        const metadata = await conn.groupMetadata(chat).catch(_ => null)
        if (!metadata) return
        chats.subject = metadata.subject
        chats.metadata = metadata
      },
    },
    insertAllGroup: {
      async value() {
        const groups = (await conn.groupFetchAllParticipating().catch(_ => null)) || {}
        for (const group in groups)
          conn.chats[group] = {
            ...(conn.chats[group] || {}),
            id: group,
            subject: groups[group].subject,
            isChats: true,
            metadata: groups[group],
          }
        return conn.chats
      },
    },
    pushMessage: {
      /**
       * pushMessage
       * @param {import('baileys-pro').proto.WebMessageInfo[]} m
       */
      async value(m) {
        if (!m) return
        if (!Array.isArray(m)) m = [m]
        for (const message of m) {
          try {
            // if (!(message instanceof proto.WebMessageInfo)) continue // https://github.com/adiwajshing/Baileys/pull/696/commits/6a2cb5a4139d8eb0a75c4c4ea7ed52adc0aec20f
            if (!message) continue
            if (message.messageStubType && message.messageStubType != WAMessageStubType.CIPHERTEXT)
              conn.processMessageStubType(message).catch(console.error)
            const _mtype = Object.keys(message.message || {})
            const mtype =
              (!['senderKeyDistributionMessage', 'messageContextInfo'].includes(_mtype[0]) &&
                _mtype[0]) ||
              (_mtype.length >= 3 && _mtype[1] !== 'messageContextInfo' && _mtype[1]) ||
              _mtype[_mtype.length - 1]
            const chat = conn.decodeJid(
              message.key.remoteJid || message.message?.senderKeyDistributionMessage?.groupId || ''
            )
            if (message.message?.[mtype]?.contextInfo?.quotedMessage) {
              /**
               * @type {import('baileys-pro').proto.IContextInfo}
               */
              let context = message.message[mtype].contextInfo
              let participant = conn.decodeJid(context.participant)
              const remoteJid = conn.decodeJid(context.remoteJid || participant)
              /**
               * @type {import('baileys-pro').proto.IMessage}
               *
               */
              let quoted = message.message[mtype].contextInfo.quotedMessage
              if (remoteJid && remoteJid !== 'status@broadcast' && quoted) {
                let qMtype = Object.keys(quoted)[0]
                if (qMtype == 'conversation') {
                  quoted.extendedTextMessage = { text: quoted[qMtype] }
                  delete quoted.conversation
                  qMtype = 'extendedTextMessage'
                }
                if (!quoted[qMtype].contextInfo) quoted[qMtype].contextInfo = {}
                quoted[qMtype].contextInfo.mentionedJid =
                  context.mentionedJid || quoted[qMtype].contextInfo.mentionedJid || []
                const isGroup = remoteJid.endsWith('g.us')
                if (isGroup && !participant) participant = remoteJid
                const qM = {
                  key: {
                    remoteJid,
                    fromMe: areJidsSameUser(conn.user.jid, remoteJid),
                    id: context.stanzaId,
                    participant,
                  },
                  message: JSON.parse(JSON.stringify(quoted)),
                  ...(isGroup ? { participant } : {}),
                }
                let qChats = conn.chats[participant]
                if (!qChats)
                  qChats = conn.chats[participant] = { id: participant, isChats: !isGroup }
                if (!qChats.messages) qChats.messages = {}
                if (!qChats.messages[context.stanzaId] && !qM.key.fromMe)
                  qChats.messages[context.stanzaId] = qM
                let qChatsMessages
                if ((qChatsMessages = Object.entries(qChats.messages)).length > 40)
                  qChats.messages = Object.fromEntries(
                    qChatsMessages.slice(30, qChatsMessages.length)
                  ) // maybe avoid memory leak
              }
            }
            if (!chat || chat === 'status@broadcast') continue
            const isGroup = chat.endsWith('@g.us')
            let chats = conn.chats[chat]
            if (!chats) {
              if (isGroup) await conn.insertAllGroup().catch(console.error)
              chats = conn.chats[chat] = { id: chat, isChats: true, ...(conn.chats[chat] || {}) }
            }
            let metadata, sender
            if (isGroup) {
              if (!chats.subject || !chats.metadata) {
                metadata = (await conn.groupMetadata(chat).catch(_ => ({}))) || {}
                if (!chats.subject) chats.subject = metadata.subject || ''
                if (!chats.metadata) chats.metadata = metadata
              }
              sender = conn.decodeJid(
                (message.key?.fromMe && conn.user.id) ||
                  message.participant ||
                  message.key?.participant ||
                  chat ||
                  ''
              )
              if (sender !== chat) {
                let chats = conn.chats[sender]
                if (!chats) chats = conn.chats[sender] = { id: sender }
                if (!chats.name) chats.name = message.pushName || chats.name || ''
              }
            } else if (!chats.name) chats.name = message.pushName || chats.name || ''
            if (['senderKeyDistributionMessage', 'messageContextInfo'].includes(mtype)) continue
            chats.isChats = true
            if (!chats.messages) chats.messages = {}
            const fromMe = message.key.fromMe || areJidsSameUser(sender || chat, conn.user.id)
            if (
              !['protocolMessage'].includes(mtype) &&
              !fromMe &&
              message.messageStubType != WAMessageStubType.CIPHERTEXT &&
              message.message
            ) {
              delete message.message.messageContextInfo
              delete message.message.senderKeyDistributionMessage
              chats.messages[message.key.id] = JSON.parse(JSON.stringify(message, null, 2))
              let chatsMessages
              if ((chatsMessages = Object.entries(chats.messages)).length > 40)
                chats.messages = Object.fromEntries(chatsMessages.slice(30, chatsMessages.length))
            }
          } catch (e) {
            console.error(e)
          }
        }
      },
    },
    serializeM: {
      /**
       * Serialize Message, so it easier to manipulate
       * @param {import('baileys-pro').proto.WebMessageInfo} m
       */
      value(m) {
        return smsg(conn, m)
      },
    },
    ...(typeof conn.chatRead !== 'function'
      ? {
          chatRead: {
            /**
             * Read message
             * @param {String} jid
             * @param {String|undefined|null} participant
             * @param {String} messageID
             */
            value(jid, participant = conn.user.jid, messageID) {
              return conn.sendReadReceipt(jid, participant, [messageID])
            },
            enumerable: true,
          },
        }
      : {}),
    ...(typeof conn.setStatus !== 'function'
      ? {
          setStatus: {
            /**
             * setStatus bot
             * @param {String} status
             */
            value(status) {
              return conn.query({
                tag: 'iq',
                attrs: {
                  to: S_WHATSAPP_NET,
                  type: 'set',
                  xmlns: 'status',
                },
                content: [
                  {
                    tag: 'status',
                    attrs: {},
                    content: Buffer.from(status, 'utf-8'),
                  },
                ],
              })
            },
            enumerable: true,
          },
        }
      : {}),
  })
  if (sock.user?.id) sock.user.jid = sock.decodeJid(sock.user.id)
  store.bind(sock)
  return sock
}
/**
 * Serialize Message
 * @param {ReturnType<typeof makeWASocket>} conn
 * @param {import('baileys-pro').proto.WebMessageInfo} m
 * @param {Boolean} hasParent
 */
export function smsg(conn, m, hasParent) {
  if (!m) return m
  /**
   * @type {import('baileys-pro').proto.WebMessageInfo}
   */
  let M = proto.WebMessageInfo
  m = M.fromObject(m)
  m.conn = conn
  let protocolMessageKey
  if (m.message) {
    if (m.mtype == 'protocolMessage' && m.msg.key) {
      protocolMessageKey = m.msg.key
      if (protocolMessageKey == 'status@broadcast') protocolMessageKey.remoteJid = m.chat
      if (!protocolMessageKey.participant || protocolMessageKey.participant == 'status_me')
        protocolMessageKey.participant = m.sender
      protocolMessageKey.fromMe =
        conn.decodeJid(protocolMessageKey.participant) === conn.decodeJid(conn.user.id)
      if (
        !protocolMessageKey.fromMe &&
        protocolMessageKey.remoteJid === conn.decodeJid(conn.user.id)
      )
        protocolMessageKey.remoteJid = m.sender
    }
    if (m.quoted) if (!m.quoted.mediaMessage) delete m.quoted.download
  }
  if (!m.mediaMessage) delete m.download

  try {
    if (protocolMessageKey && m.mtype == 'protocolMessage')
      conn.ev.emit('message.delete', protocolMessageKey)
  } catch (e) {
    console.error(e)
  }
  return m
}

// https://github.com/Nurutomo/wabot-aq/issues/490
export function serialize() {
  const MediaType = [
    'imageMessage',
    'videoMessage',
    'audioMessage',
    'stickerMessage',
    'documentMessage',
  ]
  return Object.defineProperties(proto.WebMessageInfo.prototype, {
    conn: {
      value: undefined,
      enumerable: false,
      writable: true,
    },
    id: {
      get() {
        return this.key?.id
      },
    },
    isBaileys: {
      get() {
        return (
          this.id?.length === 16 || (this.id?.startsWith('3EB0') && this.id?.length === 12) || false
        )
      },
    },
    chat: {
      get() {
        const senderKeyDistributionMessage = this.message?.senderKeyDistributionMessage?.groupId
        return (
          this.key?.remoteJid ||
          (senderKeyDistributionMessage && senderKeyDistributionMessage !== 'status@broadcast') ||
          ''
        ).decodeJid()
      },
    },
    isGroup: {
      get() {
        return this.chat.endsWith('@g.us')
      },
      enumerable: true,
    },
    sender: {
      get() {
        return this.conn?.decodeJid(
          (this.key?.fromMe && this.conn?.user.id) ||
            this.participant ||
            this.key.participant ||
            this.chat ||
            ''
        )
      },
      enumerable: true,
    },
    fromMe: {
      get() {
        return this.key?.fromMe || areJidsSameUser(this.conn?.user.id, this.sender) || false
      },
    },
    mtype: {
      get() {
        if (!this.message) return ''
        const type = Object.keys(this.message)
        return (
          (!['senderKeyDistributionMessage', 'messageContextInfo'].includes(type[0]) && type[0]) || // Sometimes message in the front
          (type.length >= 3 && type[1] !== 'messageContextInfo' && type[1]) || // Sometimes message in midle if mtype length is greater than or equal to 3
          type[type.length - 1]
        ) // common case
      },
      enumerable: true,
    },
    msg: {
      get() {
        if (!this.message) return null
        return this.message[this.mtype]
      },
    },
    mediaMessage: {
      get() {
        if (!this.message) return null
        const Message =
          (this.msg?.url || this.msg?.directPath
            ? { ...this.message }
            : extractMessageContent(this.message)) || null
        if (!Message) return null
        const mtype = Object.keys(Message)[0]
        return MediaType.includes(mtype) ? Message : null
      },
      enumerable: true,
    },
    mediaType: {
      get() {
        let message
        if (!(message = this.mediaMessage)) return null
        return Object.keys(message)[0]
      },
      enumerable: true,
    },
    quoted: {
      get() {
        /**
         * @type {ReturnType<typeof makeWASocket>}
         */
        const self = this
        const msg = self.msg
        const contextInfo = msg?.contextInfo
        const quoted = contextInfo?.quotedMessage
        if (!msg || !contextInfo || !quoted) return null
        const type = Object.keys(quoted)[0]
        let q = quoted[type]
        const text = typeof q === 'string' ? q : q.text
        return Object.defineProperties(
          JSON.parse(JSON.stringify(typeof q === 'string' ? { text: q } : q)),
          {
            mtype: {
              get() {
                return type
              },
              enumerable: true,
            },
            mediaMessage: {
              get() {
                const Message =
                  (q.url || q.directPath ? { ...quoted } : extractMessageContent(quoted)) || null
                if (!Message) return null
                const mtype = Object.keys(Message)[0]
                return MediaType.includes(mtype) ? Message : null
              },
              enumerable: true,
            },
            mediaType: {
              get() {
                let message
                if (!(message = this.mediaMessage)) return null
                return Object.keys(message)[0]
              },
              enumerable: true,
            },
            id: {
              get() {
                return contextInfo.stanzaId
              },
              enumerable: true,
            },
            chat: {
              get() {
                return contextInfo.remoteJid || self.chat
              },
              enumerable: true,
            },
            isBaileys: {
              get() {
                return (
                  this.id?.length === 16 ||
                  (this.id?.startsWith('3EB0') && this.id.length === 12) ||
                  false
                )
              },
              enumerable: true,
            },
            sender: {
              get() {
                return (contextInfo.participant || this.chat || '').decodeJid()
              },
              enumerable: true,
            },
            fromMe: {
              get() {
                return areJidsSameUser(this.sender, self.conn?.user.jid)
              },
              enumerable: true,
            },
            text: {
              get() {
                return text || this.caption || this.contentText || this.selectedDisplayText || ''
              },
              enumerable: true,
            },
            mentionedJid: {
              get() {
                return q.contextInfo?.mentionedJid || self.getQuotedObj()?.mentionedJid || []
              },
              enumerable: true,
            },
            name: {
              get() {
                const sender = this.sender
                return sender ? self.conn?.getName(sender) : null
              },
              enumerable: true,
            },
            vM: {
              get() {
                return proto.WebMessageInfo.fromObject({
                  key: {
                    fromMe: this.fromMe,
                    remoteJid: this.chat,
                    id: this.id,
                  },
                  message: quoted,
                  ...(self.isGroup ? { participant: this.sender } : {}),
                })
              },
            },
            fakeObj: {
              get() {
                return this.vM
              },
            },
            download: {
              value(saveToFile = false) {
                const mtype = this.mediaType
                return self.conn?.downloadM(
                  this.mediaMessage[mtype],
                  mtype.replace(/message/i, ''),
                  saveToFile
                )
              },
              enumerable: true,
              configurable: true,
            },
            reply: {
              /**
               * Reply to quoted message
               * @param {String|Object} text
               * @param {String|false} chatId
               * @param {Object} options
               */
              value(text, chatId, options) {
                return self.conn?.reply(chatId ? chatId : this.chat, text, this.vM, options)
              },
              enumerable: true,
            },
            copy: {
              /**
               * Copy quoted message
               */
              value() {
                const M = proto.WebMessageInfo
                return smsg(conn, M.fromObject(M.toObject(this.vM)))
              },
              enumerable: true,
            },
            forward: {
              /**
               * Forward quoted message
               * @param {String} jid
               *  @param {Boolean} forceForward
               */
              value(jid, force = false, options) {
                return self.conn?.sendMessage(
                  jid,
                  {
                    forward: this.vM,
                    force,
                    ...options,
                  },
                  { ...options }
                )
              },
              enumerable: true,
            },
            copyNForward: {
              /**
               * Exact Forward quoted message
               * @param {String} jid
               * @param {Boolean|Number} forceForward
               * @param {Object} options
               */
              value(jid, forceForward = false, options) {
                return self.conn?.copyNForward(jid, this.vM, forceForward, options)
              },
              enumerable: true,
            },
            cMod: {
              /**
               * Modify quoted Message
               * @param {String} jid
               * @param {String} text
               * @param {String} sender
               * @param {Object} options
               */
              value(jid, text = '', sender = this.sender, options = {}) {
                return self.conn?.cMod(jid, this.vM, text, sender, options)
              },
              enumerable: true,
            },
            delete: {
              /**
               * Delete quoted message
               */
              value() {
                return self.conn?.sendMessage(this.chat, { delete: this.vM.key })
              },
              enumerable: true,
            },
            //react
            react: {
              value(text) {
                return self.conn?.sendMessage(this.chat, {
                  react: {
                    text,
                    key: this.key,
                  },
                })
              },
              enumerable: true,
            },
            //
          }
        )
      },
      enumerable: true,
    },
    _text: {
      value: null,
      writable: true,
    },
    text: {
      get() {
        const msg = this.msg
        const text =
          (typeof msg === 'string' ? msg : msg?.text) || msg?.caption || msg?.contentText || ''
        return typeof this._text === 'string'
          ? this._text
          : '' ||
              (typeof text === 'string'
                ? text
                : text?.selectedDisplayText ||
                  text?.hydratedTemplate?.hydratedContentText ||
                  text) ||
              ''
      },
      set(str) {
        return (this._text = str)
      },
      enumerable: true,
    },
    mentionedJid: {
      get() {
        return (
          (this.msg?.contextInfo?.mentionedJid?.length && this.msg.contextInfo.mentionedJid) || []
        )
      },
      enumerable: true,
    },
    name: {
      get() {
        return (!nullish(this.pushName) && this.pushName) || this.conn?.getName(this.sender)
      },
      enumerable: true,
    },
    download: {
      value(saveToFile = false) {
        const mtype = this.mediaType
        return this.conn?.downloadM(
          this.mediaMessage[mtype],
          mtype.replace(/message/i, ''),
          saveToFile
        )
      },
      enumerable: true,
      configurable: true,
    },
    reply: {
      value(text, chatId, options) {
        return this.conn?.reply(chatId ? chatId : this.chat, text, this, options)
      },
    },
    copy: {
      value() {
        const M = proto.WebMessageInfo
        return smsg(this.conn, M.fromObject(M.toObject(this)))
      },
      enumerable: true,
    },
    forward: {
      value(jid, force = false, options = {}) {
        return this.conn?.sendMessage(
          jid,
          {
            forward: this,
            force,
            ...options,
          },
          { ...options }
        )
      },
      enumerable: true,
    },
    copyNForward: {
      value(jid, forceForward = false, options = {}) {
        return this.conn?.copyNForward(jid, this, forceForward, options)
      },
      enumerable: true,
    },
    cMod: {
      value(jid, text = '', sender = this.sender, options = {}) {
        return this.conn?.cMod(jid, this, text, sender, options)
      },
      enumerable: true,
    },
    getQuotedObj: {
      value() {
        if (!this.quoted.id) return null
        const q = proto.WebMessageInfo.fromObject(
          this.conn?.loadMessage(this.quoted.id) || this.quoted.vM
        )
        return smsg(this.conn, q)
      },
      enumerable: true,
    },
    getQuotedMessage: {
      get() {
        return this.getQuotedObj
      },
    },
    delete: {
      value() {
        return this.conn?.sendMessage(this.chat, { delete: this.key })
      },
      enumerable: true,
    },
    //react
    react: {
      value(text) {
        return this.conn?.sendMessage(this.chat, {
          react: {
            text,
            key: this.key,
          },
        })
      },
      enumerable: true,
    },
    //
  })
}

export function logic(check, inp, out) {
  if (inp.length !== out.length) throw new Error('Input and Output must have same length')
  for (let i in inp) if (util.isDeepStrictEqual(check, inp[i])) return out[i]
  return null
}

export function protoType() {
  Buffer.prototype.toArrayBuffer = function toArrayBufferV2() {
    const ab = new ArrayBuffer(this.length)
    const view = new Uint8Array(ab)
    for (let i = 0; i < this.length; ++i) {
      view[i] = this[i]
    }
    return ab
  }
  /**
   * @returns {ArrayBuffer}
   */
  Buffer.prototype.toArrayBufferV2 = function toArrayBuffer() {
    return this.buffer.slice(this.byteOffset, this.byteOffset + this.byteLength)
  }
  /**
   * @returns {Buffer}
   */
  ArrayBuffer.prototype.toBuffer = function toBuffer() {
    return Buffer.from(new Uint8Array(this))
  }
  // /**
  //  * @returns {String}
  //  */
  // Buffer.prototype.toUtilFormat = ArrayBuffer.prototype.toUtilFormat = Object.prototype.toUtilFormat = Array.prototype.toUtilFormat = function toUtilFormat() {
  //     return util.format(this)
  // }
  Uint8Array.prototype.getFileType =
    ArrayBuffer.prototype.getFileType =
    Buffer.prototype.getFileType =
      async function getFileType() {
        return await fileTypeFromBuffer(this)
      }
  /**
   * @returns {Boolean}
   */
  String.prototype.isNumber = Number.prototype.isNumber = isNumber
  /**
   *
   * @returns {String}
   */
  String.prototype.capitalize = function capitalize() {
    return this.charAt(0).toUpperCase() + this.slice(1, this.length)
  }
  /**
   * @returns {String}
   */
  String.prototype.capitalizeV2 = function capitalizeV2() {
    const str = this.split(' ')
    return str.map(v => v.capitalize()).join(' ')
  }
  String.prototype.decodeJid = function decodeJid() {
    if (/:\d+@/gi.test(this)) {
      const decode = jidDecode(this) || {}
      return ((decode.user && decode.server && decode.user + '@' + decode.server) || this).trim()
    } else return this.trim()
  }
  /**
   * number must be milliseconds
   * @returns {string}
   */
  Number.prototype.toTimeString = function toTimeString() {
    // const milliseconds = this % 1000
    const seconds = Math.floor((this / 1000) % 60)
    const minutes = Math.floor((this / (60 * 1000)) % 60)
    const hours = Math.floor((this / (60 * 60 * 1000)) % 24)
    const days = Math.floor(this / (24 * 60 * 60 * 1000))
    return (
      (days ? `${days} day(s) ` : '') +
      (hours ? `${hours} hour(s) ` : '') +
      (minutes ? `${minutes} minute(s) ` : '') +
      (seconds ? `${seconds} second(s)` : '')
    ).trim()
  }
  Number.prototype.getRandom = String.prototype.getRandom = Array.prototype.getRandom = getRandom
}

function isNumber() {
  const int = parseInt(this)
  return typeof int === 'number' && !isNaN(int)
}

function getRandom() {
  if (Array.isArray(this) || this instanceof String)
    return this[Math.floor(Math.random() * this.length)]
  return Math.floor(Math.random() * this)
}

/**
 * ??
 * @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing_operator
 * @returns {boolean}
 */
function nullish(args) {
  return !(args !== null && args !== undefined)
}

// TypeError: Cannot read properties of null (reading 'user')
//     at WebMessageInfo.get (file:///home/container/lib/simple.js:888:70)
//     at Object.value (file:///home/container/lib/simple.js:731:61)
//     at Object.handler (file:///home/container/handler.js?update=1646537086773:18:10)
//     at EventEmitter.emit (node:events:532:35)
//     at Object.all (file:///home/container/plugins/_templateResponse.js?update=1646538543307:79:13)
//     at async Object.handler (file:///home/container/handler.js?update=1646537086773:346:21)