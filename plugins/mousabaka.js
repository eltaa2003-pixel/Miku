import fs   from 'fs';
import axios from 'axios';
import { cleanAnswerText, isExactCommand } from '../lib/answerCleaner.js';
import { prepareWhatsAppImage } from '../lib/whatsappImage.js';

const DATA_PATH      = './plugins/game-data.json';
const IMAGE_LIST_URL = 'https://raw.githubusercontent.com/eltaa2003-pixel/Miku/main/images.json';

global.mousabakaBotSettings = global.mousabakaBotSettings || {};
const BOT_JID = 'يوت@e.whatsapp.net';

let _gameData = {};

const loadGameData = () => {
  try {
    _gameData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch (err) {
    console.error('[مسابقة] Failed to load game-data.json:', err.message);
    _gameData = {};
  }
};

loadGameData();

const getSinglePool = () => _gameData['single_answer'] || [];
const getMultiPool  = () => _gameData['multi_answer']  || [];
const getNamesPool  = () => _gameData['names_pool']    || [];

function getBotConfig(chatId) {
  global.mousabakaBotSettings = global.mousabakaBotSettings || {};
  return global.mousabakaBotSettings[chatId] || { enabled: false, difficulty: 'medium' };
}

function setBotConfig(chatId, config) {
  global.mousabakaBotSettings = global.mousabakaBotSettings || {};
  const current = getBotConfig(chatId);
  global.mousabakaBotSettings[chatId] = {
    enabled:    typeof config.enabled === 'boolean' ? config.enabled : current.enabled,
    difficulty: config.difficulty || current.difficulty,
  };
  return global.mousabakaBotSettings[chatId];
}

global.mousabakaBotHelpers = global.mousabakaBotHelpers || {};
Object.assign(global.mousabakaBotHelpers, {
  getBotConfig,
  setBotConfig,
  getComp,
  scheduleBotAnswerForChat: (chatId, conn) => {
    const comp = getComp(chatId);
    if (comp) scheduleBotAnswer(comp, chatId, conn);
  },
});

// ─── Constants ───────────────────────────────────────────────────────────────

const MODES         = ['SINGLE', 'MULTI', 'NAMES', 'IMAGE'];
const PHASE_TRIGGER = [5, 10, 15];

const NAME_COUNT_TABLE = [
  { count: 2, weight: 35 },
  { count: 3, weight: 40 },
  { count: 4, weight: 15 },
  { count: 5, weight: 10 / 3 },
  { count: 6, weight: 10 / 3 },
  { count: 7, weight: 10 / 3 },
];

function pickNameCount() {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const { count, weight } of NAME_COUNT_TABLE) {
    cumulative += weight;
    if (roll < cumulative) return count;
  }
  return 3;
}

// ─── Text normalization ───────────────────────────────────────────────────────

const normalizeForMatching = (text) => {
  if (typeof text !== 'string') return '';
  return text.trim().toLowerCase().replace(/[جغق]/g, 'g').replace(/\s+/g, ' ');
};

const extractPossibleAnswers = (text) => {
  const parts = text
    .split(/[،,\s\/\\|&+\-]/)
    .map(p => normalizeForMatching(p))
    .filter(p => p.length > 0);
  return [...new Set(parts)];
};

const extractPossibleAnswersFull = (text) => {
  const parts = extractPossibleAnswers(text);
  const full  = normalizeForMatching(text);
  return [...new Set([full, ...parts])];
};

const deduplicateAnswers = (questions) =>
  questions.map(q => {
    const seen = new Map();
    for (const ans of q.answers) {
      const key = normalizeForMatching(ans);
      if (!seen.has(key)) seen.set(key, ans);
    }
    return { ...q, answers: [...seen.values()] };
  });

