#!/usr/bin/env node

console.log('🔍 Checking Loaded Plugins\n');

// Simulate the plugin loading process
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

const pluginFolder = './plugins';
const pluginFilter = (filename) => /\.js$/.test(filename) && !filename.endsWith('.cjs');

try {
  if (!existsSync(pluginFolder)) {
    console.log('❌ Plugins folder not found');
    process.exit(1);
  }
  
  const allFiles = readdirSync(pluginFolder);
  const pluginFiles = allFiles.filter(pluginFilter);
  
  console.log(`📁 Found ${pluginFiles.length} plugin files:`);
  
  // Check for kick-related files
  const kickFiles = pluginFiles.filter(file => 
    file.toLowerCase().includes('kick') || 
    file.includes('طرد') ||
    file.includes('دزمها') ||
    file.includes('انقلع') ||
    file.includes('بنعالي')
  );
  
  console.log('\n🎯 Kick-related files:');
  if (kickFiles.length > 0) {
    kickFiles.forEach(file => {
      console.log(`  ✅ ${file}`);
    });
  } else {
    console.log('  ❌ No kick-related files found');
  }
  
  // Check for test command
  const testFiles = pluginFiles.filter(file => file.includes('test'));
  console.log('\n🧪 Test files:');
  if (testFiles.length > 0) {
    testFiles.forEach(file => {
      console.log(`  ✅ ${file}`);
    });
  } else {
    console.log('  ❌ No test files found');
  }
  
  console.log('\n📋 All plugin files:');
  pluginFiles.forEach(file => {
    console.log(`  📄 ${file}`);
  });
  
  console.log('\n🎯 Next Steps:');
  console.log('1. Restart the bot to load new plugins');
  console.log('2. Try the test command: .test');
  console.log('3. Try the kick command: .kick @user');
  console.log('4. Check bot logs for any errors');
  
} catch (error) {
  console.error('❌ Error reading plugins:', error.message);
} 