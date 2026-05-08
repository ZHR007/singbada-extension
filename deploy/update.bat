@echo off
echo ============================================
echo   Singbada Extension - Update
echo ============================================
echo.

set "INSTALL_DIR=%USERPROFILE%\singbada-extension"

if not exist "%INSTALL_DIR%\.git" (
    echo [ERROR] Extension not found!
    echo Please run setup.bat first.
    pause
    exit /b 1
)

cd /d "%INSTALL_DIR%"

echo Checking for updates...
git pull

if %errorlevel%==0 (
    echo.
    echo [OK] Update complete!
    echo.
    echo Please go to chrome://extensions/ and click
    echo the reload button on "Singbada Factory Info Helper"
) else (
    echo.
    echo [ERROR] Update failed. Check network connection.
)

echo.
pause