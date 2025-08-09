#!/usr/bin/env node

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('🔍 Diagnosing Kick Command Issue\n');

// Check if kick.js exists
try {
  const kickContent = readFileSync('./plugins/kick.js', 'utf8');
  console.log('✅ kick.js file exists');
  
  // Check for basic structure
  if (kickContent.includes('export default handler')) {
    console.log('✅ Has default export');
  } else {
    console.log('❌ Missing default export');
  }
  
  if (kickContent.includes('handler.command')) {
    console.log('✅ Has command pattern');
  } else {
    console.log('❌ Missing command pattern');
  }
  
  if (kickContent.includes('handler.tags')) {
    console.log('✅ Has tags');
  } else {
    console.log('❌ Missing tags');
  }
  
} catch (error) {
  console.log('❌ kick.js file not found or not readable');
}

// Check all plugin files
console.log('\n📁 Checking all plugin files:');
try {
  const pluginFiles = readdirSync('./plugins').filter(file => file.endsWith('.js'));
  console.log(`Found ${pluginFiles.length} plugin files`);
  
  // Check for any files with 'kick' in the name
  const kickFiles = pluginFiles.filter(file => file.toLowerCase().includes('kick'));
  console.log(`Kick-related files: ${kickFiles.join(', ')}`);
  
  // Check for any files with 'طرد' in the name
  const arabicKickFiles = pluginFiles.filter(file => file.includes('طرد'));
  console.log(`Arabic kick files: ${arabicKickFiles.join(', ')}`);
  
} catch (error) {
  console.log('❌ Cannot read plugins directory');
}

// Check main.js for plugin loading
console.log('\n🔧 Checking main.js for plugin loading:');
try {
  const mainContent = readFileSync('./main.js', 'utf8');
  
  if (mainContent.includes('plugins')) {
    console.log('✅ main.js references plugins');
  } else {
    console.log('❌ main.js does not reference plugins');
  }
  
  if (mainContent.includes('handler')) {
    console.log('✅ main.js references handler');
  } else {
    console.log('❌ main.js does not reference handler');
  }
  
} catch (error) {
  console.log('❌ Cannot read main.js');
}

// Check handler.js for command processing
console.log('\n🎯 Checking handler.js for command processing:');
try {
  const handlerContent = readFileSync('./handler.js', 'utf8');
  
  if (handlerContent.includes('plugin.command')) {
    console.log('✅ handler.js processes plugin commands');
  } else {
    console.log('❌ handler.js does not process plugin commands');
  }
  
  if (handlerContent.includes('isAccept')) {
    console.log('✅ handler.js has command acceptance logic');
  } else {
    console.log('❌ handler.js missing command acceptance logic');
  }
  
} catch (error) {
  console.log('❌ Cannot read handler.js');
}

console.log('\n🎯 Possible Solutions:');
console.log('====================');
console.log('1. **Restart the bot** - New plugins need restart to load');
console.log('2. **Check bot logs** - Look for any error messages');
console.log('3. **Verify prefix** - Make sure you\'re using the correct prefix (.)');
console.log('4. **Check permissions** - Ensure bot has admin rights');
console.log('5. **Test in group** - Commands only work in groups');
console.log('6. **Check command format** - Use: .kick @user or .طرد @user');

console.log('\n🔧 Quick Fixes to Try:');
console.log('=====================');
console.log('1. Restart the bot completely');
console.log('2. Try the command: .kick @yourself (for testing)');
console.log('3. Check if other commands work (like .menu)');
console.log('4. Verify the bot is online and responding');
console.log('5. Check if you\'re an admin in the group');

console.log('\n📝 Debug Commands to Try:');
console.log('========================');
console.log('.kick (without target - should show help)');
console.log('.طرد (without target - should show help)');
console.log('.kick @yourself (with mention)');
console.log('.طرد @yourself (with mention)');
console.log('.kick 1234567890 (with phone number)'); 