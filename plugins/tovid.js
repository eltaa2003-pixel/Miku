import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { promisify } from 'util'

const writeFile = promisify(fs.writeFile)
const unlink = promisify(fs.unlink)
const access = promisify(fs.access)

// High-performance configuration for animated stickers
const CONFIG = {
  // Quality presets optimized for speed and quality
  quality: {
    ultra: {
      size: '1024:1024',
      fps: 30,
      bitrate: '2M',
      crf: '18', // Very high quality
      preset: 'medium', // Balance of speed/quality
      format: 'mp4',
      gifQuality: '1', // Best GIF quality
      filters: 'scale=1024:1024:flags=lanczos:force_original_aspect_ratio=decrease,pad=1024:1024:-1:-1:color=transparent@0.0'
    },
    high: {
      size: '512:512',
      fps: 25,
      bitrate: '1.5M',
      crf: '20',
      preset: 'fast', // Faster encoding
      format: 'mp4',
      gifQuality: '2',
      filters: 'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=transparent@0.0'
    },
    fast: {
      size: '256:256',
      fps: 20,
      bitrate: '800k',
      crf: '23',
      preset: 'veryfast', // Fastest encoding
      format: 'gif',
      gifQuality: '3',
      filters: 'scale=256:256:flags=lanczos:force_original_aspect_ratio=decrease,pad=256:256:-1:-1:color=transparent@0.0'
    }
  },
  timeout: 60000, // 60 seconds for animated content
  maxFileSize: 50 * 1024 * 1024, // 50MB for animated files
  maxDuration: 30, // Max 30 seconds
  threads: 4 // Multi-threading for speed
}

// Utility functions
const createTempDir = () => {
  const tmpDir = path.join(process.cwd(), 'tmp')
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true })
  }
  return tmpDir
}

const generateTempFilename = (extension) => {
  return `animated_sticker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${extension}`
}

const validateAnimatedFile = (buffer, format) => {
  if (!buffer || buffer.length < 16) return false
  
  if (format === 'gif') {
    // GIF signature: GIF87a or GIF89a
    const gifHeader = buffer.toString('ascii', 0, 6)
    return gifHeader === 'GIF87a' || gifHeader === 'GIF89a'
  } else if (format === 'mp4') {
    // MP4 signature: check for ftyp box
    const mp4Header = buffer.toString('ascii', 4, 8)
    return mp4Header === 'ftyp'
  }
  return false
}

const getAnimationInfo = async (inputPath) => {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      inputPath
    ])
    
    let stdout = ''
    
    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    ffprobe.on('close', (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(stdout)
          const videoStream = info.streams.find(s => s.codec_type === 'video')
          
          resolve({
            duration: parseFloat(info.format.duration) || 0,
            fps: eval(videoStream?.r_frame_rate) || 15,
            width: videoStream?.width || 512,
            height: videoStream?.height || 512,
            frames: videoStream?.nb_frames || 0
          })
        } catch (error) {
          reject(new Error('Failed to parse animation info'))
        }
      } else {
        reject(new Error('Failed to get animation info'))
      }
    })
  })
}

const cleanupFiles = async (...filePaths) => {
  for (const filePath of filePaths) {
    try {
      await access(filePath)
      await unlink(filePath)
    } catch (error) {
      // File doesn't exist or already cleaned up
    }
  }
}

const convertToGIF = async (inputPath, outputPath, options = {}) => {
  const {
    qualityPreset = 'high',
    timeout = CONFIG.timeout
  } = options

  const preset = CONFIG.quality[qualityPreset]

  return new Promise((resolve, reject) => {
    // Optimized GIF conversion with high quality and speed
    const args = [
      '-i', inputPath,
      '-vf', `${preset.filters},fps=${preset.fps},palettegen=stats_mode=diff`,
      '-y',
      `${outputPath}_palette.png`
    ]

    // First pass: Generate optimized palette
    const paletteGen = spawn('ffmpeg', args)
    
    paletteGen.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('Palette generation failed'))
        return
      }

      // Second pass: Create GIF with palette
      const gifArgs = [
        '-i', inputPath,
        '-i', `${outputPath}_palette.png`,
        '-filter_complex', `[0:v]${preset.filters},fps=${preset.fps}[v];[v][1:v]paletteuse=dither=bayer:bayer_scale=${preset.gifQuality}:diff_mode=rectangle`,
        '-threads', CONFIG.threads.toString(),
        '-y',
        outputPath
      ]

      const gifConvert = spawn('ffmpeg', gifArgs)
      let stderr = ''

      const timer = setTimeout(() => {
        gifConvert.kill('SIGKILL')
        reject(new Error(`GIF conversion timed out after ${timeout}ms`))
      }, timeout)

      gifConvert.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      gifConvert.on('close', (code) => {
        clearTimeout(timer)
        
        // Cleanup palette file
        cleanupFiles(`${outputPath}_palette.png`)
        
        if (code === 0) {
          resolve({ outputPath, format: 'gif' })
        } else {
          reject(new Error(`GIF conversion failed: ${stderr}`))
        }
      })
    })
  })
}