function normalizeArabicText(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

function arabicToEnglish(str) {
  return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function formatElapsed(ms) {
  if (!ms || ms <= 0) return '0s';
  if (ms < 1000) return `${ms}ms`;
  const secs = (ms / 1000).toFixed(2);
  return `${secs}s`;
}

function updateTimeStats(comp, jid, elapsedMs) {
  if (!comp.timeStats[jid]) {
    comp.timeStats[jid] = { best: Infinity, total: 0, count: 0 };
  }
  const stats = comp.timeStats[jid];
  stats.count += 1;
  stats.total += elapsedMs;
  if (elapsedMs < stats.best) stats.best = elapsedMs;
}

function getTimeBadge(jid, comp) {
  const stats = comp.timeStats[jid];
  if (!stats || !stats.count) return '';
  const avg = Math.round(stats.total / stats.count);
  return ` ⏱️ ${formatElapsed(stats.best)} (م: ${formatElapsed(avg)})`;
}

// ─── Chat state ────────────────────────────────────────────────────────────────

let compStates = {};

function getComp(chatId) {
  return compStates[chatId] || null;
}

function createComp(chatId, targetScore, options = {}) {
  const order = [...MODES].sort(() => Math.random() - 0.5);
  const botConfig = getBotConfig(chatId);
  const botEnabled = typeof options.botEnabled === 'boolean' ? options.botEnabled : botConfig.enabled;
  const botDifficulty = options.botDifficulty || botConfig.difficulty;

  compStates[chatId] = {
    active:          true,
    targetScore,
    phaseOrder:      order,
    currentPhase:    0,
    scores:          {},
    phasesTriggered: new Set(),
    roundMode:       order[0],
    roundLocked:     false,
    roundStartTime:  0,
    single:          null,
    multi:           null,
    names:           null,
    image:           null,
    lastMsg:         {},
    botEnabled,
    botDifficulty,
    botTimer:        null,
    timeStats:       {},
  };
  return compStates[chatId];
}

function destroyComp(chatId) {
  if (compStates[chatId]) {
    if (compStates[chatId].botTimer) clearTimeout(compStates[chatId].botTimer);
    compStates[chatId].active = false;
  }
  delete compStates[chatId];
  _sendQueues.delete(chatId);
}

// ─── Spam filter ──────────────────────────────────────────────────────────────

function isSpam(text) {
  if (!text || typeof text !== 'string') return true;
  const t = text.trim();
  if (t.length < 2) return true;
  if (!/[\p{L}]/u.test(t)) return true;
  return false;
}

function isRapidDupe(comp, jid, text) {
  const last = comp.lastMsg[jid];
  if (!last) return false;
  return last.text === text.trim() && (Date.now() - last.time) < 1500;
}

function recordMsg(comp, jid, text) {
  comp.lastMsg[jid] = { text: text.trim(), time: Date.now() };
}

// ─── Scoreboard ───────────────────────────────────────────────────────────────

function buildBoard(scores) {
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([jid, pts]) => {
      const name = jid.includes('@e.whatsapp.net') ? '🤖 يوت' : `@${jid.split('@')[0]}`;
      return `${name} — ${pts} نقطة`;
    })
    .join('\n');
}

function boardMentions(scores) {
  return Object.keys(scores);
}

function topScore(scores) {
  return Math.max(0, ...Object.values(scores));
}

// ─── Phase management ─────────────────────────────────────────────────────────

function targetPhase(highScore) {
  if (highScore >= PHASE_TRIGGER[2]) return 3;
  if (highScore >= PHASE_TRIGGER[1]) return 2;
  if (highScore >= PHASE_TRIGGER[0]) return 1;
  return 0;
}

const PHASE_NAMES = ['المرحلة الأولى', 'المرحلة الثانية', 'المرحلة الثالثة', 'المرحلة الرابعة'];
const MODE_LABELS = {
  SINGLE: 'س',
  MULTI:  'تع',
  NAMES:  'أسماء',
  IMAGE:  'صورة',
};

// ─── Question helpers ─────────────────────────────────────────────────────────

function pickSingleQuestion() {
  const pool = deduplicateAnswers(getSinglePool());
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickMultiQuestion() {
  const pool = deduplicateAnswers(getMultiPool());
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickNames() {
  const pool  = getNamesPool();
  if (!pool.length) return [];
  const count = Math.min(pickNameCount(), pool.length);
  const used  = new Set();
  const out   = [];
  while (out.length < count) {
    const idx = Math.floor(Math.random() * pool.length);
    if (!used.has(idx)) { used.add(idx); out.push(pool[idx]); }
  }
  return out;
}

// ─── Round posting ────────────────────────────────────────────────────────────

async function postNextRound(comp, chatId, conn, m) {
  if (!comp.active) return;
  comp.roundLocked = true;

  if (comp.botTimer) {
    clearTimeout(comp.botTimer);
    comp.botTimer = null;
  }

  const mode = comp.phaseOrder[comp.currentPhase];
  comp.roundMode = mode;

  comp.single = null;
  comp.multi  = null;
  comp.names  = null;
  comp.image  = null;

  try {
    if (mode === 'SINGLE') {
      const q = pickSingleQuestion();
      if (!q) { await conn.sendMessage(chatId, { text: '⚠️ نفدت أسئلة الإجابة الواحدة.' }); return; }
      comp.single = {
        question:   q.question,
        answers:    q.answers.map(a => normalizeForMatching(a)),
        answeredBy: null,
      };
      const sent = await conn.sendMessage(chatId, { text: `س/\n*${q.question}*` });
      comp.roundStartTime = (sent.messageTimestamp || Date.now()) * 1000;

    } else if (mode === 'MULTI') {
      const q = pickMultiQuestion();
      if (!q) { await conn.sendMessage(chatId, { text: '⚠️ نفدت أسئلة الإجابات المتعددة.' }); return; }
      comp.multi = {
        question:   q.question,
        answers:    q.answers.map(a => normalizeForMatching(a)),
        playerSets: {},
        answeredBy: null,
      };
      const sent = await conn.sendMessage(chatId, { text: `تع/3\n*${q.question}*` });
      comp.roundStartTime = (sent.messageTimestamp || Date.now()) * 1000;

    } else if (mode === 'NAMES') {
      const names = pickNames();
      if (!names.length) { await conn.sendMessage(chatId, { text: '⚠️ نفد قاموس الأسماء.' }); return; }
      comp.names = {
        currentNames:   names,
        playerProgress: {},
        answeredBy:     null,
      };
      const sent = await conn.sendMessage(chatId, { text: names.join('  |  ') });
      comp.roundStartTime = (sent.messageTimestamp || Date.now()) * 1000;

    } else if (mode === 'IMAGE') {
      try {
        const listRes = await axios.get(IMAGE_LIST_URL, { timeout: 5000 });
        const entries = Object.entries(listRes.data);
        if (!entries.length) throw new Error('empty');
        const [url, rawAnswer] = entries[Math.floor(Math.random() * entries.length)];
        const imgRes = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
        const contentType = imgRes.headers['content-type'] || 'image/jpeg';
        if (!contentType.startsWith('image/')) {
          throw new Error(`Not an image (${contentType}).`);
        }
        const buffer = Buffer.from(imgRes.data);
        const preparedImage = await prepareWhatsAppImage(buffer);
        comp.image = {
          answer:     Array.isArray(rawAnswer)
                        ? rawAnswer.map(a => a.toLowerCase())
                        : [rawAnswer.toLowerCase()],
          answeredBy: null,
        };
        const sent = await conn.sendMessage(chatId, {
          ...preparedImage,
          caption:  '',
        });
        comp.roundStartTime = (sent.messageTimestamp || Date.now()) * 1000;
      } catch (err) {
        await conn.sendMessage(chatId, { text: '⚠️ فشل تحميل الصورة.' });
        return;
      }
    }
  } finally {
    comp.roundLocked = false;
    scheduleBotAnswer(comp, chatId, conn);
  }
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isRoundDecided(comp) {
  const mode = comp.roundMode;
  if (mode === 'SINGLE') return comp.single && comp.single.answeredBy;
  if (mode === 'MULTI')  return comp.multi  && comp.multi.answeredBy;
  if (mode === 'NAMES')  return comp.names  && comp.names.answeredBy;
  if (mode === 'IMAGE')  return comp.image  && comp.image.answeredBy;
  return true;
}

function scheduleBotAnswer(comp, chatId, conn) {
  if (!comp.active || !comp.botEnabled) return;
  if (isRoundDecided(comp)) return;
  const difficulty = comp.botDifficulty || 'medium';
  const delays = {
    easy:   randomBetween(8500, 12000),
    medium: randomBetween(4200, 7800),
    hard:   randomBetween(1300, 3200),
  };
  const delay = delays[difficulty] || delays.medium;

  if (comp.botTimer) clearTimeout(comp.botTimer);
  comp.botTimer = setTimeout(async () => {
    comp.botTimer = null;
    try {
      if (!comp.active || comp.roundLocked || isRoundDecided(comp)) return;
      const mode = comp.roundMode;

      if (mode === 'SINGLE' && comp.single && !comp.single.answeredBy) {
        const answer = comp.single.answers[Math.floor(Math.random() * comp.single.answers.length)];
        await conn.sendMessage(chatId, { text: `🤖 يوت: ${answer}` });
        if (!comp.single.answeredBy) {
          comp.single.answeredBy = BOT_JID;
          await awardPoint(comp, chatId, conn, BOT_JID);
        }
      }

      if (mode === 'MULTI' && comp.multi && !comp.multi.answeredBy) {
        const answers = [...new Set(comp.multi.answers)].slice(0, 3);
        if (!answers.length) return;
        await conn.sendMessage(chatId, { text: `🤖 يوت: ${answers.join(' ، ')}` });
        if (!comp.multi.answeredBy) {
          comp.multi.answeredBy = BOT_JID;
          await awardPoint(comp, chatId, conn, BOT_JID);
        }
      }

      if (mode === 'NAMES' && comp.names && !comp.names.answeredBy) {
        await conn.sendMessage(chatId, { text: `🤖 يوت: ${comp.names.currentNames.join(' ، ')}` });
        if (!comp.names.answeredBy) {
          comp.names.answeredBy = BOT_JID;
          await awardPoint(comp, chatId, conn, BOT_JID);
        }
      }

      if (mode === 'IMAGE' && comp.image && !comp.image.answeredBy) {
        const answer = comp.image.answer[0];
        await conn.sendMessage(chatId, { text: `🤖 يوت: ${answer}` });
        if (!comp.image.answeredBy) {
          comp.image.answeredBy = BOT_JID;
          await awardPoint(comp, chatId, conn, BOT_JID);
        }
      }

    } catch (err) {
      console.error('[مسابقة] AI answer error:', err);
    }
  }, delay);
}

// ─── Award point ──────────────────────────────────────────────────────────────

async function awardPoint(comp, chatId, conn, winnerJid, winnerMsg, winnerElapsed = 0) {
  if (!comp.active) return;
  if (comp.roundLocked) return;
  comp.roundLocked = true;

  comp.scores[winnerJid] = (comp.scores[winnerJid] || 0) + 1;
  const newScore = comp.scores[winnerJid];
  const board    = buildBoard(comp.scores);
  const mentions = boardMentions(comp.scores);
  const high     = topScore(comp.scores);

  if (newScore >= comp.targetScore) {
    const num = winnerJid.split('@')[0];
    destroyComp(chatId);
    const timeText  = winnerElapsed ? `\n⏱️ ${formatElapsed(winnerElapsed)}` : '';
    const timeStats = comp.timeStats[winnerJid];
    const statsText = timeStats
      ? `\n📊 أفضل: ${formatElapsed(timeStats.best)} (م: ${formatElapsed(Math.round(timeStats.total / timeStats.count))})`
      : '';
    await conn.sendMessage(chatId, {
      text: `🏆 *@${num} فاز بـ ${newScore} فنش!*\n\n${board}${timeText}${statsText}`,
      mentions: [...new Set([...mentions, winnerJid])],
    }, { quoted: winnerMsg });
    return;
  }

  const displayName    = winnerJid.includes('@e.whatsapp.net') ? '🤖 يوت' : `@${winnerJid.split('@')[0]}`;
  const mentionsForMsg = winnerJid.includes('@e.whatsapp.net') ? [] : [winnerJid];
  const timeLine       = winnerElapsed ? ` ⏱️ ${formatElapsed(winnerElapsed)}` : '';
  const timeBadge      = winnerElapsed ? getTimeBadge(winnerJid, comp) : '';
  await safeSend(conn, chatId, {
    text: `✅ ${displayName} +1${timeLine}${timeBadge}\n\n${board}`,
    mentions: mentionsForMsg,
  }, { quoted: winnerMsg });

  const needed = targetPhase(high);
  if (needed > comp.currentPhase) {
    comp.currentPhase = needed;
    const mode  = comp.phaseOrder[comp.currentPhase];
    const label = PHASE_NAMES[comp.currentPhase];
    const mlab  = MODE_LABELS[mode];
    await delay(600);
    await safeSend(conn, chatId, { text: `*${label}* — ${mlab}` });
    await delay(800);
  } else {
    await delay(600);
  }

  await postNextRound(comp, chatId, conn, winnerMsg);
}

// ─── Answer checkers ──────────────────────────────────────────────────────────

async function checkSingle(comp, chatId, conn, m) {
  if (!comp.single || comp.single.answeredBy) return;
  const userAnswers = extractPossibleAnswersFull(cleanAnswerText(m.text));
  const matched     = userAnswers.find(ua => comp.single.answers.includes(ua));
  if (!matched) return;

  const elapsed = (m.messageTimestamp * 1000) - comp.roundStartTime;
  updateTimeStats(comp, m.sender, elapsed);

  comp.single.answeredBy = m.sender;
  await awardPoint(comp, chatId, conn, m.sender, m, elapsed);
}

async function checkMulti(comp, chatId, conn, m) {
  if (!comp.multi || comp.multi.answeredBy) return;
  const jid         = m.sender;
  const userAnswers = extractPossibleAnswers(cleanAnswerText(m.text));

  if (!comp.multi.playerSets[jid]) comp.multi.playerSets[jid] = new Set();
  const playerSet = comp.multi.playerSets[jid];

  let foundNew = false;
  for (const ua of userAnswers) {
    if (comp.multi.answers.includes(ua)) {
      playerSet.add(ua);
      foundNew = true;
    }
  }

  if (!foundNew) return;

  const elapsed = (m.messageTimestamp * 1000) - comp.roundStartTime;
  updateTimeStats(comp, jid, elapsed);

  if (playerSet.size >= 3) {
    comp.multi.answeredBy = jid;
    await awardPoint(comp, chatId, conn, jid, m, elapsed);
    return;
  }

  const displayName = jid.includes('@e.whatsapp.net') ? '🤖 يوت' : `@${jid.split('@')[0]}`;
  await conn.sendMessage(chatId, {
    text: `✅ ${displayName} (${playerSet.size}/3)`,
    mentions: [jid],
  });
}

async function checkNames(comp, chatId, conn, m) {
  if (!comp.names || comp.names.answeredBy) return;
  const jid   = m.sender;
  const input = cleanAnswerText(m.text);

  const { foundNewMatches, hasAllNames } = checkNamesProgress(
    input,
    comp.names.currentNames,
    comp.names.playerProgress,
    jid
  );

  if (!foundNewMatches) return;

  const elapsed = (m.messageTimestamp * 1000) - comp.roundStartTime;
  updateTimeStats(comp, jid, elapsed);

  if (hasAllNames) {
    comp.names.answeredBy = jid;
    await awardPoint(comp, chatId, conn, jid, m, elapsed);
    return;
  }

  const displayName = jid.includes('@e.whatsapp.net') ? '🤖 يوت' : `@${jid.split('@')[0]}`;
  const progress    = comp.names.playerProgress[jid];
  const found       = progress ? progress.size : 0;
  const total       = comp.names.currentNames.length;
  await conn.sendMessage(chatId, {
    text: `✅ ${displayName} (${found}/${total})`,
    mentions: [jid],
  });
}

async function checkImage(comp, chatId, conn, m) {
  if (!comp.image || comp.image.answeredBy) return;
  const userAnswer = normalizeForMatching(m.text);
  if (!comp.image.answer.includes(userAnswer)) return;

  const elapsed = (m.messageTimestamp * 1000) - comp.roundStartTime;
  updateTimeStats(comp, m.sender, elapsed);

  comp.image.answeredBy = m.sender;
  await awardPoint(comp, chatId, conn, m.sender, m, elapsed);
}

function checkNamesProgress(userInput, currentNames, playerProgress, playerId) {
  const normalizedInput = normalizeArabicText(userInput).toLowerCase();
  if (!playerProgress[playerId]) playerProgress[playerId] = new Set();

  let foundNewMatches = false;

  for (const originalName of currentNames) {
    const normalizedName = normalizeArabicText(originalName).toLowerCase();
    if (playerProgress[playerId].has(originalName)) continue;

    let nameMatches = false;
    if (normalizedInput === normalizedName) {
      nameMatches = true;
    } else if (
      normalizedInput.includes(normalizedName) &&
      normalizedInput.length >= normalizedName.length * 0.8
    ) {
      nameMatches = true;
    } else if (normalizedName.includes(' ')) {
      const nameWords  = normalizedName.split(/\s+/);
      const inputWords = normalizedInput.split(/\s+/);
      const found      = nameWords.filter(nw =>
        inputWords.some(iw => iw === nw || iw.includes(nw))
      );
      if (found.length >= nameWords.length * 0.8) nameMatches = true;
    }

    if (nameMatches) {
      playerProgress[playerId].add(originalName);
      foundNewMatches = true;
    }
  }

  return {
    foundNewMatches,
    hasAllNames: currentNames.every(n => playerProgress[playerId].has(n)),
  };
}

// ─── Start / Stop ─────────────────────────────────────────────────────────────

function parseStartOptions(args = []) {
  const difficultyAliases = {
    سهل: 'easy',
    easy: 'easy',
    عادي: 'medium',
    متوسط: 'medium',
    medium: 'medium',
    صعب: 'hard',
    hard: 'hard',
  };
  let target = 10;
  let botDifficulty = 'medium';

  for (const arg of args) {
    const cleaned = arabicToEnglish(String(arg || '').trim().toLowerCase());
    const num = parseInt(cleaned, 10);
    if (!isNaN(num) && num > 0) {
      target = Math.min(num, 30);
      continue;
    }
    if (difficultyAliases[cleaned]) botDifficulty = difficultyAliases[cleaned];
  }

  return { target, botDifficulty };
}

async function startCompetition(m, conn, args = [], options = {}) {
  const chatId = m.chat;

  if (getComp(chatId)) {
    return conn.sendMessage(chatId,
      { text: '⚠️ في مسابقة شغالة. اكتب *.سمسابقة* لوقفها.' },
      { quoted: m }
    );
  }

  const { target, botDifficulty } = parseStartOptions(args);

  const comp = createComp(chatId, target, {
    botEnabled: !!options.botEnabled,
    botDifficulty,
  });

  const botText = comp.botEnabled ? `\n🤖 ضد يوت - ${botDifficulty}` : '';
  await conn.sendMessage(chatId, { text: `🏆 *مسابقة!* ${target} فنش${botText}` });

  await delay(1000);
  await conn.sendMessage(chatId, { text: '3️⃣' });
  await delay(1000);
  await conn.sendMessage(chatId, { text: '2️⃣' });
  await delay(1000);
  await conn.sendMessage(chatId, { text: '1️⃣' });
  await delay(700);
  await conn.sendMessage(chatId, { text: '🟢 *ابدأ!*' });
  await delay(400);

  await postNextRound(comp, chatId, conn, m);
}

async function stopCompetition(m, conn) {
  const chatId = m.chat;
  const comp   = getComp(chatId);

  if (!comp) {
    return conn.sendMessage(chatId,
      { text: 'ما في مسابقة شغالة.' },
      { quoted: m }
    );
  }

  const hadScores = Object.keys(comp.scores).length > 0;
  const board     = buildBoard(comp.scores);
  const mentions  = Object.keys(comp.scores).filter(jid => !jid.includes('@e.whatsapp.net'));

  destroyComp(chatId);

  if (!hadScores) {
    return conn.sendMessage(chatId, { text: '❌ وقفت المسابقة.\nما سجّل أحد.' });
  }

  await conn.sendMessage(chatId, {
    text: `❌ *وقفت المسابقة*\n\n${board}`,
    mentions,
  });
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Rate-safe send ───────────────────────────────────────────────────────────
const _sendQueues = new Map();

async function safeSend(conn, chatId, payload, opts) {
  if (!_sendQueues.has(chatId)) _sendQueues.set(chatId, Promise.resolve());
  const next = _sendQueues.get(chatId).then(async () => {
    await delay(350);
    return conn.sendMessage(chatId, payload, opts);
  });
  _sendQueues.set(chatId, next.catch(() => {}));
  return next;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

let handler = async (m, { conn, command, args }) => {
  const chatId = m.chat;
  try {
    if (command === 'مسابقة') {
      return await startCompetition(m, conn, args);
    }
    if (command === 'مسابقة_بوت') {
      return await startCompetition(m, conn, args, { botEnabled: true });
    }
    if (command === 'سمسابقة') {
      return await stopCompetition(m, conn);
    }
  } catch (err) {
    console.error('[مسابقة] command error:', err);
    try { await m.reply('❌ حدث خطأ غير متوقع.'); } catch {}
  }
};

handler.command = ['مسابقة', 'مسابقة_بوت', 'سمسابقة'];
handler.help    = ['مسابقة', 'مسابقة_بوت'];
handler.tags    = ['game'];

handler.all = async function (m) {
  const conn   = this;
  const txt    = (m.text || '').trim();
  const chatId = m.chat;

  try {
    const comp = getComp(chatId);
    if (!comp || !comp.active || comp.roundLocked) return !0;

    if (!txt || isExactCommand(txt, ['مسابقة', 'مسابقة_بوت', 'سمسابقة'])) return !0;
    const answerText = cleanAnswerText(txt);
    if (isSpam(answerText)) return !0;
    if (isRapidDupe(comp, m.sender, answerText)) return !0;
    recordMsg(comp, m.sender, answerText);
    m.text = answerText;

    const mode = comp.roundMode;
    if      (mode === 'SINGLE') await checkSingle(comp, chatId, conn, m);
    else if (mode === 'MULTI')  await checkMulti(comp, chatId, conn, m);
    else if (mode === 'NAMES')  await checkNames(comp, chatId, conn, m);
    else if (mode === 'IMAGE')  await checkImage(comp, chatId, conn, m);

  } catch (err) {
    console.error('[مسابقة] error:', err);
  }

  return !0;
};

export default handler;
