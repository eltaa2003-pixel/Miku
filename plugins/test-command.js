const handler = async (m, { conn, text, usedPrefix, command }) => {
  console.log('🧪 TEST COMMAND TRIGGERED! 🧪');
  console.log('Command:', command);
  console.log('Text:', text);
  console.log('Group:', m.chat);
  console.log('Sender:', m.sender);
  
  await m.reply('✅ Test command is working! Handler system is functional.');
};

handler.help = ['test'];
handler.tags = ['test'];
handler.command = /^test$/i;

export default handler; 