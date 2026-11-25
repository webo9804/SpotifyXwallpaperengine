const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec, spawn } = require("child_process");
const crypto = require("crypto");
const util = require("util");
const PORT = 8989;

// Ensure log directory exists before writing
const logDir = path.join(process.env.APPDATA || ".", "WESync");
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logPath = path.join(logDir, "server.log");

// Log rotation: if log exceeds 2MB, archive it
try {
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > 2 * 1024 * 1024) {
        const archivePath = logPath + ".old";
        if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
        fs.renameSync(logPath, archivePath);
    }
} catch (e) {}

const logStream = fs.createWriteStream(logPath, { flags: 'a' });
logStream.on('error', () => {}); // never let a log failure crash the server
function log(...args) {
    const msg = args.map(a => {
        if (a instanceof Error) return a.stack || a.message;
        return typeof a === 'string' ? a : util.inspect(a);
    }).join(' ');
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    logStream.write(line);
    try { process.stdout.write(line); } catch (e) {}
}
console.log = log;
console.error = log;
log("Starting WESyncServer...");

// Track ongoing transcoding jobs to prevent duplicate work
const transcodingJobs = new Map();

// 1. Check if Wallpaper Engine is actively running (with in-flight deduplication & maxBuffer)
let isWeRunningCache = false;
let lastWeCheckTime = 0;
const WE_CHECK_CACHE_MS = 2500;
let weCheckInFlight = null;

function checkWeRunning() {
    const now = Date.now();
    if (now - lastWeCheckTime < WE_CHECK_CACHE_MS) {
        return Promise.resolve(isWeRunningCache);
    }
    if (weCheckInFlight) {
        return weCheckInFlight;
    }
    weCheckInFlight = new Promise((resolve) => {
        exec("tasklist /FO CSV /NH", { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
            lastWeCheckTime = Date.now();
            if (!err && stdout) {
                isWeRunningCache = /wallpaper(32|64)\.exe/i.test(stdout);
            } else {
                isWeRunningCache = false;
            }
            weCheckInFlight = null;
            resolve(isWeRunningCache);
        });
    });
    return weCheckInFlight;
}

// 2. Windows Wallpaper retrieval with cmd chcp 65001 reg query (no PowerShell spawn) & in-flight deduplication
let cachedWindowsWallpaper = null;
let lastWinWpCheckTime = 0;
const WIN_WP_CACHE_MS = 6000;
let winWpInFlight = null;

function getWindowsWallpaper() {
    const now = Date.now();
    if (cachedWindowsWallpaper && (now - lastWinWpCheckTime < WIN_WP_CACHE_MS)) {
        if (fs.existsSync(cachedWindowsWallpaper)) {
            return Promise.resolve(cachedWindowsWallpaper);
        }
    }
    if (winWpInFlight) {
        return winWpInFlight;
    }

    winWpInFlight = new Promise((resolve) => {
        const cmd = 'chcp 65001 >nul && reg query "HKCU\\Control Panel\\Desktop" /v WallPaper';
        exec(cmd, { windowsHide: true, encoding: "utf-8" }, (err, stdout) => {
            lastWinWpCheckTime = Date.now();
            let wpPath = "";
            if (!err && stdout) {
                const match = stdout.match(/WallPaper\s+REG_SZ\s+(.+)/i);
                if (match && match[1]) {
                    wpPath = match[1].trim();
                }
            }

            if (wpPath && fs.existsSync(wpPath)) {
                cachedWindowsWallpaper = wpPath;
                winWpInFlight = null;
                return resolve(wpPath);
            }

            // Fallback to TranscodedWallpaper
            const transcodedPath = path.join(
                process.env.APPDATA || "",
                "Microsoft", "Windows", "Themes", "TranscodedWallpaper"
            );
            if (fs.existsSync(transcodedPath)) {
                cachedWindowsWallpaper = transcodedPath;
                winWpInFlight = null;
                return resolve(transcodedPath);
            }

            cachedWindowsWallpaper = null;
            winWpInFlight = null;
            resolve("");
        });
    });
    return winWpInFlight;
}

let cachedWeConfigPath = null;
let cachedWeConfigTime = 0;

