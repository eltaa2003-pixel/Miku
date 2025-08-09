import { canLevelUp, xpRange } from '../lib/levelling.js';

let handler = m => m;

let currentCount = 1; 
let gameState = {
    active: false,
    currentQuestionIndex: -1,
    responses: {},
    playerAttempts: {}, // Track all player attempts for current question
    questionStartTime: 0,
    answeredBy: null, // Track who answered correctly first
    allPlayerMessages: {} // Track all messages from players during active question
};

// This is the new function I added
const normalizeForMatching = (text) => {
  if (typeof text !== 'string') return '';
  // Treat ج, غ, and ق as the same character (g) for matching purposes
  return text.trim().toLowerCase().replace(/[جغق]/g, 'g').replace(/\s+/g, ' ');
};

// This function removes duplicate answers from the lists
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

const gameData = deduplicateAnswers([
    {
      question: 'إطلاق نيل',
      answers: [ 'غاميوزا', 'جاميوزا', 'قاميوزا' ]
    },
    { question: 'إطلاق ستارك', answers: [ 'لوس لوبوس' ] },
    { question: 'إطلاق غريمجو', answers: [ 'بانترا' ] },
    { question: 'إطلاق زايلو أبورو', answers: [ 'فورنيكاراس' ] },
    { question: 'إطلاق يامي', answers: [ 'ارا' ] },
    {
      question: 'إطلاق باراغان',
      answers: [ 'اوروغانتي', 'اوروجانتي', 'اوروقانتي' ]
    },
    {
      question: 'إطلاق الكيورا',
      answers: [
        'مورشيلاجو',
        'مورشيلاغو',
        'مورشيلاقو',
        'مورشيلاغو',
        'مورشيلاجو',
        'مورشيلاقو'
      ]
    },
    { question: 'الإسبادا 3', answers: [ 'نيل' ] },
    { question: 'الإسبادا 4', answers: [ 'الكيورا' ] },
    {
      question: 'الإسبادا 2',
      answers: [ 'باراغان', 'باراجان', 'باراقان' ]
    },
    { question: 'الإسبادا 1', answers: [ 'ستارك' ] },
    { question: 'الأسد الذهبي', answers: [ 'شيكي' ] },
    { question: 'أقوى مستخدم نين', answers: [ 'نيترو' ] },
    { question: 'عين الصقر', answers: [ 'ميهوك' ] },
    {
      question: 'الناسك المنحرف',
      answers: [ 'جيرايا', 'غيرايا', 'قيرايا' ]
    },
    { question: 'قدرة كرولو', answers: [ 'السرقه', 'السرغه', 'السرجه' ] },
    {
      question: 'قدرة هيسوكا',
      answers: [
        'بانجي غام', 'بانغي غام',
        'بانقي غام', 'بانجي جام',
        'بانجي قام', 'جام',
        'غام',       'قام'
      ]
    },
    { question: 'الوميض الأصفر', answers: [ 'ميناتو' ] },
    {
      question: 'قدرة غون',
      answers: [ 'جاجانكين', 'غاجانكين', 'قاجانكين' ]
    },
    { question: 'رقم هيسوكا بالاختبار', answers: [ '44', '٤٤' ] },
    { question: 'رئيس العناكب', answers: [ 'كرولو' ] },
    { question: 'قائد تومان', answers: [ 'مايكي' ] },
    { question: 'نائب مايكي', answers: [ 'دراكن' ] },
    { question: 'القمر العلوي الأول', answers: [ 'كوكوشيبو' ] },
    { question: 'القمر العلوي الثاني', answers: [ 'دوما' ] },
    { question: 'القمر العلوي الثالث', answers: [ 'اكازا' ] },
    {
      question: 'القمر العلوي الرابع',
      answers: [ 'هانتينغو', 'هانتينجو', 'هانتينقو' ]
    },
    {
      question: 'القمر العلوي الخامس',
      answers: [ 'غيوكو', 'جيوكو', 'قيوكو' ]
    },
    { question: 'أخت تانجيرو', answers: [ 'نيزوكو' ] },
    { question: 'ابن أوسين', answers: [ 'اوهون' ] },
    { question: 'أخت ثورفين', answers: [ 'هيلغا', 'هيلجا', 'هيلقا' ] },
    { question: 'أب ثورفين', answers: [ 'ثورز' ] },
    { question: 'ابن ثورز', answers: [ 'ثورفين' ] },
    { question: 'سيف روجر', answers: [ 'ايس' ] },
    { question: 'سيف إيتاشي', answers: [ 'توتسوكا' ] },
    { question: 'سيف أودين', answers: [ 'اينما' ] },
    { question: 'سيف ميهوك', answers: [ 'يورو' ] },
    { question: 'سيف ريوما', answers: [ 'شوسوي', 'شوزوي' ] },
    { question: 'صقر الأوتشيها', answers: [ 'ساسكي' ] },
    { question: 'شبح الأوتشيها', answers: [ 'مادارا' ] },
    { question: 'ملك الظلام', answers: [ 'رايلي' ] },
    { question: 'كلب الزولديك', answers: [ 'ميكي' ] },
    { question: 'كلب الفورجر', answers: [ 'بوند' ] },
    { question: 'ملك الكوينشي', answers: [ 'يوهاباخ', 'يوها باخ' ] },
    { question: 'أخ إيتوشي ساي', answers: [ 'رين' ] },
    { question: 'أخ إيتوشي رين', answers: [ 'ساي' ] },
    { question: 'حبيبة أوكي', answers: [ 'كيو' ] },
    { question: 'أقوى مخلوق', answers: [ 'كايدو' ] },
    { question: 'شبح المعجزات', answers: [ 'كوروكو' ] },
    { question: 'رامي الثلاثيات', answers: [ 'ميدوريما' ] },
    { question: 'رامي المعجزات', answers: [ 'ميدوريما' ] },
    { question: 'أخت بوروتو', answers: [ 'هيماواري' ] },
    {
      question: 'لون عين الكوروتا',
      answers: [ 'قرمزي', 'غرمزي', 'جرمزي' ]
    },
    { question: 'ابنة كايدو', answers: [ 'ياماتو' ] },
    { question: 'اب لوفي', answers: [ 'دراغون', 'دراجون', 'دراقون' ] },
    { question: 'مربية لوفي', answers: [ 'دادان' ] },
    { question: 'بطل البحرية', answers: [ 'غارب', 'جارب', 'قارب' ] },
    {
      question: 'الدراج الأزرق',
      answers: [ 'اوكيجي', 'اوكيغي', 'اوكيقي', 'كوزان' ]
    },
    { question: 'سكين كرولو', answers: [ 'بينز' ] },
    { question: 'أحمر الشعر', answers: [ 'شانكس' ] },
    {
      question: 'سيف شانكس',
      answers: [ 'غريفين', 'جريفين', 'قريفين', 'جريفين', 'غريفين', 'قريفين' ]
    },
    {
      question: 'رمح اللحية',
      answers: [ 'موراكوموغيري', 'موراكوموجيري', 'موراكوموقيري' ]
    },
    { question: 'كيميائي الشعلة', answers: [ 'روي' ] },
    { question: 'تنين ناتسو', answers: [ 'اغنيل', 'اجنيل', 'اقنيل' ] },
    { question: 'أكسيد ناتسو', answers: [ 'هابي' ] },
    { question: 'صاحب إي إن دي', answers: [ 'زيريف' ] },
    { question: 'كتاب زيريف', answers: [ 'اي ان دي' ] },
    { question: 'ابن ناروتو', answers: [ 'بوروتو' ] },
    { question: 'أم ناروتو', answers: [ 'كوشينا' ] },
    { question: 'زوجة هاشيراما', answers: [ 'ميتو' ] },
    {
      question: 'أوميني كامل',
      answers: [ 'دايكي اوميني', 'اوميني دايكي' ]
    },
    { question: 'كيسي كامل', answers: [ 'ريوتا كيسي', 'كيسي ريوتا' ] },
    { question: 'معلم إيتشيغو', answers: [ 'كيسكي' ] },
    {
      question: 'أوراهارا كامل',
      answers: [ 'كيسكي اوراهارا', 'اوراهارا كيسكي' ]
    },
    { question: 'نائب أيزن', answers: [ 'مومو' ] },
    { question: 'نائب كايدو', answers: [ 'كينغ', 'كينج', 'كينق' ] },
    { question: 'أقوى جنرال', answers: [ 'اوكي' ] },
    { question: 'قصر أيزن', answers: [ 'لاس نوشيس' ] },
    {
      question: 'سفينة باغي',
      answers: [ 'بيغ', 'بيج', 'بيق', 'بيج توب', 'بيغ توب', 'بيق توب' ]
    },
    { question: 'سفينة شانكس', answers: [ 'ريد فورس' ] },
    { question: 'سفينة اللحية', answers: [ 'موبي ديك', 'موبيديك' ] },
    {
      question: 'سفينة روجر',
      answers: [ 'اوروجاكسون', 'اوروغاكسون', 'اوروقاكسون' ]
    },
    {
      question: 'سفينة لوفي القديمة',
      answers: [ 'غوينغ ميري', 'جوينغ ميري', 'قوينغ ميري' ]
    },
    {
      question: 'سفينة لوفي الجديدة',
      answers: [ 'ساني غو', 'ساني جو', 'ساني قو' ]
    },
    { question: 'وعاء سوكونا', answers: [ 'يوجي', 'يوغي', 'يوقي' ] },
    { question: 'وعاء إيشيكي', answers: [ 'كاواكي' ] },
    { question: 'وعاء موموشيكي', answers: [ 'بوروتو' ] },
    {
      question: 'التينساي',
      answers: [ 'ساكوراجي', 'ساكوراغي', 'ساكوراقي' ]
    },
    { question: 'ابن فيجيتا', answers: [ 'ترانكس' ] },
    {
      question: 'أمير السايان',
      answers: [ 'فيجيتا', 'فيغيتا', 'فيقيتا' ]
    },
    { question: 'السايان الأسطوري', answers: [ 'برولي' ] },
    { question: 'نائب روجر', answers: [ 'رايلي' ] },
    { question: 'أخت أكاي', answers: [ 'سيرا' ] },
    { question: 'أب سيلفا زولديك', answers: [ 'زينو' ] },
    { question: 'أب زينو زولديك', answers: [ 'ماها' ] },
    {
      question: 'أب جين فريكس',
      answers: [
        'جين', 'غين',
        'قين', 'غين',
        'جين', 'قين',
        'قين', 'غين',
        'جين'
      ]
    },
    { question: 'بانكاي ياماموتو', answers: [ 'زانكا نو تاتشي', 'زانكا نو تاشي' ] },
    { question: 'شيكاي كيسكي', answers: [ 'بينيهيمي' ] },
    {
      question: 'شيكاي أيزن',
      answers: [
        'كيوكا سوغيستو',
        'كيوكا سوجيستو',
        'كيوكا سوقيستو',
      ]
    },
    { question: 'ملاحة الطاقم', answers: [ 'نامي' ] },
    {
        question: 'أخت نامي',
        answers: [ 'نوجيكو', 'نوغيكو', 'نوقيكو', 'نوغيكو', 'نوجيكو', 'نوقيكو' ]
      },
      { question: 'قائد العناكب', answers: [ 'كرولو' ] },
      { question: 'قائد الثيران السوداء', answers: [ 'يامي' ] },
      { question: 'مستخدم شينرا تينسي', answers: [ 'باين' ] },
      {
        question: 'مستخدم إيدو تينسي',
        answers: [ 'اوروتشيمارو', 'كابوتو', 'توبيراما' ]
      },
      { question: 'قبضة اللهب', answers: [ 'ايس' ] },
      { question: 'جراح الموت', answers: [ 'لاو' ] },
      { question: 'أخت لاو', answers: [ 'لامي' ] },
      { question: 'خال ليفاي', answers: [ 'كيني' ] },
      { question: 'معد كاراسونو', answers: [ 'توبيو' ] },
      { question: 'نجم كاراسونو', answers: [ 'اساهي' ] },
      { question: 'معذب العناكب', answers: [ 'فيتان' ] },
      { question: 'مكنسة شيزوكو', answers: [ 'ديمي' ] }
    ]);


