import { existsSync, readdirSync, unlinkSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

/**
 * Session Recovery Utility for Bad MAC and other encryption errors
 * Provides comprehensive session management and recovery functions
 */
class SessionRecovery {
  constructor(sessionDir = './MyninoSession') {
    this.sessionDir = sessionDir;
    this.recoveryLog = [];
    this.quarantineDir = join(sessionDir, 'quarantine');
    this.backupDir = join(sessionDir, 'backup');
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    try {
      if (!existsSync(this.sessionDir)) {
        mkdirSync(this.sessionDir, { recursive: true });
      }
      if (!existsSync(this.quarantineDir)) {
        mkdirSync(this.quarantineDir, { recursive: true });
      }
      if (!existsSync(this.backupDir)) {
        mkdirSync(this.backupDir, { recursive: true });
      }
    } catch (error) {
      console.error(chalk.red('❌ Error creating directories:', error.message));
    }
  }

  /**
   * Comprehensive session recovery for Bad MAC errors
   */
  async recoverFromBadMac(jid) {
    try {
      console.log(chalk.yellow(`🔧 Starting comprehensive Bad MAC recovery for ${jid}`));
      
      const recoverySteps = [
        () => this.quarantineCorruptedKeys(jid),
        () => this.clearSessionCache(jid),
        () => this.regenerateSessionKeys(jid),
        () => this.validateSessionIntegrity(jid),
        () => this.reestablishConnection(jid)
      ];

      for (let i = 0; i < recoverySteps.length; i++) {
        try {
          console.log(chalk.cyan(`📋 Recovery step ${i + 1}/${recoverySteps.length}`));
          await recoverySteps[i]();
          await this.delay(1000); // Small delay between steps
        } catch (stepError) {
          console.error(chalk.red(`❌ Recovery step ${i + 1} failed:`, stepError.message));
          // Continue with next step
        }
      }

      // Log recovery attempt
      this.logRecovery(jid, 'Bad MAC', true);
      console.log(chalk.green(`✅ Bad MAC recovery completed for ${jid}`));
      
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Bad MAC recovery failed for ${jid}:`, error.message));
      this.logRecovery(jid, 'Bad MAC', false, error.message);
      return false;
    }
  }

  /**
   * Quarantine corrupted session keys
   */
  async quarantineCorruptedKeys(jid) {
    try {
      console.log(chalk.cyan(`🏥 Quarantining corrupted keys for ${jid}`));
      
      const jidHash = this.hashJid(jid);
      const files = readdirSync(this.sessionDir);
      let quarantinedCount = 0;

      for (const file of files) {
        if ((file.includes(jidHash) || file.includes(jid.replace('@', '_'))) && 
            (file.startsWith('session-') || file.startsWith('sender-key-') || file.startsWith('pre-key-'))) {
          
          const sourcePath = join(this.sessionDir, file);
          const quarantinePath = join(this.quarantineDir, `${Date.now()}_${file}`);
          
          try {
            // Move to quarantine instead of deleting
            if (existsSync(sourcePath)) {
              const fs = await import('fs/promises');
              await fs.rename(sourcePath, quarantinePath);
              quarantinedCount++;
              console.log(chalk.yellow(`🏥 Quarantined: ${file}`));
            }
          } catch (error) {
            // If rename fails, try to delete
            try {
              unlinkSync(sourcePath);
              console.log(chalk.yellow(`🗑️ Deleted corrupted: ${file}`));
            } catch (deleteError) {
              console.error(chalk.red(`❌ Failed to handle ${file}:`, deleteError.message));
            }
          }
        }
      }

      console.log(chalk.cyan(`🏥 Quarantined ${quarantinedCount} corrupted keys`));
    } catch (error) {
      console.error(chalk.red('❌ Error quarantining keys:', error.message));
    }
  }

  /**
   * Clear session cache for JID
   */
  async clearSessionCache(jid) {
    try {
      console.log(chalk.cyan(`🧹 Clearing session cache for ${jid}`));
      
      // Clear from global session cache
      if (global.sessionCache && global.sessionCache.has(jid)) {
        global.sessionCache.delete(jid);
        console.log(chalk.cyan(`🗑️ Removed ${jid} from session cache`));
      }

      // Clear from connection chats if available
      if (global.conn && global.conn.chats && global.conn.chats[jid]) {
        delete global.conn.chats[jid];
        console.log(chalk.cyan(`🗑️ Removed ${jid} from connection chats`));
      }

    } catch (error) {
      console.error(chalk.red('❌ Error clearing session cache:', error.message));
    }
  }

  /**
   * Regenerate session keys for JID
   */
  async regenerateSessionKeys(jid) {
    try {
      console.log(chalk.cyan(`🔄 Regenerating session keys for ${jid}`));
      
      if (!global.conn) {
        console.log(chalk.yellow('⚠️ No connection available for key regeneration'));
        return;
      }

      // Skip @lid contacts as they need special handling
      if (jid.includes('@lid')) {
        console.log(chalk.yellow(`⚠️ Skipping @lid contact: ${jid}`));
        return;
      }

      // Request fresh PreKey bundle
      try {
        await global.conn.requestPreKeyBundle(jid);
        console.log(chalk.green(`✅ Requested PreKey bundle for ${jid}`));
      } catch (error) {
        console.log(chalk.yellow(`⚠️ PreKey bundle request failed: ${error.message}`));
      }

      // Re-establish presence subscription
      try {
        await global.conn.presenceSubscribe(jid);
        console.log(chalk.green(`✅ Re-established presence for ${jid}`));
      } catch (error) {
        console.log(chalk.yellow(`⚠️ Presence subscription failed: ${error.message}`));
      }

      // Add back to session cache
      if (global.sessionCache) {
        global.sessionCache.add(jid);
        console.log(chalk.green(`✅ Added ${jid} back to session cache`));
      }

    } catch (error) {
      console.error(chalk.red('❌ Error regenerating session keys:', error.message));
    }
  }

  /**
   * Validate session integrity
   */
  async validateSessionIntegrity(jid) {
    try {
      console.log(chalk.cyan(`🔍 Validating session integrity for ${jid}`));
      
      const jidHash = this.hashJid(jid);
      const files = readdirSync(this.sessionDir);
      let validKeys = 0;

      for (const file of files) {
        if (file.includes(jidHash) && 
            (file.startsWith('session-') || file.startsWith('sender-key-') || file.startsWith('pre-key-'))) {
          
          try {
            const filePath = join(this.sessionDir, file);
            const stats = statSync(filePath);
            
            // Basic validation - file should exist and have content
            if (stats.size > 0) {
              validKeys++;
            } else {
              console.log(chalk.yellow(`⚠️ Empty key file detected: ${file}`));
              unlinkSync(filePath); // Remove empty files
            }
          } catch (error) {
            console.log(chalk.yellow(`⚠️ Invalid key file: ${file}`));
          }
        }
      }

      console.log(chalk.cyan(`🔍 Found ${validKeys} valid keys for ${jid}`));
      return validKeys > 0;

    } catch (error) {
      console.error(chalk.red('❌ Error validating session integrity:', error.message));
      return false;
    }
  }

  /**
   * Re-establish connection for JID
   */
  async reestablishConnection(jid) {
    try {
      console.log(chalk.cyan(`🔗 Re-establishing connection for ${jid}`));
      
      if (!global.conn) {
        console.log(chalk.yellow('⚠️ No connection available'));
        return;
      }

      // Skip @lid contacts
      if (jid.includes('@lid')) {
        console.log(chalk.yellow(`⚠️ Skipping @lid contact: ${jid}`));
        return;
      }

      // Use global session creation if available
      if (global.createImmediateSession) {
        await global.createImmediateSession(jid);
        console.log(chalk.green(`✅ Created immediate session for ${jid}`));
      } else {
        // Fallback to basic session establishment
        await global.conn.presenceSubscribe(jid).catch(() => {});
        console.log(chalk.green(`✅ Re-established basic connection for ${jid}`));
      }

    } catch (error) {
      console.error(chalk.red('❌ Error re-establishing connection:', error.message));
    }
  }

  /**
   * Emergency session cleanup - removes all corrupted sessions
   */
  async emergencyCleanup() {
    try {
      console.log(chalk.red('🚨 Starting emergency session cleanup'));
      
      const files = readdirSync(this.sessionDir);
      let cleanedCount = 0;

      for (const file of files) {
        if (file.startsWith('session-') || file.startsWith('sender-key-') || file.startsWith('pre-key-')) {
          try {
            const filePath = join(this.sessionDir, file);
            const stats = statSync(filePath);
            
            // Remove files older than 1 hour or empty files
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            if (stats.mtimeMs < oneHourAgo || stats.size === 0) {
              unlinkSync(filePath);
              cleanedCount++;
              console.log(chalk.yellow(`🗑️ Cleaned: ${file}`));
            }
          } catch (error) {
            // Ignore individual file errors
          }
        }
      }

      console.log(chalk.red(`🚨 Emergency cleanup completed: ${cleanedCount} files removed`));
      return cleanedCount;

    } catch (error) {
      console.error(chalk.red('❌ Emergency cleanup failed:', error.message));
      return 0;
    }
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats() {
    const stats = {
      totalRecoveries: this.recoveryLog.length,
      successfulRecoveries: this.recoveryLog.filter(r => r.success).length,
      failedRecoveries: this.recoveryLog.filter(r => !r.success).length,
      recentRecoveries: this.recoveryLog.filter(r => Date.now() - r.timestamp < 24 * 60 * 60 * 1000).length
    };

    return stats;
  }

  /**
   * Log recovery attempt
   */
  logRecovery(jid, errorType, success, errorMessage = null) {
    this.recoveryLog.push({
      jid,
      errorType,
      success,
      errorMessage,
      timestamp: Date.now()
    });

    // Keep only last 100 entries
    if (this.recoveryLog.length > 100) {
      this.recoveryLog = this.recoveryLog.slice(-100);
    }
  }

  /**
   * Hash JID for consistent naming
   */
  hashJid(jid) {
    let hash = 0;
    for (let i = 0; i < jid.length; i++) {
      const char = jid.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Display recovery statistics
   */
  displayStats() {
    const stats = this.getRecoveryStats();
    console.log(chalk.cyan('📊 Session Recovery Statistics:'));
    console.log(chalk.cyan(`   Total Recoveries: ${stats.totalRecoveries}`));
    console.log(chalk.cyan(`   Successful: ${stats.successfulRecoveries}`));
    console.log(chalk.cyan(`   Failed: ${stats.failedRecoveries}`));
    console.log(chalk.cyan(`   Recent (24h): ${stats.recentRecoveries}`));
    
    if (stats.totalRecoveries > 0) {
      const successRate = ((stats.successfulRecoveries / stats.totalRecoveries) * 100).toFixed(1);
      console.log(chalk.cyan(`   Success Rate: ${successRate}%`));
    }
  }
}

// Create global instance
const sessionRecovery = new SessionRecovery();

// Export for use in other modules
export default sessionRecovery;

// Export recovery function for direct use
export const recoverFromBadMac = async (jid) => {
  return await sessionRecovery.recoverFromBadMac(jid);
};

// Export emergency cleanup function
export const emergencySessionCleanup = async () => {
  return await sessionRecovery.emergencyCleanup();
};