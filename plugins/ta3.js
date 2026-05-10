import fs from 'fs';

const dataPath = './plugins/ta3-data.json';
let questionsAndAnswers = [];

// Helper function to normalize Arabic text variations
const normalizeForMatching = (text) => {
  if (typeof text !== 'string') return '';
  // Treat ج, غ, and ق as the same character (g) for matching purposes
  return text.trim().toLowerCase().replace(/[جغق]/g, 'g').replace(/\s+/g, ' ');
};

// Helper function to remove duplicates from answer lists based on normalization
const deduplicateAnswers = (questions) => {
  return questions.map(q => {
    const uniqueAnswers = new Map();
    for (const answer of q.answers) {
      const normalized = normalizeForMatching(answer);
      if (!uniqueAnswers.has(normalized)) {
        uniqueAnswers.set(normalized, answer);
      }
    }
    return {
      ...q,
      answers: [...uniqueAnswers.values()]
    };
  });
};


const defaultQuestions = [
  { question: 'هاشيرا', answers: ['غيو', 'جيو', 'قيو', 'غيومي', 'جيومي', 'قيومي', 'سانيمي', 'شينوبو', 'متسوري', 'تينغن', 'تينجن', 'تينقن', 'تنغن', 'تنجن', 'تنقن', 'اوباناي', 'سانيمي', 'توكيتو'] },
  { question: 'قبعة القش', answers: ['لوفي', 'زورو', 'نامي', 'روبين', 'تشوبر', 'بروك', 'سانجي', 'سانغي', 'سانقي', 'اوسوب', 'فرانكي'] },
  { question: 'طاقم روجر', answers: ['روجر', 'روغر', 'روقر', 'رايلي', 'باغي', 'باجي', 'باقي', 'كروكس', 'شانكس'] },
  { question: 'طاقم اللحيه', answers: [ 'ماركو', 'ايس', 'تيتش', 'ساتش' ] },
  { question: 'بحرية', answers: ['غارب', 'جارب', 'قارب', 'شو', 'هينا', 'كوبي', 'اوكيجي', 'اوكيغي', 'اوكيقي', 'كوزان', 'كيزارو', 'اكاينو'] },
  { question: 'هوكاجي', answers: ['ميناتو', 'ناروتو', 'كاكاشي', 'تسونادي', 'هاشيراما', 'توبيراما', 'هيروزين', 'ساروتوبي'] },
  { question: 'كاجي', answers: [ 'اي', 'مو', 'مي' ] },
  { question: 'سانين', answers: [ 'تسونادي', 'جيرايا', 'غيرايا', 'قيرايا', 'اوروتشيمارو' ] },
  { question: 'بليتش', answers: ['ايزن', 'روز', 'لوف', 'قين', 'غين', 'جين', 'توسين', 'ايتشيفو', 'ايشين', 'يوزو', 'كارين', 'فوسو', 'ميتو', 'ماساكي', 'ياماموتو', 'زاراكي', 'كيوراكو', 'موموي', 'هيوري', 'هوري'] },
  { question: 'قادة', answers: ['ايزن', 'روز', 'لوف', 'لوفي', 'توسين', 'جين', 'غين', 'قين'] },
  { question: 'جنرالات', answers: [ 'هيو', 'كيو', 'تو' ] },
  { question: 'كينقدوم', answers: ['نيل', 'تيا', 'يامي', 'لوبي', 'هيو', 'كيو', 'تو', 'اوكي', 'رينبا', 'اوهون', 'توسين', 'كانكي'] },
  { question: 'ارانكار', answers: [ 'نيل', 'تيا', 'يامي', 'لوبي', 'ايزن' ] },
  { question: 'شياطين', answers: ['روي', 'دوما', 'داكي', 'غيو', 'جيو', 'قيو', 'غيومي', 'جيومي', 'قيومي', 'سانيمي', 'شينوبو', 'نيزوكو', 'تانجيرو', 'تانغيرو', 'تانقيرو'] },
  { question: 'بلاك كلوفر', answers: ['استا', 'ريل', 'يونوا', 'جاك', 'غاك', 'قاك', 'لاك', 'غوش', 'جوش', 'قوش', 'ماغنا', 'ماجنا', 'ماقنا', 'يوليوس'] },
  { question: 'قمر علوي', answers: ['داكي', 'غيوتارو', 'جيوتارو', 'قيوتارو', 'دوما', 'اكازا', 'كوكوشيبو'] },
  { question: 'ثالوث اعظم', answers: [ 'زينون', 'دانتي', 'فانيكا' ] },
  { question: 'اسبادا', answers: [ 'نيل', 'تيا', 'لوبي', 'يامي' ] },
  { question: 'نواب', answers: ['زورو', 'كوين', 'كينغ', 'كينج', 'كينق', 'بارا', 'رينجي', 'رينغي', 'رينقي'] },
  { question: 'معجزات', answers: ['اكاشي', 'اوميني', 'كيسي', 'دايكي', 'ريوتا', 'اتسوشي', 'كوروكو'] },
  { question: 'فايزارد', answers: ['روز', 'لوف', 'شينجي', 'شينغي', 'شينقي', 'هيوري', 'كينسي'] },
  { question: 'يونكو', answers: ['تيتش', 'كايدو', 'لوفي', 'باغي', 'باجي', 'باقي', 'شانكس'] },
  { question: 'اوزوماكي', answers: [ 'ميتو', 'فوسو', 'كارين', 'كوشينا' ] },
  { question: 'تشيبوكاي', answers: ['كروكودايل', 'دوفلامينغو', 'دوفلامينجو', 'دوفلامينقو', 'لاو', 'هانكوك', 'كوما', 'تيتش', 'ميهوك', 'باغي', 'باجي', 'باقي', 'موريا'] },
  { question: 'طاقم شانكس', answers: [ 'لاكي رو', 'شانكس', 'ياسوب', 'بيكمان' ] },
  { question: 'سون', answers: ['غوكو', 'جوكو', 'قوكو', 'غوهان', 'جوهان', 'قوهان', 'غوتين', 'جوتين', 'قوتين'] },
  { question: 'سينجو', answers: ['ايتاما', 'ناواكي', 'توكا', 'ميتو', 'تسونادي', 'هاشيراما', 'توبيراما'] },
  { question: 'سوبرنوفا', answers: [ 'ابو', 'كيد', 'لاو' ] },
  { question: 'سفن', answers: ['نوا', 'ماكسيم', 'ساني غو', 'ساني جو', 'ساني قو', 'ميري', 'غونغ', 'جونغ', 'قونغ', 'ميس لوف', 'موبي ديك', 'ريد فورس'] },
  { question: 'طاقم تيتش', answers: [ 'تيتش', 'شوت', 'كيو', 'اوجر', 'اوغر', 'اوقر' ] },
  { question: 'اخوة الساكي', answers: [ 'ايس', 'سابو', 'لوفي' ] },
  { question: 'اوتشيها', answers: ['راي', 'بارو', 'شين', 'ناكا', 'تيكا', 'ساسكي', 'مادارا', 'ايتاتشي', 'ايتاشي', 'ايزانا', 'ايزومي', 'اوبيتو', 'سارادا'] },
  { question: 'اكatsuki', answers: [ 'باين', 'توبي', 'زيتسو', 'كونان', 'ايتاشي', 'ساسوري' ] },
  { question: 'قادة', answers: ['تيتش', 'ايزن', 'جين', 'غين', 'قين', 'قين', 'غين', 'جين', 'غين', 'جين', 'قين', 'توسين'] },
  { question: 'غيلان', answers: [ 'روز', 'ماريا', 'سينا' ] },
  { question: 'تنانين', answers: ['اغنيل', 'اجنيل', 'اقنيل', 'كايدو', 'ليفايا', 'ايرين', 'اكنولوغيا', 'اكنولوجيا', 'اكنولوقيا'] },
  { question: 'فريكس', answers: ['غون', 'جون', 'قون', 'غين', 'جين', 'قين', 'ابي', 'ميتو', 'جين', 'غين', 'قين', 'قين', 'غين', 'جين', 'جون', 'غون', 'قون'] },
  { question: 'هايكيو', answers: [ 'يو', 'ريو', 'كي', 'شويو' ] },
  { question: 'كوارث كايدو', answers: ['كينغ', 'كينج', 'كينق', 'جاك', 'غاك', 'قاك', 'كوين'] },
  { question: 'هيوغا', answers: [ "هانابي","هيناتا",'نيجي', 'نيغي', 'نيقي', 'هياشي', 'كو', 'ناتسو' ] },
  { question: 'دريار', answers: [ 'يوري', 'ريتا', 'ايفان', 'ماكاروف', 'لاكسوس', 'لاكسس' ] },
  { question: 'كونوها', answers: ['ساي', 'قاي', 'غاي', 'جاي', 'لي', 'داي', 'تن تن', 'ساسكي', 'ناروتو'] },
  { question: 'الفريق السابع', answers: ['رين', 'توبي', 'ساي', 'ساسكي', 'ساكورا', 'ناروتو', 'اوبيتو'] },
  { question: 'السانين الاسطورين', answers: [ 'جيرايا', 'غيرايا', 'قيرايا', 'اوروتشيمارو', 'تسونادي' ] },
  { question: 'مدربين ناروتو', answers: [ 'ايروكا', 'كاكاشي', 'جيرايا', 'غيرايا', 'قيرايا' ] },
  { question: 'نمل', answers: [ 'ميرويم', 'يوبي', 'بوف', 'بيتو' ] },
  { question: 'سيراف النهاية', answers: [ 'يو', 'شينوا', 'غورين', 'جورين', 'قورين' ] },
  { question: 'حراس الملك', answers: [ 'يوبي', 'بوف', 'بيتو' ] },
  { question: 'عمالقة', answers: [ 'اني', 'زيكي', 'بيك', 'زيك', 'رود' ] },
  { question: 'اكرمان', answers: [ 'كيني', 'ليفاي', 'ريتشل', 'ميكاسا' ] },
  { question: 'قادة سحره', answers: [ 'ريل', 'جاك', 'غاك', 'قاك', 'يامي', 'يونوا' ] },
  { question: 'سحره', answers: ['ريل', 'جاك', 'غاك', 'قاك', 'يامي', 'يونوا', 'استا', 'لاك', 'غوش', 'جوش', 'قوش'] },
  { question: 'مونكي', answers: ['لوفي', 'دراغون', 'دراجون', 'دراقون', 'غارب', 'جارب', 'قارب'] },
  { question: 'زودياك', answers: ['غين', 'جين', 'قين', 'جين', 'غين', 'قين', 'هيل', 'بيون', 'قين', 'غين', 'جين', 'سايو'] },
  { question: 'دي', answers: ['لامي', 'لاو', 'تيتش', 'ايس', 'لوفي', 'غارب', 'جارب', 'قارب'] },
  { question: 'ديث نوت', answers: [ 'رم', 'نير', 'ال', 'ريم', 'لايت', 'ريوك' ] },
  { question: 'ثوار', answers: ['كوما', 'باجي', 'باغي', 'باقي', 'دراغون', 'دراجون', 'دراقون', 'كوالا', 'سابو'] },
  { question: 'يوجين', answers: [ 'هاك', 'هودي', 'جيمبي', 'غيمبي', 'قيمبي' ] },
  { question: 'كوتشيكي', answers: [ 'بياكويا', 'روكيا', 'غينري', 'جينري', 'قينري' ] },
  { question: 'محققين', answers: ['هيجي', 'هيغي', 'هيقي', 'نير', 'ال', 'اي', 'كونان', 'ميلو'] },
  { question: 'قرية الرمل', answers: [ 'غارا', 'جارا', 'قارا', 'راسا', 'باكي', 'تيماري' ] },
  { question: 'شينيغامي', answers: ['ريوك', 'بارا', 'لايت', 'كيرا', 'ايزن', 'روز', 'لوف'] },
  { question: 'وصايا', answers: ['زيلدريس', 'درول', 'جالان', 'غالان', 'قالان', 'غوثر', 'جوثر', 'قوثر', 'جوثر', 'غوثر', 'قوثر', 'استاروسا'] },
  { question: 'خطايا', answers: ['كينغ', 'كينج', 'كينق', 'بان', 'ديان', 'ميليوداس', 'كينق', 'كينغ', 'كينج', 'كينج', 'كينغ', 'كينق'] },
  { question: 'فرقة استطلاع', answers: ['ليفاي', 'هانجي', 'هانغي', 'هانقي', 'ارمين', 'ايرين', 'ميكاسا', 'جان', 'غان', 'قان', 'كوني', 'ساشا'] },
  { question: 'ابطال بنها', answers: ['ديكو', 'مومو', 'جيرو', 'غيرو', 'قيرو', 'ايدا', 'شوتو'] },
  { question: 'ادميرالات', answers: ['ايشو', 'كونغ', 'كونج', 'كونق', 'كوزان', 'اكاينو', 'اوكيجي', 'اوكيغي', 'اوكيقي', 'كيزارو'] },
  { question: 'اطفال', answers: [ 'فيل', 'ايما', 'راي' ] },
  { question: 'كهنة اينيل', answers: [ 'شورا', 'اوم', 'جيداتسو', 'غيداتسو', 'قيداتسو' ] },
  { question: 'مفجرين', answers: [ 'ساب', 'بارا', 'جينثيرو', 'غينثيرو', 'قينثيرو' ] }
];

