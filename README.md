# Spotify x Wallpaper Engine Sync Plugin

This plugin dynamically syncs your Spotify background with your active Wallpaper Engine video!

## Requirements
1. **Spicetify**: Must be installed.
2. **Node.js**: Must be installed on your system.
3. **FFmpeg**: Must be installed and added to your system PATH (used to compress 4K videos to 1080p dynamically).
4. **Wallpaper Engine**: Must be installed in the default Steam directory.

## Installation
1. Extract this folder.
2. Double click `install.bat`.
3. The script will automatically copy the server files, inject the Spicetify theme, and apply the extension.

## Note
- Only **Video (MP4/WebM)** wallpapers are supported. "Scene" (.pkg) and "Web" wallpapers cannot be synced.
- The first time you switch to a new wallpaper, it may take ~10 seconds to generate the optimized video cache. Future switches to the same wallpaper will be instant.
