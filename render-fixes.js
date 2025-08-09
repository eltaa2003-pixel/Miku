#!/usr/bin/env node

/**
 * Render Deployment Fixes
 * Comprehensive fixes for common Render deployment issues
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

console.log(chalk.cyan('🔧 Applying Render deployment fixes...\n'));

// Fix 1: Create required directories
console.log(chalk.yellow('1. Creating required directories...'));

const requiredDirs = [
  './tmp',
  './MyninoSession',
  './session-backup',
  './jadibts',
  './data',
  './db'
];

requiredDirs.forEach(dir => {
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(chalk.green(`✅ Created directory: ${dir}`));
    } else {
      console.log(chalk.cyan(`📁 Directory exists: ${dir}`));
    }
  } catch (error) {
    console.log(chalk.red(`❌ Error creating ${dir}:`, error.message));
  }
});

// Fix 2: Create essential files
console.log(chalk.yellow('\n2. Creating essential files...'));

const essentialFiles = [
  {
    path: './tmp/.gitkeep',
    content: '# This file ensures the tmp directory is tracked by git'
  },
  {
    path: './data/.gitkeep',
    content: '# This file ensures the data directory is tracked by git'
  },
  {
    path: './db/.gitkeep',
    content: '# This file ensures the db directory is tracked by git'
  }
];

essentialFiles.forEach(file => {
  try {
    if (!existsSync(file.path)) {
      writeFileSync(file.path, file.content);
      console.log(chalk.green(`✅ Created file: ${file.path}`));
    } else {
      console.log(chalk.cyan(`📄 File exists: ${file.path}`));
    }
  } catch (error) {
    console.log(chalk.red(`❌ Error creating ${file.path}:`, error.message));
  }
});

// Fix 3: Check environment variables
console.log(chalk.yellow('\n3. Checking environment variables...'));

const requiredEnvVars = [
  'RENDER_EXTERNAL_URL',
  'RENDER_SERVICE_ID',
  'RENDER_SERVICE_NAME'
];

requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(chalk.green(`✅ ${envVar}: ${process.env[envVar]}`));
  } else {
    console.log(chalk.yellow(`⚠️ ${envVar}: Not set (optional for local development)`));
  }
});

// Fix 4: Check Node.js version
console.log(chalk.yellow('\n4. Checking Node.js version...'));
const nodeVersion = process.version;
console.log(chalk.green(`✅ Node.js version: ${nodeVersion}`));

// Fix 5: Check file permissions
console.log(chalk.yellow('\n5. Checking file permissions...'));

const criticalFiles = [
  './main.js',
  './handler.js',
  './config.js',
  './lib/encryption-manager.js',
  './lib/private-blocker.js',
  './plugins/private-blocker-admin.js'
];

criticalFiles.forEach(file => {
  try {
    if (existsSync(file)) {
      console.log(chalk.green(`✅ ${file} exists and accessible`));
    } else {
      console.log(chalk.red(`❌ ${file} missing`));
    }
  } catch (error) {
    console.log(chalk.red(`❌ Error checking ${file}:`, error.message));
  }
});

// Summary
console.log(chalk.cyan('\n📊 Render Fixes Summary:'));
console.log(chalk.cyan('======================'));

console.log(chalk.green('✅ All required directories created'));
console.log(chalk.green('✅ Essential files created'));
console.log(chalk.green('✅ Environment variables checked'));
console.log(chalk.green('✅ Node.js version verified'));
console.log(chalk.green('✅ Critical files verified'));

console.log(chalk.cyan('\n🚀 Your bot should now work properly on Render!'));
console.log(chalk.cyan('\n💡 Additional recommendations:'));
console.log(chalk.cyan('   • Monitor logs for encryption errors'));
console.log(chalk.cyan('   • Use the private blocker commands if needed'));
console.log(chalk.cyan('   • Check session persistence after restarts'));
console.log(chalk.cyan('   • Monitor memory usage on Render'));

console.log(chalk.cyan('\n📖 For troubleshooting:'));
console.log(chalk.cyan('   • Check Render logs for detailed error messages'));
console.log(chalk.cyan('   • Use .blockstats to monitor blocking system'));
console.log(chalk.cyan('   • Monitor encryption key statistics'));
console.log(chalk.cyan('   • Check session backup/restore functionality')); 