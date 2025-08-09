import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'

let handler = async (m, { conn, usedPrefix, command }) => {
  const notStickerMessage = `✳️ Reply to a sticker with :\n\n *${usedPrefix + command}*`
  if (!m.quoted) throw notStickerMessage
  const q = m.quoted || m
  let mime = q.mediaType || ''
  if (!/sticker/.test(mime)) throw notStickerMessage
  
  m.reply('⏳ جارٍ تحويل الملصق إلى صورة...')
  
  try {
    let media = await q.download()
    
    // Check if it's animated WebP by looking for ANIM chunks
    const isAnimated = media.toString('ascii', 0, Math.min(media.length, 1000)).includes('ANIM')
    
    if (isAnimated) {
      console.log('Detected animated WebP, will extract first frame')
    }
    
    // Try using the existing converter first (most reliable)
    try {
      const { ffmpeg } = await import('../lib/converter.js')
      const imageBuffer = await ffmpeg(media, [
        '-vf', 'scale=512:512'
      ], 'webp', 'png')
      
      if (imageBuffer && imageBuffer.length > 0) {
        await conn.sendFile(m.chat, imageBuffer, 'sticker-to-image.png', '*✅ تم تحويل الملصق إلى صورة بنجاح!*', m)
        return
      }
    } catch (converterError) {
      console.log('Converter method failed, trying direct FFmpeg...')
    }
    
    // Fallback to direct FFmpeg with different approach
    const tmpDir = path.join(process.cwd(), 'tmp')
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }
    
    const webpFile = path.join(tmpDir, `sticker_${Date.now()}.webp`)
    const pngFile = path.join(tmpDir, `image_${Date.now()}.png`)
    
    // Save the sticker to temp file
    fs.writeFileSync(webpFile, media)
    
    // Convert using ffmpeg with different parameters for animated WebP
    await new Promise((resolve, reject) => {
      const args = [
        '-i', webpFile,
        '-vf', 'scale=512:512'
      ]
      
      // Add frame extraction for animated WebP
      if (isAnimated) {
        args.splice(2, 0, '-vframes', '1') // Extract only first frame
      }
      
      args.push(
        '-pix_fmt', 'rgb24', // Force RGB format
        '-f', 'image2',
        '-vcodec', 'png', // Explicitly use PNG codec
        '-y',
        pngFile
      )
      
      const ffmpeg = spawn('ffmpeg', args)
      
      let stderr = ''
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      ffmpeg.on('error', (error) => {
        console.error('FFmpeg spawn error:', error)
        reject(error)
      })
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          // Verify the output file
          if (!fs.existsSync(pngFile)) {
            reject(new Error('Output file was not created'))
            return
          }
          
          const stats = fs.statSync(pngFile)
          if (stats.size === 0) {
            reject(new Error('Output file is empty'))
            return
          }
          
          // Check if it's actually a PNG file
          const fileBuffer = fs.readFileSync(pngFile, { start: 0, end: 8 })
          if (fileBuffer.length < 8 || fileBuffer.toString('ascii', 0, 8) !== '\x89PNG\r\n\x1a\n') {
            console.error('Invalid PNG header:', fileBuffer.toString('hex', 0, 8))
            reject(new Error('Output file is not a valid PNG'))
            return
          }
          
          resolve()
        } else {
          console.error('FFmpeg stderr:', stderr)
          reject(new Error(`FFmpeg exited with code ${code}. Error: ${stderr}`))
        }
      })
    })
    
    // Read the converted image
    const imageBuffer = fs.readFileSync(pngFile)
    
    // Additional validation
    if (imageBuffer.length === 0) {
      throw new Error('Converted image is empty')
    }
    
    // Send the high quality image
    await conn.sendFile(m.chat, imageBuffer, 'sticker-to-image.png', '*✅ تم تحويل الملصق إلى صورة بنجاح!*', m)
    
    // Clean up temp files
    try {
      fs.unlinkSync(webpFile)
      fs.unlinkSync(pngFile)
    } catch (cleanupError) {
      // Silent cleanup
    }
    
  } catch (error) {
    console.error('ToImg Error:', error)
    
    // Try alternative method using different parameters
    try {
      let media = await q.download()
      const tmpDir = path.join(process.cwd(), 'tmp')
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true })
      }
      
      const webpFile = path.join(tmpDir, `sticker_alt_${Date.now()}.webp`)
      const pngFile = path.join(tmpDir, `image_alt_${Date.now()}.png`)
      
      fs.writeFileSync(webpFile, media)
      
      // Try with simpler parameters and force frame extraction
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-i', webpFile,
          '-vframes', '1', // Always extract first frame
          '-vcodec', 'png',
          '-y',
          pngFile
        ])
        
        ffmpeg.on('close', (code) => {
          if (code === 0 && fs.existsSync(pngFile) && fs.statSync(pngFile).size > 0) {
            resolve()
          } else {
            reject(new Error('Alternative conversion failed'))
          }
        })
      })
      
      const imageBuffer = fs.readFileSync(pngFile)
      await conn.sendFile(m.chat, imageBuffer, 'sticker-to-image.png', '*✅ تم تحويل الملصق إلى صورة بنجاح!*', m)
      
      // Clean up
      try {
        fs.unlinkSync(webpFile)
        fs.unlinkSync(pngFile)
      } catch (e) {}
      
      return
      
    } catch (altError) {
      console.error('Alternative method also failed:', altError)
    }
    
    // Try using online service as last resort
    try {
      console.log('Trying online conversion service...')
      
      const formData = new FormData()
      formData.append('new-image', new Blob([media], { type: 'image/webp' }), 'sticker.webp')
      formData.append('new-image_url', '')
      formData.append('new-image_extension', 'webp')
      formData.append('submit', 'Convert Now!')
      
      const response = await fetch('https://s11.ezgif.com/webp-to-png', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        throw new Error('Online service request failed')
      }
      
      const html = await response.text()
      const match = html.match(/https:\/\/s11\.ezgif\.com\/v\/[^"]+\.png/)
      
      if (!match) {
        throw new Error('Could not find converted image URL')
      }
      
      const imageUrl = match[0]
      const imageResponse = await fetch(imageUrl)
      const imageBuffer = await imageResponse.buffer()
      
      if (imageBuffer && imageBuffer.length > 0) {
        await conn.sendFile(m.chat, imageBuffer, 'sticker-to-image.png', '*✅ تم تحويل الملصق إلى صورة بنجاح!*', m)
        return
      }
      
    } catch (onlineError) {
      console.error('Online conversion also failed:', onlineError)
    }
    
    // Final fallback: send error message
    await m.reply('❌ حدث خطأ أثناء تحويل الملصق إلى صورة. حاول مرة أخرى.')
  }
}

handler.help = ['toimg <sticker>']
handler.tags = ['sticker']
handler.command = ['لصورة', 'toimg']

export default handler