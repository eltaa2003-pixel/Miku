import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class AudioHandler {
    constructor(config = {}) {
        this.config = {
            youtubeApiKey: config.youtubeApiKey,
            downloadPath: config.downloadPath || './downloads/audio',
            maxDuration: config.maxDuration || 600, // 10 minutes max
            ...config
        };

        // Ensure download directory exists
        this.ensureDownloadDir();
    }

    ensureDownloadDir() {
        if (!fs.existsSync(this.config.downloadPath)) {
            fs.mkdirSync(this.config.downloadPath, { recursive: true });
        }
    }

    async searchYouTube(query, maxResults = 5) {
        try {
            if (!this.config.youtubeApiKey) {
                throw new Error('YouTube API key not configured');
            }

            const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${this.config.youtubeApiKey}`;
            
            const response = await axios.get(searchUrl);
            const videos = response.data.items || [];

            // Get video details including duration
            const videoIds = videos.map(video => video.id.videoId).join(',');
            const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=${this.config.youtubeApiKey}`;
            
            const detailsResponse = await axios.get(detailsUrl);
            const videoDetails = detailsResponse.data.items || [];

            // Combine search results with details
            const enrichedResults = videos.map(video => {
                const details = videoDetails.find(d => d.id === video.id.videoId);
                const duration = details ? this.parseDuration(details.contentDetails.duration) : 0;
                
                return {
                    id: video.id.videoId,
                    title: video.snippet.title,
                    channel: video.snippet.channelTitle,
                    description: video.snippet.description,
                    thumbnail: video.snippet.thumbnails.medium?.url,
                    url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
                    duration: duration,
                    durationText: this.formatDuration(duration),
                    publishedAt: video.snippet.publishedAt
                };
            });

            // Filter by duration (exclude very long videos)
            return enrichedResults.filter(video => video.duration <= this.config.maxDuration);

        } catch (error) {
            console.error('YouTube search error:', error);
            throw new Error('Failed to search YouTube');
        }
    }

    parseDuration(isoDuration) {
        // Parse ISO 8601 duration (PT4M13S) to seconds
        const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;

        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);

        return hours * 3600 + minutes * 60 + seconds;
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    async downloadAudio(videoId, title) {
        try {
            // Check if yt-dlp is available
            await this.checkYtDlp();

            const sanitizedTitle = this.sanitizeFilename(title);
            const outputPath = path.join(this.config.downloadPath, `${sanitizedTitle}.%(ext)s`);
            const url = `https://www.youtube.com/watch?v=${videoId}`;

            // Download audio using yt-dlp
            const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" "${url}"`;
            
            console.log('Downloading audio:', sanitizedTitle);
            const { stdout, stderr } = await execAsync(command);

            // Find the downloaded file
            const files = fs.readdirSync(this.config.downloadPath);
            const downloadedFile = files.find(file => 
                file.startsWith(sanitizedTitle) && file.endsWith('.mp3')
            );

            if (downloadedFile) {
                const fullPath = path.join(this.config.downloadPath, downloadedFile);
                return {
                    success: true,
                    filePath: fullPath,
                    filename: downloadedFile,
                    size: fs.statSync(fullPath).size
                };
            } else {
                throw new Error('Downloaded file not found');
            }

        } catch (error) {
            console.error('Audio download error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async checkYtDlp() {
        try {
            await execAsync('yt-dlp --version');
        } catch (error) {
            throw new Error('yt-dlp not found. Please install it: pip install yt-dlp');
        }
    }

    sanitizeFilename(filename) {
        return filename
            .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .substring(0, 100); // Limit length
    }

    async getAudioInfo(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return {
                size: stats.size,
                sizeFormatted: this.formatFileSize(stats.size),
                exists: true
            };
        } catch (error) {
            return {
                exists: false,
                error: error.message
            };
        }
    }

    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    async cleanupOldFiles(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
        try {
            const files = fs.readdirSync(this.config.downloadPath);
            const now = Date.now();

            for (const file of files) {
                const filePath = path.join(this.config.downloadPath, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                    console.log('Cleaned up old audio file:', file);
                }
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    // Alternative method using a free service (if YouTube API is not available)
    async searchFreeAlternative(query) {
        try {
            // This would use a free service like Invidious or similar
            // For now, return a placeholder
            return [{
                id: 'placeholder',
                title: `نتائج البحث عن: ${query}`,
                channel: 'يوكي',
                description: 'البحث الصوتي قيد التطوير',
                url: '#',
                duration: 0,
                durationText: '0:00'
            }];
        } catch (error) {
            console.error('Free search error:', error);
            return [];
        }
    }
}

export default AudioHandler;