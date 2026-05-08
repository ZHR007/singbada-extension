@echo off
echo ============================================
echo   Singbada Extension - First Time Setup
echo ============================================
echo.

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed!
    echo Please download Git from: https://git-scm.com/download/win
    echo Install it, then run this script again.
    echo.
    pause
    exit /b 1
)

set "INSTALL_DIR=%USERPROFILE%\singbada-extension"

if exist "%INSTALL_DIR%\.git" (
    echo Extension already installed at: %INSTALL_DIR%
    echo.
    echo Pulling latest version...
    cd /d "%INSTALL_DIR%"
    git pull
    echo.
    echo [OK] Updated! Please reload the extension in Chrome.
    echo.
    pause
    exit /b 0
)

echo Downloading extension...
echo.
git clone https://github.com/ZHR007/singbada-extension.git "%INSTALL_DIR%"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Download failed. Check your network connection.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   [OK] Download complete!
echo ============================================
echo.
echo   Extension folder: %INSTALL_DIR%
echo.
echo   Now open Chrome and follow these steps:
echo.
echo   1. Go to: chrome://extensions/
echo   2. Turn on "Developer mode" (top right)
echo   3. Click "Load unpacked"
echo   4. Select folder: %INSTALL_DIR%
echo   5. Done!
echo.
echo   To update later, just run "update.bat"
echo ============================================
echo.
pause