#!/bin/bash

echo "🔧 Installing FFmpeg for high quality media conversions..."

# Detect OS and install ffmpeg
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v apt-get &> /dev/null; then
        echo "📦 Installing FFmpeg via apt-get (Ubuntu/Debian)..."
        sudo apt-get update
        sudo apt-get install -y ffmpeg imagemagick
    elif command -v yum &> /dev/null; then
        echo "📦 Installing FFmpeg via yum (CentOS/RHEL)..."
        sudo yum install -y ffmpeg ImageMagick
    elif command -v dnf &> /dev/null; then
        echo "📦 Installing FFmpeg via dnf (Fedora)..."
        sudo dnf install -y ffmpeg ImageMagick
    else
        echo "❌ Unsupported Linux distribution. Please install FFmpeg manually."
        exit 1
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if command -v brew &> /dev/null; then
        echo "📦 Installing FFmpeg via Homebrew (macOS)..."
        brew install ffmpeg imagemagick
    else
        echo "❌ Homebrew not found. Please install Homebrew first: https://brew.sh/"
        exit 1
    fi
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows
    echo "📦 For Windows, please install FFmpeg manually:"
    echo "   Download from: https://ffmpeg.org/download.html"
    echo "   Or use Chocolatey: choco install ffmpeg"
    exit 1
else
    echo "❌ Unsupported operating system: $OSTYPE"
    exit 1
fi

# Verify installation
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg installed successfully!"
    ffmpeg -version | head -n 1
else
    echo "❌ FFmpeg installation failed!"
    exit 1
fi

echo "🎉 FFmpeg is ready for high quality media conversions!" 