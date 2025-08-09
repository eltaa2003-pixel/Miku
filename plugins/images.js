import axios from 'axios';

// Removed cooldown logic

let handler = async (m, { conn }) => {
  // Cooldown removed

  try {
    // Send loading message
    // const loadingMsg = await conn.sendMessage(m.chat, { text: '🔍 جاري البحث عن صورة...' });

    // Optimized axios request with timeout and compression
    const response = await axios.get(`https://raw.githubusercontent.com/Seiyra/imagesfjsfasfa/refs/heads/main/okay.js`, {
      timeout: 5000, // 5 second timeout
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

    // Get random image URL
    let url = res[Math.floor(Math.random() * res.length)];

    // Delete loading message
    // await conn.sendMessage(m.chat, { delete: loadingMsg.key });

    // Send image with optimized settings
    await conn.sendFile(m.chat, url, 'image.jpg', '', m, false, {
      asDocument: false,
      mimetype: 'image/jpeg'
    });

  } catch (error) {
    console.error('Image fetch error:', error.message);
    
    // Delete loading message if it exists
    try {
      // if (loadingMsg) { // loadingMsg is removed
      //   await conn.sendMessage(m.chat, { delete: loadingMsg.key });
      // }
    } catch (e) {}

    // Send appropriate error message
    let errorMsg = '❌ فشل في جلب الصورة. ';
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorMsg += 'انتهت مهلة الاتصال.';
    } else if (error.message.includes('Network Error')) {
      errorMsg += 'خطأ في الشبكة.';
    } else {
      errorMsg += 'يرجى المحاولة مرة أخرى.';
    }

    await conn.sendMessage(m.chat, { conversation: errorMsg });
  }
};

handler.help = ['messi'];
handler.tags = ['img'];
handler.command = /^(ص)$/i;

export default handler;
