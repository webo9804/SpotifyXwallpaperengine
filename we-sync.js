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
    debugText.style.bottom = "24px";
    debugText.style.left = "24px";
    debugText.style.color = "rgba(255, 255, 255, 0.9)";
    debugText.style.fontSize = "13px";
    debugText.style.fontWeight = "500";
    debugText.style.zIndex = "99999";
    debugText.style.background = "rgba(18, 18, 18, 0.75)";
    debugText.style.padding = "10px 16px";
    debugText.style.borderRadius = "12px";
    debugText.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.6)";
    debugText.style.border = "1px solid rgba(255, 255, 255, 0.1)";
    debugText.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    debugText.style.backdropFilter = "blur(12px)";
    debugText.style.transition = "opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
    debugText.style.opacity = "1";
    debugText.innerText = "✨ 正在連線至動態桌布...";
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
                debugText.innerText = "⚠️ 提醒您，目前僅支援「影片 (Video)」格式的桌布唷！";
                document.body.style.backgroundImage = "none";
                if (video) video.src = "";
                currentBg = ""; // Reset state so switching back works
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
                        debugText.innerText = `❌ 影片載入失敗 (${code} - ${msg})`;
                    });
                    video.addEventListener("playing", function() {
                        debugText.innerText = "✅ 桌布同步成功！";
                        setTimeout(() => { debugText.style.opacity = "0"; }, 2500);
                    });
                }

                debugText.style.opacity = "1";
                debugText.innerText = "⏳ 正在對高畫質桌布進行最佳化轉檔 (約需 10 秒)，請稍候...";
                
                // Clear any static background image if it exists
                document.body.style.backgroundImage = "none";

                // Play the transcoded WebM video
                video.src = "http://127.0.0.1:8989/video?t=" + Date.now();
                video.load();
                video.play().catch(function(err) {
                    debugText.innerText = "⚠️ 瀏覽器阻擋了自動播放 (" + err.message + ")";
                });
            }
        } catch (e) {
            debugText.style.opacity = "1";
            debugText.innerText = "🔌 伺服器未啟動 (請確認背景程式有在運行)";
        } finally {
            setTimeout(checkBg, 3000);
        }
    }

    checkBg();
})();
