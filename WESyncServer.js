const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync, exec } = require("child_process");
const crypto = require("crypto");
const PORT = 8989;

function getWEConfigPath() {
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
    return path.join(base, "config.json");
}

function getCurrentWallpaper() {
    try {
        const raw = fs.readFileSync(getWEConfigPath(), "utf-8");
        const config = JSON.parse(raw);
        
        // Dynamically find the user profile (e.g., config.webbe, config.admin, etc.)
        for (const key in config) {
            if (config[key] && config[key].general && config[key].general.wallpaperconfig) {
                const wallpapers = config[key].general.wallpaperconfig.selectedwallpapers;
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

const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Access-Control-Allow-Headers", "Range, Accept");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length, Content-Type");

    if (req.url.startsWith("/path")) {
        const wp = getCurrentWallpaper();
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(wp);
        return;
    }

    if (req.url.startsWith("/video")) {
        const wp = getCurrentWallpaper();
        if (!wp) {
            res.writeHead(404);
            res.end("No wallpaper found");
            return;
        }

        const ext = path.extname(wp).toLowerCase();
        if (ext === '.pkg' || ext === '.html' || ext === '.exe') {
            res.writeHead(400);
            res.end("Unsupported format");
            return;
        }

        const cacheDir = path.join(require('os').tmpdir(), "spotify_we_cache");
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);
        
        const hash = crypto.createHash('md5').update(wp).digest('hex');
        const cachedWebm = path.join(cacheDir, `${hash}.webm`);
        const tmpWebm = path.join(cacheDir, `${hash}.webm.tmp`);

        if (!fs.existsSync(cachedWebm)) {
            try {
                console.log(`Transcoding ${wp} to WebM...`);
                await new Promise((resolve, reject) => {
                    // Output to .tmp file first, force webm format with -f webm
                    exec(`ffmpeg -y -i "${wp}" -t 60 -vf "scale=-1:'min(1080,ih)'" -r 30 -c:v libvpx -b:v 8M -crf 12 -cpu-used 5 -threads 8 -c:a libvorbis -f webm "${tmpWebm}"`, (error, stdout, stderr) => {
                        if (error) {
                            reject(error);
                        } else {
                            // Rename .tmp to .webm only when completely finished
                            if (fs.existsSync(tmpWebm)) {
                                fs.renameSync(tmpWebm, cachedWebm);
                            }
                            resolve();
                        }
                    });
                });
            } catch(e) {
                console.error("FFmpeg error:", e);
                if (fs.existsSync(tmpWebm)) fs.unlinkSync(tmpWebm);
                res.writeHead(500);
                res.end("FFmpeg transcoding failed");
                return;
            }
        }

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
        return;
    }

    res.writeHead(404);
    res.end();
});

server.listen(PORT, "127.0.0.1", () => {
    console.log("WESync Server running on http://127.0.0.1:" + PORT);
});
