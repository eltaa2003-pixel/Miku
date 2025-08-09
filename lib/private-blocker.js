import chalk from 'chalk';

/**
 * Private Message Blocker for WhatsApp Bot
 * Blocks non-owners from messaging the bot in private chats
 */
class PrivateBlocker {
  constructor() {
    this.blockedUsers = new Set();
    this.blockedCount = 0;
    this.lastBlockTime = {};
    this.blockThreshold = 3; // Number of attempts before permanent block
    this.blockDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  /**
   * Check if a user is blocked
   */
  isBlocked(userId) {
    return this.blockedUsers.has(userId);
  }

  /**
   * Block a user from private messaging
   */
  blockUser(userId, reason = 'Private messaging not allowed') {
    this.blockedUsers.add(userId);
    this.blockedCount++;
    this.lastBlockTime[userId] = Date.now();
    
    console.log(chalk.red(`🚫 BLOCKED USER: ${userId} - ${reason}`));
    console.log(chalk.cyan(`📊 Total blocked users: ${this.blockedCount}`));
  }

  /**
   * Unblock a user
   */
  unblockUser(userId) {
    if (this.blockedUsers.has(userId)) {
      this.blockedUsers.delete(userId);
      delete this.lastBlockTime[userId];
      console.log(chalk.green(`✅ UNBLOCKED USER: ${userId}`));
      return true;
    }
    return false;
  }

  /**
   * Check if user should be blocked based on attempts
   */
  shouldBlockUser(userId) {
    const attempts = this.getAttemptCount(userId);
    return attempts >= this.blockThreshold;
  }

  /**
   * Get attempt count for a user
   */
  getAttemptCount(userId) {
    // This is a simplified version - in a real implementation,
    // you might want to store this in a database
    return this.lastBlockTime[userId] ? 1 : 0;
  }

  /**
   * Handle private message attempt
   */
  async handlePrivateMessage(m, isOwner) {
    const userId = m.sender;
    
    // Allow owners
    if (isOwner) {
      return { allowed: true, reason: 'Owner access' };
    }

    // Check if user is already blocked
    if (this.isBlocked(userId)) {
      return { 
        allowed: false, 
        reason: 'User is blocked',
        message: this.getBlockedMessage(userId)
      };
    }

    // Check if user should be blocked based on attempts
    if (this.shouldBlockUser(userId)) {
      this.blockUser(userId, 'Multiple private message attempts');
      return { 
        allowed: false, 
        reason: 'User blocked due to multiple attempts',
        message: this.getBlockedMessage(userId)
      };
    }

    // First attempt - warn and track
    this.lastBlockTime[userId] = Date.now();
    return { 
      allowed: false, 
      reason: 'First private message attempt',
      message: this.getWarningMessage(userId)
    };
  }

  /**
   * Get warning message for first attempt
   */
  getWarningMessage(userId) {
    const ownerList = global.owner.map(([number, name]) => `• ${name}: \`${number}\``).join('\n');
    
    return `*🚫 ACCESS DENIED* 🚫

*You are not authorized to message this bot in private.*

*Only owners can use this bot in private chats:*
${ownerList}

*If you need to use the bot, please:*
• Use it in a group where the bot is added
• Contact an owner for private access
• The bot will only respond to owners in private chats

*⚠️ WARNING: Multiple attempts will result in permanent blocking.*

*This is a security measure to prevent spam and unauthorized usage.*`;
  }

  /**
   * Get blocked message for blocked users
   */
  getBlockedMessage(userId) {
    const blockTime = this.lastBlockTime[userId];
    const blockDate = blockTime ? new Date(blockTime).toLocaleString() : 'Unknown';
    
    return `*🚫 PERMANENTLY BLOCKED* 🚫

*You have been permanently blocked from messaging this bot in private.*

*Block Date:* ${blockDate}
*Reason:* Multiple unauthorized private message attempts

*To regain access, contact an owner:*
${global.owner.map(([number, name]) => `• ${name}: \`${number}\``).join('\n')}

*This block is permanent and cannot be bypassed.*`;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalBlocked: this.blockedCount,
      currentlyBlocked: this.blockedUsers.size,
      blockThreshold: this.blockThreshold,
      blockDuration: this.blockDuration
    };
  }

  /**
   * Get list of blocked users
   */
  getBlockedUsers() {
    return Array.from(this.blockedUsers).map(userId => ({
      userId,
      blockTime: this.lastBlockTime[userId] || 'Unknown',
      blockDate: this.lastBlockTime[userId] ? new Date(this.lastBlockTime[userId]).toLocaleString() : 'Unknown'
    }));
  }

  /**
   * Clear all blocks (admin function)
   */
  clearAllBlocks() {
    const count = this.blockedUsers.size;
    this.blockedUsers.clear();
    this.lastBlockTime = {};
    console.log(chalk.green(`✅ Cleared ${count} blocked users`));
    return count;
  }

  /**
   * Export blocked users data
   */
  exportData() {
    return {
      blockedUsers: Array.from(this.blockedUsers),
      blockedCount: this.blockedCount,
      lastBlockTime: this.lastBlockTime,
      stats: this.getStats()
    };
  }

  /**
   * Import blocked users data
   */
  importData(data) {
    if (data.blockedUsers) {
      this.blockedUsers = new Set(data.blockedUsers);
    }
    if (data.blockedCount) {
      this.blockedCount = data.blockedCount;
    }
    if (data.lastBlockTime) {
      this.lastBlockTime = data.lastBlockTime;
    }
    console.log(chalk.green(`✅ Imported ${this.blockedUsers.size} blocked users`));
  }
}

// Create global instance
const privateBlocker = new PrivateBlocker();

// Export for use in handler.js
export default privateBlocker;

// Export helper functions
export const handlePrivateMessage = async (m, isOwner) => {
  return await privateBlocker.handlePrivateMessage(m, isOwner);
};

export const blockUser = (userId, reason) => {
  return privateBlocker.blockUser(userId, reason);
};

export const unblockUser = (userId) => {
  return privateBlocker.unblockUser(userId);
};

export const getBlockedStats = () => {
  return privateBlocker.getStats();
};

export const getBlockedUsers = () => {
  return privateBlocker.getBlockedUsers();
}; 