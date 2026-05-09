
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config({ path: './.env' });
import { watchFile, unwatchFile } from 'fs';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import fs from 'fs';
import moment from 'moment-timezone';

// Define global variables
// Owners: comma‑separated numbers in .env (e.g. OWNER_NUMBERS=96176337375,+966535993926)
const ownerEnv = process.env.OWNER_NUMBERS || '';
// Each owner can optionally include a name after a colon, e.g. "96176337375:Elta"
global.owner = ownerEnv
  ? ownerEnv.split(',').map(entry => {
      const [number, name] = entry.split(':');
      return [number.trim(), name?.trim() || ''];
    })
  : [
      ['96176337375', 'Elta'],
      ['+966535993926', 'Omar'],
    ];

global.xaxa    = process.env.XAXA    || 'kaneki';
global.suittag = (process.env.SUITTAG || '96176337375').split(',');
global.prems   = (process.env.PREMS   || '96176337375').split(',');
global.packname = process.env.PACKNAME || 'Yuki';
global.author   = process.env.AUTHOR   || '';
global.wm       = process.env.WM       || '★ -  ★';
global.titulowm = '🤖 𝓝𝓲𝓷𝓸 - 𝑩𝑶𝑻 🤖';
global.titulowm2 = '乂 𝓝𝓲𝓷𝓸 - 𝑩𝑶𝑻 乂';
global.igfg = '★𝓝𝓲𝓷𝓸&𝑩𝑶𝑻★';
global.wait = '*⌛ _downloading..._*\n\n*▰▰▰▱▱▱▱▱*';
global.mods = [];
global.d = new Date();
global.locale = 'ar';

// Load menu image safely
let menuImg;
try {
  menuImg = fs.readFileSync('./menu.jpg');
} catch (e) {
  menuImg = Buffer.alloc(0); // fallback empty buffer
  console.warn('menu.jpg not found, using empty buffer');
}
global.imagen1 = menuImg;
global.imagen2 = menuImg;
global.imagen3 = menuImg;
global.imagen4 = menuImg;
global.dia = d.toLocaleDateString(locale, { weekday: 'long' });
global.fecha = d.toLocaleDateString(locale, { day: 'numeric', month: 'numeric', year: 'numeric' });
global.mes = d.toLocaleDateString(locale, { month: 'long' });
global.año = d.toLocaleDateString(locale, { year: 'numeric' });
global.tiempo = d.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true });
global.wm2 = `${global.dia} ${global.fecha}\n★𝓝𝓲𝓷𝓸 - 𝑩𝑶𝑻★`;
global.gt = '𝓝𝓲𝓷𝓸 - 𝑩𝑶𝑻★';
global.md = 'https://chat.whatsapp.com/BjrqiXLZKmZ3jW7vEDyV27';
global.waitt = '*⌛ _downloading..._*\n\n*▰▰▰▱▱▱▱▱*';
global.waittt = '*⌛ _downloading ..._*\n\n*▰▰▰▱▱▱▱▱*';
global.waitttt = '*⌛ _downloading..._*\n\n*▰▰▰▱▱▱▱▱*';
global.nomorown = '76337375';
global.pdoc = ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/msword', 'application/pdf', 'text/rtf'];
global.cmenut = '❖––––––『';
global.cmenub = '┊✦ ';
global.cmenuf = '╰━═┅═━––––––๑\n';
global.cmenua = '\n⌕ ❙❘❙❙❘❙❚❙❘❙❙❚❙❘❙❘❙❚❙❘❙❙❚❙❘❙❙❘❙❚❙❘ ⌕\n     ';
global.dmenut = '*❖─┅──┅〈*';
global.dmenub = '*┊»*';
global.dmenub2 = '*┊*';
global.dmenuf = '*╰┅────────┅✦*';
global.htjava = '⫹⫺';
global.htki = '*⭑•̩̩͙⊱•••• ☪*';
global.htka = '*☪ ••••̩̩͙⊰•⭑*';
global.comienzo = '• • ◕◕════';
global.fin = '════◕◕ • •';
global.botdate = `⫹⫺ Date: ${moment.tz('America/Los_Angeles').format('DD/MM/YY')}`;
global.bottime = `𝗧𝗜𝗠𝗘: ${moment.tz('America/Los_Angeles').format('HH:mm:ss')}`;
global.fgif = {
  key: { participant: '0@s.whatsapp.net' },
  message: {
    videoMessage: {
      title: global.wm,
      h: 'Hmm',
      seconds: '999999999',
      gifPlayback: 'true',
      caption: global.bottime,
      jpegThumbnail: fs.readFileSync('./menu.jpg')
    }
  }
};
global.multiplier = 99;
global.flaaa = [
  'https://flamingtext.com/net-fu/proxy_form.cgi?&imageoutput=true&script=water-logo&script=water-logo&fontsize=90&doScale=true&scaleWidth=800&scaleHeight=500&fontsize=100&fillTextColor=%23000&shadowGlowColor=%23000&backgroundColor=%23000&text=',
  'https://flamingtext.com/net-fu/proxy_form.cgi?&imageoutput=true&script=crafts-logo&fontsize=90&doScale=true&scaleWidth=800&scaleHeight=500&text=',
  'https://flamingtext.com/net-fu/proxy_form.cgi?&imageoutput=true&script=amped-logo&doScale=true&scaleWidth=800&scaleHeight=500&text=',
  'https://www6.flamingtext.com/net-fu/proxy_form.cgi?&imageoutput=true&script=sketch-name&doScale=true&scaleWidth=800&scaleHeight=500&fontsize=100&fillTextType=1&fillTextPattern=Warning!&text=',
  'https://www6.flamingtext.com/net-fu/proxy_form.cgi?&imageoutput=true&script=sketch-name&doScale=true&scaleWidth=800&scaleHeight=500&fontsize=100&fillTextType=1&fillTextPattern=Warning!&fillColor1Color=%23f2aa4c&fillColor2Color=%23f2aa4c&fillColor3Color=%23f2aa4c&fillColor4Color=%23f2aa4c&fillColor5Color=%23f2aa4c&fillColor6Color=%23f2aa4c&fillColor7Color=%23f2aa4c&fillColor8Color=%23f2aa4c&fillColor9Color=%23f2aa4c&fillColor10Color=%23f2aa4c&fillOutlineColor=%23f2aa4c&fillOutline2Color=%23f2aa4c&backgroundColor=%23101820&text='
];

// Watch for changes in the current file and update
const file = fileURLToPath(import.meta.url);
watchFile(file, () => {
  unwatchFile(file);
  console.log(chalk.redBright('Updated main.js'));
  import(`${file}?update=${Date.now()}`);
});
// config.js - Single source of truth for all bot configuration
// All bot configuration should be handled here through global variables

// Message logging configuration
global.enableMessageLogging = true; // Set to false to disable message logging
global.logMessageTypes = ['text', 'image', 'video', 'audio', 'document', 'sticker', 'contact', 'location']; // Types to log