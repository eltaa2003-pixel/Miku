import chalk from 'chalk';

/**
 * Enhanced Error Handler for MongoDB and WhatsApp connection issues
 * Provides diagnosis and recovery strategies for common errors
 */
class ErrorHandler {
  constructor() {
    this.errorCounts = new Map();
    this.lastErrorTime = new Map();
    this.errorThresholds = {
      SSL_ERROR: 3,
      MONGO_ERROR: 5,
      WHATSAPP_ERROR: 10,
      DECRYPTION_ERROR: 15
    };
    this.recoveryStrategies = {};
  }

  normalizeError(reason) {
    if (reason instanceof Error) return reason;
    if (typeof reason === 'number' || typeof reason === 'string') {
      return new Error(String(reason));
    }
    return new Error(reason?.message || String(reason));
  }

  isRecoverableBaileysError(error) {
    const message = error?.message || String(error);
    return [
      'Unsupported state or unable to authenticate data',
      'Connection Closed',
      'Connection Failure',
      'WebSocket was closed',
      'Stream Errored',
      'Timed Out',
      '428',
      '440',
      '1006'
    ].some((text) => message.includes(text));
  }

  /**
   * Initialize error handlers
   */
  async initialize() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.handleCriticalError('UncaughtException', error);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      const error = this.normalizeError(reason);
      if (this.isRecoverableBaileysError(error)) {
        console.warn(chalk.yellow(`Recoverable WhatsApp socket rejection: ${error.message}`));
        return;
      }
      this.handleCriticalError('UnhandledRejection', error);
    });
  }

  /**
   * Handle critical errors with recovery strategies
   */
  async handleCriticalError(errorType, error) {
    const errorMessage = error.message || error.toString();

    if (this.isRecoverableBaileysError(error)) {
      console.warn(chalk.yellow(`Recoverable WhatsApp socket error: ${errorMessage}`));
      return;
    }
    
    console.error(chalk.red.bold(`\n❌ CRITICAL ERROR [${errorType}]:`));
    console.error(chalk.red(`Message: ${errorMessage}`));
    
    if (error.stack) {
      console.error(chalk.dim(`Stack: ${error.stack}`));
    }

    // Categorize and handle specific errors
    if (errorMessage.includes('SSL') || errorMessage.includes('TLS') || errorMessage.includes('TLSV1')) {
      await this.handleSSLError(error);
    } else if (errorMessage.includes('MongoDB') || errorMessage.includes('Mongo')) {
      await this.handleMongoError(error);
    } else if (errorMessage.includes('WhatsApp') || errorMessage.includes('Signal')) {
      await this.handleWhatsAppError(error);
    }
  }

  /**
   * Handle SSL/TLS connection errors
   */
  async handleSSLError(error) {
    const errorKey = 'SSL_ERROR';
    const count = this.incrementErrorCount(errorKey);

    console.log(chalk.yellow('\n🔒 SSL/TLS Error Detected'));
    console.log(chalk.cyan('Possible causes:'));
    console.log('  • MongoDB Atlas network configuration issues');
    console.log('  • Node.js version incompatibility');
    console.log('  • Server certificate validation problems');
    console.log('  • Firewall or proxy interference');

    console.log(chalk.cyan('\nSuggested fixes:'));
    console.log('  1. Update Node.js to the latest LTS version');
    console.log('  2. Check MongoDB Atlas IP whitelist');
    console.log('  3. Verify connection string: mongodb+srv://username:password@cluster');
    console.log('  4. Try disabling SSL certificate verification (dev only):');
    console.log('     export NODE_TLS_REJECT_UNAUTHORIZED=0');
    console.log('  5. Check if using a proxy: configure via environmental variables');

    if (count >= this.errorThresholds.SSL_ERROR) {
      console.log(chalk.red(`\n⚠️ SSL errors reached threshold (${count}). Restarting...`));
      setTimeout(() => {
        if (typeof process.send === 'function') process.send('reset');
      }, 5000);
    }
  }

  /**
   * Handle MongoDB connection errors
   */
  async handleMongoError(error) {
    const errorKey = 'MONGO_ERROR';
    const count = this.incrementErrorCount(errorKey);

    console.log(chalk.yellow('\n🗄️ MongoDB Connection Error Detected'));
    console.log(chalk.cyan('Possible causes:'));
    console.log('  • MongoDB Atlas cluster unavailable');
    console.log('  • Network connectivity issues');
    console.log('  • Invalid connection credentials');
    console.log('  • Database server overload');
    console.log('  • SSL/TLS handshake failures');

    console.log(chalk.cyan('\nSuggested fixes:'));
    console.log('  1. Verify MongoDB Atlas cluster status');
    console.log('  2. Check network connectivity to MongoDB servers');
    console.log('  3. Verify MONGODB_URI environment variable');
    console.log('  4. Check user credentials and permissions');
    console.log('  5. Add your IP to MongoDB Atlas whitelist:');
    console.log('     • Go to Atlas > Network Access');
    console.log('     • Add your IP address or use 0.0.0.0/0 (development only)');

    if (count >= this.errorThresholds.MONGO_ERROR) {
      console.log(chalk.red(`\n⚠️ MongoDB errors reached threshold (${count}). Falling back to local database...`));
      global.useLocalDB = true;
    }
  }

  /**
   * Handle WhatsApp-specific errors
   */
  async handleWhatsAppError(error) {
    const errorKey = 'WHATSAPP_ERROR';
    const count = this.incrementErrorCount(errorKey);

    console.log(chalk.yellow('\n📱 WhatsApp Connection Error Detected'));
    console.log(chalk.cyan('Possible causes:'));
    console.log('  • Session expired or invalidated');
    console.log('  • Network interruption');
    console.log('  • WhatsApp server issues');
    console.log('  • Encryption key synchronization problems');

    console.log(chalk.cyan('\nSuggested fixes:'));
    console.log('  1. Delete session files and re-authenticate');
    console.log('  2. Check internet connection');
    console.log('  3. Restart the bot');
    console.log('  4. Check WhatsApp server status');

    if (count >= this.errorThresholds.WHATSAPP_ERROR) {
      console.log(chalk.red(`\n⚠️ WhatsApp errors reached threshold (${count}). Resetting session...`));
      // Force session reset
      try {
        const fs = await import('fs');
        const sessionDir = './MyninoSession';
        if (fs.existsSync(sessionDir)) {
          // Only delete non-critical files
          const files = fs.readdirSync(sessionDir);
          files.forEach(file => {
            if (!file.endsWith('.json') || file.startsWith('creds')) {
              try {
                fs.unlinkSync(`${sessionDir}/${file}`);
              } catch (e) {
                // Silent
              }
            }
          });
        }
      } catch (e) {
        // Silent
      }
      setTimeout(() => {
        if (typeof process.send === 'function') process.send('reset');
      }, 5000);
    }
  }

  /**
   * Increment error count and return current count
   */
  incrementErrorCount(errorKey) {
    let count = this.errorCounts.get(errorKey) || 0;
    count++;
    this.errorCounts.set(errorKey, count);
    this.lastErrorTime.set(errorKey, Date.now());
    
    // Reset count after 1 hour without errors
    setTimeout(() => {
      const timeDiff = Date.now() - (this.lastErrorTime.get(errorKey) || 0);
      if (timeDiff > 60 * 60 * 1000) {
        this.errorCounts.set(errorKey, 0);
      }
    }, 60 * 60 * 1000);
    
    return count;
  }

  /**
   * Handle specific MongoDB error codes
   */
  analyzeMongoDobError(error) {
    const errorMessage = error.message || '';
    
    if (errorMessage.includes('ECONNREFUSED')) {
      return {
        type: 'CONNECTION_REFUSED',
        message: 'MongoDB server refused connection',
        suggestion: 'Make sure MongoDB is running or check connection string'
      };
    }
    
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      return {
        type: 'DNS_RESOLUTION_FAILED',
        message: 'Could not resolve MongoDB hostname',
        suggestion: 'Check DNS configuration and connection string'
      };
    }
    
    if (errorMessage.includes('ETIMEDOUT')) {
      return {
        type: 'CONNECTION_TIMEOUT',
        message: 'Connection to MongoDB timed out',
        suggestion: 'Check network connectivity and MongoDB server status'
      };
    }
    
    if (errorMessage.includes('authentication failed')) {
      return {
        type: 'AUTH_FAILED',
        message: 'MongoDB authentication failed',
        suggestion: 'Check username and password in connection string'
      };
    }
    
    if (errorMessage.includes('ReplicaSetNoPrimary')) {
      return {
        type: 'REPLICA_SET_ERROR',
        message: 'MongoDB replica set has no primary',
        suggestion: 'Check MongoDB Atlas cluster status and health'
      };
    }
    
    return {
      type: 'UNKNOWN',
      message: 'Unknown MongoDB error',
      suggestion: 'Check MongoDB logs and server status'
    };
  }

  /**
   * Generate diagnostic report
   */
  generateDiagnosticReport() {
    console.log(chalk.cyan.bold('\n📋 Diagnostic Report'));
    console.log(chalk.cyan('━'.repeat(50)));
    
    console.log(chalk.cyan('Error Statistics:'));
    for (const [errorType, count] of this.errorCounts.entries()) {
      const lastTime = this.lastErrorTime.get(errorType);
      const timeAgo = lastTime ? Math.round((Date.now() - lastTime) / 1000) : 'N/A';
      console.log(`  • ${errorType}: ${count} errors (Last: ${timeAgo}s ago)`);
    }
    
    console.log(chalk.cyan('\nEnvironment Info:'));
    console.log(`  • Node.js: ${process.version}`);
    console.log(`  • Platform: ${process.platform}`);
    console.log(`  • Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    console.log(`  • Uptime: ${Math.round(process.uptime())}s`);
    
    console.log(chalk.cyan('\nConfiguration Status:'));
    console.log(`  • MongoDB URI: ${process.env.MONGODB_URI ? '✓ Set' : '✗ Not set'}`);
    console.log(`  • TLS Enabled: ${process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ? '✗ Disabled' : '✓ Enabled'}`);
    console.log(`  • LOCAL_DB: ${global.useLocalDB ? '✓ Using local database' : '✗ Using remote'}`);
  }
}

export default new ErrorHandler();
