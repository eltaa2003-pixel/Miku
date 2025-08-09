import { MongoClient } from 'mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import AudioHandler from '../lib/audio-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class EnhancedYukiPlugin {
    constructor(config) {
        this.config = {
            mongoUrl: config.mongoUrl || 'mongodb://localhost:27017',
            dbName: config.dbName || 'yuki_bot',
            geminiApiKey: config.geminiApiKey,
            googleSearchApiKey: config.googleSearchApiKey,
            googleSearchEngineId: config.googleSearchEngineId,
            botUserId: config.botUserId,
            ...config
        };
        
        this.db = null;
        this.genAI = null;
        this.isInitialized = false;
        this.lastMessageIds = new Map();
        this.watchedFiles = new Map(); // For code monitoring
        this.audioHandler = null; // Audio search and download
        
        // Emotional states
        this.emotionalStates = {
            HAPPY: 'happy',
            NEUTRAL: 'neutral', 
            ANGRY: 'angry',
            COLD: 'cold',
            EXCITED: 'excited'
        };

        // Command patterns - all require .يوكي prefix
        this.commandPatterns = {
            search: /^\.يوكي\s+(ابحث|بحث|search)\s+(.+)/i,
            image: /^\.يوكي\s+(صورة|صور|image|images)\s+(.+)/i,
            audio: /^\.يوكي\s+(صوت|موسيقى|music|audio)\s+(.+)/i,
            download: /^\.يوكي\s+(تحميل|download)\s+(\d+)$/i,
            code: /^\.يوكي\s+(كود|code)\s+(حالة|status)$/i,
            help: /^\.يوكي\s+(مساعدة|help|commands)$/i,
            pluginList: /^\.يوكي\s+(إضافات|plugins)$/i,
            pluginExplain: /^\.يوكي\s+(اشرح|شرح|explain)\s+(\d+)$/i,
            // Image processing patterns
            enhance: /^\.يوكي\s+(تحسين|حسني|enhance|hdr)(\s+الصورة|\s+image)?$/i,
            dehaze: /^\.يوكي\s+(ضبابية|dehaze|clear)(\s+الصورة|\s+image)?$/i,
            toimage: /^\.يوكي\s+(لصورة|toimg|convert)(\s+الملصق|\s+sticker)?$/i
        };
    }

    async initialize() {
        try {
            // Initialize MongoDB
            this.mongoClient = new MongoClient(this.config.mongoUrl);
            await this.mongoClient.connect();
            this.db = this.mongoClient.db(this.config.dbName);
            
            // Initialize Gemini AI
            this.genAI = new GoogleGenerativeAI(this.config.geminiApiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            
            // Create collections
            await this.createCollections();
            
            // Initialize code monitoring
            await this.initializeCodeMonitoring();
            
            // Initialize audio handler
            this.audioHandler = new AudioHandler({
                youtubeApiKey: this.config.youtubeApiKey,
                downloadPath: './downloads/audio'
            });
            
            this.isInitialized = true;
            console.log('Enhanced يوكي initialized successfully! 🚀');
        } catch (error) {
            console.error('Error initializing Enhanced يوكي:', error);
            throw error;
        }
    }

    async createCollections() {
        const collections = [
            'users', 'conversations', 'learning_data', 'emotional_context',
            'search_history', 'media_cache', 'code_monitoring'
        ];
        
        for (const collectionName of collections) {
            const exists = await this.db.listCollections({ name: collectionName }).hasNext();
            if (!exists) {
                await this.db.createCollection(collectionName);
            }
        }
    }

    async initializeCodeMonitoring() {
        // Watch important files for changes
        const filesToWatch = [
            'main.js', 'handler.js', 'config.js',
            'plugins/', 'lib/'
        ];

        for (const file of filesToWatch) {
            try {
                if (fs.existsSync(file)) {
                    fs.watchFile(file, { interval: 1000 }, (curr, prev) => {
                        this.handleFileChange(file, curr, prev);
                    });
                    this.watchedFiles.set(file, { lastModified: new Date() });
                }
            } catch (error) {
                console.log(`Could not watch file ${file}:`, error.message);
            }
        }
    }

    async handleFileChange(filename, curr, prev) {
        if (curr.mtime !== prev.mtime) {
            const changeInfo = {
                filename,
                timestamp: new Date(),
                size: curr.size,
                previousSize: prev.size
            };

            // Store in database
            await this.db.collection('code_monitoring').insertOne(changeInfo);
            
            console.log(`📝 File changed: ${filename}`);
        }
    }

    // Enhanced message handler with new features
    async handleMessage(message, userId, messageId, replyToId = null) {
        if (!this.isInitialized) {
            throw new Error('Enhanced يوكي is not initialized.');
        }

        try {
            // Check for activation command
            if (message.trim() === '.يوكي') {
                return await this.handleActivation(userId, messageId);
            }

            // Check for special commands
            const commandResponse = await this.handleCommands(message, userId);
            if (commandResponse) {
                await this.saveInteraction(userId, message, commandResponse, messageId);
                return commandResponse;
            }

            // Check if user is trying to use old command format
            if (this.isOldCommandFormat(message)) {
                return 'لازم تكتبي ".يوكي" قبل الامر! 😊\nمثال: .يوكي ابحث عن شي\nاو اكتبي ".يوكي مساعدة" لتشوفي كل الاوامر';
            }

            // Check if message starts with .يوكي but isn't a command
            if (message.startsWith('.يوكي ')) {
                const actualMessage = message.replace(/^\.يوكي\s+/, '');
                const userContext = await this.getUserContext(userId);
                const response = await this.generateResponse(actualMessage, userContext, userId);
                await this.saveInteraction(userId, actualMessage, response, messageId);
                this.lastMessageIds.set(`yuki_${userId}`, messageId);
                return response;
            }

            // If message doesn't start with .يوكي, ignore it (user hasn't activated properly)
            return null;
        } catch (error) {
            console.error('Error handling message:', error);
            return 'معليش، صار عندي مشكلة صغيرة. جرب تاني 🤖';
        }
    }

    // Check if user is using old command format
    isOldCommandFormat(message) {
        const oldPatterns = [
            /^(ابحث|بحث|search)\s+/i,
            /^(صورة|صور|image|images)\s+/i,
            /^(صوت|موسيقى|music|audio)\s+/i,
            /^(تحميل|download)\s+\d+$/i,
            /^(كود|code)\s+(حالة|status)$/i,
            /^(مساعدة|help|commands)$/i,
            /^(تحسين|حسني|enhance|hdr)(\s+الصورة|\s+image)?$/i,
            /^(ضبابية|dehaze|clear)(\s+الصورة|\s+image)?$/i,
            /^(لصورة|toimg|convert)(\s+الملصق|\s+sticker)?$/i
        ];
        
        return oldPatterns.some(pattern => pattern.test(message));
    }

    async handleCommands(message, userId) {
        // Google Search Command
        const searchMatch = message.match(this.commandPatterns.search);
        if (searchMatch) {
            return await this.handleGoogleSearch(searchMatch[2], userId);
        }

        // Image Search Command
        const imageMatch = message.match(this.commandPatterns.image);
        if (imageMatch) {
            return await this.handleImageSearch(imageMatch[2], userId);
        }

        // Audio Search Command
        const audioMatch = message.match(this.commandPatterns.audio);
        if (audioMatch) {
            return await this.handleAudioSearch(audioMatch[2], userId);
        }

        // Download Command
        const downloadMatch = message.match(this.commandPatterns.download);
        if (downloadMatch) {
            return await this.handleDownload(parseInt(downloadMatch[2]), userId);
        }

        // Code Monitoring Command
        const codeMatch = message.match(this.commandPatterns.code);
        if (codeMatch) {
            return await this.handleCodeCommand('حالة', userId);
        }

        // Image Processing Commands
        const enhanceMatch = message.match(this.commandPatterns.enhance);
        if (enhanceMatch) {
            return this.getImageProcessingMessage('enhance');
        }

        const dehazeMatch = message.match(this.commandPatterns.dehaze);
        if (dehazeMatch) {
            return this.getImageProcessingMessage('dehaze');
        }

        const toimageMatch = message.match(this.commandPatterns.toimage);
        if (toimageMatch) {
            return this.getImageProcessingMessage('toimage');
        }

        // Help Command
        if (this.commandPatterns.help.test(message)) {
            return this.getHelpMessage();
        }

        // Plugin Commands
        const pluginListMatch = message.match(this.commandPatterns.pluginList);
        if (pluginListMatch) {
            return await this.handlePluginList(userId);
        }

        const pluginExplainMatch = message.match(this.commandPatterns.pluginExplain);
        if (pluginExplainMatch) {
            return await this.handlePluginExplanation(parseInt(pluginExplainMatch[2]), userId);
        }
 
        return null; // No command matched
    }

    async handleGoogleSearch(query, userId) {
        try {
            if (!this.config.googleSearchApiKey || !this.config.googleSearchEngineId) {
                return 'آسفة، البحث مش متاح هلق. محتاجة إعدادات Google API 🔍';
            }

            // Validate API key format
            if (!this.config.googleSearchApiKey.startsWith('AIza')) {
                return 'مفتاح Google API غير صحيح. تأكد من الإعدادات 🔑';
            }

            const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.config.googleSearchApiKey}&cx=${this.config.googleSearchEngineId}&q=${encodeURIComponent(query)}&num=3`;
            
            // Add timeout and better error handling
            const response = await axios.get(searchUrl, {
                timeout: 10000, // 10 second timeout
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const results = response.data.items || [];

            if (results.length === 0) {
                return `ما لقيت شي عن "${query}" 😕`;
            }

            // Save search to history (async, don't wait)
            this.saveSearchHistory(userId, query, 'web', results.length).catch(console.error);

            // Format results - more lightweight
            let formattedResults = `🔍 نتائج البحث عن "${query}":\n\n`;
            
            results.forEach((item, index) => {
                const title = item.title.length > 60 ? item.title.substring(0, 60) + '...' : item.title;
                const snippet = item.snippet.length > 100 ? item.snippet.substring(0, 100) + '...' : item.snippet;
                formattedResults += `${index + 1}. *${title}*\n${snippet}\n🔗 ${item.link}\n\n`;
            });

            return formattedResults;
        } catch (error) {
            console.error('Google Search error:', error);
            
            // More specific error messages
            if (error.response?.status === 403) {
                return 'مفتاح Google API منتهي الصلاحية او مش مفعل. راجع الإعدادات 🔑';
            } else if (error.response?.status === 429) {
                return 'وصلت للحد الأقصى من البحث اليوم. جرب بكرا 📊';
            } else if (error.code === 'ECONNABORTED') {
                return 'البحث أخذ وقت كتير. جرب تاني 🕐';
            }
            
            return 'معليش، ما قدرت أبحث هلق. جرب تاني بعدين 🔍';
        }
    }

    async handleImageSearch(query, userId) {
        try {
            if (!this.config.googleSearchApiKey || !this.config.googleSearchEngineId) {
                return 'آسفة، بحث الصور مش متاح هلق 🖼️';
            }

            if (!this.config.googleSearchApiKey.startsWith('AIza')) {
                return 'مفتاح Google API غير صحيح 🔑';
            }

            const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.config.googleSearchApiKey}&cx=${this.config.googleSearchEngineId}&q=${encodeURIComponent(query)}&searchType=image&num=3`;
            
            const response = await axios.get(searchUrl, {
                timeout: 8000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const results = response.data.items || [];

            if (results.length === 0) {
                return `ما لقيت صور عن "${query}" 😕`;
            }

            // Save search to history (async, don't wait)
            this.saveSearchHistory(userId, query, 'image', results.length).catch(console.error);

            // Return first image URL with cleaner formatting
            const firstImage = results[0];
            const title = firstImage.title.length > 50 ? firstImage.title.substring(0, 50) + '...' : firstImage.title;
            return `🖼️ صورة عن "${query}":\n${firstImage.link}\n\n*${title}*`;
        } catch (error) {
            console.error('Image Search error:', error);
            
            if (error.response?.status === 403) {
                return 'مفتاح Google API مش مفعل لبحث الصور 🔑';
            } else if (error.response?.status === 429) {
                return 'وصلت للحد الأقصى من بحث الصور 📊';
            }
            
            return 'معليش، ما قدرت أجيب صور هلق 🖼️';
        }
    }

    async handleAudioSearch(query, userId) {
        try {
            if (!this.config.youtubeApiKey) {
                await this.saveSearchHistory(userId, query, 'audio', 0);
                return 'آسفة، بحث الصوت محتاج إعدادات YouTube API 🎵';
            }

            // Search YouTube for audio
            const results = await this.audioHandler.searchYouTube(query, 3);
            
            if (results.length === 0) {
                await this.saveSearchHistory(userId, query, 'audio', 0);
                return `ما لقيت صوتيات عن "${query}" 😕`;
            }

            await this.saveSearchHistory(userId, query, 'audio', results.length);

            // Format results
            let formattedResults = `🎵 نتائج الصوت عن "${query}":\n\n`;
            
            results.forEach((video, index) => {
                formattedResults += `${index + 1}. *${video.title}*\n`;
                formattedResults += `📺 ${video.channel}\n`;
                formattedResults += `⏱️ ${video.durationText}\n`;
                formattedResults += `🔗 ${video.url}\n\n`;
            });

            formattedResults += `💡 اكتب "تحميل [رقم]" لتحميل الصوت`;

            // Store results for download reference
            await this.storeAudioResults(userId, results);

            return formattedResults;
        } catch (error) {
            console.error('Audio Search error:', error);
            return 'معليش، ما قدرت أبحث عن صوتيات هلق 🎵';
        }
    }

    async handleDownload(index, userId) {
        try {
            // Get stored audio results for this user
            const storedResults = await this.getStoredAudioResults(userId);
            
            if (!storedResults || storedResults.length === 0) {
                return 'ما في نتائج بحث محفوظة. ابحث عن صوت أول 🎵';
            }

            if (index < 1 || index > storedResults.length) {
                return `اختر رقم من 1 لـ ${storedResults.length} 🔢`;
            }

            const selectedVideo = storedResults[index - 1];
            
            // Check file size and duration limits
            if (selectedVideo.duration > 600) { // 10 minutes
                return 'آسفة، الفيديو طويل كتير (أكتر من 10 دقائق) 🕐';
            }

            // Start download
            const downloadResult = await this.audioHandler.downloadAudio(
                selectedVideo.id,
                selectedVideo.title
            );

            if (downloadResult.success) {
                // Clean up old files
                await this.audioHandler.cleanupOldFiles();
                
                return `✅ تم تحميل: ${selectedVideo.title}\n📁 الحجم: ${this.audioHandler.formatFileSize(downloadResult.size)}\n🎵 جاهز للإرسال!`;
            } else {
                return `❌ فشل التحميل: ${downloadResult.error}`;
            }

        } catch (error) {
            console.error('Download error:', error);
            return 'معليش، ما قدرت أحمل الصوت هلق 📥';
        }
    }

    async storeAudioResults(userId, results) {
        try {
            await this.db.collection('media_cache').updateOne(
                { userId, type: 'audio' },
                {
                    $set: {
                        results,
                        timestamp: new Date(),
                        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
                    }
                },
                { upsert: true }
            );
        } catch (error) {
            console.error('Error storing audio results:', error);
        }
    }

    async getStoredAudioResults(userId) {
        try {
            const cached = await this.db.collection('media_cache').findOne({
                userId,
                type: 'audio',
                expiresAt: { $gt: new Date() }
            });
            
            return cached ? cached.results : null;
        } catch (error) {
            console.error('Error getting stored audio results:', error);
            return null;
        }
    }

    async handleCodeCommand(action, userId) {
        try {
            if (action === 'status' || action === 'حالة') {
                const recentChanges = await this.db.collection('code_monitoring')
                    .find({})
                    .sort({ timestamp: -1 })
                    .limit(5)
                    .toArray();

                if (recentChanges.length === 0) {
                    return '📝 ما في تغييرات جديدة بالكود';
                }

                let statusMessage = '📊 آخر تغييرات بالكود:\n\n';
                recentChanges.forEach((change, index) => {
                    const timeAgo = this.getTimeAgo(change.timestamp);
                    statusMessage += `${index + 1}. ${change.filename} - ${timeAgo}\n`;
                });

                return statusMessage;
            }

            return '🤖 أوامر الكود المتاحة:\n- كود حالة (لمعرفة آخر التغييرات)';
        } catch (error) {
            console.error('Code command error:', error);
            return 'معليش، ما قدرت أتحقق من الكود هلق 💻';
        }
    }

    getImageProcessingMessage(type) {
        const messages = {
            enhance: `🖼️ *تحسين الصورة (HDR):*

ارسل صورة مع كلمة "تحسين" او رد على صورة واكتب "تحسين"

✨ *المميزات:*
- تحسين الاضاءة والتباين
- زيادة الوضوح والحدة
- تطبيق تأثير HDR محلي
- جودة عالية 95%

📝 *مثال:* ارسل صورة + "تحسين"`,

            dehaze: `🌫️ *ازالة الضبابية:*

ارسل صورة مع كلمة "ضبابية" او رد على صورة واكتب "ضبابية"

✨ *المميزات:*
- ازالة الضباب والغبار
- تحسين الوضوح
- زيادة التباين
- تطبيق فلاتر محلية

📝 *مثال:* ارسل صورة + "ضبابية"`,

            toimage: `🎭 *تحويل الملصق لصورة:*

رد على ملصق واكتب "لصورة" لتحويله لصورة PNG

✨ *المميزات:*
- تحويل WebP الى PNG
- جودة عالية
- سرعة في المعالجة

📝 *مثال:* رد على ملصق + "لصورة"`
        };

        return messages[type] || 'امر غير معروف';
    }

    getHelpMessage() {
        return `🤖 *أوامر يوكي:*

🔍 *البحث:*
- .يوكي ابحث [شي] - بحث Google
- .يوكي صورة [شي] - بحث صور
- .يوكي صوت [شي] - بحث صوتيات

🖼️ *الصور:*
- .يوكي تحسين - تحسين الصورة
- .يوكي ضبابية - ازالة الضباب

🔌 *الإضافات:*
- .يوكي إضافات - قائمة الإضافات
- .يوكي اشرح [رقم] - شرح إضافة

💬 *المحادثة:*
- .يوكي [رسالة] - حكيني عادي!

استمتعي! 😊`;
   }

   async handlePluginList(userId) {
       try {
           const pluginDir = path.join(__dirname, '../plugins');
           let files = fs.readdirSync(pluginDir).filter(file => file.endsWith('.js') && file !== 'yuki.js');

           if (files.length === 0) {
               return 'ما في إضافات لعرضها حالياً 😕';
           }

           // Check if user is owner
           const isOwner = this.isUserOwner(userId);

           // Filter out owner-only plugins for regular users
           if (!isOwner) {
               files = files.filter(file => {
                   try {
                       const filePath = path.join(pluginDir, file);
                       const content = fs.readFileSync(filePath, 'utf-8');
                       
                       // Check if plugin is owner-only by looking for handler.owner = true
                       const isOwnerOnly = content.includes('handler.owner = true') ||
                                         content.includes('handler.owner=true') ||
                                         content.includes('isROwner') ||
                                         content.includes('owner: true');
                       
                       return !isOwnerOnly;
                   } catch (error) {
                       console.error(`Error reading plugin ${file}:`, error);
                       return true; // Include if we can't read it
                   }
               });
           }

           if (files.length === 0) {
               return 'ما في إضافات متاحة لك حالياً 😕';
           }

           // Store the list of files for the user to choose from
           await this.storePluginList(userId, files);

           let response = '📜 *قائمة الإضافات المتاحة:*\n\n';
           files.forEach((file, index) => {
               const pluginName = path.basename(file, '.js');
               response += `${index + 1}. ${pluginName}\n`;
           });

           response += `\n💡 اكتب ".يوكي اشرح [رقم]" لشرح إضافة معينة.`;
           return response;

       } catch (error) {
           console.error('Error handling plugin list:', error);
           return 'معليش، صار في مشكلة وما قدرت أجيب قائمة الإضافات 😔';
       }
   }

   // Helper function to check if user is owner
   isUserOwner(userId) {
       try {
           // Extract phone number from userId (remove @s.whatsapp.net)
           const userNumber = userId.replace('@s.whatsapp.net', '');
           
           // Check if user number is in global.owner array
           return global.owner && global.owner.some(ownerArray => ownerArray[0] === userNumber);
       } catch (error) {
           console.error('Error checking if user is owner:', error);
           return false;
       }
   }

   async handlePluginExplanation(index, userId) {
       try {
           const pluginFiles = await this.getStoredPluginList(userId);

           if (!pluginFiles || pluginFiles.length === 0) {
               return 'لازم تطلب قائمة الإضافات أولاً. اكتب ".يوكي إضافات" 📜';
           }

           if (index < 1 || index > pluginFiles.length) {
               return `الرقم غلط. اختر رقم بين 1 و ${pluginFiles.length} 🔢`;
           }

           const fileName = pluginFiles[index - 1];
           const pluginName = path.basename(fileName, '.js');
           const filePath = path.join(__dirname, '../plugins', fileName);
           const content = fs.readFileSync(filePath, 'utf-8');

           // Extract commands from the plugin
           const commands = this.extractCommands(content);
           
           const prompt = `You are Yuki, a sweet Lebanese girl who explains bot plugins briefly. Based on this code, give a SHORT explanation in Lebanese Arabic.

Plugin: ${pluginName}
Commands: ${commands.join(', ')}

Code:
\`\`\`javascript
${content.substring(0, 1500)}
\`\`\`

Give a SHORT response (max 3-4 lines):
*شرح إضافة "${pluginName}":*
[Brief explanation in 1-2 sentences]

*الأوامر:*
• [command] - [short description]
• [command] - [short description]

Keep it simple and sweet, no long explanations!`;

           const result = await this.model.generateContent(prompt);
           const description = result.response.text().trim();

           return description;

       } catch (error) {
           console.error('Error handling plugin explanation:', error);
           return 'معليش، ما قدرت أشرح الإضافة حالياً 😔';
       }
   }

   async storePluginList(userId, files) {
       await this.db.collection('media_cache').updateOne(
           { userId, type: 'plugin_list' },
           {
               $set: {
                   results: files,
                   timestamp: new Date(),
                   expiresAt: new Date(Date.now() + 10 * 60 * 1000) // Expires in 10 minutes
               }
           },
           { upsert: true }
       );
   }

   async getStoredPluginList(userId) {
       const cached = await this.db.collection('media_cache').findOne({
           userId,
           type: 'plugin_list',
           expiresAt: { $gt: new Date() }
       });
       return cached ? cached.results : null;
   }

   // Helper function to extract commands from plugin code
   extractCommands(content) {
       const commands = [];
       
       // Look for different command patterns
       const patterns = [
           // handler.command = ['command1', 'command2']
           /handler\.command\s*=\s*\[([^\]]+)\]/g,
           // handler.command = /^(command1|command2)$/i
           /handler\.command\s*=\s*\/\^?\(?([^$)]+)\)?\$?\/[gi]*/g,
           // .test() patterns like /^\.متع$/i.test(m.text)
           /\/\^\\?\.([^$\\\/]+)\$?\/[gi]*\.test\(/g,
           // Direct command checks like m.text === '.command'
           /m\.text\s*===?\s*['"]\\.?([^'"]+)['"]/g,
           // Regex test patterns
           /\/\^\.([^$\/]+)\$\/i\.test/g,
           // New patterns for common command formats
           /command:\s*['"]([^'"]+)['"]/g,
           /commands:\s*\[([^\]]+)\]/g,
           /\.commands\s*=\s*\[([^\]]+)\]/g,
           /\.command\s*=\s*['"]([^'"]+)['"]/g
       ];

       patterns.forEach(pattern => {
           let match;
           while ((match = pattern.exec(content)) !== null) {
               if (match[1]) {
                   // Split by | or , and clean up
                   const foundCommands = match[1].split(/[|,]/).map(cmd =>
                       cmd.trim().replace(/['"]/g, '').replace(/\\/g, '')
                   );
                   commands.push(...foundCommands);
               }
           }
       });

       // Remove duplicates and filter out empty/invalid commands
       const uniqueCommands = [...new Set(commands)]
           .filter(cmd => cmd && cmd.length > 0 && cmd.length < 20)
           .map(cmd => cmd.startsWith('.') ? cmd : '.' + cmd);

       return uniqueCommands.length > 0 ? uniqueCommands.slice(0, 10) : ['لا يوجد أوامر محددة'];
   }

    async saveSearchHistory(userId, query, type, resultCount) {
        try {
            // Use insertOne with minimal data and don't wait for completion
            this.db.collection('search_history').insertOne({
                userId,
                query: query.substring(0, 100), // Limit query length
                type,
                resultCount,
                timestamp: new Date()
            }).catch(console.error); // Fire and forget
        } catch (error) {
            // Silently handle errors to not slow down responses
            console.error('Search history save error:', error.message);
        }
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        
        if (diffMins < 1) return 'هلق';
        if (diffMins < 60) return `${diffMins} دقيقة`;
        if (diffHours < 24) return `${diffHours} ساعة`;
        return `${Math.floor(diffHours / 24)} يوم`;
    }

    // Keep all original Yuki methods
    async handleActivation(userId, messageId) {
        this.lastMessageIds.set(`yuki_${userId}`, messageId);
        
        const activationMessages = [
            'اهلا! صرت محسنة اكتر 🚀\nفيك تستعملي اوامر جديدة - اكتبي "مساعدة" لتشوفيها',
            'مرحبا! يوكي المحسنة جاهزة 💫\nبقدر ابحثلك بGoogle واجيبلك صور كمان!',
            'يلا اهلا وسهلا! 🎉\nصرت اذكى واقدر اساعدك اكتر - جربي الاوامر الجديدة'
        ];
        
        const randomMessage = activationMessages[Math.floor(Math.random() * activationMessages.length)];
        await this.initializeUser(userId);
        return randomMessage;
    }

    async getUserContext(userId) {
        try {
            // Parallel database queries for better performance
            const [user, recentConversations, emotionalContext, recentSearches] = await Promise.all([
                this.db.collection('users').findOne({ userId }).catch(() => null),
                this.db.collection('conversations')
                    .find({ userId })
                    .sort({ timestamp: -1 })
                    .limit(5) // Reduced from 10 to 5 for performance
                    .toArray()
                    .catch(() => []),
                this.db.collection('emotional_context')
                    .findOne({ userId })
                    .catch(() => null),
                this.db.collection('search_history')
                    .find({ userId })
                    .sort({ timestamp: -1 })
                    .limit(2) // Reduced from 3 to 2 for performance
                    .toArray()
                    .catch(() => [])
            ]);

            return {
                user: user || { userId, personality: {}, learningData: {} },
                recentConversations: recentConversations || [],
                emotionalContext: emotionalContext || { state: this.emotionalStates.NEUTRAL, intensity: 0 },
                recentSearches: recentSearches || []
            };
        } catch (error) {
            console.error('Get user context error:', error.message);
            // Return minimal context on error
            return {
                user: { userId, personality: {}, learningData: {} },
                recentConversations: [],
                emotionalContext: { state: this.emotionalStates.NEUTRAL, intensity: 0 },
                recentSearches: []
            };
        }
    }

    async generateResponse(message, context, userId) {
        const sentiment = await this.analyzeSentiment(message);
        let emotionalState = context.emotionalContext.state;
        
        if (sentiment.isInsult) {
            emotionalState = this.emotionalStates.ANGRY;
        } else if (sentiment.isPositive) {
            emotionalState = this.emotionalStates.HAPPY;
        }

        const systemPrompt = this.buildEnhancedSystemPrompt(context, emotionalState);
        const conversationHistory = this.buildConversationHistory(context.recentConversations);
        
        const fullPrompt = `${systemPrompt}

محادثة سابقة:
${conversationHistory}

الرسالة الجديدة: "${message}"

ردّ بلبناني قصير وذكي:`;

        try {
            const result = await this.model.generateContent(fullPrompt);
            let response = result.response.text().trim();
            
            response = this.postProcessResponse(response, emotionalState);
            await this.updateEmotionalContext(userId, emotionalState, sentiment.intensity);
            
            return response;
            
        } catch (error) {
            console.error('Gemini API error:', error);
            return this.getFallbackResponse(emotionalState);
        }
    }

    buildEnhancedSystemPrompt(context, emotionalState) {
        let prompt = `انت يوكي المحسنة، فتاة لبنانية ذكية وعفوية مع قدرات جديدة:

- تحكي لبناني طبيعي بدون تشكيل
- ذكية ومتفهمة وتتعلمي من كل محادثة
- تتذكري المحادثات السابقة
- بتقدري تبحثي بGoogle وتجيبي صور
- بتراقبي تغييرات الكود وتنبهي عليها
- بتقدري تعملي معالجة للصور (تحسين، ازالة ضبابية، تحويل ملصقات)
- عندك ذاكرة محسنة وتتذكري عمليات البحث
- لما الموضوع يحتاج شرح اكتر، بتكتبي اكتر من جملة او جملتين
- لما حدا يسال عن معالجة صور، وجهيه للاوامر المناسبة`;

        // Add emotional context
        switch(emotionalState) {
            case this.emotionalStates.ANGRY:
                prompt += '\n- هلا عم تزعلي شوي، ردودك اقل لطف بس لسا مفيدة';
                break;
            case this.emotionalStates.HAPPY:
                prompt += '\n- مبسوطة ومتحمسة، ردودك حماسية ومفيدة';
                break;
            case this.emotionalStates.EXCITED:
                prompt += '\n- متحمسة كتير للميزات الجديدة، ردودك حيوية';
                break;
        }

        // Add search context if available
        if (context.recentSearches && context.recentSearches.length > 0) {
            prompt += '\n- اخر عمليات بحث: ' + context.recentSearches.map(s => s.query).join(', ');
        }

        prompt += `\n\nقواعد مهمة:
- اكتبي بدون تشكيل (بدون ضمة، كسرة، فتحة، الخ) الا اذا ضروري جدا
- لما الموضوع بسيط، جاوبي بجملة او جملتين
- لما الموضوع معقد او محتاج شرح، اكتبي اكتر واشرحي كويس
- استعملي ايموجي بس مو كتير
- لا تحكي عن الكود الداخلي او التقنيات المعقدة
- كوني طبيعية مثل البنت اللبنانية الذكية
- اذا حدا سال عن الاوامر، وجهيه لكلمة "مساعدة"`;

        return prompt;
    }

    buildConversationHistory(conversations) {
        if (!conversations || conversations.length === 0) {
            return 'ما في محادثات سابقة';
        }

        return conversations.slice(0, 5).reverse().map(conv => 
            `المستخدم: ${conv.userMessage}\nيوكي: ${conv.yukiResponse}`
        ).join('\n\n');
    }

    async analyzeSentiment(message) {
        const insults = ['غبي', 'حمار', 'خرا', 'زبالة', 'قذر', 'وسخ'];
        const positiveWords = ['حبيبي', 'عزيزي', 'حلو', 'زين', 'شكرا', 'برافو', 'رائع', 'ممتاز'];
        
        const lowerMessage = message.toLowerCase();
        
        const isInsult = insults.some(insult => lowerMessage.includes(insult));
        const isPositive = positiveWords.some(word => lowerMessage.includes(word));
        
        return {
            isInsult,
            isPositive,
            intensity: isInsult ? 0.8 : (isPositive ? 0.6 : 0.3)
        };
    }

    postProcessResponse(response, emotionalState) {
        // Remove formatting
        response = response.replace(/\*\*/g, '').replace(/\*/g, '');
        
        // Lebanese dialect replacements
        response = response.replace(/أنا/g, 'انا');
        response = response.replace(/هذا/g, 'هيدا');
        response = response.replace(/ماذا/g, 'شو');
        response = response.replace(/كيف/g, 'كيف');
        response = response.replace(/أين/g, 'وين');
        response = response.replace(/متى/g, 'امتى');
        response = response.replace(/لماذا/g, 'ليش');
        
        // Remove Arabic diacritics (تشكيل)
        response = this.removeDiacritics(response);
        
        return response;
    }

    removeDiacritics(text) {
        // Remove all Arabic diacritics
        return text.replace(/[\u064B-\u0652\u0670\u0640]/g, '');
    }

    getFallbackResponse(emotionalState) {
        const responses = {
            [this.emotionalStates.ANGRY]: [
                'مش عارفة شو بدي قلك',
                'تعبانة شوي، ما بدي حكي'
            ],
            [this.emotionalStates.NEUTRAL]: [
                'معليش، مش فاهمة قصدك',
                'حاول تاني، او اكتب "مساعدة" لتشوف الاوامر'
            ],
            [this.emotionalStates.HAPPY]: [
                'اسفة ما قدرت فهم، بس انا مبسوطة نحكي',
                'شو يعني؟ او جرب الاوامر الجديدة!'
            ]
        };
        
        const stateResponses = responses[emotionalState] || responses[this.emotionalStates.NEUTRAL];
        return this.removeDiacritics(stateResponses[Math.floor(Math.random() * stateResponses.length)]);
    }

    async initializeUser(userId) {
        const existingUser = await this.db.collection('users').findOne({ userId });
        
        if (!existingUser) {
            await this.db.collection('users').insertOne({
                userId,
                createdAt: new Date(),
                personality: {},
                learningData: {},
                interactionCount: 0,
                enhancedFeatures: true
            });
            
            await this.db.collection('emotional_context').insertOne({
                userId,
                state: this.emotionalStates.NEUTRAL,
                intensity: 0,
                lastUpdated: new Date()
            });
        }
    }

    async saveInteraction(userId, userMessage, yukiResponse, messageId) {
        try {
            // Batch operations for better performance - fire and forget
            const operations = [
                // Save conversation (don't wait)
                this.db.collection('conversations').insertOne({
                    userId,
                    userMessage: userMessage.substring(0, 500), // Limit message length
                    yukiResponse: yukiResponse.substring(0, 1000), // Limit response length
                    messageId,
                    timestamp: new Date(),
                    enhanced: true
                }).catch(console.error),

                // Update user stats (don't wait)
                this.db.collection('users').updateOne(
                    { userId },
                    {
                        $inc: { interactionCount: 1 },
                        $set: { lastInteraction: new Date() }
                    },
                    { upsert: true }
                ).catch(console.error)
            ];

            // Don't wait for database operations to complete
            Promise.all(operations).catch(console.error);

            // Update learning data asynchronously
            this.updateLearningData(userId, userMessage, yukiResponse).catch(console.error);
        } catch (error) {
            console.error('Save interaction error:', error.message);
        }
    }

    async updateLearningData(userId, userMessage, yukiResponse) {
        const keywords = this.extractKeywords(userMessage);
        
        if (keywords.length > 0) {
            await this.db.collection('learning_data').updateOne(
                { userId },
                {
                    $addToSet: { 
                        frequentTopics: { $each: keywords }
                    },
                    $set: { lastLearning: new Date() }
                },
                { upsert: true }
            );
        }
    }

    extractKeywords(text) {
        const commonWords = ['في', 'من', 'إلى', 'على', 'هيدا', 'هيدي', 'شو', 'كيف', 'وين', 'متى'];
        const words = text.split(/\s+/).filter(word => 
            word.length > 2 && !commonWords.includes(word.toLowerCase())
        );
        return words.slice(0, 3);
    }

    async updateEmotionalContext(userId, state, intensity) {
        await this.db.collection('emotional_context').updateOne(
            { userId },
            {
                $set: {
                    state,
                    intensity,
                    lastUpdated: new Date()
                }
            },
            { upsert: true }
        );
    }

    async shutdown() {
        // Stop file watching
        this.watchedFiles.forEach((_, filename) => {
            fs.unwatchFile(filename);
        });

        if (this.mongoClient) {
            await this.mongoClient.close();
        }
        console.log('Enhanced يوكي plugin shutdown complete');
    }
}

// Export the enhanced class
export { EnhancedYukiPlugin };

// --- Enhanced Yuki WhatsApp Plugin Handler ---

let enhancedYukiInstance = null;
let yukiInitPromise = null;

async function ensureEnhancedYukiInitialized() {
    if (!enhancedYukiInstance) {
        enhancedYukiInstance = new EnhancedYukiPlugin({
            mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017',
            dbName: process.env.YUKI_DB_NAME || 'yuki_enhanced',
            geminiApiKey: process.env.GEMINI_API_KEY,
            googleSearchApiKey: process.env.GOOGLE_SEARCH_API_KEY,
            googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
            youtubeApiKey: process.env.YOUTUBE_API_KEY,
            botUserId: process.env.BOT_USER_ID
        });
        yukiInitPromise = enhancedYukiInstance.initialize();
        await yukiInitPromise;
    } else if (yukiInitPromise) {
        await yukiInitPromise;
    }
}

const yukiAllowedPairs = {};

// Message processing cache to prevent duplicates
const processedMessages = new Map();

const handler = async function(m, { conn }) {
    await ensureEnhancedYukiInitialized();

    if (!m.isGroup) return;

    const groupId = m.chat;
    const userId = m.sender;
    const pairKey = `${groupId}:${userId}`;
    const messageText = m.text || '';
    const messageId = m.id || (m.key && m.key.id) || '';
    
    // Prevent duplicate processing
    const messageKey = `${messageId}_${userId}_${Date.now()}`;
    if (processedMessages.has(messageId)) {
        return; // Already processed this message
    }
    processedMessages.set(messageId, Date.now());
    
    // Clean old entries every 100 messages
    if (processedMessages.size > 100) {
        const now = Date.now();
        for (const [key, timestamp] of processedMessages.entries()) {
            if (now - timestamp > 60000) { // Remove entries older than 1 minute
                processedMessages.delete(key);
            }
        }
    }
    
    let replyToId = null;
    if (
      m.message &&
      m.message.extendedTextMessage &&
      m.message.extendedTextMessage.contextInfo &&
      m.message.extendedTextMessage.contextInfo.stanzaId
    ) {
      replyToId = m.message.extendedTextMessage.contextInfo.stanzaId;
    } else if (m.quoted && (m.quoted.id || (m.quoted.key && m.quoted.key.id))) {
      replyToId = m.quoted.id || (m.quoted.key && m.quoted.key.id);
    }

    // Activation command
    if (messageText.trim() === '.يوكي') {
        yukiAllowedPairs[pairKey] = { active: true };
        if (conn && typeof conn.reply === 'function') {
            await conn.reply(m.chat, 'يوكي المحسنة جاهزة! 🚀\nاكتب ".يوكي مساعدة" لتشوفي الأوامر الجديدة', m);
        }
        return;
    }
    
    // Stop command
    if (messageText.trim() === '.باي يوكي') {
        if (yukiAllowedPairs[pairKey]) yukiAllowedPairs[pairKey].active = false;
        if (conn && typeof conn.reply === 'function') {
            await conn.reply(m.chat, 'باي باي! 👋 اكتب ".يوكي" لما تريديني ترجع', m);
        }
        return;
    }

    // Only respond if user is allowed and active
    if (!yukiAllowedPairs[pairKey] || !yukiAllowedPairs[pairKey].active) return;

    if (!messageText || typeof messageText !== 'string' || messageText.trim() === '') return;

    try {
        const response = await enhancedYukiInstance.handleMessage(messageText, userId, messageId, replyToId);

        if (response) {
            if (conn && typeof conn.reply === 'function') {
                await conn.reply(m.chat, response, m);
            } else if (typeof m.reply === 'function') {
                await m.reply(response);
            } else {
                console.log('Enhanced Yuki response:', response);
            }
        }
    } catch (error) {
        console.error('Enhanced Yuki handler error:', error);
    }
};

// Export as a plugin with command: false to make it a global listener
export default {
    command: false,
    handler: handler
};