let handler = async (_0x3631d4, { conn }) => {
    // Extract all owner information from global.owner
    let ownerList = global.owner.map(([number, name]) => `👤 مالك البوت: ${name}\n📞 رقم الهاتف: ${number}`).join('\n\n');
    _0x3631d4.sendMessage(ownerList);
};

handler.help = ['owner'];
handler.tags = ['info'];
handler.command = ['owner'];

export default handler;
  