function _resolveWEConfigPath() {
    // 1. Try Wallpaper Engine registry (chcp 65001 to prevent Chinese garbled path)
    try {
        const stdout = require('child_process').execSync('chcp 65001 >nul && reg query "HKCU\\Software\\WallpaperEngine" /v installPath', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
        const match = stdout.match(/installPath\s+REG_SZ\s+(.+)/i);
        if (match && match[1]) {
            const rawInstall = match[1].trim();
            const candidates = [rawInstall, path.dirname(rawInstall)];
            for (const dir of candidates) {
                const testPath = path.join(dir, "config.json");
                if (fs.existsSync(testPath)) {
                    log("Found WE path from WE registry: " + testPath);
                    return testPath;
                }
            }
        }
    } catch (e) {}

    // 2. Try Steam Registry to find all library folders (chcp 65001)
    try {
        const stdout = require('child_process').execSync('chcp 65001 >nul && reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
        const match = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/i);
        if (match && match[1]) {
            let steamPath = match[1].trim();
            const vdfPath = path.join(steamPath, "steamapps", "libraryfolders.vdf");
            if (fs.existsSync(vdfPath)) {
                const vdfContent = fs.readFileSync(vdfPath, 'utf-8');
                const folders = vdfContent.split(/"path"\s+"([^"]+)"/);
                for (let i = 1; i < folders.length; i += 2) {
                    const libPath = folders[i].replace(/\\\\/g, "\\");
                    const remainder = folders[i+1] || "";
                    if (remainder.includes('"431960"')) {
                        const testPath = path.join(libPath, "steamapps", "common", "wallpaper_engine", "config.json");
                        if (fs.existsSync(testPath)) {
                            log("Found WE path from Steam VDF: " + testPath);
                            return testPath;
                        }
                    }
                }
            }
            
            // Fallback to main Steam install path
            const testPath = path.join(steamPath, "steamapps", "common", "wallpaper_engine", "config.json");
            if (fs.existsSync(testPath)) {
                log("Found WE path from main Steam path: " + testPath);
                return testPath;
            }
        }
    } catch (e) {}

    // 3. Absolute fallback
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 
                            (process.env.ProgramFiles && process.env.ProgramFiles.includes('(x86)') 
                                ? process.env.ProgramFiles 
                                : "C:\\Program Files (x86)");
                                
    const finalPath = path.join(
        programFilesX86,
        "Steam", "steamapps", "common", "wallpaper_engine", "config.json"
    );
    log("Using fallback WE path: " + finalPath);
    return finalPath;
}

// Cache the config path for 60 seconds to avoid running execSync on every request
function getWEConfigPath() {
    const now = Date.now();
    if (cachedWeConfigPath && (now - cachedWeConfigTime) < 60000) {
        return cachedWeConfigPath;
    }
    cachedWeConfigPath = _resolveWEConfigPath();
    cachedWeConfigTime = now;
    return cachedWeConfigPath;
}

let lastValidWeWallpaper = "";

function getCurrentWEWallpaper() {
    try {
        const raw = fs.readFileSync(getWEConfigPath(), "utf-8");
        const config = JSON.parse(raw);
        
        // Priority: find user profile matching process.env.USERNAME (case-insensitive)
        const currentUsername = (process.env.USERNAME || "").toLowerCase();
        let matchedKey = null;
        for (const key in config) {
            if (key.toLowerCase() === currentUsername) {
                matchedKey = key;
                break;
            }
        }

        const candidateKeys = matchedKey
            ? [matchedKey, ...Object.keys(config).filter(k => k !== matchedKey)]
            : Object.keys(config);

        for (const key of candidateKeys) {
            if (config[key] && config[key].general && config[key].general.wallpaperconfig) {
                const wallpapers = config[key].general.wallpaperconfig.selectedwallpapers;
                if (!wallpapers || typeof wallpapers !== 'object') continue;
                const monitorKey = Object.keys(wallpapers)[0] || 'Monitor0';
                if (wallpapers[monitorKey] && wallpapers[monitorKey].file) {
                    const wp = wallpapers[monitorKey].file.replace(/\//g, "\\");
                    if (fs.existsSync(wp)) {
                        lastValidWeWallpaper = wp;
                        return wp;
                    }
                }
            }
        }
        return "";
    } catch (e) {
        // When WE is writing config.json, readFileSync or JSON.parse might throw.
        // Return lastValidWeWallpaper if it still exists to prevent spurious fallback.
        if (lastValidWeWallpaper && fs.existsSync(lastValidWeWallpaper)) {
            return lastValidWeWallpaper;
        }
        return "";
    }
}

async function resolveActiveWallpaper() {
    const isWeRunning = await checkWeRunning();
    let wp = "";
    if (isWeRunning) {
        wp = getCurrentWEWallpaper();
    }
    if (!wp) {
        wp = await getWindowsWallpaper();
    }
    return wp;
}

// Detect media type and MIME safely, closing fd in finally block
function detectMediaType(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        return { type: 'unsupported', mime: '' };
    }

    const ext = path.extname(filePath).toLowerCase();
    const baseName = path.basename(filePath).toLowerCase();
    const isTranscoded = baseName === 'transcodedwallpaper' || ext === '';

    let fd = null;
    let magic = '';
    let riffType = '';

    try {
        fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(12);
        fs.readSync(fd, buffer, 0, 12, 0);
        magic = buffer.subarray(0, 4).toString('hex').toUpperCase();
        riffType = buffer.subarray(8, 12).toString('ascii');
    } catch (e) {
    } finally {
        if (fd !== null) {
            try { fs.closeSync(fd); } catch (e) {}
        }
    }

    if (magic.startsWith('FFD8FF')) {
        return { type: 'image', mime: 'image/jpeg' };
    }
    if (magic === '89504E47') {
        return { type: 'image', mime: 'image/png' };
    }
    if (magic.startsWith('424D')) {
        return { type: 'image', mime: 'image/bmp' };
    }
    if (magic === '47494638') {
        return { type: 'image', mime: 'image/gif' };
    }
    if (magic === '52494646' && riffType === 'WEBP') {
        return { type: 'image', mime: 'image/webp' };
    }

    if (['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.gif'].includes(ext)) {
        return {
            type: 'image',
            mime: 'image/' + (ext === '.jpg' ? 'jpeg' : ext.substring(1))
        };
    }

    if (isTranscoded) {
        // TranscodedWallpaper or no-extension image fallback
        return { type: 'image', mime: 'image/jpeg' };
    }

    if (['.mp4', '.webm', '.avi', '.mkv', '.mov', '.m4v'].includes(ext)) {
        return { type: 'video', mime: 'video/webm' };
    }

    return { type: 'unsupported', mime: '' };
}

