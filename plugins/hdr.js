import FormData from "form-data";
import Jimp from "jimp";
import axios from "axios";
import fs from "fs";

const handler = async (m, {conn, usedPrefix, command}) => {
  const datas = global
  const idioma = datas.db.data.users[m.sender]?.language || global.defaultLenguaje || 'en'
  const _translate = JSON.parse(fs.readFileSync(`./language/${idioma}.json`))
  const tradutor = _translate.plugins.herramientas_hd

 try {    
  let q = m.quoted ? m.quoted : m;
  let mime = (q.msg || q).mimetype || q.mediaType || "";
  if (!mime) throw `${tradutor.texto1} ${usedPrefix + command}*`;
  if (!/image\/(jpe?g|png)/.test(mime)) throw `${tradutor.texto2[0]} (${mime}) ${tradutor.texto2[1]}`;
  
  m.reply(tradutor.texto3);
  let img = await q.download?.();
  
  // Optimize image size for faster processing while preserving aspect ratio
  const image = await Jimp.read(img);
  const maxSize = 1024;
  let optimized;
  
  if (image.getWidth() > image.getHeight()) {
    // Landscape image
    optimized = image.resize(maxSize, Jimp.AUTO, Jimp.RESIZE_BILINEAR).quality(90);
  } else {
    // Portrait or square image
    optimized = image.resize(Jimp.AUTO, maxSize, Jimp.RESIZE_BILINEAR).quality(90);
  }
  
  const optimizedBuffer = await optimized.getBufferAsync(Jimp.MIME_JPEG);
  
  // Send initial progress message
  const progressMsg = await m.reply("🔄 بدا التحسين...\n▱▱▱▱▱▱▱▱▱▱ 0%");
  
  let progress = 0;
  let lastUpdate = 0;
  const progressInterval = setInterval(async () => {
    try {
      progress += Math.random() * 10 + 5; // Slower progress increment
      if (progress > 85) progress = 85; // Don't reach 100% until actually done
      
      const filledBlocks = Math.floor(progress / 10);
      const emptyBlocks = 10 - filledBlocks;
      const progressBar = "▰".repeat(filledBlocks) + "▱".repeat(emptyBlocks);
      
      // Only update every 3 seconds to avoid rate limiting
      const now = Date.now();
      if (now - lastUpdate > 3000) {
        await conn.sendMessage(m.chat, {
          text: `🔄 جاري التحسين...\n${progressBar} ${Math.floor(progress)}%`,
          edit: progressMsg.key
        });
        lastUpdate = now;
      }
    } catch (e) {
      // Ignore edit errors and stop interval
      clearInterval(progressInterval);
    }
  }, 3000); // Changed from 1000ms to 3000ms
  
  try {
    let pr = await ihancer(optimizedBuffer, { method: 1, size: 'high' });
    clearInterval(progressInterval);
    
    // Show 100% completion
    try {
      await conn.sendMessage(m.chat, {
        text: "✅ تم التحسين!\n▰▰▰▰▰▰▰▰▰▰ 100%",
        edit: progressMsg.key
      });
    } catch (editError) {
      // If edit fails, send new message
      await m.reply("✅ تم التحسين!");
    }
    
    await conn.sendMessage(m.chat, {image: pr}, {quoted: m});
  } catch (error) {
    clearInterval(progressInterval);
    
    // Send error message
    try {
      await conn.sendMessage(m.chat, {
        text: "*[❗] ERROR, PLEASE CHECK THE INPUT FILE*",
        edit: progressMsg.key
      });
    } catch (editError) {
      await m.reply("*[❗] ERROR, PLEASE CHECK THE INPUT FILE*");
    }
    
    throw error;
  }
 } catch (error) {
  console.error('HDR Enhancement Error:', error);
  await m.reply(tradutor.texto4);
 }
};
handler.help = ["remini", "hd", "enhance"];
handler.tags = ["ai", "tools"];
handler.command = ["remini", "hd", "تحسين"];
export default handler;

async function ihancer(buffer, { method = 1, size = 'medium' } = {}) {
  try {
    const _size = ['low', 'medium', 'high'];
    
    if (!buffer || !Buffer.isBuffer(buffer)) throw new Error('Image buffer is required');
    if (method < 1 || method > 4) throw new Error('Available methods: 1, 2, 3, 4');
    if (!_size.includes(size)) throw new Error(`Available sizes: ${_size.join(', ')}`);
    
    const form = new FormData();
    form.append('method', method.toString());
    form.append('is_pro_version', 'false');
    form.append('is_enhancing_more', 'false');
    form.append('max_image_size', size);
    form.append('file', buffer, `enhance_${Date.now()}.jpg`);
    
    const { data } = await axios.post('https://ihancer.com/api/enhance', form, {
      headers: {
        ...form.getHeaders(),
        'accept-encoding': 'gzip',
        host: 'ihancer.com',
        'user-agent': 'Dart/3.5 (dart:io)'
      },
      responseType: 'arraybuffer',
      timeout: 60000, // 60 second timeout
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        console.log(`Upload Progress: ${percentCompleted}%`);
      }
    });
    
    return Buffer.from(data);
  } catch (error) {
    throw new Error(error.message);
  }
}