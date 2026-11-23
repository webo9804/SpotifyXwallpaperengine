@echo off
setlocal
chcp 65001 >nul

echo ==========================================
echo SpotifyXwallpaper Uninstaller
echo ==========================================
echo.

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
echo [1/4] Stopping background server and Spotify...
taskkill /f /fi "WINDOWTITLE eq WESyncServer_Loop" >nul 2>nul
taskkill /f /im spotify.exe >nul 2>nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cmd.exe' -and $_.CommandLine -match 'WESyncServer_Loop' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'WESyncServer' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'ffmpeg.exe' -and $_.CommandLine -match 'spotify_we_cache' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>nul
timeout /t 2 /nobreak >nul

echo [2/4] Removing background server files and cache...
rmdir /s /q "%APPDATA%\WESync" 2>nul
del /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StartWESyncServer.vbs" 2>nul
del /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StartWESync.bat" 2>nul
del /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StartWESyncServer.bat" 2>nul
rmdir /s /q "%TEMP%\spotify_we_cache" 2>nul

echo [3/4] Removing Spicetify Extension and Theme files...
del /q "%APPDATA%\spicetify\Extensions\wesync.js" 2>nul
del /q "%APPDATA%\spicetify\Extensions\we-sync.js" 2>nul
rmdir /s /q "%APPDATA%\spicetify\Themes\WESyncTheme" 2>nul
rmdir /s /q "%APPDATA%\spicetify\Themes\TransparentTheme" 2>nul

icacls "%LOCALAPPDATA%\Spotify\Update" /remove:d "%USERNAME%" >nul 2>nul

echo [4/4] Removing Spicetify settings and applying changes...
set "PATH=%PATH%;%LOCALAPPDATA%\spicetify"

where spicetify >nul 2>nul
if errorlevel 1 goto :skip_spicetify

spicetify config extensions wesync.js-
spicetify config extensions we-sync.js-
set "CUR_THEME="
for /f "delims=" %%T in ('spicetify config current_theme 2^>nul') do set "CUR_THEME=%%T"
if /i "%CUR_THEME%"=="WESyncTheme" goto :reset_theme
if /i "%CUR_THEME%"=="TransparentTheme" goto :reset_theme
echo [INFO] Keeping your other Spicetify theme ^(%CUR_THEME%^).
goto :apply_spicetify

:reset_theme
spicetify config current_theme ""
spicetify config color_scheme ""
spicetify config inject_css 0 replace_colors 0 overwrite_assets 0

:apply_spicetify
spicetify apply
goto :done_spicetify

:skip_spicetify
echo [INFO] Spicetify not found in PATH, skipping Spicetify config reset.

:done_spicetify

echo.
echo ==========================================
echo [SUCCESS] Uninstallation complete!
echo The background plugin has been removed.
echo Spotify's auto-update has been restored.
echo Node.js, Spicetify, and FFmpeg were NOT deleted.
echo ==========================================
pause
