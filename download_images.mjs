import fs from 'fs';
import path from 'path';
import https from 'https';

const images = {
  "https://i.postimg.cc/rpSvcCvh/017cf1887b461a1cadd6903aa4831fa2-1.jpg": "ميريوليونا",
  "https://i.postimg.cc/zvSBggbp/0a59886819700c644f133f64b611d735-1.jpg": "ايرين",
  "https://i.postimg.cc/3NpGbNyD/135c143e20047660fd47faf448bc9afd-1.jpg": "غابيمارو",
  "https://i.postimg.cc/cJHnGXgW/1e1df5de1a628d6d6f4d4a6ad8384a47-1.jpg": "غوجو",
  "https://i.postimg.cc/TP8ZZHHL/1f275bc4501655f9b9d790f927bb422f-1.jpg": "ناخت",
  "https://i.postimg.cc/MZDq1x3s/238c5c3108b6d34af284773ce471a625-1.jpg": "تانجيرو",
  "https://i.postimg.cc/bJyFPX0J/2814d3f4b243a87d2150363729f3d732-1.jpg": "كاكاشي",
  "https://i.postimg.cc/mgZc78S9/28dc5d2f0fa5c4fb2f25319f8ef32842-1.jpg": "شينوبو",
  "https://i.postimg.cc/J4p7Cmby/2981a2efcb8f97cdd82968e3ae2288ed-2.jpg": "بان",
  "https://i.postimg.cc/QdMtFVXk/2b3358a7255ae7220bfb8dd9a69b5668-1.jpg": "انيا",
  "https://i.postimg.cc/6qTj7dmx/306f39ef97e6a8538882c51f4f0aa449-1.jpg": "روكيا",
  "https://i.postimg.cc/yNbS1ccZ/36f3e75ad216969da98638a9e4478ff5-1.jpg": "ميجورو",
  "https://i.postimg.cc/nzKZRtFh/38635168690023e93e32233e1362be9e-2.jpg": "ليبي",
  "https://i.postimg.cc/CKzzQ5XL/39635347763322b1c91f7f144cefbeea-1.jpg": "دابي",
  "https://i.postimg.cc/c4kW5hSw/3b57b3ef59f3c37117db61b2c0a9ab38-2.jpg": "هيناتا",
  "https://i.postimg.cc/5thNK38n/46c6ac3075801cfe6080ae93b9226065-1.jpg": "اليا",
  "https://i.postimg.cc/50JWFkBd/4cc4f2b1ec66b035bb527beaa5bff290-2.jpg": "شانكس",
  "https://i.postimg.cc/J0wDJ8T7/522e2df4da526f76711e067b971b7696-1.jpg": "ماكي",
  "https://i.postimg.cc/yxFJyG5m/52affa99223d37f512c0cb2ea87b2f56-1.jpg": "شوتو_1",
  "https://i.postimg.cc/x8RfCVh4/530ee3708a477f6ce8794dd322f51f8d-1.jpg": "باكوغو",
  "https://i.postimg.cc/MKH2RBQT/563f7aee99751b8d33be8835cc88bab9-1.jpg": "ايرين_2",
  "https://i.postimg.cc/tCNZ1LFy/5da232fec13ef0aa6b0600bef07008c9-2.jpg": "ميكاسا",
  "https://i.postimg.cc/kXHry5Qy/5eaeb4e2e68cdfe7bf04722e51ccf215-1.jpg": "زورو",
  "https://i.postimg.cc/XYXjVh8s/635e210a5701535631886639a7610ce5-2.jpg": "غورين",
  "https://i.postimg.cc/mrCGkGFy/6965c564437f65029f2f80128d3ad859-1.jpg": "رانبو",
  "https://i.postimg.cc/W3dggXT8/7429b4c82082bd314daa58bc72fe58cd.jpg": "مارين",
  "https://i.postimg.cc/fbhrHSJY/774bd711b583083aaa324ce8f4a03fe2-1.jpg": "ساسكي",
  "https://i.postimg.cc/brM61s7D/7f067d4bd80467ef2fc716f917c03c7d-1.jpg": "كيسكي",
  "https://i.postimg.cc/zBHHVvFP/809047dc72705df0dd1eda5f850dc011-2.jpg": "كين",
  "https://i.postimg.cc/Yqr2PjmK/86017a6b760d2259165b8739cb0aa643-2.jpg": "سوكونا",
  "https://i.postimg.cc/zGdy7Kdc/87e0b57d502a6d85975f7c90a6f6915d-2.jpg": "توكيتو",
  "https://i.postimg.cc/qvQ3F97Q/948ead3bd439f3ed8631201fc5a066f5-1.jpg": "ميتسوري",
  "https://i.postimg.cc/cL5JwZCq/9d939ff1521ca327788dc07069fd6274-1.jpg": "توغي",
  "https://i.postimg.cc/br8YpwCn/a23bf61771037aa7c595c5246b8f9d5b-2.jpg": "شوكو",
  "https://i.postimg.cc/3rnQd1WV/a272dfb2f44ac4b1bb59332ce6a96c33-1.jpg": "نانامي",
  "https://i.postimg.cc/T2qYQn1J/a375971e0e793f11a40e7ebe7fda228e-1.jpg": "ساكورا",
  "https://i.postimg.cc/dVZbNKnc/a919765f9da80a849df4333436527624-1.jpg": "ديكو",
  "https://i.postimg.cc/XJ5XnhnR/aa74b26be38435c005a6356cc92c4703-1.jpg": "شوتو_2",
  "https://i.postimg.cc/yYH38Vgv/b26f7f298cec8a36bc69d798e1bca1b8-1.jpg": "يوجي",
  "https://i.postimg.cc/nLgCbZfK/b8ba274ae68a964080512f314b9a0c05-3.jpg": "شادو",
  "https://i.postimg.cc/JnSJqZhL/ba380b9152e3b18f873846e0b1c8def2.jpg": "ايرزا",
  "https://i.postimg.cc/26njsZwm/be3b5fbb7b64eb82bb5e8a584f9b300e-1.jpg": "شيغاراكي",
  "https://i.postimg.cc/y8wH7NWN/c12a672f22ce9b3632cca926c2d37027-2.jpg": "غون",
  "https://i.postimg.cc/pXCrVKtL/c249e4271d4b9bf308e78560f5ece122-1.jpg": "تشانغ",
  "https://i.postimg.cc/HkMN49sp/c2b01147395346e972352ee81c545c2d-1.jpg": "ياماتو",
  "https://i.postimg.cc/NFfhd9Cd/c485732f7532d09f239edcb81bf9428d-1.jpg": "ايس",
  "https://i.postimg.cc/yY8BP5w7/c7a382047045f218d1e36ffcd7878ebb-1.jpg": "سيل",
  "https://i.postimg.cc/Pxy9vffY/c9b8d034f911fb387a0ba6ace66704b3-1.jpg": "روبين",
  "https://i.postimg.cc/kMxDZk18/cd9fbd7a5a930c7a5b24749da7052399-1.jpg": "فريرين",
  "https://i.postimg.cc/R06ZT8JW/cda7d1b97e8dba8a12cb1eacf38cb77d-1.jpg": "اوبيتو",
  "https://i.postimg.cc/7PQtFW5H/d27fe9ccc9ebc3aa12d6bebd9c5bf306-1.jpg": "ايتشيغو",
  "https://i.postimg.cc/sfnbV2NR/dc272775e47fec42fa31d3af4437a3ff.jpg": "لاو",
  "https://i.postimg.cc/SQzcKTZN/df491b0555cdb7a5c08664b334f575b2.jpg": "لوسي",
  "https://i.postimg.cc/pTBbQYC9/e206ddf0f27e3b1084a18b9f6635a514-1.jpg": "هوتارو",
  "https://i.postimg.cc/bNxbxGc7/e30e4ef52da2edde6d7502549c6a0c8c-1.jpg": "توجي",
  "https://i.postimg.cc/GhHV91WT/e9dab0f3b76c0fb5022818bf6098a247-1.jpg": "نامي",
  "https://i.postimg.cc/GtMWVLZd/ebe7b4e8d59b91b3f881ccc0ea8c20d5-1.jpg": "غيو",
  "https://i.postimg.cc/wj9N0697/eec57d6aaceec8bf0f34ebd842b209d9-1.jpg": "توغا",
  "https://i.postimg.cc/ncg5DPxR/ef2d9a6faead11bb68a986fdefcc4185-1.jpg": "كاروت",
  "https://i.postimg.cc/3RtfJL9Z/f37896c54355b9ad4a6d1c8d43fabb25-1.jpg": "ايتاتشي",
  "https://i.postimg.cc/MKM3qmBy/f7b53b830cb12606495529d4503b48c0-1.jpg": "كورابيكا",
  "https://i.postimg.cc/sXsb2Gz3/f7ed6ed115daea80119a49d6e80fa716-1.jpg": "كوبي",
  "https://i.postimg.cc/Y2gm749v/f8309ad7747ce749bf08a1e849f4b799-2.jpg": "كيلوا",
  "https://i.postimg.cc/YqKYL6VN/feb9600eac8cbb5d8419cbcfb2301fe2-1.jpg": "تشوسو",
  "https://i.postimg.cc/mDpVGP2X/58cfc28ad97b65ada8a68310217a47f4.jpg": "واغوري"
};