const processedDefaultQuestions = deduplicateAnswers(defaultQuestions);

const loadQuestions = () => {
  try {
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf8');
      // Always deduplicate loaded data to ensure consistency
      questionsAndAnswers = deduplicateAnswers(JSON.parse(data));
    } else {
      questionsAndAnswers = processedDefaultQuestions;
      fs.writeFileSync(dataPath, JSON.stringify(questionsAndAnswers, null, 2));
    }
  } catch (error) {
    console.error('Error loading ta3 questions:', error);
    questionsAndAnswers = processedDefaultQuestions;
  }
};

const saveQuestions = () => {
  try {
    // Before saving, ensure the data is clean
    const cleanedData = deduplicateAnswers(questionsAndAnswers);
    fs.writeFileSync(dataPath, JSON.stringify(cleanedData, null, 2));
  } catch (error) {
    console.error('Error saving ta3 questions:', error);
  }
};

loadQuestions();

let handler = m => m;

let gameState = {
  active: false,
  currentQuestion: '',
  responses: {},
  playerCorrectAnswers: {},
  questionStartTime: 0,
  answeredBy: []
};

async function isAdmin(m, conn) {
  if (!m.isGroup) return false;
  try {
    const groupMetadata = await conn.groupMetadata(m.chat);
    const participants = groupMetadata.participants;
    const admins = participants.filter(p => p.admin);
    return admins.some(admin => admin.id === m.sender);
  } catch (error) {
    console.error('Error fetching group metadata:', error);
    return false;
  }
}

