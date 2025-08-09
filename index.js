import { join, dirname } from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import cluster from "cluster";
import { watchFile, unwatchFile } from "fs";
import cfonts from "cfonts";
import chalk from "chalk";
import { createInterface } from "readline";
import yargs from "yargs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(__dirname);
const { name, author } = require(join(__dirname, "./package.json"));

// Prevent multiple banners - only show in primary process
if (cluster.isPrimary) {
  console.clear(); // Clear console first
  console.log(chalk.cyan('🚀 Starting Elta Bot...'));

  cfonts.say('𝐸𝓁𝓉𝒶\nBot\nMD', {
    font: 'chrome',
    align: 'center',
    gradient: ['red', 'magenta']
  });

  cfonts.say(`by Elta`, {
    font: 'console',
    align: 'center',
    gradient: ['red', 'magenta']
  });
}

// Initialize readline interface only in primary
const rl = cluster.isPrimary ? createInterface({
  input: process.stdin,
  output: process.stdout
}) : null;

let isRunning = false;
let currentProcess = null;

/**
 * Start the bot process
 * @param {string} file - Path to the main bot file
 */
function startBot(file) {
  if (isRunning) {
    console.log(chalk.yellow('⚠️  Bot is already running'));
    return;
  }

  // Kill any existing processes first
  if (currentProcess && !currentProcess.killed) {
    console.log(chalk.yellow('🔄 Killing existing process...'));
    currentProcess.kill('SIGKILL');
    currentProcess = null;
  }

  isRunning = true;
  const args = [join(__dirname, file), ...process.argv.slice(2)];

  console.log(chalk.blue('📦 Setting up bot process...'));

  cluster.setupPrimary({
    exec: args[0],
    args: args.slice(1),
    silent: false,
    env: {
      ...process.env,
      ELTA_CHILD_PROCESS: 'true'
    }
  });

  currentProcess = cluster.fork();

  // Handle messages from bot process
  currentProcess.on('message', (data) => {
    switch (data) {
      case 'reset':
        console.log(chalk.yellow('🔄 Restarting bot...'));
        if (currentProcess && !currentProcess.killed) {
          currentProcess.kill('SIGTERM');
        }
        isRunning = false;
        setTimeout(() => startBot(file), 3000); // Reduced delay
        break;
        
      case 'uptime':
        currentProcess.send(process.uptime());
        break;
        
      default:
        if (typeof data === 'object' && data.type === 'status') {
          console.log(chalk.green('✅ Bot Status:'), data.message);
        } else {
          console.log(chalk.cyan('📨 Message from bot:'), data);
        }
    }
  });

  // Handle process exit
  currentProcess.on('exit', (code, signal) => {
    isRunning = false;
    currentProcess = null; // Clear reference
    
    if (code === 0) {
      console.log(chalk.green('✅ Bot stopped gracefully'));
      return;
    }

    console.error(chalk.red('❌ Bot crashed with code:'), code);
    if (signal) console.error(chalk.red('📡 Signal:'), signal);
    
    // Only auto-restart on crashes, not manual stops
    if (signal !== 'SIGTERM' && signal !== 'SIGINT') {
      console.log(chalk.yellow('🔄 Auto-restarting in 5 seconds...'));
      setTimeout(() => startBot(file), 5000);
    }
  });

  // Handle unexpected errors
  currentProcess.on('error', (error) => {
    console.error(chalk.red('💥 Process error:'), error.message);
    isRunning = false;
    currentProcess = null;
  });

  console.log(chalk.green('✅ Bot process started successfully'));
}

// Only run in primary process
if (cluster.isPrimary) {
  // Parse command line arguments
  const opts = yargs(process.argv.slice(2))
    .option('test', {
      type: 'boolean',
      description: 'Run in test mode'
    })
    .exitProcess(false)
    .parse();

  // Setup readline for interactive commands
  if (!opts.test && rl) {
    rl.on('line', (input) => {
      const command = input.trim().toLowerCase();
      
      if (!command) return;
      
      switch (command) {
        case 'restart':
        case 'r':
          console.log(chalk.yellow('🔄 Manual restart requested...'));
          if (currentProcess && isRunning) {
            currentProcess.emit('message', 'reset');
          } else {
            console.log(chalk.red('⚠️ No bot process running to restart'));
          }
          break;
          
        case 'stop':
        case 'exit':
        case 'quit':
          console.log(chalk.red('🛑 Stopping bot...'));
          if (currentProcess) {
            currentProcess.kill('SIGTERM');
            setTimeout(() => {
              if (isRunning) {
                currentProcess.kill('SIGKILL');
              }
            }, 5000);
          }
          if (rl) rl.close();
          process.exit(0);
          break;
          
        case 'status':
        case 's':
          console.log(chalk.blue('📊 Bot Status:'), isRunning ? chalk.green('Running') : chalk.red('Stopped'));
          if (currentProcess) {
            console.log(chalk.blue('🆔 Process ID:'), currentProcess.process.pid);
          }
          break;
          
        case 'help':
        case 'h':
          console.log(chalk.blue('Available commands:'));
          console.log(chalk.gray('  restart/r  - Restart the bot'));
          console.log(chalk.gray('  stop/exit  - Stop the bot and exit'));
          console.log(chalk.gray('  status/s   - Show bot status'));
          console.log(chalk.gray('  help/h     - Show this help'));
          break;
          
        default:
          // Forward other commands to bot process
          if (currentProcess && isRunning) {
            currentProcess.emit('message', command);
          } else {
            console.log(chalk.red('⚠️ No bot process running. Use "restart" to start it.'));
          }
      }
    });

    console.log(chalk.gray('💡 Commands: restart/r, stop/exit, status/s, help/h'));
  }

  // Improved graceful shutdown handling
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    
    console.log(chalk.yellow(`\n🛑 Received ${signal}, shutting down...`));
    
    if (currentProcess && !currentProcess.killed) {
      console.log(chalk.blue('📝 Stopping bot process...'));
      currentProcess.removeAllListeners(); // Prevent restart
      currentProcess.kill('SIGTERM');
      
      setTimeout(() => {
        if (currentProcess && !currentProcess.killed) {
          console.log(chalk.red('⚡ Force killing bot process...'));
          currentProcess.kill('SIGKILL');
        }
        currentProcess = null;
      }, 3000);
    }
    
    if (rl) rl.close();
    setTimeout(() => process.exit(0), 4000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error(chalk.red('💥 Uncaught Exception:'), error);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('💥 Unhandled Rejection at:'), promise, 'reason:', reason);
    shutdown('UNHANDLED_REJECTION');
  });

  // Start the bot
  startBot('main.js');
}