let handler = m => m;

// Regular expression to detect common error patterns in messages
const errorPattern = /(error|failed|exception|cannot|unable to|unexpected|invalid|issue|problem|bug|crash|traceback)/i;

// List of owner JIDs to notify
const ownerJids = ['96176337375@s.whatsapp.net']; // Add your JID here

handler.before = async function (m) {
  // Ignore messages from the bot itself
  if (m.fromMe) {
    return;
  }

  // Check if the message contains any error-related keywords
  if (errorPattern.test(m.text)) {
    const errorMessage = `
*🚨 Error Alert! 🚨*

An error or issue has been detected in a message.

*User:* @${m.sender.split('@')[0]}
*Chat:* ${m.chat}
*Message:*
${m.text}

Please review the logs for more details.
    `.trim();

    // Send the error message to all owner JIDs
    for (const ownerJid of ownerJids) {
      await this.sendMessage(ownerJid, {
        text: errorMessage,
        mentions: [m.sender],
      });
    }
  }
};

handler.command = /^(health|status)$/i;
handler.rowner = true;

handler.handler = async function (m) {
  const healthStatus = `
*🤖 Bot Health Status 🤖*

*Status:* All systems operational
*Uptime:* ${process.uptime() ? formatUptime(process.uptime()) : 'N/A'}
*Memory Usage:* ${formatMemoryUsage(process.memoryUsage().rss)}
*Node.js Version:* ${process.version}
*Platform:* ${process.platform}

Everything is running smoothly! ✅
  `.trim();

  await m.reply(healthStatus);
};

export default handler;

/**
 * Formats uptime from seconds to a human-readable string.
 * @param {number} seconds - The uptime in seconds.
 * @returns {string} - The formatted uptime string.
 */
function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return `${d}d ${h}h ${m}m ${s}s`;
}

/**
 * Formats memory usage from bytes to a human-readable string.
 * @param {number} bytes - The memory usage in bytes.
 * @returns {string} - The formatted memory usage string.
 */
function formatMemoryUsage(bytes) {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}