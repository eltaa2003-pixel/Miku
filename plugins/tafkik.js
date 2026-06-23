import { canLevelUp, xpRange } from '../lib/levelling.js';

// Time helpers
const formatElapsed = (ms) => {
  if (!ms || ms <= 0) return '0s';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const updateTimeStats = (stats, jid, elapsedMs) => {
  if (!stats[jid]) stats[jid] = { best: Infinity, total: 0, count: 0 };
  const s = stats[jid];
  s.count += 1;
  s.total += elapsedMs;
  if (elapsedMs < s.best) s.best = elapsedMs;
};

let handler = m => m;

let gameState = {
    active: false,
    currentName: '',
    responses: {},
    questionStartTime: 0,
    timeStats: {}
};

const names = [
   'لوفي', 'ناروتو', 'سابو', 'ايس', 'رايلي', 'جيرايا', 'ايتاتشي', 'ساسكي', 'شيسوي', 'يوهان',
        'غوهان', 'ايزن', 'فايوليت', 'نامي', 'هانكوك', 'روبين', 'كاكاشي', 'ريومو', 'ريمورو',
        'غوكو', 'غوغو', 'كيلوا', 'غون', 'كورابيكا', 'يوسكي', 'ايشيدا', 'ايتشيغو', 'ميناتو', 'رينجي',
        'جيمبي', 'انوس', 'سايتاما', 'نيزيكو', 'اوراهارا', 'تانجيرو', 'نويل', 'استا', 'يونو', 'لايت',
        'راينر', 'اثي', 'لوكاس', 'زاك', 'الوكا', 'ماها', 'زينو', 'سيلفا', 'رينغوكو', 'تينغن', 'ميتسوري',
        'تنغن', 'هولمز', 'فريزا', 'فريزر', 'غيومي', 'غيو', 'كينق', 'عبدول', 'علي بابا', 'عبدالله', 'اللحية البيضاء',
        'ترانكس', 'تشوبر', 'فرانكي', 'دوفلامينغو', 'كروكودايل', 'ايانوكوجي', 'موراساكيبارا', 'فيلو', 'فو',
        'هان', 'ثورز', 'ثورفين', 'ساي', 'ساسكي', 'سابيتو', 'ساسوري', 'كوراما', 'كابوتو', 'ناروتو', 'لي',
        'غاي', 'شيغاراكي', 'اول فور ون', 'اول مايت', 'تشيساكي', 'كيسامي', 'كيساكي', 'موتين روشي', 'بيل', 'نير',
        'لوغ', 'زورو', 'ماكي', 'ماي', 'شوكو', 'شيزوكو', 'ويس', 'بو', 'بان', 'بولا', 'غوتين', 'مورو', 'سيل',
        'فيجيتا', 'بيروس', 'ديو', 'جوتارو', 'كيرا', 'غاتس', 'غارب', 'هيماواري', 'بوروتو', 'غاجيل', 'جيغن', 'ليو',
        'هيكي', 'هاتشيمان', 'ثوركيل', 'اشيلاد', 'صوفيا', 'ميدوريما', 'ميدوريا', 'ديكو', 'داكي', 'دابي', 'ليفاي',
        'ايرين', 'ارمين', 'ايروين', 'ميكاسا', 'هانجي', 'غابي', 'غابيمارو', 'هيتش', 'ريتش', 'ايلتا', 'توكا', 'كانيكي',
        'ليوريو', 'نيترو', 'ميرويم', 'ماتشي', 'جيلال', 'ميستوغان', 'هيسوكا', 'شالنارك', 'بولنارف', 'كاكيوين', 'فيتان',
        'كينشيرو', 'نوبوناغا', 'ريم', 'رين', 'رايلي', 'زينيتسو', 'ويليام', 'ويندي', 'هوري', 'هيوري', 'هوريكيتا',
        'اوروتشيمارو', 'شادو', 'تسونادي', 'هاشيراما', 'شويو', 'توبيراما', 'هيروزين', 'لولوش', 'نانالي', 'سوزاكو',
        'ميامورا', 'جيمبي', 'اوريهيمي', 'روكيا', 'ماش', 'لانس', 'رينجي', 'استا', 'ايس', 'ايما', 'راي', 'نير', 'ري',
        'كي', 'كيو', 'كو', 'رين', 'ريم', 'شين', 'غوكو', 'هيناتا', 'هاشيراما', 'توبيراما', 'ناروتو', 'بوروتو', 'شيكامارو',
        'شانكس', 'يوريتشي', 'غابيمارو', 'تشوبر', 'زينيتسو', 'ويليام', 'ويس', 'ويل', 'نيل', 'ساتورو', 'غيتو', 'علي',
        'سانغورو', 'نيزوكو', 'ايلومي', 'ميغومي', 'مي مي', 'ماكي', 'ماي', 'ناخت', 'ليخت', 'لاك', 'يامي', 'يوري', 'يور',
        'يو', 'ساسكي', 'ساسوري', 'كانيكي', 'ساساكي', 'البرت', 'ساكورا', 'لاو', 'كيو', 'شوت', 'ابي', 'روز', 'لوف', 'كاتاكوري',
        'رم', 'ابي ابو ايس', 'شوكو', 'ماي ماكي شوكو', 'كونان', 'كايتو', 'توغوموري', 'شينرا', 'بينيمارو', 'هيسوكا', 'فيتان',
        'ماتشي', 'كرولو', 'ساي', 'سابو', 'ثورز', 'ثورفين', 'ثوركيل', 'ثورغيل', 'كنوت', 'ثور', 'ثيو', 'مورا', 'ساكي', 'بارا',
        'يوليوس', 'لوسيوس', 'لامي', 'ميامورا', 'هوري', 'كوروكو', 'كاغامي', 'شيسوي', 'غين', 'ترانكس', 'ايزن', 'دابي', 'دازاي',
        'ايانوكوجي', 'ايتادوري', 'جين', 'يوجي', 'دراغون', 'دازاي', 'ديكو', 'جينوس', 'جيرو', 'جود', 'كود', 'كيد', 'يوميكو'
];

handler.all = async function(m, { conn }) {
    if (/^\.متف$/i.test(m.text)) {
        if (gameState.active) {
            return m.reply('اللعبة قيد التشغيل بالفعل.');
        }

        gameState.active = true;
        gameState.responses = {}; // Reset responses
        gameState.timeStats = {};
        let randomIndex = Math.floor(Math.random() * names.length);
        gameState.currentName = names[randomIndex];
        const sent = await m.reply(`*${gameState.currentName}*`);
        gameState.questionStartTime = (sent && sent.messageTimestamp) ? sent.messageTimestamp * 1000 : Date.now();
    } else if (/^\.ستف$/i.test(m.text)) {
        if (!gameState.active) {
            return m.reply('لا توجد لعبة قيد التشغيل حالياً.');
        }

        gameState.active = false;

        if (Object.keys(gameState.responses).length === 0) {
            await m.reply('لم يربح أحد نقاطاً في هذه اللعبة.');
        } else {
            let result = Object.entries(gameState.responses).map(([jid, points]) => {
                const stats = gameState.timeStats[jid];
                const timeText = stats ? ` ⏱️ ${formatElapsed(stats.best)} (م: ${formatElapsed(Math.round(stats.total / stats.count))})` : '';
                return `@${jid.split('@')[0]}: ${points} نقطة${timeText}`;
            }).join('\n');

            await m.reply(`اللعبة انتهت!\n\nالنقاط:\n${result}`, null, {
                mentions: Object.keys(gameState.responses)
            });
        }

        gameState.currentName = ''; // Clear the current name
    } else if (gameState.active && gameState.currentName) {
        const expectedInput = gameState.currentName.split('').join(' '); // Expected format with spaces
        const normalizedInput = m.text.replace(/\s+/g, ' ').trim(); // Normalize spaces
        const expectedNormalized = expectedInput.replace(/\s+/g, ' '); // Normalize expected input
        
        if (normalizedInput === expectedNormalized) {
            if (!gameState.responses[m.sender]) {
                gameState.responses[m.sender] = 1;
            } else {
                gameState.responses[m.sender] += 1;
            }

            const elapsed = (m.messageTimestamp * 1000) - gameState.questionStartTime;
            updateTimeStats(gameState.timeStats, m.sender, elapsed);
            const stats = gameState.timeStats[m.sender];
            const isNewBest = stats && elapsed <= stats.best;
            const timeText = ` ⏱️ ${formatElapsed(elapsed)}` + (isNewBest ? ' 🏅' : ` (أفضل: ${formatElapsed(stats.best)})`);

            let randomIndex = Math.floor(Math.random() * names.length);
            gameState.currentName = names[randomIndex];
            const sent = await m.reply(`*${gameState.currentName}*${timeText}`);
            gameState.questionStartTime = (sent && sent.messageTimestamp) ? sent.messageTimestamp * 1000 : Date.now();
        }
    }
};

export default handler;