const startGame = async (m) => {
    if (gameState.active) return; // Silent - no reply
    gameState.active = true;
    gameState.responses = {};
    gameState.playerAttempts = {};
    gameState.allPlayerMessages = {};
    nextQuestion(m);
};

const stopGame = async (m) => {
    if (!gameState.active) return; // Silent - no reply
    gameState.active = false;
    
    if (Object.keys(gameState.responses).length === 0) {
        // Silent - no reply about no winners
    } else {
        let result = Object.entries(gameState.responses).map(([jid, points]) => {
            return `@${jid.split('@')[0]}: ${points} نقطة`;
        }).join('\n');
        
        await m.reply(`اللعبة انتهت!\n\nالنقاط:\n${result}`, null, {
            mentions: Object.keys(gameState.responses)
        });
    }
};

const skipQuestion = async (m) => {
    if (!gameState.active || gameState.currentQuestionIndex === -1) return;
    
    const currentQuestion = gameData[gameState.currentQuestionIndex];
    const correctAnswers = currentQuestion.answers.join(' / ');
    
    await m.reply(`الإجابة: ${correctAnswers}`);
    
    // Move to next question after showing answer
    setTimeout(() => {
        nextQuestion(m);
    }, 2000);
};

const nextQuestion = async (m) => {
    // Reset question-specific tracking
    gameState.playerAttempts = {};
    gameState.allPlayerMessages = {};
    gameState.answeredBy = null;
    gameState.questionStartTime = Date.now();
    
    gameState.currentQuestionIndex = Math.floor(Math.random() * gameData.length);
    await m.reply(`*س/${gameData[gameState.currentQuestionIndex].question}*`);
};

