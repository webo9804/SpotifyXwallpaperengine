@echo off
echo ==========================================
echo Spotify x Wallpaper Engine Sync Installer
echo ==========================================
echo.
echo This will install the WESync plugin to your Spicetify setup.
echo Make sure you have Spicetify installed and Node.js installed!
echo.
pause

echo 1. Installing background server...
mkdir "%USERPROFILE%\Documents\WESync" 2>nul
copy /Y WESyncServer.js "%USERPROFILE%\Documents\WESync\WESyncServer.js" >nul
copy /Y StartWESyncServer.vbs "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StartWESyncServer.vbs" >nul

echo 2. Installing Spicetify Extension...
copy /Y we-sync.js "%APPDATA%\spicetify\Extensions\we-sync.js" >nul

echo 3. Installing Spicetify Theme...
mkdir "%APPDATA%\spicetify\Themes\TransparentTheme" 2>nul
copy /Y user.css "%APPDATA%\spicetify\Themes\TransparentTheme\user.css" >nul
copy /Y color.ini "%APPDATA%\spicetify\Themes\TransparentTheme\color.ini" >nul

echo 4. Applying Spicetify settings...
spicetify config extensions we-sync.js
spicetify config current_theme TransparentTheme
spicetify apply

echo.
echo Starting background server for the first time...
start "" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StartWESyncServer.vbs"

echo.
echo Installation complete! Open Spotify to see your new background.
pause
