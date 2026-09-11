@echo off
setlocal
chcp 65001 >nul

echo ==========================================
echo Spotify x Wallpaper Engine Sync Installer
echo ==========================================
echo.

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

echo [1/4] Installing background server...
mkdir "%USERPROFILE%\Documents\WESync" 2>nul
copy /Y "WESyncServer.js" "%USERPROFILE%\Documents\WESync\WESyncServer.js" >nul

:: Dynamically generate the VBS script to use the correct user profile path
set "VBS_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StartWESyncServer.vbs"
echo Set objShell = CreateObject("WScript.Shell") > "%VBS_PATH%"
echo objShell.Run "node ""%USERPROFILE%\Documents\WESync\WESyncServer.js""", 0, False >> "%VBS_PATH%"

echo [2/4] Installing Spicetify Extension...
if not exist "%APPDATA%\spicetify\Extensions" mkdir "%APPDATA%\spicetify\Extensions"
copy /Y "we-sync.js" "%APPDATA%\spicetify\Extensions\we-sync.js" >nul

echo [3/4] Installing Spicetify Theme...
if not exist "%APPDATA%\spicetify\Themes\TransparentTheme" mkdir "%APPDATA%\spicetify\Themes\TransparentTheme"
copy /Y "user.css" "%APPDATA%\spicetify\Themes\TransparentTheme\user.css" >nul
copy /Y "color.ini" "%APPDATA%\spicetify\Themes\TransparentTheme\color.ini" >nul

echo [4/4] Applying Spicetify settings...
:: Enable extension
spicetify config extensions we-sync.js
:: Apply transparent theme (required for video background)
spicetify config current_theme TransparentTheme
spicetify config inject_css 1 replace_colors 1 overwrite_assets 1
spicetify apply

echo.
echo Starting background server for the first time...
start "" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StartWESyncServer.vbs"

echo.
echo ==========================================
echo [SUCCESS] Installation complete! 
echo Open Spotify to see your new background.
echo ==========================================
pause