const OUTPUT_DIR = './assets/characters';
const GITHUB_BASE = 'https://raw.githubusercontent.com/eltaa2003-pixel/Miku/main/assets/characters';

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

const newJson = {};
let count = 0;

for (const [url, answer] of Object.entries(images)) {
  const ext = path.extname(url);
  const name = Array.isArray(answer) ? answer[0] : answer;
  const filename = `${name}${ext}`;
  const dest = path.join(OUTPUT_DIR, filename);
  const githubUrl = `${GITHUB_BASE}/${encodeURIComponent(filename)}`;

  process.stdout.write(`Downloading ${name}... `);
  try {
    await download(url, dest);
    console.log('✓');
  } catch (e) {
    console.log(`✗ (${e.message})`);
    continue;
  }

  // Preserve array answers (like اوبيتو/توبي)
  newJson[githubUrl] = answer;
  count++;
}

fs.writeFileSync('./images.json', JSON.stringify(newJson, null, 2), 'utf8');
console.log(`\nDone! ${count} images downloaded to ${OUTPUT_DIR}/`);
console.log('Updated images.json written with new GitHub URLs.');
console.log('\nNext steps:');
console.log('  1. Copy the assets/ folder into your Miku repo');
console.log('  2. Copy images.json to the right place in your repo');
console.log('  3. git add assets/ images.json && git commit -m "migrate images to GitHub" && git push');