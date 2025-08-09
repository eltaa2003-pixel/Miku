import { makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';

console.log('Before auth state');
const { state, saveCreds } = await useMultiFileAuthState('./MyninoSession');
console.log('After auth state');

const sock = makeWASocket({
  printQRInTerminal: true,
  logger: pino({ level: 'info' }),
  auth: state
});

console.log('After makeWASocket');

sock.ev.on('connection.update', (update) => {
  console.log('connection.update event:', update);
});
sock.ev.on('creds.update', saveCreds);
console.log('After registering event handlers'); 