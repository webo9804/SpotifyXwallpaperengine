(function WESync() {
    let currentBg = localStorage.getItem("we-sync-current-bg") || "";
    let ignoredBg = localStorage.getItem("we-sync-ignored-bg") || "";
    let failedBg = "";
    let failCount = 0;
    let mediaEl = null;
    let isTranscoding = false;
    let transcodeDeadline = 0; // watchdog: never stay in 'transcoding' state forever
    let initialized = false;

    // Remove old elements if they exist (prevents duplicates on hot reload)
    const oldDebug = document.getElementById("we-sync-debug");
    if (oldDebug) oldDebug.remove();
    const oldVideo = document.getElementById("we-sync-video");
    if (oldVideo) oldVideo.remove();
    const oldImg = document.getElementById("we-sync-img");
    if (oldImg) oldImg.remove();
    const oldPrompt = document.getElementById("we-sync-prompt");
    if (oldPrompt) oldPrompt.remove();
    const oldDimmer = document.getElementById("wesync-dimmer");
    if (oldDimmer) oldDimmer.remove();
    const oldPanel = document.getElementById("wesync-panel");
    if (oldPanel) oldPanel.remove();
    const oldFab = document.getElementById("wesync-fab");
    if (oldFab) oldFab.remove();

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

    // ==========================================
    // WESync 背景亮度控制面板
    // ==========================================
    function initWESyncControls() {
        if (document.getElementById('wesync-panel')) return;

        const STORAGE_KEY = 'wesync_brightness';
        const DEFAULT_BRIGHTNESS = 60;

        let brightness = parseInt(localStorage.getItem(STORAGE_KEY), 10);
        if (isNaN(brightness) || brightness < 10 || brightness > 100) {
            brightness = DEFAULT_BRIGHTNESS;
        }

        function ensureDimmer() {
            let dimmer = document.getElementById('wesync-dimmer');
            if (!dimmer) {
                dimmer = document.createElement('div');
                dimmer.id = 'wesync-dimmer';
                document.body.prepend(dimmer);
            }
            return dimmer;
        }

        function applyBrightness(val) {
            brightness = Math.min(100, Math.max(10, val));
            localStorage.setItem(STORAGE_KEY, String(brightness));
            const dimmer = ensureDimmer();
            const dimOpacity = (100 - brightness) / 100;
            dimmer.style.backgroundColor = `rgba(0, 0, 0, ${dimOpacity.toFixed(2)})`;
        }

        const panel = document.createElement('div');
        panel.id = 'wesync-panel';
        panel.innerHTML = `
            <div class="wesync-panel-header">
                <span>背景設定</span>
                <button id="wesync-reset" type="button" title="重設">重設</button>
            </div>
            <label class="wesync-row" for="wesync-slider">
                <span>背景亮度</span>
                <span id="wesync-val">${brightness}%</span>
            </label>
            <input id="wesync-slider" type="range" min="10" max="100" step="1" value="${brightness}" />
        `;
        document.body.appendChild(panel);

        const slider = panel.querySelector('#wesync-slider');
        const valLabel = panel.querySelector('#wesync-val');
        const resetBtn = panel.querySelector('#wesync-reset');

        slider.addEventListener('input', (e) => {
            const v = parseInt(e.target.value, 10);
            valLabel.textContent = `${v}%`;
            applyBrightness(v);
        });

        resetBtn.addEventListener('click', () => {
            slider.value = DEFAULT_BRIGHTNESS;
            valLabel.textContent = `${DEFAULT_BRIGHTNESS}%`;
            applyBrightness(DEFAULT_BRIGHTNESS);
        });

        function togglePanel(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            setTimeout(() => panel.classList.toggle('open'), 0);
        }

        document.addEventListener('click', (e) => {
            if (
                panel.classList.contains('open') &&
                !panel.contains(e.target) &&
                !e.target.closest('[data-wesync-trigger]')
            ) {
                panel.classList.remove('open');
            }
        });

        const SUN_ICON_SVG = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-10a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 1zm0 11.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75zm7-4.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 15 8zM3.25 8a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 3.25 8zm9.697-4.947a.75.75 0 0 1 0 1.061l-1.06 1.06a.75.75 0 1 1-1.061-1.06l1.06-1.061a.75.75 0 0 1 1.061 0zm-8.838 8.839a.75.75 0 0 1 0 1.06l-1.061 1.061a.75.75 0 0 1-1.06-1.06l1.06-1.061a.75.75 0 0 1 1.061 0zm8.838 1.06a.75.75 0 0 1-1.06 0l-1.061-1.06a.75.75 0 0 1 1.06-1.061l1.061 1.06a.75.75 0 0 1 0 1.061zm-8.838-8.838a.75.75 0 0 1-1.06 0l-1.061-1.061a.75.75 0 1 1 1.06-1.06l1.061 1.06a.75.75 0 0 1 0 1.061z"/></svg>';

        function mountTrigger() {
            if (window.Spicetify && Spicetify.Topbar && Spicetify.Topbar.Button) {
                const topbarBtn = new Spicetify.Topbar.Button(
                    '背景亮度設定',
                    SUN_ICON_SVG,
                    togglePanel,
                    false
                );
                if (topbarBtn && topbarBtn.element) {
                    topbarBtn.element.setAttribute('data-wesync-trigger', '1');
                }
            } else if (!document.getElementById('wesync-fab')) {
                const fab = document.createElement('button');
                fab.id = 'wesync-fab';
                fab.type = 'button';
                fab.innerHTML = SUN_ICON_SVG;
                fab.title = '背景亮度設定';
                fab.setAttribute('data-wesync-trigger', '1');
                fab.addEventListener('click', togglePanel);
                document.body.appendChild(fab);
            }
        }

        applyBrightness(brightness);

        let retries = 0;
        const timer = setInterval(() => {
            if ((window.Spicetify && Spicetify.Topbar && Spicetify.Topbar.Button) || retries >= 20) {
                clearInterval(timer);
                mountTrigger();
            }
            retries++;
        }, 300);
    }

    // Initialize brightness controls and dimmer
    initWESyncControls();

    function showUpdatePrompt(newBg, isImage, isVideo) {
        // If a prompt already exists, remove it first so we always show the LATEST wallpaper
        const existingPrompt = document.getElementById("we-sync-prompt");
        if (existingPrompt) {
            // Same wallpaper already being asked about: keep the DOM stable (polling runs every 3s)
            if (existingPrompt.dataset.bg === newBg) return;
            existingPrompt.remove();
        }

        const prompt = document.createElement("div");
        prompt.id = "we-sync-prompt";
        prompt.dataset.bg = newBg;
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
            localStorage.setItem("we-sync-ignored-bg", ignoredBg);
        };
    }

    // Dynamically inject transparency CSS via JS to cover ALL Spotify versions
    function forceTransparency() {
        if (document.getElementById("we-sync-force-css")) return;
        const style = document.createElement("style");
        style.id = "we-sync-force-css";
        style.textContent = `
            :root {
                --background-base: transparent !important;
                --background-highlight: rgba(255, 255, 255, 0.1) !important;
                --background-press: rgba(255, 255, 255, 0.2) !important;
                --background-elevated-base: rgba(24, 24, 24, 0.92) !important;
                --background-elevated-highlight: rgba(45, 45, 45, 0.95) !important;
                --background-elevated-press: rgba(60, 60, 60, 0.95) !important;
                --background-tinted-base: transparent !important;
                --background-tinted-highlight: rgba(255, 255, 255, 0.1) !important;
                --background-tinted-press: rgba(255, 255, 255, 0.2) !important;
                --background-color: transparent !important;
                --bg-color: transparent !important;
            }
            body, html, #main, [data-testid="root"], [data-testid="main-view-container"],
            [class*="Root__top"], [class*="Root__globalNav"], [class*="Root__main"], [class*="Root__nav"],
            [class*="Root__now-playing"], [class*="Root__right-sidebar"],
            [class*="main-view-container"], [class*="os-host"], [class*="os-viewport"],
            [class*="os-padding"], [class*="os-content"],
            [class*="Layout__"], [class*="mainViewContainer"] {
                background-color: transparent !important;
                background: transparent !important;
                background-image: none !important;
            }
            [class*="entityHeader-background"], [class*="entityHeader-overlay"],
            [class*="actionBarBackground"], [class*="topBar-background"],
            [class*="topBar-overlay"], [class*="blinder"] {
                background: transparent !important;
                opacity: 0 !important;
            }
            .main-yourLibraryX-entryPoints, .main-yourLibraryX-libraryContainer,
            .main-nowPlayingView-contextItemInfo, .main-nowPlayingView-section, .main-nowPlayingView-content,
            [data-testid="your-library"], [data-testid="now-playing-widget"] {
                background-color: rgba(0, 0, 0, 0.25) !important;
                background: rgba(0, 0, 0, 0.25) !important;
            }
        `;
        document.head.appendChild(style);
    }

    function applyBackground(bgFile, isImage, isVideo) {
        currentBg = bgFile;
        ignoredBg = "";
        localStorage.setItem("we-sync-current-bg", currentBg);
        localStorage.setItem("we-sync-ignored-bg", ignoredBg);
        
        if (mediaEl) {
            if (mediaEl.tagName === "VIDEO") {
                try {
                    mediaEl.pause();
                    mediaEl.removeAttribute("src");
                    mediaEl.load();
                } catch (e) {}
            }
            mediaEl.remove();
            mediaEl = null;
        }
        document.body.style.backgroundImage = "none";

        // Force transparency via JS as a safety net for all Spotify versions
        forceTransparency();

        if (isImage) {
            isTranscoding = false;
            mediaEl = document.createElement("img");
            mediaEl.id = "we-sync-img";
            mediaEl.style.position = "fixed";
            mediaEl.style.top = "0";
            mediaEl.style.left = "0";
            mediaEl.style.width = "100vw";
            mediaEl.style.height = "100vh";
            mediaEl.style.objectFit = "cover";
            mediaEl.style.zIndex = "-2";
            mediaEl.style.pointerEvents = "none";
            
            mediaEl.onload = () => {
                failCount = 0;
                failedBg = "";
                debugText.innerText = "✅ 已與桌布同步！";
                setTimeout(() => { debugText.style.opacity = "0"; }, 2500);
            };
            mediaEl.onerror = () => {
                if (failedBg === bgFile) failCount++;
                else { failedBg = bgFile; failCount = 1; }

                if (failCount >= 3) {
                    debugText.style.opacity = "1";
                    debugText.innerText = `⚠️ 圖片連續載入失敗，已放棄同步此桌布。`;
                    ignoredBg = bgFile;
                    localStorage.setItem("we-sync-ignored-bg", ignoredBg);
                    setTimeout(() => { debugText.style.opacity = "0"; }, 4000);
                } else {
                    debugText.style.opacity = "1";
                    debugText.innerText = `⚠️ 圖片載入失敗，稍後重試 (${failCount}/3)`;
                    currentBg = ""; // Reset so it retries on next check
                    localStorage.setItem("we-sync-current-bg", "");
                }
            };

            debugText.style.opacity = "1";
            debugText.innerText = "⏳ 正在載入靜態桌布...";
            
            mediaEl.src = "http://127.0.0.1:8989/media?t=" + Date.now();
            document.body.prepend(mediaEl);
        } 
        else if (isVideo) {
            const container = document.createElement("div");
            container.innerHTML = `<video id="we-sync-video" autoplay loop muted playsinline style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; object-fit: cover; z-index: -2; pointer-events: none;"></video>`;
            mediaEl = container.firstChild;
            mediaEl.volume = 0;
            mediaEl.defaultMuted = true;

            mediaEl.addEventListener("error", function(e) {
                isTranscoding = false;
                if (failedBg === bgFile) failCount++;
                else { failedBg = bgFile; failCount = 1; }

                if (failCount >= 3) {
                    debugText.style.opacity = "1";
                    debugText.innerText = `⚠️ 影片連續轉檔或載入失敗，已放棄同步此桌布。`;
                    ignoredBg = bgFile;
                    localStorage.setItem("we-sync-ignored-bg", ignoredBg);
                    setTimeout(() => { debugText.style.opacity = "0"; }, 4000);
                } else {
                    debugText.style.opacity = "1";
                    debugText.innerText = `⚠️ 影片載入失敗，稍後重試 (${failCount}/3)`;
                    currentBg = ""; // Reset so it retries on next check
                    localStorage.setItem("we-sync-current-bg", "");
                }
            });
            mediaEl.addEventListener("playing", function() {
                isTranscoding = false;
                failCount = 0; // Reset fail count on success
                failedBg = "";
                debugText.innerText = "✅ 已與桌布同步！";
                setTimeout(() => { debugText.style.opacity = "0"; }, 2500);
            });

            debugText.style.opacity = "1";
            debugText.innerText = "⏳ 正在針對高畫質桌布進行最佳化轉檔 (約需 10 秒，請稍候)...";
            isTranscoding = true;
            transcodeDeadline = Date.now() + 3 * 60 * 1000;
            
            mediaEl.src = "http://127.0.0.1:8989/media?t=" + Date.now();
            document.body.prepend(mediaEl);
            mediaEl.load();
            mediaEl.play().catch(function(err) {
                if (err.name === 'NotAllowedError') {
                    debugText.style.opacity = "1";
                    debugText.innerText = "⚠️ 瀏覽器阻擋自動播放，請「點擊畫面任意處」解鎖";
                    isTranscoding = false;
                    
                    const unlockAutoplay = () => {
                        if (mediaEl && mediaEl.paused) {
                            mediaEl.play().then(() => {
                                debugText.innerText = "✅ 已與桌布同步！";
                                setTimeout(() => { debugText.style.opacity = "0"; }, 2500);
                            }).catch(e => {});
                        }
                        document.removeEventListener("click", unlockAutoplay);
                    };
                    document.addEventListener("click", unlockAutoplay);
                } else if (err.name === 'AbortError') {
                    console.log("Play interrupted (likely loading new video)");
                } else {
                    console.error("Video playback failed:", err);
                    isTranscoding = false;
                    debugText.style.opacity = "1";
                    debugText.innerText = "⚠️ 影片播放失敗 (" + err.name + ")";
                    setTimeout(() => { debugText.style.opacity = "0"; }, 4000);
                }
            });
        }
    }

    async function checkBg() {
        try {
            if (isTranscoding && Date.now() < transcodeDeadline) {
                setTimeout(checkBg, 5000);
                return;
            }
            isTranscoding = false;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetch("http://127.0.0.1:8989/path", { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) {
                setTimeout(checkBg, 5000);
                return;
            }

            const mediaType = (res.headers.get("X-Media-Type") || "").toLowerCase();
            const bgFile = await res.text();
            if (!bgFile) {
                // If no wallpaper is found (WE not running & no Windows wallpaper), hide the loading text
                debugText.style.opacity = "0";
                setTimeout(checkBg, 5000);
                return;
            }

            if (!initialized || retryCount > 0) {
                initialized = true;
                debugText.style.opacity = "0";
            }
            retryCount = 0;

            let isVideo = false;
            let isImage = false;

            if (mediaType === "image") {
                isImage = true;
            } else if (mediaType === "video") {
                isVideo = true;
            } else {
                const rawPath = (bgFile.includes("|") ? bgFile.split("|")[0] : bgFile).trim();
                isVideo = !!rawPath.toLowerCase().match(/\.(mp4|webm|avi|mkv|mov)$/);
                isImage = !!rawPath.toLowerCase().match(/\.(jpg|jpeg|png|bmp|webp|gif)$/) ||
                          rawPath.toLowerCase().endsWith("transcodedwallpaper") ||
                          rawPath.toLowerCase().includes("transcodedwallpaper");
            }

            if (!isVideo && !isImage) {
                if (currentBg === "") {
                    debugText.style.opacity = "1";
                    debugText.innerText = "⚠️ 目前的桌布不是支援的「影片或圖片」格式。";
                    document.body.style.backgroundImage = "none";
                } else if (bgFile !== ignoredBg) {
                    debugText.style.opacity = "1";
                    debugText.innerText = "⚠️ 偵測到不支援的桌布格式，將為您維持原本的 Spotify 背景。";
                    setTimeout(() => { debugText.style.opacity = "0"; }, 4000);
                    ignoredBg = bgFile;
                    localStorage.setItem("we-sync-ignored-bg", ignoredBg);
                }
                setTimeout(checkBg, 5000);
                return;
            }

            if (!mediaEl) {
                applyBackground(bgFile, isImage, isVideo);
            } else if (bgFile !== currentBg && bgFile !== ignoredBg) {
                if (currentBg === "") {
                    applyBackground(bgFile, isImage, isVideo); // silent retry after a failed load
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
