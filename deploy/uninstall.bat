@echo off
echo ============================================
echo   Singbada Extension - Uninstall
echo ============================================
echo.

echo Removing Chrome extension policy...
REG DELETE "HKCU\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" /v 1 /f >nul 2>&1

if %errorlevel%==0 (
    echo [OK] Extension policy removed. Please restart Chrome.
) else (
    echo [INFO] No policy found, may already be uninstalled.
)

echo.
pause