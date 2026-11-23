@echo off
setlocal
chcp 65001 >nul

if not exist "%~dp0color.ini" (
    echo ==========================================
    echo [ERROR] Missing installation files!
    echo Please DO NOT run install.bat directly inside the ZIP file.
    echo You must EXTRACT the entire ZIP file to a normal folder first.
    echo Right-click the ZIP -^> Extract All -^> run install.bat from there.
    echo ==========================================
    pause
    exit /b 1
)

echo ==========================================
echo SpotifyXwallpaper Installer
echo ==========================================
echo.

if not exist "%APPDATA%\Spotify\Spotify.exe" (
    echo [ERROR] Spotify Desktop version not found!
    echo Spicetify DOES NOT support the Microsoft Store version of Spotify.
    echo Please UNINSTALL Spotify from the Microsoft Store,
    echo and download the normal Windows .exe version from:
    echo https://www.spotify.com/download/windows/
    pause
    exit /b 1
)

:: ==========================================
:: Requirement Checks
:: ==========================================

:: winget is only required when Node.js or FFmpeg must be installed automatically
set "NEED_WINGET=0"
where node >nul 2>nul
if errorlevel 1 set "NEED_WINGET=1"
where ffmpeg >nul 2>nul
if errorlevel 1 set "NEED_WINGET=1"
if "%NEED_WINGET%"=="1" (
    where winget >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] 'winget' is not installed on your system!
        echo We need 'winget' to automatically download Node.js and FFmpeg.
        echo Please install Node.js and FFmpeg manually, then run this installer again.
        echo Node.js: https://nodejs.org/
        echo FFmpeg: https://ffmpeg.org/download.html
        pause
        exit /b 1
    )
)

:: Check and Install Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Node.js is not installed. Automatically installing Node.js via winget...
    winget install OpenJS.NodeJS --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
        echo [WARN] Failed to install Node.js via winget. You may need to install it manually.
    ) else (
        echo [INFO] Node.js installed! ^(You might need to restart your PC later for PATH to update^)
    )
)

:: Check and Install Spicetify (check default folder before downloading again)
if exist "%LOCALAPPDATA%\spicetify\spicetify.exe" (
    set "PATH=%PATH%;%LOCALAPPDATA%\spicetify"
)
where spicetify >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Spicetify is not installed. Automatically installing Spicetify...
    powershell -Command "iwr -useb https://raw.githubusercontent.com/spicetify/cli/main/install.ps1 | iex"
    set "PATH=%PATH%;%LOCALAPPDATA%\spicetify"
)

:: Check and Install FFmpeg
where ffmpeg >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] FFmpeg is not installed. Automatically installing FFmpeg via winget...
    winget install Gyan.FFmpeg --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
        echo [WARN] Failed to install FFmpeg via winget. You may need to install it manually.
    ) else (
        echo [INFO] FFmpeg installed!
    )
)

:: Refresh PATH and expand REG_EXPAND_SZ variables properly
set "SYS_PATH="
set "USR_PATH="
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%B"
call set "PATH=%SYS_PATH%;%USR_PATH%;%PATH%"
if exist "%LOCALAPPDATA%\spicetify\spicetify.exe" set "PATH=%PATH%;%LOCALAPPDATA%\spicetify"

:: ==========================================
:: Step 1: Install Background Server
:: ==========================================
echo [1/4] Installing background server...
:: Kill existing server, loop, and any transcoding ffmpeg locked on our cache folder
taskkill /f /fi "WINDOWTITLE eq WESyncServer_Loop" >nul 2>nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cmd.exe' -and $_.CommandLine -match 'WESyncServer_Loop' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'WESyncServer' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'ffmpeg.exe' -and $_.CommandLine -match 'spotify_we_cache' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>nul

:: Wait a moment for processes to fully terminate and release file locks
timeout /t 2 /nobreak >nul

mkdir "%APPDATA%\WESync" 2>nul
copy /y "%~dp0WESyncServer.js" "%APPDATA%\WESync\" >nul
if errorlevel 1 (
    echo [ERROR] Failed to copy WESyncServer.js! Please close any running instances or check antivirus exclusions.
    pause
    exit /b 1
)

:: Clear old cache to avoid corrupted video issues from previous versions
rmdir /s /q "%TEMP%\spotify_we_cache" 2>nul

:: Resolve absolute paths to avoid PATH environment issues
set "NODE_EXE="
for /f "delims=" %%I in ('where node 2^>nul') do (
    set "NODE_EXE=%%I"
    goto :found_node
)
:found_node
if "%NODE_EXE%"=="" (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    ) else (
        set "NODE_EXE=node"
    )
)

set "FFMPEG_EXE="
for /f "delims=" %%I in ('where ffmpeg 2^>nul') do (
    set "FFMPEG_EXE=%%I"
    goto :found_ffmpeg
)
:found_ffmpeg
if "%FFMPEG_EXE%"=="" (
    if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\ffmpeg.exe" (
        set "FFMPEG_EXE=%LOCALAPPDATA%\Microsoft\WinGet\Links\ffmpeg.exe"
        goto :found_ffmpeg_search
    )
    for /f "delims=" %%F in ('dir /s /b "%LOCALAPPDATA%\Microsoft\WinGet\Packages\ffmpeg.exe" 2^>nul') do (
        set "FFMPEG_EXE=%%F"
        goto :found_ffmpeg_search
    )
)
:found_ffmpeg_search
if "%FFMPEG_EXE%"=="" (
    set "FFMPEG_EXE=ffmpeg"
)

