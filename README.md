# Spotify x Wallpaper Engine Sync 🎵✨

A fully automated, ultra-smooth plugin that syncs your dynamic Wallpaper Engine backgrounds directly into your Spotify client using Spicetify.

## ✨ Features

- **Intelligent Real-Time Sync**: Automatically detects your currently active Wallpaper Engine wallpaper and seamlessly syncs it to Spotify.
- **Smart Fallback Mechanism**: If Wallpaper Engine is not running or not installed, the plugin intelligently detects and applies your default Windows desktop wallpaper instead.
- **Universal Media Support**: Flawlessly supports both dynamic video backgrounds and static image wallpapers without any manual configuration.
- **Hardware-Accelerated Transcoding**: Utilizes FFmpeg to transcode high-resolution 4K video wallpapers into a lightweight, optimized format on the fly, ensuring minimal CPU/GPU overhead.
- **Elegant Translucency**: Features carefully crafted CSS that preserves Spicetify's native UI elements and text readability while blending the background perfectly.
- **Bulletproof Auto-Installer & Daemon**:
  - Automatically resolves and installs missing dependencies (Node.js, FFmpeg, Spicetify).
  - Deploys an invisible daemon process that ensures the background server stays alive and automatically recovers from unexpected crashes.
  - Dynamically scans the Windows Registry to support custom Steam installation paths.

## 🚀 Installation

1. Download the latest `Spotify_WESync_Plugin.zip` from the Releases tab.
2. Extract the ZIP file to a convenient location on your PC.
3. Double-click **`install.bat`** to begin the automated setup.
4. That's it! The installer will automatically download any missing dependencies, configure Spicetify, and initialize the background server.

## 🗑️ Uninstallation

If you wish to remove the background sync functionality:
1. Navigate to the extracted folder.
2. Double-click **`uninstall.bat`**.
3. The script will safely terminate the background daemon, remove the injected scripts, and restore your Spotify client to its default Spicetify theme without affecting your Node.js or FFmpeg installations.

## ⚙️ Requirements

- Windows 10 / 11
- Spotify (Desktop Client)
- *Optional:* Wallpaper Engine (Steam)

## 🛠️ Tech Stack

- **Node.js**: Background server, caching, and state management.
- **FFmpeg**: On-the-fly video downscaling and VP8/WebM transcoding.
- **Spicetify**: UI injection and DOM manipulation.

---
*Created by bobo*
