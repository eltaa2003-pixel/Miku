/**
 * Render-specific configuration for WhatsApp Bot
 * Handles session persistence and encryption key management for cloud deployment
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

// Render environment variables
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID;
const RENDER_SERVICE_NAME = process.env.RENDER_SERVICE_NAME;

// Session directory configuration
const SESSION_DIR = './MyninoSession';
const BACKUP_DIR = './session-backup';

/**
 * Render-specific session management
 */
class RenderSessionManager {
  constructor() {
    this.isRender = !!RENDER_EXTERNAL_URL;
    this.sessionDir = SESSION_DIR;
    this.backupDir = BACKUP_DIR;
    this.lastBackup = 0;
    this.backupInterval = 30 * 60 * 1000; // 30 minutes
    this.shutdownInProgress = false;
  }

  /**
   * Initialize Render-specific session management
   */
  async initialize() {
    if (!this.isRender) {
      console.log(chalk.cyan('🌐 Not running on Render, using standard session management'));
      return;
    }

    console.log(chalk.cyan('🚀 Initializing Render-specific session management'));
    
    // Ensure directories exist
    this.ensureDirectories();
    
    // Restore session from backup if needed
    await this.restoreSession();
    
    // Set up periodic backup
    this.setupPeriodicBackup();
    
    // Set up graceful shutdown
    this.setupGracefulShutdown();
    
    console.log(chalk.green('✅ Render session management initialized'));
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    try {
      if (!existsSync(this.sessionDir)) {
        mkdirSync(this.sessionDir, { recursive: true });
        console.log(chalk.green(`📁 Created session directory: ${this.sessionDir}`));
      }
      
      if (!existsSync(this.backupDir)) {
        mkdirSync(this.backupDir, { recursive: true });
        console.log(chalk.green(`📁 Created backup directory: ${this.backupDir}`));
      }
    } catch (error) {
      console.error(chalk.red('❌ Error creating directories:', error.message));
    }
  }

  /**
   * Restore session from backup
   */
  async restoreSession() {
    try {
      const backupFile = join(this.backupDir, 'session-backup.json');
      
      if (existsSync(backupFile)) {
        const backupData = JSON.parse(readFileSync(backupFile, 'utf8'));
        const lastBackupTime = new Date(backupData.timestamp);
        const now = new Date();
        const hoursSinceBackup = (now - lastBackupTime) / (1000 * 60 * 60);
        
        if (hoursSinceBackup < 24) { // Only restore if backup is less than 24 hours old
          console.log(chalk.yellow(`🔄 Restoring session from backup (${hoursSinceBackup.toFixed(1)} hours old)`));
          
          // Restore session files
          for (const [filename, content] of Object.entries(backupData.files)) {
            const filePath = join(this.sessionDir, filename);
            writeFileSync(filePath, content);
          }
          
          console.log(chalk.green(`✅ Restored ${Object.keys(backupData.files).length} session files`));
        } else {
          console.log(chalk.yellow('⚠️ Backup is too old, starting fresh session'));
        }
      } else {
        console.log(chalk.cyan('📝 No backup found, starting fresh session'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Error restoring session:', error.message));
    }
  }

  /**
   * Create session backup
   */
  async createBackup() {
    if (this.shutdownInProgress) return;
    
    try {
      const { readdirSync, existsSync } = await import('fs');
      if (!existsSync(this.sessionDir)) return;
      
      const files = readdirSync(this.sessionDir);
      const backupData = {
        timestamp: new Date().toISOString(),
        files: {}
      };
      
      for (const file of files) {
        if (file.endsWith('.json') || file.startsWith('pre-key-') || 
            file.startsWith('session-') || file.startsWith('sender-key-')) {
          try {
            const filePath = join(this.sessionDir, file);
            const content = readFileSync(filePath, 'utf8');
            backupData.files[file] = content;
          } catch (e) {
            // Skip files that can't be read
          }
        }
      }
      
      const backupFile = join(this.backupDir, 'session-backup.json');
      writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
      
      this.lastBackup = Date.now();
      console.log(chalk.green(`💾 Session backup created with ${Object.keys(backupData.files).length} files`));
    } catch (error) {
      console.error(chalk.red('❌ Error creating backup:', error.message));
    }
  }

  /**
   * Set up periodic backup
   */
  setupPeriodicBackup() {
    setInterval(async () => {
      if (Date.now() - this.lastBackup > this.backupInterval) {
        await this.createBackup();
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Set up graceful shutdown
   */
  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      if (this.shutdownInProgress) return;
      this.shutdownInProgress = true;
      
      console.log(chalk.yellow(`\n🛑 Received ${signal}, creating final backup...`));
      
      try {
        await this.createBackup();
        console.log(chalk.green('✅ Final backup completed'));
      } catch (error) {
        console.error(chalk.red('❌ Error during final backup:', error.message));
      }
      
      // Don't call process.exit here - let the main process manager handle shutdown
      // This prevents conflicting exit handlers
    };
    
    // Only set up handlers if not already handled by parent process
    if (!process.listenerCount('SIGTERM')) {
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    }
    if (!process.listenerCount('SIGINT')) {
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }
  }

  /**
   * Get Render environment info
   */
  getRenderInfo() {
    return {
      isRender: this.isRender,
      externalUrl: RENDER_EXTERNAL_URL,
      serviceId: RENDER_SERVICE_ID,
      serviceName: RENDER_SERVICE_NAME
    };
  }
}

// Create global instance
const renderSessionManager = new RenderSessionManager();

// Export for use in main.js
export default renderSessionManager;

// Export initialization function
export const initializeRenderSession = async () => {
  await renderSessionManager.initialize();
}; 