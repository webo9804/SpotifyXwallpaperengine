@echo off
setlocal
chcp 65001 >nul

echo ==========================================
echo Spotify x Wallpaper Engine Sync Installer
echo ==========================================
echo.

:: ==========================================
:: Requirement Checks
:: ==========================================

:: Check for winget (required for automated installation on older Windows systems)
where winget >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] 'winget' is not installed on your system!
    echo We need 'winget' to automatically download Node.js and FFmpeg.
    echo Please install Node.js and FFmpeg manually, then run this installer again.
    echo Node.js: https://nodejs.org/
    echo FFmpeg: https://ffmpeg.org/download.html
    pause
    exit /b
)

:: Check and Install Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Node.js is not installed. Automatically installing Node.js via winget...
    winget install OpenJS.NodeJS --accept-package-agreements --accept-source-agreements
    echo [INFO] Node.js installed! (You might need to restart your PC later for PATH to update)
)

:: Check and Install Spicetify
where spicetify >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Spicetify is not installed. Automatically installing Spicetify...
    powershell -Command "iwr -useb https://raw.githubusercontent.com/spicetify/cli/main/install.ps1 | iex"
    :: Temporarily add spicetify to path for this script
    set "PATH=%PATH%;%LOCALAPPDATA%\spicetify"
)

:: Check and Install FFmpeg
where ffmpeg >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] FFmpeg is not installed. Automatically installing FFmpeg via winget...
    winget install Gyan.FFmpeg --accept-package-agreements --accept-source-agreements
    echo [INFO] FFmpeg installed!
)

:: Refresh PATH so newly installed winget packages are available immediately
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%B"
set "PATH=%SYS_PATH%;%USR_PATH%;%PATH%"

:: ==========================================
:: Step 1: Install Background Server
:: ==========================================
echo [1/4] Installing background server...

:: Kill existing server and loop processes if running
taskkill /f /fi "WINDOWTITLE eq WESyncServer_Loop" >nul 2>nul
wmic process where "name='node.exe' and commandline like '%%WESyncServer%%'" call terminate >nul 2>nul
wmic process where "name='cmd.exe' and commandline like '%%WESyncServer_Loop%%'" call terminate >nul 2>nul

:: Wait a moment for processes to fully terminate and release port
timeout /t 2 /nobreak >nul

:: Clear old cache to avoid corrupted video issues from previous versions
rmdir /s /q "%TEMP%\spotify_we_cache" 2>nul

:: Copy server file
mkdir "%USERPROFILE%\Documents\WESync" 2>nul
copy /Y "WESyncServer.js" "%USERPROFILE%\Documents\WESync\WESyncServer.js" >nul

:: Create a robust restart loop script that auto-recovers from crashes
:: The loop checks if the .js file still exists (deleted = uninstalled, stop looping)
set "LOOP_BAT=%USERPROFILE%\Documents\WESync\WESyncServer_Loop.bat"
(
    echo @echo off
    echo :loop
    echo if not exist "%%USERPROFILE%%\Documents\WESync\WESyncServer.js" exit /b
    echo node "%%USERPROFILE%%\Documents\WESync\WESyncServer.js"
    echo timeout /t 10 /nobreak ^>nul
    echo goto loop
) > "%LOOP_BAT%"

:: Generate VBS startup script using the ACTUAL resolved path (not env vars)
:: This avoids VBS failing to expand %%USERPROFILE%% at runtime
set "VBS_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StartWESyncServer.vbs"
echo Set objShell = CreateObject("WScript.Shell") > "%VBS_PATH%"
echo objShell.Run "cmd /c ""%USERPROFILE%\Documents\WESync\WESyncServer_Loop.bat""", 0, False >> "%VBS_PATH%"

:: ==========================================
:: Step 2: Install Spicetify Extension
:: ==========================================
echo [2/4] Installing Spicetify Extension...
if not exist "%APPDATA%\spicetify\Extensions" mkdir "%APPDATA%\spicetify\Extensions"
copy /Y "we-sync.js" "%APPDATA%\spicetify\Extensions\we-sync.js" >nul

:: ==========================================
:: Step 3: Install Spicetify Theme
:: ==========================================
echo [3/4] Installing Spicetify Theme...
if not exist "%APPDATA%\spicetify\Themes\TransparentTheme" mkdir "%APPDATA%\spicetify\Themes\TransparentTheme"
copy /Y "user.css" "%APPDATA%\spicetify\Themes\TransparentTheme\user.css" >nul
copy /Y "color.ini" "%APPDATA%\spicetify\Themes\TransparentTheme\color.ini" >nul

:: ==========================================
:: Step 4: Apply Spicetify Settings
:: ==========================================
echo [4/4] Applying Spicetify settings...
:: Enable extension
spicetify config extensions we-sync.js
:: Apply transparent theme (required for video background)
spicetify config current_theme TransparentTheme
spicetify config inject_css 1 replace_colors 1 overwrite_assets 1

echo [INFO] Restarting Spotify to apply changes...
taskkill /f /im spotify.exe >nul 2>nul
timeout /t 2 /nobreak >nul
spicetify apply

:: ==========================================
:: Start server for the first time
:: ==========================================
echo.
echo Starting background server for the first time...
start "" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StartWESyncServer.vbs"

echo.
echo ==========================================
echo [SUCCESS] Installation complete! 
echo Open Spotify to see your new background.
echo ==========================================
pause
