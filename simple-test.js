console.log('🔍 Testing kick.js plugin...');

try {
  // Test if we can import the plugin
  const kickModule = await import('./plugins/kick.js');
  console.log('✅ Plugin imported successfully');
  
  // Check if it has the required properties
  const handler = kickModule.default;
  console.log('✅ Default export found:', typeof handler);
  
  if (handler.command) {
    console.log('✅ Command pattern found:', handler.command);
  } else {
    console.log('❌ No command pattern found');
  }
  
  if (handler.help) {
    console.log('✅ Help found:', handler.help);
  } else {
    console.log('❌ No help found');
  }
  
  if (handler.tags) {
    console.log('✅ Tags found:', handler.tags);
  } else {
    console.log('❌ No tags found');
  }
  
  console.log('✅ Plugin structure looks good!');
  
} catch (error) {
  console.error('❌ Error importing plugin:', error.message);
} 