const extractPossibleAnswers = (text) => {
  const separators = /[،,\s\/\\|&+\-]/;
  const parts = text.split(separators)
    .map(part => normalizeForMatching(part))
    .filter(part => part.length > 0);
  // Only return individual parts, not the full text
  return [...new Set(parts)];
};

const addAnswer = async (m, newAnswer, conn) => {
  if (!gameState.active || !gameState.currentQuestion) {
    return m.reply('لا توجد لعبة قيد التشغيل حالياً.');
  }

  const userIsAdmin = await isAdmin(m, conn);
  if (!userIsAdmin) {
    return m.reply('فقط المشرفون يمكنهم إضافة إجابات جديدة.');
  }

  if (!newAnswer || newAnswer.trim().length === 0) {
    return m.reply('يرجى كتابة الإجابة التي تريد إضافتها.\nمثال: .ضف ناروتو');
  }

  let questionIndex = questionsAndAnswers.findIndex(q => q.question === gameState.currentQuestion);
  if (questionIndex === -1) {
    return m.reply('خطأ: لم يتم العثور على السؤال الحالي.');
  }

  const normalizedNewAnswer = normalizeForMatching(newAnswer);
  const existingAnswers = questionsAndAnswers[questionIndex].answers.map(answer => normalizeForMatching(answer));
  if (existingAnswers.includes(normalizedNewAnswer)) {
    return m.reply('هذه الإجابة موجودة بالفعل (أو شكل مختلف لنفس الكلمة).');
  }

  questionsAndAnswers[questionIndex].answers.push(newAnswer.trim());
  saveQuestions();
  await m.reply(`تمت إضافة "${newAnswer.trim()}" بشكل دائم كإجابة صحيحة للسؤال الحالي: ${gameState.currentQuestion}`);
};

