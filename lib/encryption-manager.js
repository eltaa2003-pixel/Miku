import { existsSync, readdirSync, writeFileSync, unlinkSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import sessionRecovery, { recoverFromBadMac } from './session-recovery.js';

/**
 * Enhanced Encryption Key Manager for WhatsApp Bot
 * Handles SenderKey and PreKey management to prevent decryption errors
 * Includes comprehensive Bad MAC error recovery
 */
class EncryptionManager {
  constructor(sessionDir = './MyninoSession') {
    this.sessionDir = sessionDir;
    this.keyCache = new Map();
    this.lastCleanup = Date.now();
    this.cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.failedJids = new Set(); // Track JIDs with persistent issues
    this.recoveryAttempts = new Map(); // Track recovery attempts per JID
    this.maxRecoveryAttempts = 3;
    this.sessionBackups = new Map(); // Store session backups
  }

  /**
   * Initialize encryption key management
   */
  async initialize() {
    try {
      // Ensure session directory exists
      if (!existsSync(this.sessionDir)) {
        console.log(chalk.yellow('⚠️ Session directory not found, encryption keys will be created on first connection'));
        return;
      }

      // Load existing encryption keys
      await this.loadEncryptionKeys();
      
      // Set up periodic cleanup
      setInterval(() => {
        this.cleanupOldKeys();
      }, this.cleanupInterval);

      console.log(chalk.green('✅ Encryption key manager initialized'));
    } catch (error) {
      console.error(chalk.red('❌ Error initializing encryption manager:', error.message));
    }
  }

  /**
   * Load existing encryption keys from session files
   */
  async loadEncryptionKeys() {
    try {
      const files = readdirSync(this.sessionDir);
      
      for (const file of files) {
        if (file.startsWith('sender-key-') || file.startsWith('pre-key-') || file.startsWith('session-')) {
          const filePath = join(this.sessionDir, file);
          const stats = statSync(filePath);
          
          // Cache key metadata
          this.keyCache.set(file, {
            path: filePath,
            lastModified: stats.mtimeMs,
            size: stats.size
          });
        }
      }
      
      console.log(chalk.cyan(`📦 Loaded ${this.keyCache.size} encryption keys`));
    } catch (error) {
      console.error(chalk.red('❌ Error loading encryption keys:', error.message));
    }
  }

  /**
   * Handle SenderKey record issues
   */
  async handleSenderKeyIssue(jid, error) {
    try {
      console.log(chalk.yellow(`🔑 Handling SenderKey issue for ${jid}`));
      
      // Force session refresh for this JID
      if (global.forceSessionRefresh) {
        await global.forceSessionRefresh(jid);
      }
      
      // Clear any cached sender keys for this JID
      this.clearCachedKeys(jid, 'sender-key');
      
      // Request fresh PreKey bundle
      if (global.conn && global.conn.requestPreKeyBundle) {
        try {
          await global.conn.requestPreKeyBundle(jid).catch(() => {});
        } catch (error) {
          // Silent error handling
        }
      }
      
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Error handling SenderKey issue for ${jid}:`, error.message));
      return false;
    }
  }

  /**
   * Handle PreKey ID issues
   */
  async handlePreKeyIssue(jid, error) {
    try {
      console.log(chalk.yellow(`🔑 Handling PreKey issue for ${jid}`));
      
      // Request fresh PreKey bundle
      if (global.conn && global.conn.requestPreKeyBundle) {
        await global.conn.requestPreKeyBundle(jid).catch(() => {});
      }
      
      // Clear any cached pre-keys for this JID
      this.clearCachedKeys(jid, 'pre-key');
      
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Error handling PreKey issue for ${jid}:`, error.message));
      return false;
    }
  }

  /**
   * Enhanced Bad MAC error handler with progressive recovery
   */
  async handleBadMacError(jid, error) {
    try {
      const attempts = this.recoveryAttempts.get(jid) || 0;
      console.log(chalk.yellow(`🔑 Handling Bad MAC error for ${jid} (attempt ${attempts + 1}/${this.maxRecoveryAttempts})`));
      
      // Track recovery attempts
      this.recoveryAttempts.set(jid, attempts + 1);
      
      // Progressive recovery strategy
      if (attempts === 0) {
        // First attempt: Clear session keys only
        await this.clearSessionKeys(jid);
        await this.requestFreshSession(jid);
      } else if (attempts === 1) {
        // Second attempt: Clear all keys and force complete refresh
        await this.clearAllKeysForJid(jid);
        await this.forceCompleteSessionRefresh(jid);
      } else if (attempts === 2) {
        // Third attempt: Nuclear option - clear everything and restart session
        await this.nuclearSessionReset(jid);
      } else {
        // Max attempts reached - mark as failed
        this.failedJids.add(jid);
        console.log(chalk.red(`❌ Max recovery attempts reached for ${jid}, marking as failed`));
        return false;
      }
      
      // Reset attempts on successful recovery (will be checked later)
      setTimeout(() => {
        if (!this.failedJids.has(jid)) {
          this.recoveryAttempts.delete(jid);
        }
      }, 300000); // Reset after 5 minutes if no more errors
      
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Error handling Bad MAC for ${jid}:`, error.message));
      return false;
    }
  }

  /**
   * Clear only session keys for a JID
   */
  async clearSessionKeys(jid) {
    try {
      console.log(chalk.cyan(`🧹 Clearing session keys for ${jid}`));
      this.clearCachedKeys(jid, 'session');
      await this.deleteSessionFiles(jid);
    } catch (error) {
      console.error(chalk.red('❌ Error clearing session keys:', error.message));
    }
  }

  /**
   * Clear all encryption keys for a JID
   */
  async clearAllKeysForJid(jid) {
    try {
      console.log(chalk.cyan(`🧹 Clearing all keys for ${jid}`));
      this.clearCachedKeys(jid, 'sender-key');
      this.clearCachedKeys(jid, 'pre-key');
      this.clearCachedKeys(jid, 'session');
      await this.deleteAllKeyFiles(jid);
    } catch (error) {
      console.error(chalk.red('❌ Error clearing all keys:', error.message));
    }
  }

  /**
   * Request fresh session establishment
   */
  async requestFreshSession(jid) {
    try {
      console.log(chalk.cyan(`🔄 Requesting fresh session for ${jid}`));
      
      if (global.conn) {
        // Remove from session cache
        if (global.sessionCache) {
          global.sessionCache.delete(jid);
        }
        
        // Request fresh PreKey bundle
        try {
          await global.conn.requestPreKeyBundle(jid).catch(() => {});
        } catch (error) {
          // Silent error handling
        }
        
        // Re-establish presence subscription
        try {
          await global.conn.presenceSubscribe(jid).catch(() => {});
        } catch (error) {
          // Silent error handling
        }
        
        // Add back to session cache
        if (global.sessionCache) {
          global.sessionCache.add(jid);
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Error requesting fresh session:', error.message));
    }
  }

  /**
   * Force complete session refresh
   */
  async forceCompleteSessionRefresh(jid) {
    try {
      console.log(chalk.cyan(`🔄 Force complete session refresh for ${jid}`));
      
      // Use global session refresh if available
      if (global.forceSessionRefresh) {
        await global.forceSessionRefresh(jid);
      } else {
        await this.requestFreshSession(jid);
      }
      
      // Additional delay to allow session establishment
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(chalk.red('❌ Error in force complete session refresh:', error.message));
    }
  }

  /**
   * Nuclear session reset - last resort
   */
  async nuclearSessionReset(jid) {
    try {
      console.log(chalk.red(`💥 Nuclear session reset for ${jid}`));
      
      // Backup current session before destroying
      await this.backupSession(jid);
      
      // Clear everything
      await this.clearAllKeysForJid(jid);
      
      // Remove from all caches
      if (global.sessionCache) {
        global.sessionCache.delete(jid);
      }
      
      // Wait before re-establishing
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Re-establish from scratch
      if (global.createImmediateSession) {
        await global.createImmediateSession(jid);
      } else {
        await this.requestFreshSession(jid);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Error in nuclear session reset:', error.message));
    }
  }

  /**
   * Backup session before destroying
   */
  async backupSession(jid) {
    try {
      const jidHash = this.hashJid(jid);
      const backupData = {
        jid,
        timestamp: Date.now(),
        keys: []
      };
      
      // Collect all key files for this JID
      const files = readdirSync(this.sessionDir);
      for (const file of files) {
        if (file.includes(jidHash)) {
          try {
            const filePath = join(this.sessionDir, file);
            const content = readFileSync(filePath);
            backupData.keys.push({
              filename: file,
              content: content.toString('base64')
            });
          } catch (error) {
            // Ignore backup errors for individual files
          }
        }
      }
      
      this.sessionBackups.set(jid, backupData);
      console.log(chalk.cyan(`💾 Backed up session for ${jid}`));
    } catch (error) {
      console.error(chalk.red('❌ Error backing up session:', error.message));
    }
  }

  /**
   * Delete session files for a JID
   */
  async deleteSessionFiles(jid) {
    try {
      const jidHash = this.hashJid(jid);
      const files = readdirSync(this.sessionDir);
      
      for (const file of files) {
        if (file.startsWith('session-') && file.includes(jidHash)) {
          try {
            const filePath = join(this.sessionDir, file);
            if (existsSync(filePath)) {
              unlinkSync(filePath);
              console.log(chalk.cyan(`🗑️ Deleted session file: ${file}`));
            }
          } catch (error) {
            // Ignore individual file deletion errors
          }
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Error deleting session files:', error.message));
    }
  }

  /**
   * Delete all key files for a JID
   */
  async deleteAllKeyFiles(jid) {
    try {
      const jidHash = this.hashJid(jid);
      const files = readdirSync(this.sessionDir);
      
      for (const file of files) {
        if ((file.startsWith('session-') || file.startsWith('sender-key-') || file.startsWith('pre-key-')) && file.includes(jidHash)) {
          try {
            const filePath = join(this.sessionDir, file);
            if (existsSync(filePath)) {
              unlinkSync(filePath);
              console.log(chalk.cyan(`🗑️ Deleted key file: ${file}`));
            }
          } catch (error) {
            // Ignore individual file deletion errors
          }
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Error deleting key files:', error.message));
    }
  }

  /**
   * Handle No matching sessions errors
   */
  async handleNoMatchingSessions(jid, error) {
    try {
      console.log(chalk.yellow(`🔑 Handling No matching sessions for ${jid}`));
      
      // Clear session cache for this JID
      this.clearCachedKeys(jid, 'session');
      
      // Force session refresh
      if (global.forceSessionRefresh) {
        await global.forceSessionRefresh(jid);
      }
      
      // Request fresh PreKey bundle
      if (global.conn && global.conn.requestPreKeyBundle) {
        try {
          await global.conn.requestPreKeyBundle(jid).catch(() => {});
        } catch (error) {
          // Silent error handling
        }
      }
      
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Error handling No matching sessions for ${jid}:`, error.message));
      return false;
    }
  }

  /**
   * Clear cached keys for a specific JID and type
   */
  clearCachedKeys(jid, keyType) {
    try {
      const jidHash = this.hashJid(jid);
      
      for (const [filename, metadata] of this.keyCache.entries()) {
        if (filename.includes(keyType) && filename.includes(jidHash)) {
          this.keyCache.delete(filename);
          console.log(chalk.cyan(`🗑️ Cleared cached key: ${filename}`));
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Error clearing cached keys:', error.message));
    }
  }

  /**
   * Hash JID for consistent key naming
   */
  hashJid(jid) {
    let hash = 0;
    for (let i = 0; i < jid.length; i++) {
      const char = jid.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Clean up old encryption keys
   */
  cleanupOldKeys() {
    try {
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      let cleanedCount = 0;

      for (const [filename, metadata] of this.keyCache.entries()) {
        if (now - metadata.lastModified > maxAge) {
          try {
            if (existsSync(metadata.path)) {
              unlinkSync(metadata.path);
              cleanedCount++;
            }
            this.keyCache.delete(filename);
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }

      if (cleanedCount > 0) {
        console.log(chalk.cyan(`🧹 Cleaned up ${cleanedCount} old encryption keys`));
      }
    } catch (error) {
      console.error(chalk.red('❌ Error during key cleanup:', error.message));
    }
  }

  /**
   * Get encryption key statistics
   */
  getKeyStats() {
    const stats = {
      total: this.keyCache.size,
      senderKeys: 0,
      preKeys: 0,
      sessions: 0
    };

    for (const filename of this.keyCache.keys()) {
      if (filename.startsWith('sender-key-')) stats.senderKeys++;
      else if (filename.startsWith('pre-key-')) stats.preKeys++;
      else if (filename.startsWith('session-')) stats.sessions++;
    }

    return stats;
  }

  /**
   * Log encryption key statistics
   */
  logKeyStats() {
    const stats = this.getKeyStats();
    console.log(chalk.cyan('📊 Encryption Key Statistics:'));
    console.log(chalk.cyan(`   Total Keys: ${stats.total}`));
    console.log(chalk.cyan(`   Sender Keys: ${stats.senderKeys}`));
    console.log(chalk.cyan(`   Pre Keys: ${stats.preKeys}`));
    console.log(chalk.cyan(`   Sessions: ${stats.sessions}`));
  }
}

// Create global instance
const encryptionManager = new EncryptionManager();

// Export for use in main.js
export default encryptionManager;

// Enhanced global error handler for encryption issues
export const handleEncryptionError = async (error, jid) => {
  if (!jid) return false;

  const errorMessage = error.message || error.toString();
  console.log(chalk.yellow(`🔧 Handling encryption error for ${jid}: ${errorMessage}`));
  
  // Use comprehensive session recovery for Bad MAC errors
  if (errorMessage.includes('Bad MAC')) {
    console.log(chalk.yellow(`🔧 Using comprehensive Bad MAC recovery for ${jid}`));
    return await recoverFromBadMac(jid);
  }
  
  // Use standard handlers for other errors
  if (errorMessage.includes('No SenderKeyRecord found for decryption')) {
    return await encryptionManager.handleSenderKeyIssue(jid, error);
  }
  
  if (errorMessage.includes('Invalid PreKey ID')) {
    return await encryptionManager.handlePreKeyIssue(jid, error);
  }
  
  if (errorMessage.includes('No matching sessions found')) {
    return await encryptionManager.handleNoMatchingSessions(jid, error);
  }
  
  // For any other session-related errors, try comprehensive recovery
  if (errorMessage.includes('Session error') ||
      errorMessage.includes('Failed to decrypt') ||
      errorMessage.includes('decrypt message')) {
    console.log(chalk.yellow(`🔧 Using comprehensive recovery for session error: ${jid}`));
    return await recoverFromBadMac(jid);
  }
  
  return false;
};

// Export session recovery functions for direct use
export { recoverFromBadMac, sessionRecovery };