const extractPossibleAnswers = (text) => {
    // Split by common separators and clean each part
    const separators = /[،,\s\/\\|&+\-]/;
    const parts = text.split(separators)
        .map(part => normalizeForMatching(part))
        .filter(part => part.length > 0);
    
    // Also include the full text as one answer
    const fullText = normalizeForMatching(text);
    
    return [...new Set([fullText, ...parts])]; // Remove duplicates
};

const checkAnswer = async (m) => {
    if (!gameState.active || gameState.currentQuestionIndex === -1) return;
    
    const currentQuestion = gameData[gameState.currentQuestionIndex];
    const correctAnswers = currentQuestion.answers.map(answer => normalizeForMatching(answer));
    const userJid = m.sender;
    const messageTime = Date.now();
    
    // Track this player's message
    if (!gameState.allPlayerMessages[userJid]) {
        gameState.allPlayerMessages[userJid] = [];
    }
    gameState.allPlayerMessages[userJid].push({
        text: m.text,
        time: messageTime
    });
    
    // Extract all possible answers from user's message
    const userAnswers = extractPossibleAnswers(m.text);
    
    // Check if any of the user's answers match correct answers
    const matchedAnswer = userAnswers.find(userAnswer => 
        correctAnswers.some(correctAnswer => correctAnswer === userAnswer)
    );
    
    if (matchedAnswer) {
        // Check if this user already got this question right
        if (gameState.answeredBy === userJid) {
            return; // User already got this question right - silent
        }
        
        // Check if someone else already answered correctly
        if (gameState.answeredBy !== null) {
            // Silent - no reply about being late
            return;
        }
        
        // This is the first correct answer
        gameState.answeredBy = userJid;
        gameState.responses[userJid] = (gameState.responses[userJid] || 0) + 1;
        
        // Silent success - no message, just proceed to next question
        setTimeout(() => {
            nextQuestion(m);
        }, 1000);
    } else {
        // Track wrong attempts - but silently
        if (!gameState.playerAttempts[userJid]) {
            gameState.playerAttempts[userJid] = [];
        }
        gameState.playerAttempts[userJid].push({
            answers: userAnswers,
            time: messageTime
        });
    }
};

