#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import { platform } from 'os';

console.log('🔧 Checking FFmpeg installation...');

// Check if ffmpeg is already installed
exec('ffmpeg -version', (error, stdout, stderr) => {
  if (error) {
    console.log('❌ FFmpeg not found. Installing...');
    installFFmpeg();
  } else {
    console.log('✅ FFmpeg is already installed!');
    console.log(stdout.split('\n')[0]); // Show version
    console.log('🎉 Ready for high quality media conversions!');
  }
});

function installFFmpeg() {
  const os = platform();
  
  if (os === 'win32') {
    console.log('📦 Windows detected. Please run: install-ffmpeg.bat');
    console.log('   Or install manually from: https://ffmpeg.org/download.html');
  } else if (os === 'darwin') {
    console.log('📦 macOS detected. Installing via Homebrew...');
    exec('brew install ffmpeg', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Homebrew not found. Please install Homebrew first: https://brew.sh/');
      } else {
        console.log('✅ FFmpeg installed successfully!');
      }
    });
  } else if (os === 'linux') {
    console.log('📦 Linux detected. Installing via apt-get...');
    exec('sudo apt-get update && sudo apt-get install -y ffmpeg', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Failed to install via apt-get. Please install manually.');
      } else {
        console.log('✅ FFmpeg installed successfully!');
      }
    });
  } else {
    console.log('❌ Unsupported operating system. Please install FFmpeg manually.');
  }
}

// Also check for ImageMagick
exec('convert -version', (error, stdout, stderr) => {
  if (error) {
    console.log('⚠️  ImageMagick not found. Some features may not work optimally.');
  } else {
    console.log('✅ ImageMagick is installed!');
  }
}); 