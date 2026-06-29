import sharp from 'sharp';

const MAX_IMAGE_SIZE = 1280;
const THUMBNAIL_SIZE = 320;

export async function prepareWhatsAppImage(buffer) {
  const image = sharp(buffer, { animated: false })
    .rotate()
    .resize({
      width: MAX_IMAGE_SIZE,
      height: MAX_IMAGE_SIZE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: '#ffffff' })
    .jpeg({
      quality: 88,
      progressive: false,
      mozjpeg: false,
    });

  const imageBuffer = await image.toBuffer();
  const jpegThumbnail = await sharp(imageBuffer)
    .resize({
      width: THUMBNAIL_SIZE,
      height: THUMBNAIL_SIZE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 70,
      progressive: false,
      mozjpeg: false,
    })
    .toBuffer();

  return {
    image: imageBuffer,
    mimetype: 'image/jpeg',
    jpegThumbnail,
  };
}