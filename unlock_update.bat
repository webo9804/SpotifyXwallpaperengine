@echo off
chcp 65001 >nul
echo ==========================================
echo Spotify Auto-Update Unlocker
echo ==========================================
echo.
echo Restoring write access to Spotify update folder...

mkdir "%LOCALAPPDATA%\Spotify\Update" 2>nul
icacls "%LOCALAPPDATA%\Spotify\Update" /remove:d "%USERNAME%" >nul 2>nul
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to modify permissions on "%LOCALAPPDATA%\Spotify\Update".
    echo Try right-clicking unlock_update.bat -^> Run as administrator.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Spotify can now auto-update again.
echo Note: Updating Spotify might break your Spicetify theme!
pause
