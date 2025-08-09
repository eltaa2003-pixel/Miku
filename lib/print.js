import {WAMessageStubType} from '@whiskeysockets/baileys';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PhoneNumber = require('awesome-phonenumber');
import chalk from 'chalk';
import {watchFile} from 'fs';

const terminalImage = global.opts['img'] ? require('terminal-image') : '';
const urlRegex = (await import('url-regex-safe')).default({strict: false});

export default async function(m, conn = {user: {}}) {
  const _name = await conn.getName(m.sender);
  const decodedSender = m.sender ? conn.decodeJid(m.sender) : '';
  let sender = decodedSender;
  try {
    sender = new PhoneNumber('+' + decodedSender.replace('@s.whatsapp.net', '')).getNumber('international') + (_name ? ' ~' + _name : '');
  } catch {
    // It's okay if it fails, 'sender' is already set to the decoded JID
  }
  
  // Check if this is a bot message (outgoing)
  const isBot = m.fromMe || (m.sender && conn.user && m.sender === conn.decodeJid(conn.user.jid));
  if (isBot) {
    sender = 'Bot ~يوكي';
  }
  
  const chat = await conn.getName(m.chat);
  let img;
  try {
    if (global.opts['img']) {
      img = /sticker|image/gi.test(m.mtype) ? await terminalImage.buffer(await m.download()) : false;
    }
  } catch (e) {
    console.error(e);
  }
  const filesize = (m.msg ?
m.msg.vcard ?
m.msg.vcard.length :
m.msg.fileLength ?
m.msg.fileLength.low || m.msg.fileLength :
m.msg.axolotlSenderKeyDistributionMessage ?
m.msg.axolotlSenderKeyDistributionMessage.length :
m.text ?
m.text.length :
0 :
m.text ? m.text.length : 0) || 0;
  const user = global.db.data.users[m.sender];
  const jid = conn.user?.jid ? conn.decodeJid(conn.user.jid) : '';
  let me = jid;
  try {
    me = new PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international');
  } catch {
    me = jid;
  }

  console.log(`▣────────────···
│ ${chalk.redBright('%s')}
│⏰ㅤ${chalk.black(chalk.bgYellow('%s'))}
│📑ㅤ${chalk.black(chalk.bgGreen('%s'))}
│📊ㅤ${chalk.magenta('%s [%s %sB]')}
│📤ㅤ${chalk.green('%s')}
│📃ㅤ${chalk.yellow('%s')}
│📥ㅤ${chalk.green('%s')}
│💬ㅤ${chalk.black(chalk.bgYellow('%s'))}
▣────────────···
`.trim(),

  sender,
  (m.messageTimestamp ? new Date(1000 * (m.messageTimestamp.low || m.messageTimestamp)) : new Date).toTimeString(),
m.messageStubType ? WAMessageStubType[m.messageStubType] : '',
filesize,
filesize === 0 ? 0 : (filesize / 1009 ** Math.floor(Math.log(filesize) / Math.log(1000))).toFixed(1),
['', ...'KMGTP'][Math.floor(Math.log(filesize) / Math.log(1000))] || '',
sender,
m ? m.exp : '?',
m.chat + (chat ? ' ~' + chat : ''),
m.mtype ? m.mtype.replace(/message$/i, '').replace('audio', m.msg.ptt ? 'PTT' : 'audio').replace(/^./, (v) => v.toUpperCase()) : '',
  );
  if (img) console.log(img.trimEnd());
  if (typeof m.text === 'string' && m.text) {
    let log = m.text.replace(/\u200e+/g, '');
    const mdRegex = /(?<=(?:^|[\s\n])\S?)(?:([*_~])(.+?)\1|```((?:.||[\n\r])+?)```)(?=\S?(?:[\s\n]|$))/g;
    const mdFormat = (depth = 4) => (_, type, text, monospace) => {
      const types = {
        '_': 'italic',
        '*': 'bold',
        '~': 'strikethrough',
      };
      text = text || monospace;
      const formatted = !types[type] || depth < 1 ? text : chalk[types[type]](text.replace(mdRegex, mdFormat(depth - 1)));
      return formatted;
    };
    if (log.length < 1024) {
      log = log.replace(urlRegex, (url, i, text) => {
        const end = url.length + i;
        return i === 0 || end === text.length || (/^\s$/.test(text[end]) && /^\s$/.test(text[i - 1])) ? chalk.blueBright(url) : url;
      });
    }
    log = log.replace(mdRegex, mdFormat(4));
    if (m.mentionedJid) for (const user of m.mentionedJid) log = log.replace('@' + user.split`@`[0], chalk.blueBright('@' +await conn.getName(user)));
    console.log(m.error != null ? chalk.red(log) : m.isCommand ? chalk.yellow(log) : log);
  }
  if (m.messageStubParameters) {
    console.log(m.messageStubParameters.map((jid) => {
      const decodedJid = conn.decodeJid(jid);
      const name = conn.getName(decodedJid);
      let formattedJid = decodedJid.replace(/@s\.whatsapp\.net$/, '');
      try {
        formattedJid = new PhoneNumber('+' + formattedJid).getNumber('international');
      } catch {}
      return chalk.gray(formattedJid + (name ? ' ~' + name : ''));
    }).join(', '));
  }
  if (/document/i.test(m.mtype)) console.log(`🗂️ ${m.msg.fileName || m.msg.displayName || 'Document'}`);
  else if (/ContactsArray/i.test(m.mtype)) console.log(`👨‍👩‍👧‍👦 ${' ' || ''}`);
  else if (/contact/i.test(m.mtype)) console.log(`👨 ${m.msg.displayName || ''}`);
  else if (/audio/i.test(m.mtype)) {
    const duration = m.msg.seconds;
    console.log(`${m.msg.ptt ? '🎤ㅤ(PTT ' : '🎵ㅤ('}AUDIO) ${Math.floor(duration / 60).toString().padStart(2, 0)}:${(duration % 60).toString().padStart(2, 0)}`);
  }
  console.log();
}
const file = global.__filename(import.meta.url);
watchFile(file, () => {
  console.log(chalk.redBright('Update \'lib/print.js\''));
});