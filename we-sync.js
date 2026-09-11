(function WESync() {
    let currentBg = "";
    let video = null;

    function createVideo() {
        const v = document.createElement("video");
        v.id = "we-sync-video";
        v.autoplay = true;
        v.loop = true;
        v.muted = true;
        v.style.position = "fixed";
        v.style.top = "0";
        v.style.left = "0";
        v.style.width = "100vw";
        v.style.height = "100vh";
        v.style.objectFit = "cover";
        v.style.zIndex = "0";
        v.style.pointerEvents = "none";
        v.style.filter = "brightness(0.4)"; // 降低亮度到 40% 增加質感與文字辨識度
        document.body.prepend(v);
        return v;
    }

    const debugText = document.createElement("div");
    debugText.id = "we-sync-debug";
    debugText.style.position = "fixed";
    debugText.style.bottom = "20px";
    debugText.style.left = "20px";
    debugText.style.color = "white";
    debugText.style.fontSize = "14px";
    debugText.style.zIndex = "99999";
    debugText.style.background = "rgba(0,0,0,0.5)";
    debugText.style.padding = "8px 12px";
    debugText.style.borderRadius = "8px";
    debugText.style.fontFamily = "sans-serif";
    debugText.style.backdropFilter = "blur(10px)";
    debugText.style.transition = "opacity 1s ease";
    debugText.style.opacity = "1";
    debugText.innerText = "WESync: Starting...";
    document.body.appendChild(debugText);

    async function checkBg() {
        try {
            const res = await fetch("http://127.0.0.1:8989/path");
            if (!res.ok) return;
            const bgFile = await res.text();
            if (!bgFile) return;

            // Warn user if it's not a video
            if (!bgFile.toLowerCase().match(/\.(mp4|webm|avi|mkv|mov)$/)) {
                debugText.style.opacity = "1";
                debugText.innerText = "WESync: Error - Please select a 'Video' wallpaper! (.pkg not supported)";
                document.body.style.backgroundImage = "none";
                if (video) video.src = "";
                return;
            }

            if (bgFile !== currentBg) {
                currentBg = bgFile;
                
                if (!video) {
                    video = createVideo();
                    video.addEventListener("error", function(e) {
                        debugText.style.opacity = "1";
                        const err = video.error;
                        const code = err ? err.code : "Unknown";
                        const msg = err ? err.message : "";
                        debugText.innerText = `WESync: Error ${code} - ${msg}`;
                    });
                    video.addEventListener("playing", function() {
                        debugText.innerText = "WESync: Playing";
                        setTimeout(() => { debugText.style.opacity = "0"; }, 2000);
                    });
                }

                debugText.style.opacity = "1";
                debugText.innerText = "WESync: Transcoding High-Res Video (Wait ~10s)...";
                
                // Clear any static background image if it exists
                document.body.style.backgroundImage = "none";

                // Play the transcoded WebM video
                video.src = "http://127.0.0.1:8989/video?t=" + Date.now();
                video.load();
                video.play().catch(function(err) {
                    debugText.innerText = "WESync: Play blocked: " + err.message;
                });
            }
        } catch (e) {
            debugText.innerText = "WESync: Server offline";
        } finally {
            setTimeout(checkBg, 3000);
        }
    }

    checkBg();
})();
