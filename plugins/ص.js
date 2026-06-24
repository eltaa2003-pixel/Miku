import axios from 'axios';

const IMAGE_LIST_URL = 'https://raw.githubusercontent.com/eltaa2003-pixel/Miku/main/images.json';
let gameState = {};

let handler = async (m, { conn }) => {
  const chat = m.chat;
  const cmd = m.text?.trim();

  // STOP
  if (/^\.سص$/.test(cmd)) {
    if (!gameState[chat] || !gameState[chat].active) {
      return m.reply(' ما في لعبة شغالة.');
    }
    gameState[chat] = { active: false };
    return m.reply('وقفنا');
  }

  // START
  if (/^\.مص$/.test(cmd)) {
    if (gameState[chat]?.active) {
      return m.reply(' اللعبة شغالة .');
    }
    return await sendQuestion(m, conn, chat);
  }
};

async function sendQuestion(m, conn, chat) {
  try {
    const response = await axios.get(IMAGE_LIST_URL, {
      timeout: 5000,
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)'
      }
    });

    const data = response.data;
    if (typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid format.');

    const entries = Object.entries(data);
    if (entries.length === 0) throw new Error('No images available.');

    const [url, rawAnswer] = entries[Math.floor(Math.random() * entries.length)];

    const imageResponse = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)'
      }
    });

    const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
    if (!contentType.startsWith('image/')) throw new Error(`Not an image (${contentType}).`);

    const imageBuffer = Buffer.from(imageResponse.data);
    await conn.sendMessage(chat, {
      image: imageBuffer,
      mimetype: contentType,
      caption: ''
    }, { quoted: m });

    gameState[chat] = {
      active: true,
      answer: rawAnswer,
      questionStartTime: Date.now()
    };


  } catch (error) {
    console.error('Image fetch/send error:', error.message);
    await m.reply(' فشلتك يا ايلتا اعذرني لا تمحيني بليز');
  }
}

handler.all = async function (m) {
  const chat = m.chat;
  if (!gameState[chat]?.active) return;
  if (gameState[chat]?.locked) return;
  if (m.isBaileys) return;
  if (!m.text) return;
  if (/^\.(مص|سص)$/.test(m.text.trim())) return;

  const userAnswer = m.text.trim().toLowerCase();
  const rawAnswer = gameState[chat].answer;
  if (!rawAnswer) return;
  const answers = Array.isArray(rawAnswer)
    ? rawAnswer.map(a => a.toLowerCase())
    : [rawAnswer.toLowerCase()];

  if (answers.includes(userAnswer)) {
    gameState[chat].locked = true;
    const elapsed = ((Date.now() - gameState[chat].questionStartTime) / 1000).toFixed(2);
    await m.reply(`✅ ${m.pushName} أجاب صح! ⚡ ${elapsed} ثانية`);
    await sendQuestion(m, this, chat);
  }
};

handler.help = ['مص', 'سص'];
handler.tags = ['game'];
handler.command = /^(مص|سص)$/i;

export default handler;