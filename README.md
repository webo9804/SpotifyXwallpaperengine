# Spotify x Wallpaper Engine Sync 🎵✨

A fully automated, ultra-smooth plugin that syncs your dynamic Wallpaper Engine backgrounds directly into your Spicetify client!

## ✨ Features
- **Zero-Config Real-Time Sync**: Automatically detects your currently active Wallpaper Engine wallpaper and syncs it to Spotify.
- **Hardware Accelerated**: Uses FFmpeg to transcode 4K videos to a lightweight 1080p format on the fly to save CPU/GPU resources.
- **Elegant Translucency**: Carefully crafted CSS preserves Spicetify's native UI, syntax highlighting, and text readability while blending the background perfectly.
- **Bulletproof Auto-Installer**: 
  - Automatically installs Node.js and FFmpeg if missing.
  - Automatically sets up Spicetify if missing.
  - Dynamically scans Windows Registry for custom Steam installation paths.
  - Runs silently in the background on startup.

## 🚀 Installation

1. Download the latest `Spotify_WESync_Plugin.zip` from the Releases tab.
2. Extract the ZIP file to your Desktop.
3. Double-click **`install.bat`**.
4. That's it! The installer will automatically download any missing dependencies, configure Spicetify, and start the sync server.

## ⚙️ Requirements
- Windows 10/11
- Wallpaper Engine (Steam)
- Spotify (Desktop)

## 🛠️ Tech Stack
- **Node.js**: Background server and caching
- **FFmpeg**: On-the-fly video downscaling and VP8/WebM transcoding
- **Spicetify**: UI injection and DOM manipulation

*Made with ❤️ and AI.*
