@echo off
setlocal
chcp 65001 >nul

echo ==========================================
echo Spotify x Wallpaper Engine Sync Uninstaller
echo ==========================================
echo.

:: Confirmation prompt to prevent accidental uninstall
echo WARNING: This will remove the Spotify background plugin.
echo Node.js, Spicetify, and FFmpeg will NOT be removed.
echo.
set /p CONFIRM="Are you sure? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Uninstall cancelled.
    pause
    exit /b
)

echo.
echo [1/4] Stopping background server...
taskkill /f /fi "WINDOWTITLE eq WESyncServer_Loop" >nul 2>nul
wmic process where "name='node.exe' and commandline like '%%WESyncServer%%'" call terminate >nul 2>nul
wmic process where "name='cmd.exe' and commandline like '%%WESyncServer_Loop%%'" call terminate >nul 2>nul
:: Wait for processes to fully terminate
timeout /t 2 /nobreak >nul

echo [2/4] Removing background server files and cache...
rmdir /s /q "%USERPROFILE%\Documents\WESync" 2>nul
del /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StartWESyncServer.vbs" 2>nul
rmdir /s /q "%TEMP%\spotify_we_cache" 2>nul

echo [3/4] Removing Spicetify Extension and Theme files...
del /q "%APPDATA%\spicetify\Extensions\we-sync.js" 2>nul
rmdir /s /q "%APPDATA%\spicetify\Themes\TransparentTheme" 2>nul

echo [4/4] Removing Spicetify settings and applying changes...
:: Temporarily add spicetify to path just in case
set "PATH=%PATH%;%LOCALAPPDATA%\spicetify"

where spicetify >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    :: Remove extension from config
    spicetify config extensions we-sync.js-
    :: Clear theme (Spicetify will use default)
    spicetify config current_theme ""
    spicetify config inject_css 0 replace_colors 0 overwrite_assets 0
    spicetify apply
) else (
    echo [INFO] Spicetify not found in PATH, skipping Spicetify config reset.
)

echo.
echo ==========================================
echo [SUCCESS] Uninstallation complete! 
echo The background plugin has been removed.
echo Node.js, Spicetify, and FFmpeg were NOT deleted.
echo ==========================================
pause