const convertToMP4 = async (inputPath, outputPath, options = {}) => {
  const {
    qualityPreset = 'high',
    timeout = CONFIG.timeout
  } = options

  const preset = CONFIG.quality[qualityPreset]

  return new Promise((resolve, reject) => {
    // High-performance MP4 conversion with hardware acceleration attempts
    const args = [
      '-i', inputPath,
      '-vf', preset.filters,
      '-c:v', 'libx264',
      '-preset', preset.preset,
      '-crf', preset.crf,
      '-b:v', preset.bitrate,
      '-maxrate', preset.bitrate,
      '-bufsize', `${parseInt(preset.bitrate) * 2}k`,
      '-r', preset.fps.toString(),
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', // Optimize for streaming
      '-threads', CONFIG.threads.toString(),
      '-tune', 'animation', // Optimize for animated content
      '-profile:v', 'high',
      '-level', '4.0',
      '-y',
      outputPath
    ]

    const ffmpeg = spawn('ffmpeg', args)
    let stderr = ''

    const timer = setTimeout(() => {
      ffmpeg.kill('SIGKILL')
      reject(new Error(`MP4 conversion timed out after ${timeout}ms`))
    }, timeout)

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    ffmpeg.on('close', (code) => {
      clearTimeout(timer)
      
      if (code === 0) {
        resolve({ outputPath, format: 'mp4' })
      } else {
        console.error('MP4 conversion stderr:', stderr)
        reject(new Error(`MP4 conversion failed: ${stderr}`))
      }
    })
  })
}

const convertAnimatedSticker = async (media, qualityPreset = 'high', outputFormat = 'auto') => {
  const tmpDir = createTempDir()
  const inputFile = path.join(tmpDir, generateTempFilename('webp'))
  
  try {
    // Write input file
    await writeFile(inputFile, media)

    // Get animation information
    const animInfo = await getAnimationInfo(inputFile)
    
    // Validate duration
    if (animInfo.duration > CONFIG.maxDuration) {
      throw new Error(`Animation too long: ${animInfo.duration}s (max: ${CONFIG.maxDuration}s)`)
    }

    // Auto-select format based on content and quality preset
    let targetFormat = outputFormat
    if (outputFormat === 'auto') {
      if (qualityPreset === 'ultra' || animInfo.duration > 10) {
        targetFormat = 'mp4' // Better for long/high-quality animations
      } else if (qualityPreset === 'fast' || animInfo.frames < 50) {
        targetFormat = 'gif' // Better for short/simple animations
      } else {
        targetFormat = 'mp4' // Default to MP4 for balanced quality/size
      }
    }

    const outputFile = path.join(tmpDir, generateTempFilename(targetFormat))
    let result

    // Convert based on target format
    if (targetFormat === 'gif') {
      result = await convertToGIF(inputFile, outputFile, { qualityPreset })
    } else {
      result = await convertToMP4(inputFile, outputFile, { qualityPreset })
    }

    // Read and validate output
    const outputBuffer = fs.readFileSync(result.outputPath)
    
    if (!validateAnimatedFile(outputBuffer, result.format)) {
      throw new Error(`Output is not a valid ${result.format.toUpperCase()} file`)
    }

    const stats = fs.statSync(result.outputPath)
    
    return {
      buffer: outputBuffer,
      format: result.format,
      fileSize: stats.size,
      originalInfo: animInfo,
      cleanup: () => cleanupFiles(inputFile, result.outputPath)
    }

  } catch (error) {
    // Cleanup on error
    await cleanupFiles(inputFile)
    throw error
  }
}