// Function to check if a player corrected themselves in recent messages
const checkForCorrections = async (m) => {
    if (!gameState.active || gameState.currentQuestionIndex === -1 || gameState.answeredBy !== null) return;
    
    const userJid = m.sender;
    const userMessages = gameState.allPlayerMessages[userJid];
    
    if (!userMessages || userMessages.length < 2) return;
    
    const currentQuestion = gameData[gameState.currentQuestionIndex];
    const correctAnswers = currentQuestion.answers.map(answer => normalizeForMatching(answer));
    
    // Check the last few messages for corrections
    const recentMessages = userMessages.slice(-3); // Check last 3 messages
    
    for (let i = 0; i < recentMessages.length; i++) {
        const messageAnswers = extractPossibleAnswers(recentMessages[i].text);
        const matchedAnswer = messageAnswers.find(answer => 
            correctAnswers.some(correctAnswer => correctAnswer === answer)
        );
        
        if (matchedAnswer && gameState.answeredBy === null) {
            gameState.answeredBy = userJid;
            gameState.responses[userJid] = (gameState.responses[userJid] || 0) + 1;
            
            // Silent success for correction - no message, just proceed to next question
            setTimeout(() => {
                nextQuestion(m);
            }, 1000);
            break;
        }
    }
};

handler.all = async function(m) {
    if (m.text === ".مس") return startGame(m);
    if (m.text === ".سس") return stopGame(m);
    if (m.text === ".سكيب") return skipQuestion(m);
    
    // Only process during active game
    if (gameState.active) {
        await checkAnswer(m);
        await checkForCorrections(m);
    }
};

export default handler;