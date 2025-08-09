@echo off
echo 🔧 Installing FFmpeg for high quality media conversions...

REM Check if Chocolatey is installed
where choco >nul 2>nul
if %errorlevel% equ 0 (
    echo 📦 Installing FFmpeg via Chocolatey...
    choco install ffmpeg -y
    goto :verify
)

REM Check if winget is available
where winget >nul 2>nul
if %errorlevel% equ 0 (
    echo 📦 Installing FFmpeg via winget...
    winget install Gyan.FFmpeg
    goto :verify
)

REM Check if scoop is available
where scoop >nul 2>nul
if %errorlevel% equ 0 (
    echo 📦 Installing FFmpeg via Scoop...
    scoop install ffmpeg
    goto :verify
)

echo ❌ No package manager found. Please install FFmpeg manually:
echo    Download from: https://ffmpeg.org/download.html
echo    Or install Chocolatey: https://chocolatey.org/install
echo    Or install Scoop: https://scoop.sh/
pause
exit /b 1

:verify
echo.
echo ✅ FFmpeg installation completed!
echo 🎉 FFmpeg is ready for high quality media conversions!
pause 