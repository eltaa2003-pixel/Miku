import axios from 'axios';

let handler = async (m, { conn }) => {
  try {
    const response = await axios.get(`https://raw.githubusercontent.com/Seiyra/imagesfjsfasfa/refs/heads/main/okay.js`, {
      timeout: 5000,
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)'
      }
    });

    let res = response.data;

    if (!Array.isArray(res)) {
      throw new Error('Response is not an array.');
    }

    if (res.length === 0) {
      throw new Error('No images available.');
    }

    let url = res[Math.floor(Math.random() * res.length)];
    
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      throw new Error('Invalid image URL format');
    }

    try {
      await conn.sendFile(m.chat, url, 'image.jpg', '', m, false, {
        asDocument: false,
        mimetype: 'image/jpeg'
      });
    } catch (sendError) {
      console.log('Send error:', sendError.message);
      await m.reply('🖼️ صورة:\n' + url);
    }

  } catch (error) {
    console.error('Image fetch error:', error.message);
    
    let errorMsg = '❌ فشل في جلب الصورة. ';
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      errorMsg += 'انتهت مهلة الاتصال.';
    } else if (error.message?.includes('Network Error')) {
      errorMsg += 'خطأ في الشبكة.';
    } else {
      errorMsg += 'يرجى المحاولة مرة أخرى.';
    }

    await m.reply(errorMsg);
  }
};

handler.help = ['messi'];
handler.tags = ['img'];
handler.command = /^(ص)$/i;

export default handler;