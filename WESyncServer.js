const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync, exec } = require("child_process");
const crypto = require("crypto");
const PORT = 8989;

// Track if Wallpaper Engine is currently running
let isWeRunningCache = false;
function checkWeRunning() {
    exec('tasklist | findstr /i "wallpaper32.exe wallpaper64.exe ui32.exe"', (err, stdout) => {
        isWeRunningCache = !!stdout && stdout.trim().length > 0;
    });
}
// Check every 10 seconds
setInterval(checkWeRunning, 10000);
checkWeRunning();

// Track ongoing transcoding jobs to prevent duplicate work
const transcodingJobs = new Map();

let cachedWeConfigPath = null;
let cachedWindowsWallpaper = null;

function updateWindowsWallpaper() {
    exec('reg query "HKCU\\Control Panel\\Desktop" /v Wallpaper', (err, stdout) => {
        if (!err && stdout) {
            const match = stdout.match(/Wallpaper\s+REG_SZ\s+(.+)/i);
            if (match && match[1]) {
                const wpPath = match[1].trim();
                if (fs.existsSync(wpPath)) {
                    cachedWindowsWallpaper = wpPath;
                }
            }
        }
    });
}
setInterval(updateWindowsWallpaper, 10000);
updateWindowsWallpaper();

function getWEConfigPath() {
    if (cachedWeConfigPath) return cachedWeConfigPath;
    let base = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\wallpaper_engine";
    try {
        const out = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 431960" /v InstallLocation', { encoding: 'utf-8' });
        const match = out.match(/InstallLocation\s+REG_SZ\s+(.+)/i);
        if (match && match[1]) {
            base = match[1].trim();
        }
    } catch (e) {
        // Fallback to default
    }
    cachedWeConfigPath = path.join(base, "config.json");
    return cachedWeConfigPath;
}

function getCurrentWallpaper() {
    try {
        const raw = fs.readFileSync(getWEConfigPath(), "utf-8");
        const config = JSON.parse(raw);
        
        // Dynamically find the user profile (e.g., config.webbe, config.admin, etc.)
        for (const key in config) {
            if (config[key] && config[key].general && config[key].general.wallpaperconfig) {
                const wallpapers = config[key].general.wallpaperconfig.selectedwallpapers;
                // Guard against null/undefined wallpapers
                if (!wallpapers || typeof wallpapers !== 'object') continue;
                // Get the first monitor's wallpaper, or fallback to Monitor0
                const monitorKey = Object.keys(wallpapers)[0] || 'Monitor0';
                if (wallpapers[monitorKey] && wallpapers[monitorKey].file) {
                    return wallpapers[monitorKey].file.replace(/\//g, "\\");
                }
            }
        }
        return "";
    } catch (e) {
        return "";
    }
}

function ensureCacheDir() {
    const tempDir = path.join(require('os').tmpdir(), 'spotify_we_cache');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    } else {
        // Auto-cleanup: keep only the 10 most recent cached videos to prevent storage bloat
        try {
            const files = fs.readdirSync(tempDir)
                .filter(f => f.endsWith('.webm'))
                .map(f => ({ name: f, time: fs.statSync(path.join(tempDir, f)).mtime.getTime() }))
                .sort((a, b) => b.time - a.time);
                
            if (files.length > 10) {
                for (let i = 10; i < files.length; i++) {
                    fs.unlinkSync(path.join(tempDir, files[i].name));
                }
            }
        } catch (e) {
            console.error("Cache cleanup error:", e);
        }
    }
    return tempDir;
}

function transcodeVideo(wp, cacheDir) {
    const hash = crypto.createHash('md5').update(wp).digest('hex');
    const cachedWebm = path.join(cacheDir, `${hash}.webm`);
    const tmpWebm = path.join(cacheDir, `${hash}.webm.tmp`);

    // If already cached and valid, return immediately
    if (fs.existsSync(cachedWebm)) {
        const stat = fs.statSync(cachedWebm);
        if (stat.size > 0) {
            return Promise.resolve(cachedWebm);
        }
        // Remove corrupt cache
        fs.unlinkSync(cachedWebm);
    }

    // If already transcoding this file, return the existing promise (prevent duplicates)
    if (transcodingJobs.has(hash)) {
        return transcodingJobs.get(hash);
    }

    const job = new Promise((resolve, reject) => {
        console.log(`Transcoding ${wp} to WebM...`);
        const ffmpegExe = process.env.FFMPEG_PATH || "ffmpeg";
        
        const args = [
            "-y", "-i", wp,
            "-t", "60",
            "-vf", "scale=-1:'min(1080,ih)'",
            "-r", "30",
            "-c:v", "libvpx", "-b:v", "8M", "-crf", "12", "-cpu-used", "5", "-threads", "8",
            "-c:a", "libvorbis",
            "-f", "webm",
            tmpWebm
        ];

        const { spawn } = require("child_process");
        const ffmpeg = spawn(ffmpegExe, args, { windowsHide: true });

        ffmpeg.on('close', (code) => {
            transcodingJobs.delete(hash);
            if (code !== 0) {
                if (fs.existsSync(tmpWebm)) {
                    try { fs.unlinkSync(tmpWebm); } catch(e) {}
                }
                reject(new Error(`FFmpeg exited with code ${code}`));
            } else {
                try {
                    if (fs.existsSync(tmpWebm)) {
                        fs.renameSync(tmpWebm, cachedWebm);
                    }
                    resolve(cachedWebm);
                } catch(e) {
                    reject(e);
                }
            }
        });

        ffmpeg.on('error', (err) => {
            transcodingJobs.delete(hash);
            if (fs.existsSync(tmpWebm)) {
                try { fs.unlinkSync(tmpWebm); } catch(e) {}
            }
            reject(err);
        });
    });

    transcodingJobs.set(hash, job);
    return job;
}

