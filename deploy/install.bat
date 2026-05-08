@echo off
echo ============================================
echo   Singbada Extension - Install
echo ============================================
echo.

rem ============ CONFIG ============
set "EXT_ID=gcicojedmojipobcplkjipgdmlgpehji"
set "UPDATE_URL=https://raw.githubusercontent.com/ZHR007/singbada-extension/main/deploy/updates.xml"
rem ================================

echo Writing Chrome extension policy (machine level)...
REG ADD "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" /v 1 /t REG_SZ /d "%EXT_ID%;%UPDATE_URL%" /f >nul 2>&1

if %errorlevel%==0 (
    echo.
    echo [OK] Extension policy installed!
    echo.
    echo Next steps:
    echo   1. Close ALL Chrome windows
    echo   2. Reopen Chrome
    echo   3. Chrome will auto-download and install the extension
    echo.
    echo After install, updates are automatic.
) else (
    echo.
    echo [FAIL] Registry write failed.
    echo Please right-click this file and "Run as administrator".
)

echo.
pause