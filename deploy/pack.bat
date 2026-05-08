@echo off
echo ============================================
echo   Singbada Extension - Pack Tool
echo ============================================
echo.

set "CHROME_PATH="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)
if "%CHROME_PATH%"=="" (
    echo [ERROR] Chrome not found.
    pause
    exit /b 1
)
echo Found Chrome: %CHROME_PATH%
echo.

rem Resolve absolute path (remove trailing ..)
for %%I in ("%~dp0..") do set "EXT_DIR=%%~fI"
set "PEM_FILE=%EXT_DIR%.pem"
set "CRX_FILE=%EXT_DIR%.crx"
set "DEPLOY_DIR=%EXT_DIR%\deploy"

echo Extension dir: %EXT_DIR%
echo.

if exist "%PEM_FILE%" (
    echo Using existing key to pack...
    "%CHROME_PATH%" --pack-extension="%EXT_DIR%" --pack-extension-key="%PEM_FILE%"
) else (
    echo First time packing, generating new key...
    "%CHROME_PATH%" --pack-extension="%EXT_DIR%"
)

echo.

if exist "%CRX_FILE%" (
    echo [OK] Pack successful!
    echo.
    echo Copying .crx to deploy folder...
    copy /Y "%CRX_FILE%" "%DEPLOY_DIR%\singbada-extension.crx" >nul
    echo [OK] Copied to: %DEPLOY_DIR%\singbada-extension.crx
) else (
    echo [ERROR] .crx file not found at: %CRX_FILE%
    echo Please check Chrome output above.
    pause
    exit /b 1
)

if not exist "%PEM_FILE%" (
    echo.
    echo ============================================
    echo   IMPORTANT - First Pack
    echo ============================================
    echo   1. Drag .crx into chrome://extensions/ to get Extension ID
    echo   2. Replace ID placeholder in:
    echo      - deploy\updates.xml
    echo      - deploy\install.bat
    echo   3. KEEP the .pem file safe! Never delete it!
    echo ============================================
)

echo.
echo ----------------------------------------
echo   Next: update version in updates.xml
echo   then: git add + commit + push
echo ----------------------------------------
echo.
pause