:: Write restart loop line-by-line (safe when paths contain parentheses like Program Files (x86))
set "LOOP_BAT=%APPDATA%\WESync\WESyncServer_Loop.bat"
> "%LOOP_BAT%" echo @echo off
>> "%LOOP_BAT%" echo title WESyncServer_Loop
>> "%LOOP_BAT%" echo chcp 65001 ^>nul
>> "%LOOP_BAT%" echo :loop
>> "%LOOP_BAT%" echo if not exist "%%APPDATA%%\WESync\WESyncServer.js" exit /b
>> "%LOOP_BAT%" echo set "FFMPEG_PATH=%FFMPEG_EXE%"
>> "%LOOP_BAT%" echo "%NODE_EXE%" "%%APPDATA%%\WESync\WESyncServer.js"
>> "%LOOP_BAT%" echo ping -n 11 127.0.0.1 ^>nul
>> "%LOOP_BAT%" echo goto loop

:: Clean up any legacy startup scripts from older versions to prevent port conflicts
del /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StartWESync.bat" 2>nul
del /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StartWESyncServer.bat" 2>nul

:: Generate VBS startup script using pure ASCII (line-by-line to avoid parenthesis issues)
set "VBS_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StartWESyncServer.vbs"
> "%VBS_PATH%" echo Set objShell = CreateObject("WScript.Shell")
>> "%VBS_PATH%" echo strPath = objShell.ExpandEnvironmentStrings("%%APPDATA%%\WESync\WESyncServer_Loop.bat")
>> "%VBS_PATH%" echo objShell.Run """" ^& strPath ^& """", 0, False

:: ==========================================
:: Step 2: Install Spicetify Extension
:: ==========================================
echo [2/4] Installing Spicetify Extension...
if not exist "%APPDATA%\spicetify\Extensions" mkdir "%APPDATA%\spicetify\Extensions"
copy /Y "%~dp0we-sync.js" "%APPDATA%\spicetify\Extensions\wesync.js" >nul
if errorlevel 1 (
    echo [ERROR] Failed to copy we-sync.js! Check if antivirus removed the file.
    pause
    exit /b 1
)

:: ==========================================
:: Step 3: Install Spicetify Theme
:: ==========================================
echo [3/4] Installing Spicetify Theme...
if not exist "%APPDATA%\spicetify\Themes\WESyncTheme" mkdir "%APPDATA%\spicetify\Themes\WESyncTheme"
copy /Y "%~dp0user.css" "%APPDATA%\spicetify\Themes\WESyncTheme\user.css" >nul
if errorlevel 1 (
    echo [ERROR] Failed to copy user.css!
    pause
    exit /b 1
)
copy /Y "%~dp0color.ini" "%APPDATA%\spicetify\Themes\WESyncTheme\color.ini" >nul
if errorlevel 1 (
    echo [ERROR] Failed to copy color.ini!
    pause
    exit /b 1
)

:: ==========================================
:: Verify dependencies actually installed before declaring success
:: ==========================================
set "DEP_MISSING=0"
if not exist "%NODE_EXE%" if "%NODE_EXE%"=="node" (
    where node >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] Node.js still not found after installation attempt.
        set "DEP_MISSING=1"
    )
)
where spicetify >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Spicetify still not found after installation attempt.
    set "DEP_MISSING=1"
)
if not exist "%FFMPEG_EXE%" if "%FFMPEG_EXE%"=="ffmpeg" (
    where ffmpeg >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] FFmpeg still not found after installation attempt.
        set "DEP_MISSING=1"
    )
)
if "%DEP_MISSING%"=="1" (
    echo ==========================================
    echo [FAILED] One or more dependencies could not be installed automatically.
    echo Please install the missing item^(s^) manually, then re-run install.bat.
    echo ==========================================
    pause
    exit /b 1
)

:: ==========================================
:: Step 4: Configuration & Startup
:: ==========================================
echo [4/4] Finalizing setup...

:: 1. Optional: block Spotify auto-updates (an update wipes Spicetify)
echo.
set "LOCK_CHOICE=Y"
set /p LOCK_CHOICE="Block Spotify auto-updates to keep the theme? Run unlock_update.bat to undo. (Y/N, default Y): "
if /i "%LOCK_CHOICE%"=="Y" (
    mkdir "%LOCALAPPDATA%\Spotify\Update" 2>nul
    icacls "%LOCALAPPDATA%\Spotify\Update" /deny "%USERNAME%":W >nul 2>nul
    if errorlevel 1 (
        echo [WARN] Could not lock the Spotify update folder.
    ) else (
        echo [INFO] Spotify auto-update blocked.
    )
)

:: 2. Start background server first and let port 8989 get ready
echo.
echo Starting background server...
wscript "%VBS_PATH%"
timeout /t 1 /nobreak >nul

:: 3. Apply Spicetify settings and start Spotify
echo.
echo Applying Spicetify settings...
spicetify config extensions wesync.js
spicetify config current_theme WESyncTheme
spicetify config color_scheme Base
spicetify config inject_css 1 replace_colors 1 overwrite_assets 1

echo [INFO] Restarting Spotify to apply changes...
taskkill /f /im spotify.exe >nul 2>nul
timeout /t 2 /nobreak >nul
spicetify apply
if errorlevel 1 (
    echo [INFO] Standard apply failed, trying backup apply...
    spicetify backup apply
    if errorlevel 1 (
        echo ==========================================
        echo [ERROR] Spicetify apply failed!
        echo Make sure you have opened and logged into Spotify Desktop at least once,
        echo then close Spotify and re-run install.bat.
        echo ==========================================
        pause
        exit /b 1
    )
)

:: 4. Print SUCCESS
echo.
echo ==========================================
echo [SUCCESS] Installation complete!
echo Open Spotify to see your new background.
echo ==========================================
pause