function ensureCacheDir() {
    const tempDir = path.join(require('os').tmpdir(), 'spotify_we_cache');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    } else {
        // Auto-cleanup: keep only the 10 most recent cached videos to prevent storage bloat
        try {
            const now = Date.now();
            const allFiles = fs.readdirSync(tempDir);
            
            // Clean up stale .tmp files (older than 1 hour)
            allFiles.filter(f => f.endsWith('.tmp')).forEach(f => {
                const fp = path.join(tempDir, f);
                try {
                    if (now - fs.statSync(fp).mtime.getTime() > 3600000) {
                        fs.unlinkSync(fp);
                    }
                } catch(e) {}
            });

            // Keep only 10 recent .webm files (LRU)
            const webmFiles = allFiles
                .filter(f => f.endsWith('.webm'))
                .map(f => {
                    try {
                        return { name: f, time: fs.statSync(path.join(tempDir, f)).mtime.getTime() };
                    } catch (e) {
                        return null;
                    }
                })
                .filter(Boolean)
                .sort((a, b) => b.time - a.time);
                
            if (webmFiles.length > 10) {
                for (let i = 10; i < webmFiles.length; i++) {
                    try {
                        fs.unlinkSync(path.join(tempDir, webmFiles[i].name));
                    } catch (e) {}
                }
            }
        } catch (e) {
            console.error("Cache cleanup error:", e);
        }
    }
    return tempDir;
}