const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Access-Control-Allow-Headers", "Range, Accept");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length, Content-Type");

    if (req.url.startsWith("/path")) {
        let wp = "";
        if (isWeRunningCache) {
            wp = getCurrentWallpaper();
        }
        if (!wp || !fs.existsSync(wp)) {
            if (cachedWindowsWallpaper && fs.existsSync(cachedWindowsWallpaper)) {
                wp = cachedWindowsWallpaper;
            }
        }
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(wp);
        return;
    }

    if (req.url.startsWith("/media") || req.url.startsWith("/video")) {
        let wp = "";
        
        // 1. Try Wallpaper Engine first
        if (isWeRunningCache) {
            wp = getCurrentWallpaper();
        }
        
        // 2. Fallback to Windows Desktop Wallpaper
        if (!wp || !fs.existsSync(wp)) {
            if (cachedWindowsWallpaper && fs.existsSync(cachedWindowsWallpaper)) {
                wp = cachedWindowsWallpaper;
            }
        }

        if (!wp) {
            res.writeHead(404);
            res.end("No wallpaper found");
            return;
        }

        const ext = path.extname(wp).toLowerCase();
        
        // If it's an image, serve it directly
        if (ext.match(/\.(jpg|jpeg|png|bmp|webp|gif)$/)) {
            try {
                const stat = fs.statSync(wp);
                res.writeHead(200, {
                    "Content-Type": "image/" + (ext === '.jpg' ? 'jpeg' : ext.substring(1)),
                    "Content-Length": stat.size
                });
                fs.createReadStream(wp).pipe(res);
            } catch (e) {
                if (!res.headersSent) {
                    res.writeHead(500);
                    res.end("Failed to serve image");
                }
            }
            return;
        }

        // If it's unsupported
        if (ext === '.pkg' || ext === '.html' || ext === '.exe') {
            res.writeHead(400);
            res.end("Unsupported format");
            return;
        }

        // Otherwise, assume video and transcode
        try {
            const cacheDir = ensureCacheDir();
            const cachedWebm = await transcodeVideo(wp, cacheDir);

            const stat = fs.statSync(cachedWebm);

            if (stat.size === 0) {
                fs.unlinkSync(cachedWebm);
                res.writeHead(500);
                res.end("Corrupt cache file deleted");
                return;
            }
            
            res.setHeader("Content-Type", "video/webm");
            res.setHeader("Accept-Ranges", "bytes");

            const range = req.headers.range;

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
                const chunkSize = end - start + 1;

                res.writeHead(206, {
                    "Content-Range": `bytes ${start}-${end}/${stat.size}`,
                    "Content-Length": chunkSize
                });
                fs.createReadStream(cachedWebm, { start, end }).pipe(res);
            } else {
                res.writeHead(200, { "Content-Length": stat.size });
                fs.createReadStream(cachedWebm).pipe(res);
            }
        } catch(e) {
            console.error("Video serving error:", e);
            if (!res.headersSent) {
                res.writeHead(500);
                res.end("FFmpeg transcoding failed");
            }
        }
        return;
    }

    res.writeHead(404);
    res.end();
});

// Handle port already in use — wait and retry instead of crashing
let retryCount = 0;
const MAX_RETRIES = 5;

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        retryCount++;
        if (retryCount > MAX_RETRIES) {
            console.error(`Port ${PORT} still in use after ${MAX_RETRIES} retries. Exiting (loop will restart).`);
            process.exit(1);
        }
        console.error(`Port ${PORT} is already in use. Retry ${retryCount}/${MAX_RETRIES} in 15 seconds...`);
        setTimeout(() => {
            try { server.close(); } catch(e) {}
            server.listen(PORT, "127.0.0.1");
        }, 15000);
    } else {
        console.error('Server error:', err);
    }
});

server.listen(PORT, "127.0.0.1", () => {
    retryCount = 0;
    console.log("WESync Server running on http://127.0.0.1:" + PORT);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});