const removeAnswer = async (m, answerToRemove, conn) => {
    const userIsAdmin = await isAdmin(m, conn);
    if (!userIsAdmin) {
        return m.reply('فقط المشرفون يمكنهم حذف الإجابات.');
    }

    if (!gameState.active || !gameState.currentQuestion) {
        return m.reply('لا توجد لعبة قيد التشغيل حالياً لحذف إجابة منها.');
    }

    if (!answerToRemove) {
        return m.reply('يرجى تحديد الإجابة التي تريد حذفها.');
    }

    const questionIndex = questionsAndAnswers.findIndex(q => q.question === gameState.currentQuestion);
    if (questionIndex === -1) {
        return m.reply('خطأ: لم يتم العثور على السؤال الحالي.');
    }

    const normalizedAnswerToRemove = normalizeForMatching(answerToRemove);
    const answerIndex = questionsAndAnswers[questionIndex].answers.findIndex(ans => normalizeForMatching(ans) === normalizedAnswerToRemove);

    if (answerIndex > -1) {
        const removedAnswer = questionsAndAnswers[questionIndex].answers[answerIndex];
        questionsAndAnswers[questionIndex].answers.splice(answerIndex, 1);
        saveQuestions();
        await m.reply(`تم حذف الإجابة "${removedAnswer}" بشكل دائم من السؤال الحالي.`);
    } else {
        await m.reply(`لم يتم العثور على الإجابة "${answerToRemove}" في السؤال الحالي.`);
    }
};