function transcodeVideo(wp, cacheDir) {
    let mtimeMs = 0;
    try {
        mtimeMs = fs.statSync(wp).mtimeMs;
    } catch(e) {}
    const hash = crypto.createHash('md5').update(wp + "_" + mtimeMs).digest('hex');
    const cachedWebm = path.join(cacheDir, `${hash}.webm`);
    const tmpWebm = path.join(cacheDir, `${hash}.webm.tmp`);

    // If already cached and valid, refresh mtime for LRU and return immediately
    if (fs.existsSync(cachedWebm)) {
        try {
            const stat = fs.statSync(cachedWebm);
            if (stat.size > 0) {
                try {
                    const now = new Date();
                    fs.utimesSync(cachedWebm, now, now);
                } catch (e) {}
                return Promise.resolve(cachedWebm);
            }
        } catch (e) {}
        // Remove corrupt cache
        try { fs.unlinkSync(cachedWebm); } catch (e) {}
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
            "-vf", "scale=-2:'min(1080,ih)'",
            "-r", "30",
            "-c:v", "libvpx", "-b:v", "4M", "-crf", "28", "-cpu-used", "5", "-threads", "8",
            "-an",
            "-f", "webm",
            tmpWebm
        ];

        const ffmpeg = spawn(ffmpegExe, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
        let errTail = "";
        ffmpeg.stderr.on('data', (d) => { errTail = (errTail + d.toString()).slice(-1500); });
        // Kill runaway transcodes (default 10 minutes) so the client is never stuck forever
        const killTimer = setTimeout(() => {
            console.error("FFmpeg timeout, killing process for " + wp);
            try { ffmpeg.kill('SIGKILL'); } catch (e) {}
        }, 10 * 60 * 1000);

        ffmpeg.on('close', (code) => {
            clearTimeout(killTimer);
            transcodingJobs.delete(hash);
            if (code !== 0) {
                console.error(`FFmpeg failed (code ${code}) for ${wp}:\n${errTail}`);
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
            clearTimeout(killTimer);
            console.error("FFmpeg spawn error (is FFmpeg installed / FFMPEG_PATH correct?):", err);
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

// Strict origin check to prevent malicious websites from reading local wallpaper paths
function isAllowedOrigin(origin) {
    try {
        const u = new URL(origin);
        if (u.protocol !== "https:") return false;
        const h = u.hostname.toLowerCase();
        return h === "spotify.com" || h.endsWith(".spotify.com") ||
               h === "spicetify.app" || h.endsWith(".spicetify.app");
    } catch (e) {
        return false;
    }
}

const server = http.createServer(async (req, res) => {
    // Anti DNS-rebinding: only answer requests addressed to the loopback host
    const host = (req.headers.host || "").toLowerCase();
    if (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`) {
        res.writeHead(403);
        res.end("Forbidden Host");
        return;
    }

    const origin = req.headers.origin;
    if (origin && isAllowedOrigin(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Private-Network", "true");
    } else if (origin) {
        // Block standard browsers accessing from random origins, but allow no-origin (like direct img src)
        res.writeHead(403);
        res.end("Forbidden Origin");
        return;
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Accept");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length, Content-Type, X-Media-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    let pathname = "";
    try { pathname = new URL(req.url, "http://127.0.0.1").pathname; } catch (e) {}

    if (pathname === "/path") {
        const wp = await resolveActiveWallpaper();
        if (!wp) {
            res.setHeader("X-Media-Type", "unsupported");
            res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("");
            return;
        }

        const detected = detectMediaType(wp);
        res.setHeader("X-Media-Type", detected.type);

        let mtimeMs = 0;
        try {
            mtimeMs = Math.round(fs.statSync(wp).mtimeMs);
        } catch (e) {}

        const id = `${wp}|${mtimeMs}`;
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(id);
        return;
    }

    if (pathname === "/media" || pathname === "/video") {
        const wp = await resolveActiveWallpaper();
        if (!wp || !fs.existsSync(wp)) {
            res.writeHead(404);
            res.end("No wallpaper found");
            return;
        }

        const detected = detectMediaType(wp);

        // If it's an image, serve it directly
        if (detected.type === "image") {
            try {
                const stat = fs.statSync(wp);
                res.writeHead(200, {
                    "Content-Type": detected.mime,
                    "Content-Length": stat.size
                });
                const stream = fs.createReadStream(wp);
                stream.on('error', (err) => {
                    console.error("Stream error:", err);
                    if (!res.headersSent) {
                        res.writeHead(500);
                        res.end();
                    } else {
                        res.destroy();
                    }
                });
                res.on('close', () => {
                    if (!stream.destroyed) stream.destroy();
                });
                stream.pipe(res);
            } catch (e) {
                if (!res.headersSent) {
                    res.writeHead(500);
                    res.end("Failed to serve image");
                }
            }
            return;
        }

        // If it's an unsupported format
        if (detected.type === "unsupported") {
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
                try { fs.unlinkSync(cachedWebm); } catch (e) {}
                res.writeHead(500);
                res.end("Corrupt cache file deleted");
                return;
            }
            
            res.setHeader("Content-Type", "video/webm");
            res.setHeader("Accept-Ranges", "bytes");

            const range = req.headers.range;

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                let start = parts[0] ? parseInt(parts[0], 10) : NaN;
                let end = parts[1] ? parseInt(parts[1], 10) : NaN;

                // Handle suffix range: bytes=-500 means last 500 bytes
                if (isNaN(start) && !isNaN(end)) {
                    start = Math.max(0, stat.size - end);
                    end = stat.size - 1;
                } else {
                    if (isNaN(start)) start = 0;
                    if (isNaN(end)) end = stat.size - 1;
                }

                // Clamp to valid bounds
                start = Math.max(0, Math.min(start, stat.size - 1));
                end = Math.max(start, Math.min(end, stat.size - 1));
                const chunkSize = end - start + 1;

                res.writeHead(206, {
                    "Content-Range": `bytes ${start}-${end}/${stat.size}`,
                    "Content-Length": chunkSize
                });
                const stream = fs.createReadStream(cachedWebm, { start, end });
                stream.on('error', (err) => {
                    console.error("Stream error:", err);
                    if (!res.headersSent) {
                        res.writeHead(500);
                        res.end();
                    } else {
                        res.destroy();
                    }
                });
                res.on('close', () => {
                    if (!stream.destroyed) stream.destroy();
                });
                stream.pipe(res);
            } else {
                res.writeHead(200, { "Content-Length": stat.size });
                const stream = fs.createReadStream(cachedWebm);
                stream.on('error', (err) => {
                    console.error("Stream error:", err);
                    if (!res.headersSent) {
                        res.writeHead(500);
                        res.end();
                    } else {
                        res.destroy();
                    }
                });
                res.on('close', () => {
                    if (!stream.destroyed) stream.destroy();
                });
                stream.pipe(res);
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
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});
