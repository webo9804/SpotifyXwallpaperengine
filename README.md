# Spotify x Wallpaper Engine Sync Plugin

**English**

Syncs your current **Wallpaper Engine** wallpaper (video or image), or your Windows desktop wallpaper, into the **Spotify desktop client** as a live background, using [Spicetify](https://spicetify.app/).

> [!NOTE]
> This is an unofficial personal project. It is not affiliated with Spotify, Wallpaper Engine, or Spicetify.

> [!WARNING]
> **Read before installing**
> The installer registers a startup entry, runs a background server, can optionally block Spotify auto-updates, and downloads Spicetify from the internet. These behaviors **often trigger antivirus false positives**.
> 1. **SmartScreen**: if you see "Windows protected your PC", click **More info** → **Run anyway**.
> 2. **Windows Defender**: if files are quarantined, add the extracted folder to the exclusion list.
> 3. Read the source first (only 3 `.bat` files and 2 `.js` files) and verify the SHA256 below.

---

## ✨ Features

- **Real-time sync**: detects your active Wallpaper Engine wallpaper and shows it as the Spotify background.
- **Automatic fallback**: if Wallpaper Engine is not running, your Windows desktop wallpaper is used instead.
- **Video and image support**: video wallpapers are transcoded to WebM with FFmpeg and cached; images are served directly.
- **Change confirmation**: when your wallpaper changes, Spotify asks whether to sync the new one. You can keep the current background.
- **Automatic cache cleanup**: only the 10 most recent transcoded videos are kept, and stale temp files are removed.
- **Transparent theme**: keeps Spotify's UI and text readable on top of the background.
- **Automated setup and daemon**: missing Node.js, FFmpeg, and Spicetify are installed for you. The background server restarts after a crash and starts at login.
- **Optional update lock**: during install you can choose to block Spotify auto-updates (an update wipes Spicetify's modifications).

## 💻 Requirements

- Windows 10 / 11
- **Spotify desktop client (official .exe installer)**. The **Microsoft Store version is not supported.**
- `winget`, only if Node.js or FFmpeg must be installed (included with most Windows 10/11 systems)
- Optional: Wallpaper Engine (Steam)

## 🚀 Installation

1. Download the latest ZIP from the [Releases](../../releases) page.
2. **Right-click the ZIP → Extract All.** Do not run the installer from inside the ZIP.
3. Double-click `install.bat` and follow the prompts.
4. The installer asks whether to block Spotify auto-updates (default: yes).
5. Open Spotify when it finishes.

### Verify your download (recommended)

Run this in PowerShell and compare the result with the SHA256 published on the Release page:

```powershell
Get-FileHash .\Spotify_WESync_Plugin_Release_Fixed_v2.zip -Algorithm SHA256
```

## 🗑️ Uninstall / Update

- **Full removal**: run `uninstall.bat`. It stops the background server, deletes the plugin files and cache, resets Spicetify's settings, and removes the update lock. Node.js, FFmpeg, and Spicetify themselves are **not** removed.
- **Only remove the update lock**: run `unlock_update.bat`. Note that a Spotify update may require re-running `install.bat`.
- **Upgrade the plugin**: download the new ZIP and run `install.bat` again. It overwrites the previous install.

## 🔒 Privacy & Security

- The background server listens only on `127.0.0.1:8989` and is **not exposed to the network**.
- Wallpaper scanning, file reading, and transcoding all happen locally. **No wallpaper or personal data is uploaded.**
- The server only accepts requests from Spotify / Spicetify origins and validates the `Host` header.
- The only outbound connections are made during installation to download dependencies (winget and the official Spicetify install script).

## ⚙️ How it works

| Component | Description |
|-----------|-------------|
| `WESyncServer.js` | Local Node.js server. Reads Wallpaper Engine's config to find the current wallpaper, transcodes video to VP8/WebM with FFmpeg when needed, caches the result, and serves it to Spotify. |
| `we-sync.js` | Spicetify extension. Polls the server, renders the background, and shows the change prompt. |
| `user.css` / `color.ini` | The transparent `WESyncTheme` theme. |
| `install.bat` / `uninstall.bat` / `unlock_update.bat` | Install, remove, and unlock Spotify updates. |

Install locations: `%APPDATA%\WESync\` (server and log), `%APPDATA%\spicetify\` (extension and theme), `%TEMP%\spotify_we_cache\` (transcode cache).

## ⚠️ Known limitations

- With multiple monitors, only the **first monitor's** wallpaper is synced.
- Supported formats are video (mp4, webm, avi, mkv, mov) and image (jpg, png, bmp, webp, gif). Wallpaper Engine web and application wallpapers are not supported.
- Video is software-encoded to at most 1080p at 30 fps. The first transcode of a high-resolution wallpaper can take a few tens of seconds.
- After a Spotify update, Spicetify may stop working and you may need to re-run `install.bat`.

## ❓ Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `install.bat` window closes immediately | Run from inside the ZIP | Right-click the ZIP → Extract All, then run it again |
| `install.bat` hangs for over 2 minutes | winget is waiting for terms acceptance or sign-in | Open CMD, run `winget search node`, and press `Y` when prompted |
| Installer says Node.js / FFmpeg not found after installing | PATH has not refreshed yet | Restart your PC and run `install.bat` again |
| "🔌 Server not running" and it keeps blinking | Port 8989 is in use | In CMD run `netstat -ano \| findstr 8989`, close the program using it, or reboot |
| "🔌 Server not running" (not blinking) | Background server is not running | Check `%APPDATA%\WESync\server.log`, then run `%APPDATA%\WESync\WESyncServer_Loop.bat` manually |
| "⚠️ Autoplay blocked" | Spotify's embedded browser blocks autoplay | Click anywhere in the Spotify window |
| Background is black or empty | Wallpaper Engine config not found | Make sure Wallpaper Engine has been run at least once. If it still fails, use a static Windows wallpaper and attach `server.log` to an Issue |
| Video fails to load / stuck transcoding | FFmpeg is not installed correctly | Run `ffmpeg -version` in CMD. Transcode errors are recorded in `server.log` |
| Background does not start after reboot | The startup VBS script was blocked by antivirus | Check that `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StartWESyncServer.vbs` exists |
| Spotify cannot update | Update lock was enabled during install | Run `unlock_update.bat` |

## 🐞 Reporting issues

Please open an [Issue](../../issues) and include your Windows version, Spotify version, the last 50 lines of `%APPDATA%\WESync\server.log`, and the steps to reproduce.

## 🛠️ Tech stack

Node.js (local server), FFmpeg (VP8/WebM transcoding), Spicetify (UI injection).

---

*Created by bobo*
