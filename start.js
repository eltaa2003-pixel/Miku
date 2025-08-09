#!/usr/bin/env node

import { spawn } from 'child_process';
import chalk from 'chalk';

let restartCount = 0;
const maxRestarts = 5;

function startBot() {
  
  const bot = spawn('node', ['index.js'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });

  bot.on('close', (code) => {
    
    if (restartCount < maxRestarts) {
      restartCount++;
      setTimeout(startBot, 5000);
    } else {
      process.exit(1);
    }
  });

  bot.on('error', (err) => {
    process.exit(1);
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

startBot(); 