import axios from 'axios';
import { readFile, stat } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_LIST_PATH = path.join(__dirname, '..', 'images.json');

let gameState = {};
let cachedImages = null;
let cachedImagesMtime = 0;

const NEXT_QUESTION_DELAY_MS = Number(process.env.IMAGE_GAME_NEXT_DELAY_MS || 1500);

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function isRateLimitError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.data === 429 || error?.output?.statusCode === 429 || message.includes('rate-overlimit') || message.includes('rate limit');
}

async function safeReply(m, text) {
  try {
    return await m.reply(text);
  } catch (error) {
    if (isRateLimitError(error)) {
      console.warn('Skipping image-game error reply because WhatsApp is rate limiting sends.');
      return null;
    }
    throw error;
  }
}

function normalizeAnswer(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

async function loadImages() {
  const fileStat = await stat(IMAGE_LIST_PATH);
  if (cachedImages && cachedImagesMtime === fileStat.mtimeMs) {
    return cachedImages;
  }

  const raw = await readFile(IMAGE_LIST_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('images.json must be an object of imageUrl: answer.');
  }

  cachedImages = Object.entries(data).filter(([url, answer]) => {
    return typeof url === 'string' && url.startsWith('http') && answer;
  });
  cachedImagesMtime = fileStat.mtimeMs;
  return cachedImages;
}

let handler = async (m, { conn, command }) => {
  const chat = m.chat;

  if (command === 'سص') {
    if (!gameState[chat]?.active) {
      return m.reply('ما في لعبة شغالة.');
    }

    gameState[chat] = { active: false };
    return m.reply('وقفنا لعبة الصور.');
  }

  if (command === 'مص') {
    if (gameState[chat]?.active) {
      return m.reply('لعبة الصور شغالة بالفعل.');
    }

    return sendQuestion(m, conn, chat);
  }
};

async function sendQuestion(m, conn, chat) {
  try {
    const entries = await loadImages();
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
    if (!contentType.startsWith('image/')) {
      throw new Error(`Not an image (${contentType}).`);
    }

    const imageBuffer = Buffer.from(imageResponse.data);
    await conn.sendMessage(chat, {
      image: imageBuffer,
      mimetype: contentType,
      caption: 'من هذا؟'
    }, { quoted: m });

    const answers = Array.isArray(rawAnswer) ? rawAnswer : [rawAnswer];
    gameState[chat] = {
      active: true,
      locked: false,
      answers: answers.map(normalizeAnswer).filter(Boolean),
      questionStartTime: Date.now()
    };
  } catch (error) {
    console.error('Image fetch/send error:', error.message);
    if (!isRateLimitError(error)) {
      await safeReply(m, 'فشلت أرسل الصورة، تأكد من images.json أو رابط الصورة.');
    }
  }
}

handler.all = async function(m) {
  const chat = m.chat;
  const state = gameState[chat];
  if (!state?.active || state.locked) return;
  if (m.isBaileys || !m.text) return;
  if (/^\.(مص|سص)$/i.test(m.text.trim())) return;

  const userAnswer = normalizeAnswer(m.text);
  if (!userAnswer || !state.answers.includes(userAnswer)) return;

  state.locked = true;
  const elapsed = ((Date.now() - state.questionStartTime) / 1000).toFixed(2);
  await m.reply(`✅ ${m.pushName || 'مشارك'} أجاب صح! ⚡ ${elapsed} ثانية`);
  await delay(NEXT_QUESTION_DELAY_MS);
  await sendQuestion(m, this, chat);
};

handler.help = ['مص', 'سص'];
handler.tags = ['game'];
handler.command = /^(مص|سص)$/i;

export default handler;
