import axios from 'axios';

const IMAGE_LIST_URL = 'https://raw.githubusercontent.com/Seiyra/imagesfjsfasfa/refs/heads/main/okay.js';

let handler = async (m, { conn }) => {
  try {
    const response = await axios.get(IMAGE_LIST_URL, {
      timeout: 5000,
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)'
      }
    });

    const images = response.data;
    if (!Array.isArray(images)) {
      throw new Error('Response is not an array.');
    }

    if (images.length === 0) {
      throw new Error('No images available.');
    }

    const url = images[Math.floor(Math.random() * images.length)];
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      throw new Error('Invalid image URL format.');
    }

    const imageResponse = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)'
      }
    });

    const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      throw new Error(`URL did not return an image (${contentType}).`);
    }

    await conn.sendMessage(
      m.chat,
      {
        image: Buffer.from(imageResponse.data),
        mimetype: contentType,
        caption: ''
      },
      { quoted: m }
    );
  } catch (error) {
    console.error('Image fetch/send error:', error.message);
    await m.reply('❌ فشل في جلب الصورة. يرجى المحاولة مرة أخرى.');
  }
};

handler.help = ['ص'];
handler.tags = ['img'];
handler.command = /^(ص)$/i;

export default handler;