const addQuestion = async (m, newQuestionData, conn) => {
    const userIsAdmin = await isAdmin(m, conn);
    if (!userIsAdmin) {
        return m.reply('فقط المشرفون يمكنهم إضافة أسئلة جديدة.');
    }

    const parts = newQuestionData.split('|');
    if (parts.length < 2) {
        return m.reply('يرجى استخدام الصيغة الصحيحة: .منيو-اضافة السؤال | الإجابة1,الإجابة2,...');
    }

    const question = parts[0].trim();
    const answers = parts[1].split(',').map(ans => ans.trim()).filter(ans => ans.length > 0);

    if (!question || answers.length === 0) {
        return m.reply('السؤال أو الإجابات غير صالحة.');
    }

    const normalizedQuestion = normalizeForMatching(question);
    if (questionsAndAnswers.some(q => normalizeForMatching(q.question) === normalizedQuestion)) {
        return m.reply('هذا السؤال موجود بالفعل.');
    }
    
    const uniqueAnswers = new Map();
    for (const answer of answers) {
        const normalized = normalizeForMatching(answer);
        if (!uniqueAnswers.has(normalized)) {
            uniqueAnswers.set(normalized, answer);
        }
    }
    const deduplicatedNewAnswers = [...uniqueAnswers.values()];

    questionsAndAnswers.push({ question, answers: deduplicatedNewAnswers });
    saveQuestions();
    await m.reply(`تمت إضافة السؤال الجديد بشكل دائم:\n*السؤال:* ${question}\n*الإجابات:* ${deduplicatedNewAnswers.join(', ')}`);
};

const listQuestions = async (m) => {
    if (questionsAndAnswers.length === 0) {
        return m.reply('لا توجد أسئلة متاحة حالياً.');
    }

    let list = '📋 *قائمة الأسئلة والأجوبة* 📋\n\n';
    questionsAndAnswers.forEach((qa, index) => {
        list += `*${index + 1}. السؤال:* ${qa.question}\n`;
        list += `   - *الإجابات:* ${qa.answers.join(', ')}\n\n`;
    });

    await m.reply(list);
};

const skipQuestion = async (m) => {
  if (!gameState.active || !gameState.currentQuestion) {
    return m.reply('لا توجد لعبة قيد التشغيل حالياً.');
  }

  let qa = questionsAndAnswers.find(q => q.question === gameState.currentQuestion);
  if (!qa) {
    await m.reply('لم يتم العثور على السؤال الحالي، الانتقال إلى التالي.');
    return nextQuestion(m);
  }

  await m.reply(`تم تخطي السؤال!\n*السؤال:* ${qa.question}\n*الإجابات الصحيحة كانت:* ${qa.answers.join(', ')}`);
  
  nextQuestion(m);
};

const startGame = async (m) => {
  if (gameState.active) {
    return m.reply('اللعبة قيد التشغيل بالفعل.');
  }
  if (questionsAndAnswers.length === 0) {
    return m.reply('لا توجد أسئلة لبدء اللعبة. يرجى إضافة بعض الأسئلة أولاً.');
  }

  gameState.active = true;
  gameState.responses = {};
  gameState.playerCorrectAnswers = {};
  gameState.answeredBy = [];
  
  let randomIndex = Math.floor(Math.random() * questionsAndAnswers.length);
  gameState.currentQuestion = questionsAndAnswers[randomIndex].question;
  gameState.questionStartTime = Date.now();
  
  await m.reply(`*${gameState.currentQuestion} 3/تع*`);
};

const stopGame = async (m) => {
  if (!gameState.active) {
    return m.reply('لا توجد لعبة قيد التشغيل حالياً.');
  }

  gameState.active = false;

  if (Object.keys(gameState.responses).length === 0) {
    await m.reply('لم يربح أحد نقاطاً في هذه اللعبة.');
  } else {
    let result = Object.entries(gameState.responses).map(([jid, points]) => {
      return `@${jid.split('@')[0]}: ${points} نقطة`;
    }).join('\n');

    await m.reply(`اللعبة انتهت!\n\nالنقاط:\n${result}`, null, {
      mentions: Object.keys(gameState.responses)
    });
  }

  gameState.currentQuestion = '';
};

