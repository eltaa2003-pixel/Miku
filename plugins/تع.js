let handler = m => m;

handler.all = async function(m) {
  // Access the chat object in the global database
  let chat = global.db.data.chats[m.chat];

  // Define the responses
  let responses;
  if (/^تع$/i.test(m.text)) {
    responses = [
      '3 / *هاشيرا*', '3 / *قبعة القش*', '3 / *طاقم روجر*', '3 / *طاقم اللحيه*', '3 / *بحرية*', '3 / *هوكاجي*', '3 / *كاجي*', '3 / *سانين*', '3 / *بليتش*', '3 / *قادة*', '3 / *جنرالات*', '3 / *كينقدوم*', '3 / *ارانكار*', '3 / *فول ميتال*', '3 / *كيميتسو*', '3 / *شياطين*', '3 / *بلاك كلوفر*', '3 / *قمر علوي*', '3 / *ثالوث اعظم*', '3 / *اسبادا*', '3 / *نواب*', '3 / *معجزات*', '3 / *فايزارد*', '3 / *يونكو*', '3 / *انتيك*', '3 / *غريمات*'
    ];
  }

  // Send a random response if the condition is met
  if (responses) {
    let randomIndex = Math.floor(Math.random() * responses.length);
    let randomResponse = responses[randomIndex];
    await conn.sendMessage(m.chat, randomResponse);
  }

  return !0;
};

export default handler;
