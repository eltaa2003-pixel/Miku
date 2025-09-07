// plugins/language.js
import fs from 'fs';

const handler = async (m, { args }) => {
  // List available languages by scanning the language folder
  const available = fs
    .readdirSync('./language')
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));

  // If no argument was provided, show the list of supported languages
  if (!args[0]) {
    return m.reply(
      '🌐 Available languages: ' +
      available.map(lang => `\`${lang}\``).join(', ') +
      '\nUse `.language <code>` to set your preferred language.'
    );
  }

  const lang = args[0].toLowerCase();
  if (!available.includes(lang)) {
    return m.reply(
      `❌ Language \`${lang}\` is not supported.\n` +
      'Supported languages: ' +
      available.join(', ')
    );
  }

  // Ensure user data exists
  global.db.data.users[m.sender] = global.db.data.users[m.sender] || {};
  // Save the user’s chosen language
  global.db.data.users[m.sender].language = lang;
  m.reply(`✅ Language updated to \`${lang}\`.  All future responses will be in this language.`);
};

handler.help = ['language <lang>'];
handler.tags = ['settings'];
handler.command = /^language$/i; // triggers on ".language"
handler.group = false; // can be used in any chat

export default handler;