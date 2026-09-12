(function WESync() {
    let currentBg = "";
    let ignoredBg = "";
    let mediaEl = null;
    let isTranscoding = false;

    // Remove old elements if they exist (prevents duplicates on hot reload)
    const oldDebug = document.getElementById("we-sync-debug");
    if (oldDebug) oldDebug.remove();
    const oldVideo = document.getElementById("we-sync-video");
    if (oldVideo) oldVideo.remove();
    const oldImg = document.getElementById("we-sync-img");
    if (oldImg) oldImg.remove();
    const oldPrompt = document.getElementById("we-sync-prompt");
    if (oldPrompt) oldPrompt.remove();

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
    debugText.innerText = "🔌 正在初始化同步模組...";
    document.body.appendChild(debugText);

    let retryCount = 0;

    function showUpdatePrompt(newBg, isImage, isVideo) {
        if (document.getElementById("we-sync-prompt")) return;

        const prompt = document.createElement("div");
        prompt.id = "we-sync-prompt";
        prompt.style.position = "fixed";
        prompt.style.top = "24px";
        prompt.style.right = "24px";
        prompt.style.zIndex = "99999";
        prompt.style.background = "rgba(18, 18, 18, 0.95)";
        prompt.style.padding = "20px";
        prompt.style.borderRadius = "12px";
        prompt.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.8)";
        prompt.style.border = "1px solid rgba(255, 255, 255, 0.2)";
        prompt.style.color = "white";
        prompt.style.fontFamily = "system-ui, -apple-system, sans-serif";
        
        prompt.innerHTML = `
            <div style="font-size: 15px; font-weight: bold; margin-bottom: 8px;">🌟 偵測到新桌布</div>
            <div style="font-size: 13px; color: #b3b3b3; margin-bottom: 20px;">您的電腦桌布已變更。是否要將 Spotify 背景也同步更換？</div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="we-sync-btn-no" style="padding: 8px 16px; border-radius: 20px; border: 1px solid #727272; background: transparent; color: white; cursor: pointer; font-size: 12px; font-weight: bold; transition: background 0.2s;">保持原樣</button>
                <button id="we-sync-btn-yes" style="padding: 8px 16px; border-radius: 20px; border: none; background: #1ed760; color: black; cursor: pointer; font-size: 12px; font-weight: bold; transition: transform 0.1s;">同步更換</button>
            </div>
        `;
        document.body.appendChild(prompt);

        document.getElementById("we-sync-btn-no").onmouseover = function() { this.style.background = "rgba(255,255,255,0.1)"; };
        document.getElementById("we-sync-btn-no").onmouseout = function() { this.style.background = "transparent"; };
        document.getElementById("we-sync-btn-yes").onmouseover = function() { this.style.transform = "scale(1.05)"; };
        document.getElementById("we-sync-btn-yes").onmouseout = function() { this.style.transform = "scale(1)"; };

        document.getElementById("we-sync-btn-yes").onclick = () => {
            prompt.remove();
            applyBackground(newBg, isImage, isVideo);
        };
        document.getElementById("we-sync-btn-no").onclick = () => {
            prompt.remove();
            ignoredBg = newBg;
        };
    }

    function applyBackground(bgFile, isImage, isVideo) {
        currentBg = bgFile;
        ignoredBg = "";
        
        if (mediaEl) { mediaEl.remove(); mediaEl = null; }
        document.body.style.backgroundImage = "none";

        if (isImage) {
            mediaEl = document.createElement("img");
            mediaEl.id = "we-sync-img";
            mediaEl.style.position = "fixed";
            mediaEl.style.top = "0";
            mediaEl.style.left = "0";
            mediaEl.style.width = "100vw";
            mediaEl.style.height = "100vh";
            mediaEl.style.objectFit = "cover";
            mediaEl.style.zIndex = "0";
            mediaEl.style.pointerEvents = "none";
            mediaEl.style.filter = "brightness(0.4)";
            
            mediaEl.onload = () => {
                debugText.innerText = "✅ 已與桌布同步！";
                setTimeout(() => { debugText.style.opacity = "0"; }, 2500);
            };
            mediaEl.onerror = () => {
                debugText.style.opacity = "1";
                debugText.innerText = `⚠️ 圖片載入失敗`;
                currentBg = "";
            };

            debugText.style.opacity = "1";
            debugText.innerText = "⏳ 正在載入靜態桌布...";
            
            mediaEl.src = "http://127.0.0.1:8989/media?t=" + Date.now();
            document.body.prepend(mediaEl);
        } 
        else if (isVideo) {
            mediaEl = document.createElement("video");
            mediaEl.id = "we-sync-video";
            mediaEl.autoplay = true;
            mediaEl.loop = true;
            mediaEl.muted = true;
            mediaEl.playsInline = true;
            mediaEl.style.position = "fixed";
            mediaEl.style.top = "0";
            mediaEl.style.left = "0";
            mediaEl.style.width = "100vw";
            mediaEl.style.height = "100vh";
            mediaEl.style.objectFit = "cover";
            mediaEl.style.zIndex = "0";
            mediaEl.style.pointerEvents = "none";
            mediaEl.style.filter = "brightness(0.4)";

            mediaEl.addEventListener("error", function(e) {
                debugText.style.opacity = "1";
                const err = mediaEl.error;
                const code = err ? err.code : "Unknown";
                const msg = err ? err.message : "";
                debugText.innerText = `⚠️ 影片載入失敗 (${code} - ${msg})`;
                currentBg = "";
                isTranscoding = false;
            });
            mediaEl.addEventListener("playing", function() {
                isTranscoding = false;
                debugText.innerText = "✅ 已與桌布同步！";
                setTimeout(() => { debugText.style.opacity = "0"; }, 2500);
            });

            debugText.style.opacity = "1";
            debugText.innerText = "⏳ 正在針對高畫質桌布進行最佳化轉檔 (約需 10 秒，請稍候)...";
            isTranscoding = true;
            
            mediaEl.src = "http://127.0.0.1:8989/media?t=" + Date.now();
            document.body.prepend(mediaEl);
            mediaEl.load();
            mediaEl.play().catch(function(err) {
                debugText.style.opacity = "1";
                debugText.innerText = "⚠️ 瀏覽器阻擋了自動播放 (" + err.message + ")";
                isTranscoding = false;
                currentBg = "";
            });
        }
    }

    async function checkBg() {
        try {
            if (isTranscoding) {
                setTimeout(checkBg, 5000);
                return;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetch("http://127.0.0.1:8989/path", { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) {
                setTimeout(checkBg, 5000);
                return;
            }

            const bgFile = await res.text();
            if (!bgFile) {
                setTimeout(checkBg, 5000);
                return;
            }

            retryCount = 0;

            const isVideo = !!bgFile.toLowerCase().match(/\.(mp4|webm|avi|mkv|mov)$/);
            const isImage = !!bgFile.toLowerCase().match(/\.(jpg|jpeg|png|bmp|webp|gif)$/);

            if (!isVideo && !isImage) {
                debugText.style.opacity = "1";
                debugText.innerText = "⚠️ 目前的桌布不是支援的「影片或圖片」格式。";
                document.body.style.backgroundImage = "none";
                if (mediaEl) { mediaEl.remove(); mediaEl = null; }
                currentBg = ""; 
                setTimeout(checkBg, 5000);
                return;
            }

            if (bgFile !== currentBg && bgFile !== ignoredBg) {
                if (currentBg === "") {
                    applyBackground(bgFile, isImage, isVideo);
                } else {
                    showUpdatePrompt(bgFile, isImage, isVideo);
                }
            }
        } catch (e) {
            retryCount++;
            debugText.style.opacity = "1";
            if (retryCount <= 3) {
                debugText.innerText = "⏳ 正在等待伺服器啟動... (" + retryCount + "/3)";
            } else {
                debugText.innerText = "🔌 伺服器未啟動 (請確認背景程式有在運行)";
            }
        }
        setTimeout(checkBg, retryCount > 3 ? 10000 : 3000);
    }

    checkBg();
})();
