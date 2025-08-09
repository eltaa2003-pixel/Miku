import Jimp from 'jimp';

const handler = async (m, { conn }) => {
  let q = m.quoted ? m.quoted : m;
  let mime = (q.msg || q).mimetype || '';
  if (!mime.startsWith('image/')) return m.reply('❌ أرسل صورة أو رد على صورة لاستخدام إزالة الضبابية.');

  m.reply('⏳ جارٍ معالجة الصورة محلياً...');

  try {
    const buffer = await q.download();
    const image = await Jimp.read(buffer);

    // Simulate dehaze: increase contrast, brightness, normalize, and sharpen
    image
      .contrast(0.25)      // Increase contrast
      .brightness(0.1)     // Slightly brighten
      .normalize()         // Normalize histogram
      .quality(90);        // Keep good quality

    // Apply a sharpen convolution kernel
    image.convolute([
      [ 0, -1,  0 ],
      [-1,  5, -1 ],
      [ 0, -1,  0 ]
    ]);

    const out = await image.getBufferAsync(Jimp.MIME_JPEG);
    await conn.sendFile(m.chat, out, 'dehazed.jpg', '✅ تمت معالجة الصورة محلياً!', m);
  } catch (e) {
    await m.reply('❌ حدث خطأ أثناء معالجة الصورة.');
  }
};

handler.help = ['dehaze (إزالة الضبابية من صورة، أرسل صورة أو رد على صورة)'];
handler.tags = ['tools', 'ai', 'image'];
handler.command = /^dehaze|dehazeimg|dehazeimage|ضبابية$/i;

export default handler; 