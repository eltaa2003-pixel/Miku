let handler = m => m;

let currentCount = 1; 

async function isAdmin(m, conn) {
  if (!m.isGroup) return false;
  try {
    let groupMetadata = await conn.groupMetadata(m.chat);
    let participants = groupMetadata.participants;
    let admins = participants.filter(p => p.admin);
    return admins.some(admin => admin.id === m.sender);
  } catch (error) {
    console.error('Error fetching group metadata:', error);
    return false;
  }
}

function arabicToEnglishNumeral(arabicNumeral) {
  const arabicToEnglishMap = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };
  return arabicNumeral.replace(/[٠-٩]/g, d => arabicToEnglishMap[d]);
}

/*************  ✨ Codeium Command ⭐  *************/
/**
 * Handles various text commands related to names.
 * 
 * The function responds to specific text patterns:
 * 1. If the message text matches the pattern `كت`, it will randomly select
 *    a number of names from the predefined list and send them as a response.
 * 2. If the message text matches the pattern `.كت` followed by a number, and
 *    the sender is an admin, it updates the number of names to select for the
 *    next command. The number must be an integer between 1 and 100.
 * 3. If the sender is not an admin, the function will inform them that the
 *    command is restricted to admins.
 * 
 * The names are selected from a predefined list containing various character
 * names. The response is sent back to the chat.
 */

/******  61e91366-64f6-4a9d-a3f2-e0875e7a6036  *******/
handler.help = ['كت (أرسل .كت أو .كت <عدد> للحصول على أسماء عشوائية، فقط المشرفين يمكنهم تغيير العدد)'];
handler.tags = ['game'];
handler.command = /^كت$/i;
handler.all = async function(m) {
let names= [
          'لوفي', 'ناروتو', 'سابو', 'ايس', 'رايلي', 'جيرايا', 'ايتاتشي', 'ساسكي', 'شيسوي', 'يوهان',
          'غوهان', 'آيزن', 'فايوليت', 'نامي', 'هانكوك', 'روبين', 'كاكاشي', 'ريومو', 'ريمورو',
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

  let response;
if (/^كت$/i.test(m.text)) {
  let selectedNames = [];
  for (let i = 0; i < currentCount; i++) {
    let randomIndex = Math.floor(Math.random() * names.length);
    selectedNames.push(`*${names[randomIndex]}*`);
  }
  response = selectedNames.join(' '); // Join with " و " for names
} else if (/^\.كت\s*([\د٠-٩]+)?/i.test(m.text)) {
  let isAdminUser = await isAdmin(m, conn);
  if (isAdminUser) {
    let match = m.text.match(/^\.كت\s*([\d٠-٩]+)?/i);
    let count = match[1] ? parseInt(arabicToEnglishNumeral(match[1])) : 1;
    if (count > 0 && count <= 100) {
      currentCount = count;
      response = `تم تحديث عدد الأسماء إلى ${count}`;
    } else {
      response = 'الرجاء إدخال رقم بين 1 و 100';
    }
  } else {
    response = 'هذا الأمر مخصص للمشرفين فقط.';
  }
}

if (response) {
  await conn.sendMessage(m.chat, response);
}

return !0;
};

export default handler;