let handler = async (m, { conn, usedPrefix, command }) => {
  const notAnimatedStickerMessage = `✳️ Reply to an animated sticker with:\n\n *${usedPrefix + command}*\n\n📌 Quality & Format options:\n• ${usedPrefix + command} - High quality MP4 (512x512)\n• ${usedPrefix + command} ultra - Ultra quality MP4 (1024x1024)\n• ${usedPrefix + command} fast - Fast GIF (256x256)\n• ${usedPrefix + command} gif - Force GIF output\n• ${usedPrefix + command} mp4 - Force MP4 output`
  
  // Validate input
  if (!m.quoted) throw notAnimatedStickerMessage
  
  const q = m.quoted || m
  const mime = q.mediaType || ''
  
  // Check for animated sticker (webp with animation or gif)
  if (!/sticker/.test(mime) && !/gif/.test(mime)) {
    throw notAnimatedStickerMessage
  }

  // Parse arguments
  const args = m.text.split(' ').slice(1)
  let qualityPreset = 'high' // Default
  let outputFormat = 'auto' // Auto-select format
  
  for (const arg of args) {
    const lowerArg = arg.toLowerCase()
    if (['ultra', 'high', 'fast'].includes(lowerArg)) {
      qualityPreset = lowerArg
    } else if (['gif', 'mp4'].includes(lowerArg)) {
      outputFormat = lowerArg
    }
  }

  const qualityText = {
    ultra: 'جودة فائقة (1024×1024) - MP4',
    high: 'جودة عالية (512×512) - تحديد تلقائي', 
    fast: 'معالجة سريعة (256×256) - GIF'
  }

  const formatText = {
    gif: 'GIF متحرك',
    mp4: 'فيديو MP4',
    auto: 'تحديد تلقائي'
  }

  // Send processing message
  const processingMsg = await m.reply(`⚡ جارٍ تحويل الملصق المتحرك...\n📊 الجودة: ${qualityText[qualityPreset]}\n🎬 التنسيق: ${formatText[outputFormat]}\n\n⏳ قد يستغرق حتى دقيقة للجودة العالية...`)

  try {
    // Download media
    const media = await q.download()
    
    if (!media || media.length === 0) {
      throw new Error('Failed to download animated sticker data')
    }

    if (media.length > CONFIG.maxFileSize) {
      throw new Error('Animated sticker file is too large')
    }

    // Convert animated sticker
    console.log(`Starting animated conversion: ${qualityPreset} quality, ${outputFormat} format`)
    const startTime = Date.now()
    
    const result = await convertAnimatedSticker(media, qualityPreset, outputFormat)
    
    const conversionTime = ((Date.now() - startTime) / 1000).toFixed(1)
    
    // Validate final output
    if (!result.buffer || result.buffer.length === 0) {
      throw new Error('Conversion produced empty result')
    }

    // Create success message with detailed info
    const fileSizeMB = (result.fileSize / (1024 * 1024)).toFixed(2)
    const fileSizeKB = Math.round(result.fileSize / 1024)
    
    let successMessage = '*✅ تم تحويل الملصق المتحرك بنجاح!*'
    successMessage += `\n\n📊 معلومات التحويل:`
    successMessage += `\n🎬 التنسيق: ${result.format.toUpperCase()}`
    successMessage += `\n📐 الأبعاد: ${CONFIG.quality[qualityPreset].size}`
    successMessage += `\n📁 الحجم: ${fileSizeMB}MB (${fileSizeKB}KB)`
    successMessage += `\n⏱️ المدة الأصلية: ${result.originalInfo.duration.toFixed(1)}s`
    successMessage += `\n🎞️ الإطارات: ${result.originalInfo.frames || 'غير محدد'}`
    successMessage += `\n⚡ وقت المعالجة: ${conversionTime}s`

    // Determine file extension and mime type
    const fileExt = result.format
    const fileName = `animated-sticker-${qualityPreset}.${fileExt}`
    
    // Send the converted animated file
    await conn.sendFile(
      m.chat,
      result.buffer,
      fileName,
      successMessage,
      m,
      false,
      {
        mimetype: result.format === 'gif' ? 'image/gif' : 'video/mp4'
      }
    )

    // Cleanup temporary files
    if (result.cleanup) {
      await result.cleanup()
    }

    console.log(`Animated conversion completed successfully in ${conversionTime}s`)

  } catch (error) {
    console.error('Animated sticker conversion error:', error)
    
    // Send user-friendly error message
    let errorMessage = '❌ حدث خطأ أثناء تحويل الملصق المتحرك.'
    
    if (error.message.includes('timeout')) {
      errorMessage += '\n⏰ العملية استغرقت وقتاً أطول من المتوقع. جرب جودة أقل.'
    } else if (error.message.includes('too large')) {
      errorMessage += '\n📏 حجم الملصق كبير جداً.'
    } else if (error.message.includes('too long')) {
      errorMessage += '\n⏳ الملصق طويل جداً (الحد الأقصى 30 ثانية).'
    } else if (error.message.includes('download')) {
      errorMessage += '\n📥 فشل في تحميل الملصق المتحرك.'
    } else if (error.message.includes('not animated')) {
      errorMessage += '\n🎭 هذا ليس ملصق متحرك. استخدم الأمر العادي للملصقات الثابتة.'
    } else if (error.message.includes('exceeds maximum size')) {
      errorMessage += '\n💾 حجم الملف المحول كبير جداً. جرب جودة أقل.'
    } else {
      errorMessage += '\n🔄 حاول مرة أخرى أو استخدم جودة أقل.'
    }
    
    errorMessage += `\n\n💡 نصائح:`
    errorMessage += `\n• ${usedPrefix + command} fast - للمعالجة السريعة`
    errorMessage += `\n• ${usedPrefix + command} gif - لملفات GIF أصغر`
    errorMessage += `\n• تأكد أن الملصق متحرك وليس ثابت`
    
    await m.reply(errorMessage)
    
    // Update processing message to show error
    if (processingMsg) {
      try {
        await conn.sendMessage(m.chat, { 
          text: errorMessage,
          edit: processingMsg.key 
        })
      } catch (editError) {
        // Ignore edit errors
      }
    }
  }
}

handler.help = ['toanimated <animated sticker> [quality] [format]', 'Quality: ultra, high, fast | Format: gif, mp4, auto']
handler.tags = ['sticker']
handler.command = ['متحرك', 'toanimated', 'togif', 'لفيد']
handler.limit = 2 // Higher limit due to processing intensity
handler.register = false
handler.premium = false

export default handler