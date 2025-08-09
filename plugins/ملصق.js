import fetch from 'node-fetch';
import { addExif, sticker as createBasicSticker } from '../lib/sticker.js';
import { Sticker } from 'wa-sticker-formatter';
import fs from 'fs';
import path from 'path';

let handler = async (m, { conn, args, usedPrefix, command }) => {
  let stiker = false;
  try {
    let [packname, ...author] = args.join(' ').split(/!|\|/);
    author = (author || []).join('|');
    
    // Set default packname and author
    let finalPackname = 'Yuki'; // Default packname
    let finalAuthor = ''; // Default author is empty
    
    // If user provided both packname and author (separated by |)
    if (packname && author) {
      finalPackname = packname;
      finalAuthor = author;
    }
    // If user provided only one name (no | separator) - this becomes the packname only
    else if (packname && !author) {
      finalPackname = packname; // The name becomes the packname
      finalAuthor = ''; // No author
    }
    // If no arguments provided, use defaults
    else {
      finalPackname = 'Yuki';
      finalAuthor = '';
    }
    
    let q = m.quoted ? m.quoted : m;
    let mime = (q.msg || q).mimetype || q.mediaType || '';
    
    // Check if we have media to work with
    if (!q.msg && !q.mediaType && !args[0]) {
      throw `*RESPOND TO AN IMAGE, VIDEO, OR GIF WITH ${usedPrefix + command}*`;
    }

    let img = null;
    if (/webp/g.test(mime)) {
      img = await q.download?.();
      if (!img) throw new Error('Failed to download media');
      stiker = await addExif(img, finalPackname, finalAuthor);
    } else if (/image/g.test(mime)) {
      img = await q.download?.();
      if (!img) throw new Error('Failed to download media');
      stiker = await createSticker(img, false, finalPackname, finalAuthor);
    } else if (/video/g.test(mime) || /gif/g.test(mime)) {
      img = await q.download?.();
      if (!img) throw new Error('Failed to download media');
      if ((q.msg || q).seconds > 7) return m.reply('*Video or GIF cannot be longer than 7 seconds*');
      stiker = await createSticker(img, false, finalPackname, finalAuthor, true);
    } else if (args[0] && isUrl(args[0])) {
      stiker = await createSticker(false, args[0], finalPackname, finalAuthor);
    } else {
      throw `*RESPOND TO AN IMAGE, VIDEO, OR GIF WITH ${usedPrefix + command}*`;
    }
  } catch (e) {
    console.error('Sticker creation error:', e);
    
    // Quick fallback to basic sticker creation
    try {
      let q = m.quoted ? m.quoted : m;
      let img = await q.download?.();
      if (img) {
        stiker = await createBasicSticker(img, false, 'Yuki', '');
      } else {
        stiker = '*Failed to create sticker*';
      }
    } catch (fallbackError) {
      console.error('Fallback sticker creation error:', fallbackError);
      stiker = '*Failed to create sticker*';
    }
  } finally {
    if (stiker instanceof Buffer && stiker.length > 0) {
      // Fast path: send directly as sticker without file I/O
      try {
        await conn.sendMessage(m.chat, { 
          stickerMessage: { 
            url: `data:image/webp;base64,${stiker.toString('base64')}` 
          }
        });
      } catch (sendError) {
        console.error('Direct send failed, trying file method:', sendError);
        
        // Fallback to file method
        let tmpFile = null;
        try {
          const tmpDir = path.join(process.cwd(), 'tmp');
          if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
          }
          
          tmpFile = path.join(tmpDir, `sticker_${Date.now()}.webp`);
          fs.writeFileSync(tmpFile, stiker);
          
          await conn.sendFile(m.chat, tmpFile, '', '', m, { asSticker: true });
          
        } catch (fileError) {
          console.error('File method failed:', fileError);
          m.reply('*Failed to send sticker*');
        } finally {
          if (tmpFile && fs.existsSync(tmpFile)) {
            try {
              fs.unlinkSync(tmpFile);
            } catch (cleanupError) {
              // Silent cleanup error
            }
          }
        }
      }
    } else {
      m.reply(stiker);
    }
  }
};

handler.help = ['sfull'];
handler.tags = ['sticker'];
handler.command = ['ملصق','ملصقي'];
export default handler;

const isUrl = (text) => {
  return /https?:\/\/\S+\.(jpg|jpeg|png|gif)/i.test(text);
};

async function createSticker(img, url, packName, authorName, animated = false, quality = 20) {
  try {
    let stickerMetadata = { 
      type: animated ? 'full' : 'default', 
      pack: packName || 'Yuki', 
      author: authorName || '', 
      quality 
    };
    
    const sticker = new Sticker(img ? img : url, stickerMetadata);
    const buffer = await sticker.toBuffer();
    
    if (!buffer || buffer.length === 0) {
      throw new Error('Generated sticker buffer is empty');
    }
    
    return buffer;
  } catch (error) {
    console.error('Error creating sticker:', error);
    throw new Error('Failed to create sticker');
  }
}