const nextQuestion = async (m) => {
  gameState.playerCorrectAnswers = {};
  gameState.answeredBy = [];
  gameState.questionStartTime = Date.now();
  
  if (questionsAndAnswers.length === 0) {
    gameState.active = false;
    return m.reply('نفدت الأسئلة! انتهت اللعبة.');
  }
  
  let randomIndex = Math.floor(Math.random() * questionsAndAnswers.length);
  gameState.currentQuestion = questionsAndAnswers[randomIndex].question;
  
  setTimeout(async () => {
    await m.reply(`*${gameState.currentQuestion} 3/تع*`);
  }, 500);
};

const checkAnswer = async (m) => {
  console.log('🔍 checkAnswer called for:', m.text);
  
  if (!gameState.active || !gameState.currentQuestion) {
    console.log('❌ Game not active or no current question');
    return;
  }
  
  const userJid = m.sender;
  
  if (gameState.answeredBy.includes(userJid)) {
    console.log('❌ User already answered:', userJid);
    return;
  }
  
  let qa = questionsAndAnswers.find(q => q.question === gameState.currentQuestion);
  if (!qa) {
    console.log('❌ Question not found:', gameState.currentQuestion);
    return;
  }
  
  let correctAnswers = qa.answers;
  let normalizedCorrectAnswers = correctAnswers.map(answer => normalizeForMatching(answer));
  
  console.log('📝 Correct answers:', correctAnswers);
  console.log('📝 Normalized correct answers:', normalizedCorrectAnswers);
  
  let userAnswers = extractPossibleAnswers(m.text);
  console.log('👤 User answers extracted:', userAnswers);
  
  if (!gameState.playerCorrectAnswers[userJid]) {
    gameState.playerCorrectAnswers[userJid] = new Set();
  }
  
  userAnswers.forEach(answer => {
    if (normalizedCorrectAnswers.includes(answer)) {
      gameState.playerCorrectAnswers[userJid].add(answer);
      console.log('✅ Correct answer found:', answer);
    } else {
      console.log('❌ Wrong answer:', answer);
    }
  });
  
  const correctCount = gameState.playerCorrectAnswers[userJid].size;
  console.log('🎯 Total correct answers for user:', correctCount);
  
  if (correctCount >= 3) {
    console.log('🎉 User got 3+ correct answers! Giving point...');
    gameState.answeredBy.push(userJid);
    if (!gameState.responses[userJid]) {
      gameState.responses[userJid] = 1;
    } else {
      gameState.responses[userJid] += 1;
    }
    
    // Silent success - no message, just proceed to next question
    nextQuestion(m);
  } else {
    console.log('⏳ User needs more correct answers. Current:', correctCount);
  }
};

handler.all = async function(m, extra) {
  // Debug logs removed to prevent terminal spam
  
  if (/^\.متع$/i.test(m.text)) {
    // Debug logs removed to prevent terminal spam
    return startGame(m);
  } else if (/^\.ستع$/i.test(m.text)) {
    // Debug logs removed to prevent terminal spam
    return stopGame(m);
  } else if (/^\.ضف\s+(.+)$/i.test(m.text)) {
    const match = m.text.match(/^\.ضف\s+(.+)$/i);
    const newAnswer = match[1];
    return addAnswer(m, newAnswer, this);
  } else if (/^\.سكب$/i.test(m.text)) {
    return skipQuestion(m);
  } else if (/^\.حذف\s+(.+)$/i.test(m.text)) {
    const match = m.text.match(/^\.حذف\s+(.+)$/i);
    return removeAnswer(m, match[1], this);
  } else if (/^\.منيو-اضافة\s+(.+)$/i.test(m.text)) {
    const match = m.text.match(/^\.منيو-اضافة\s+(.+)$/i);
    const newQuestionData = match[1];
    return addQuestion(m, newQuestionData, this);
  } else if (/^\.قائمة-الاسئلة$/i.test(m.text)) {
    return listQuestions(m);
  } else if (gameState.active && gameState.currentQuestion) {
    // Debug logs removed to prevent terminal spam
    // Debug logs removed to prevent terminal spam
    await checkAnswer(m);
  } else {
    // Debug logs removed to prevent terminal spam
  }
};

export default handler;