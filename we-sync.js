(function WESync() {
    let currentBg = localStorage.getItem("we-sync-current-bg") || "";
    let ignoredBg = localStorage.getItem("we-sync-ignored-bg") || "";
    let failedBg = "";
    let failCount = 0;
    let mediaEl = null;
    let autoplayUnlockHandler = null;
    let isTranscoding = false;
    let transcodeDeadline = 0; // watchdog: never stay in 'transcoding' state forever
    let initialized = false;
    let retryCount = 0;
    let pollTimerId = null;
    let isCheckingBg = false;
    let checkSeq = 0;
    let activeAbortController = null;

    // ==========================================
    // Bilingual Localization (zh-TW / en)
    // ==========================================
    const I18N = {
        zh: {
            init: "🔌 正在初始化同步模組...",
            panelTitle: "背景設定",
            resetBtn: "重設",
            brightnessLabel: "背景亮度",
            blurLabel: "背景模糊",
            resyncBtn: "重新同步目前桌布",
            resyncing: "🔄 正在重新同步桌布...",
            promptTitle: "🌟 偵測到新桌布",
            promptDesc: "電腦桌布已變更，是否要將 Spotify 背景同步更換？",
            btnNo: "保持原樣",
            btnYes: "同步更換",
            synced: "✅ 已與桌布同步！",
            imgFailFinal: "⚠️ 圖片連續載入失敗，已放棄同步此桌布。",
            imgFailRetry: (n) => `⚠️ 圖片載入失敗，稍後重試 (${n}/3)`,
            loadingImg: "⏳ 正在載入靜態桌布...",
            vidFailFinal: "⚠️ 影片連續轉檔或載入失敗，已放棄同步此桌布。",
            vidFailRetry: (n) => `⚠️ 影片載入失敗，稍後重試 (${n}/3)`,
            transcoding: "⏳ 正在針對高畫質桌布進行最佳化轉檔 (約需 10 秒，請稍候)...",
            autoplayBlocked: "⚠️ 瀏覽器阻擋自動播放，請「點擊畫面任意處」解鎖",
            vidPlayError: (name) => `⚠️ 影片播放失敗 (${name})`,
            unsupportedInitial: "⚠️ 目前的桌布不是支援的「影片或圖片」格式。",
            unsupportedKeep: "⚠️ 偵測到不支援的桌布格式，將維持原本的 Spotify 背景。",
            waitingServer: (n) => `⏳ 正在等待伺服器啟動... (${n}/3)`,
            serverOffline: "🔌 伺服器未啟動 (請確認背景程式有在運行)"
        },
        en: {
            init: "🔌 Initializing WESync...",
            panelTitle: "Background Settings",
            resetBtn: "Reset",
            brightnessLabel: "Brightness",
            blurLabel: "Blur",
            resyncBtn: "Resync Wallpaper",
            resyncing: "🔄 Resyncing wallpaper...",
            promptTitle: "🌟 New Wallpaper Detected",
            promptDesc: "Your desktop wallpaper changed. Sync Spotify background?",
            btnNo: "Keep Current",
            btnYes: "Sync Now",
            synced: "✅ Wallpaper synced!",
            imgFailFinal: "⚠️ Failed to load image after 3 attempts; skipped.",
            imgFailRetry: (n) => `⚠️ Image failed to load, retrying (${n}/3)...`,
            loadingImg: "⏳ Loading image wallpaper...",
            vidFailFinal: "⚠️ Failed to load/transcode video after 3 attempts; skipped.",
            vidFailRetry: (n) => `⚠️ Video failed to load, retrying (${n}/3)...`,
            transcoding: "⏳ Optimizing & transcoding video wallpaper (~10s)...",
            autoplayBlocked: "⚠️ Autoplay blocked. Click anywhere to start",
            vidPlayError: (name) => `⚠️ Video playback failed (${name})`,
            unsupportedInitial: "⚠️ Current wallpaper is not a supported video or image format.",
            unsupportedKeep: "⚠️ Unsupported wallpaper format detected; keeping current background.",
            waitingServer: (n) => `⏳ Waiting for server... (${n}/3)`,
            serverOffline: "🔌 Server not running (check background process)"
        }
    };

    function getLang() {
        let locale = "";
        try {
            if (window.Spicetify && Spicetify.Locale && typeof Spicetify.Locale.getLocale === "function") {
                locale = Spicetify.Locale.getLocale() || "";
            }
        } catch (e) {}
        if (!locale) {
            locale = navigator.language || navigator.userLanguage || "en";
        }
        return /^zh/i.test(locale) ? "zh" : "en";
    }

    function t(key, ...args) {
        const dict = I18N[getLang()] || I18N.en;
        const val = dict[key];
        return typeof val === "function" ? val(...args) : val;
    }

    // Remove old elements if they exist (prevents duplicates on hot reload)
    const oldIds = [
        "we-sync-debug", "we-sync-video", "we-sync-img",
        "we-sync-prompt", "wesync-dimmer", "wesync-panel", "wesync-fab"
    ];
    oldIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

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
    debugText.innerText = t("init");
    document.body.appendChild(debugText);

    function clearMediaElement() {
        if (autoplayUnlockHandler) {
            document.removeEventListener("click", autoplayUnlockHandler);
            autoplayUnlockHandler = null;
        }
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
    }

    // ==========================================
    // WESync 背景亮度與模糊控制面板
    // ==========================================
    function initWESyncControls() {
        if (document.getElementById("wesync-panel")) return;

        const BRIGHTNESS_KEY = "wesync_brightness";
        const BLUR_KEY = "wesync_blur";
        const DEFAULT_BRIGHTNESS = 60;
        const DEFAULT_BLUR = 0;

        let brightness = parseInt(localStorage.getItem(BRIGHTNESS_KEY), 10);
        if (isNaN(brightness) || brightness < 10 || brightness > 100) {
            brightness = DEFAULT_BRIGHTNESS;
        }

        let blur = parseInt(localStorage.getItem(BLUR_KEY), 10);
        if (isNaN(blur) || blur < 0 || blur > 20) {
            blur = DEFAULT_BLUR;
        }

        function ensureDimmer() {
            let dimmer = document.getElementById("wesync-dimmer");
            if (!dimmer) {
                dimmer = document.createElement("div");
                dimmer.id = "wesync-dimmer";
                document.body.prepend(dimmer);
            }
            return dimmer;
        }

        function applyVisualSettings(nextBrightness, nextBlur) {
            brightness = Math.min(100, Math.max(10, nextBrightness));
            blur = Math.min(20, Math.max(0, nextBlur));
            localStorage.setItem(BRIGHTNESS_KEY, String(brightness));
            localStorage.setItem(BLUR_KEY, String(blur));

            const dimmer = ensureDimmer();
            const dimOpacity = (100 - brightness) / 100;
            dimmer.style.backgroundColor = `rgba(0, 0, 0, ${dimOpacity.toFixed(2)})`;
            const blurCss = blur > 0 ? `blur(${blur}px)` : "none";
            dimmer.style.backdropFilter = blurCss;
            dimmer.style.webkitBackdropFilter = blurCss;
        }

        const panel = document.createElement("div");
        panel.id = "wesync-panel";
        panel.innerHTML = `
            <div class="wesync-panel-header">
                <span id="wesync-title"></span>
                <button id="wesync-reset" type="button"></button>
            </div>
            <label class="wesync-row" for="wesync-slider">
                <span id="wesync-brightness-label"></span>
                <span id="wesync-val">${brightness}%</span>
            </label>
            <input id="wesync-slider" class="wesync-slider" type="range" min="10" max="100" step="1" value="${brightness}" />
            <label class="wesync-row" for="wesync-blur-slider">
                <span id="wesync-blur-label"></span>
                <span id="wesync-blur-val">${blur}px</span>
            </label>
            <input id="wesync-blur-slider" class="wesync-slider" type="range" min="0" max="20" step="1" value="${blur}" />
            <button id="wesync-resync" type="button"></button>
        `;
        document.body.appendChild(panel);

        const titleEl = panel.querySelector("#wesync-title");
        const brightnessLabelEl = panel.querySelector("#wesync-brightness-label");
        const blurLabelEl = panel.querySelector("#wesync-blur-label");
        const slider = panel.querySelector("#wesync-slider");
        const valLabel = panel.querySelector("#wesync-val");
        const blurSlider = panel.querySelector("#wesync-blur-slider");
        const blurValLabel = panel.querySelector("#wesync-blur-val");
        const resetBtn = panel.querySelector("#wesync-reset");
        const resyncBtn = panel.querySelector("#wesync-resync");

        function refreshPanelTexts() {
            titleEl.textContent = t("panelTitle");
            resetBtn.textContent = t("resetBtn");
            resetBtn.title = t("resetBtn");
            brightnessLabelEl.textContent = t("brightnessLabel");
            blurLabelEl.textContent = t("blurLabel");
            resyncBtn.textContent = t("resyncBtn");
        }
        refreshPanelTexts();

        slider.addEventListener("input", (e) => {
            const v = parseInt(e.target.value, 10);
            valLabel.textContent = `${v}%`;
            applyVisualSettings(v, blur);
        });

        blurSlider.addEventListener("input", (e) => {
            const b = parseInt(e.target.value, 10);
            blurValLabel.textContent = `${b}px`;
            applyVisualSettings(brightness, b);
        });

        resetBtn.addEventListener("click", () => {
            slider.value = DEFAULT_BRIGHTNESS;
            valLabel.textContent = `${DEFAULT_BRIGHTNESS}%`;
            blurSlider.value = DEFAULT_BLUR;
            blurValLabel.textContent = `${DEFAULT_BLUR}px`;
            applyVisualSettings(DEFAULT_BRIGHTNESS, DEFAULT_BLUR);
        });

        resyncBtn.addEventListener("click", () => {
            panel.classList.remove("open");
            triggerManualResync();
        });

        function positionPanelNearTrigger(triggerEl) {
            panel.classList.remove("wesync-panel-bottom");
            if (!triggerEl || typeof triggerEl.getBoundingClientRect !== "function") {
                panel.style.top = "";
                panel.style.bottom = "";
                panel.style.left = "";
                panel.style.right = "";
                return;
            }
            const rect = triggerEl.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;

            const panelWidth = 244;
            if (rect.top > window.innerHeight / 2) {
                panel.style.top = "auto";
                panel.style.bottom = `${Math.max(16, Math.round(window.innerHeight - rect.top + 8))}px`;
            } else {
                panel.style.bottom = "auto";
                panel.style.top = `${Math.max(12, Math.round(rect.bottom + 8))}px`;
            }

            if (rect.left < window.innerWidth / 2) {
                const clampedLeft = Math.min(Math.max(12, Math.round(rect.left)), window.innerWidth - panelWidth - 12);
                panel.style.left = `${clampedLeft}px`;
                panel.style.right = "auto";
            } else {
                const clampedRight = Math.min(Math.max(12, Math.round(window.innerWidth - rect.right)), window.innerWidth - panelWidth - 12);
                panel.style.right = `${clampedRight}px`;
                panel.style.left = "auto";
            }
        }

        function togglePanel(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            refreshPanelTexts();
            const triggerEl = (e && e.currentTarget && e.currentTarget.getBoundingClientRect)
                ? e.currentTarget
                : (e && e.target && e.target.closest ? e.target.closest("[data-wesync-trigger]") : null) || document.querySelector("[data-wesync-trigger]");
            positionPanelNearTrigger(triggerEl);
            setTimeout(() => panel.classList.toggle("open"), 0);
        }

        document.addEventListener("click", (e) => {
            if (
                panel.classList.contains("open") &&
                !panel.contains(e.target) &&
                !e.target.closest("[data-wesync-trigger]")
            ) {
                panel.classList.remove("open");
            }
        });

        const SUN_ICON_SVG = '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-10a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 1zm0 11.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75zm7-4.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 15 8zM3.25 8a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 3.25 8zm9.697-4.947a.75.75 0 0 1 0 1.061l-1.06 1.06a.75.75 0 1 1-1.061-1.06l1.06-1.061a.75.75 0 0 1 1.061 0zm-8.838 8.839a.75.75 0 0 1 0 1.06l-1.061 1.061a.75.75 0 0 1-1.06-1.06l1.06-1.061a.75.75 0 0 1 1.061 0zm8.838 1.06a.75.75 0 0 1-1.06 0l-1.061-1.06a.75.75 0 0 1 1.06-1.061l1.061 1.06a.75.75 0 0 1 0 1.061zm-8.838-8.838a.75.75 0 0 1-1.06 0l-1.061-1.061a.75.75 0 1 1 1.06-1.06l1.061 1.06a.75.75 0 0 1 0 1.061z"/></svg>';

        function mountTrigger() {
            refreshPanelTexts();
            if (window.Spicetify && Spicetify.Topbar && Spicetify.Topbar.Button) {
                const topbarBtn = new Spicetify.Topbar.Button(
                    t("panelTitle"),
                    SUN_ICON_SVG,
                    togglePanel,
                    false
                );
                if (topbarBtn && topbarBtn.element) {
                    topbarBtn.element.setAttribute("data-wesync-trigger", "1");
                }
            } else if (!document.getElementById("wesync-fab")) {
                const fab = document.createElement("button");
                fab.id = "wesync-fab";
                fab.type = "button";
                fab.innerHTML = SUN_ICON_SVG;
                fab.title = t("panelTitle");
                fab.setAttribute("data-wesync-trigger", "1");
                fab.addEventListener("click", togglePanel);
                document.body.appendChild(fab);
                panel.classList.add("wesync-panel-bottom");
            }
        }

        applyVisualSettings(brightness, blur);

        let retries = 0;
        const timer = setInterval(() => {
            if ((window.Spicetify && Spicetify.Topbar && Spicetify.Topbar.Button) || retries >= 20) {
                clearInterval(timer);
                mountTrigger();
            }
            retries++;
        }, 300);
    }

    // Initialize brightness/blur controls and dimmer
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
            <div style="font-size: 15px; font-weight: bold; margin-bottom: 8px;">${t("promptTitle")}</div>
            <div style="font-size: 13px; color: #b3b3b3; margin-bottom: 20px;">${t("promptDesc")}</div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="we-sync-btn-no" style="padding: 8px 16px; border-radius: 20px; border: 1px solid #727272; background: transparent; color: white; cursor: pointer; font-size: 12px; font-weight: bold; transition: background 0.2s;">${t("btnNo")}</button>
                <button id="we-sync-btn-yes" style="padding: 8px 16px; border-radius: 20px; border: none; background: #1ed760; color: black; cursor: pointer; font-size: 12px; font-weight: bold; transition: transform 0.1s;">${t("btnYes")}</button>
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
                --lyrics-color-background: transparent !important;
            }
            body, html, #main, [data-testid="root"], [data-testid="main-view-container"],
            [data-testid="lyrics-page"], .lyrics-lyrics-container, .lyrics-lyrics-background, .lyrics-lyrics-contentContainer,
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
            [class*="topBar-overlay"], [class*="blinder"], [class*="under-main-view"] {
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
        if (bgFile !== failedBg) {
            failedBg = "";
            failCount = 0;
        }
        currentBg = bgFile;
        ignoredBg = "";
        localStorage.setItem("we-sync-current-bg", currentBg);
        localStorage.setItem("we-sync-ignored-bg", ignoredBg);

        clearMediaElement();
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
                debugText.innerText = t("synced");
                setTimeout(() => { debugText.style.opacity = "0"; }, 2500);
            };
            mediaEl.onerror = () => {
                if (failedBg === bgFile) failCount++;
                else { failedBg = bgFile; failCount = 1; }

                if (failCount >= 3) {
                    clearMediaElement();
                    currentBg = "";
                    localStorage.setItem("we-sync-current-bg", "");
                    debugText.style.opacity = "1";
                    debugText.innerText = t("imgFailFinal");
                    setTimeout(() => { debugText.style.opacity = "0"; }, 4000);
                } else {
                    debugText.style.opacity = "1";
                    debugText.innerText = t("imgFailRetry", failCount);
                    currentBg = ""; // Reset so it retries on next check
                    localStorage.setItem("we-sync-current-bg", "");
                }
            };

            debugText.style.opacity = "1";
            debugText.innerText = t("loadingImg");

            mediaEl.src = "http://127.0.0.1:8989/media?t=" + Date.now();
            document.body.prepend(mediaEl);
        }
        else if (isVideo) {
            const container = document.createElement("div");
            container.innerHTML = `<video id="we-sync-video" autoplay loop muted playsinline style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; object-fit: cover; z-index: -2; pointer-events: none;"></video>`;
            mediaEl = container.firstChild;
            mediaEl.volume = 0;
            mediaEl.defaultMuted = true;

            mediaEl.addEventListener("error", function() {
                isTranscoding = false;
                if (failedBg === bgFile) failCount++;
                else { failedBg = bgFile; failCount = 1; }

                if (failCount >= 3) {
                    clearMediaElement();
                    currentBg = "";
                    localStorage.setItem("we-sync-current-bg", "");
                    debugText.style.opacity = "1";
                    debugText.innerText = t("vidFailFinal");
                    setTimeout(() => { debugText.style.opacity = "0"; }, 4000);
                } else {
                    debugText.style.opacity = "1";
                    debugText.innerText = t("vidFailRetry", failCount);
                    currentBg = ""; // Reset so it retries on next check
                    localStorage.setItem("we-sync-current-bg", "");
                }
            });
            mediaEl.addEventListener("playing", function() {
                isTranscoding = false;
                failCount = 0; // Reset fail count on success
                failedBg = "";
                debugText.innerText = t("synced");
                setTimeout(() => { debugText.style.opacity = "0"; }, 2500);
            });

            debugText.style.opacity = "1";
            debugText.innerText = t("transcoding");
            isTranscoding = true;
            transcodeDeadline = Date.now() + 3 * 60 * 1000;

            mediaEl.src = "http://127.0.0.1:8989/media?t=" + Date.now();
            document.body.prepend(mediaEl);
            mediaEl.load();
            mediaEl.play().catch(function(err) {
                if (err.name === "NotAllowedError") {
                    debugText.style.opacity = "1";
                    debugText.innerText = t("autoplayBlocked");
                    isTranscoding = false;

                    if (autoplayUnlockHandler) {
                        document.removeEventListener("click", autoplayUnlockHandler);
                    }
                    autoplayUnlockHandler = () => {
                        if (mediaEl && mediaEl.paused) {
                            mediaEl.play().then(() => {
                                debugText.innerText = t("synced");
                                setTimeout(() => { debugText.style.opacity = "0"; }, 2500);
                            }).catch(() => {});
                        }
                        if (autoplayUnlockHandler) {
                            document.removeEventListener("click", autoplayUnlockHandler);
                            autoplayUnlockHandler = null;
                        }
                    };
                    document.addEventListener("click", autoplayUnlockHandler);
                } else if (err.name === "AbortError") {
                    console.log("Play interrupted (likely loading new video)");
                } else {
                    console.error("Video playback failed:", err);
                    isTranscoding = false;
                    debugText.style.opacity = "1";
                    debugText.innerText = t("vidPlayError", err.name);
                    setTimeout(() => { debugText.style.opacity = "0"; }, 4000);
                }
            });
        }
    }

    function scheduleNextCheck(delay) {
        clearTimeout(pollTimerId);
        pollTimerId = setTimeout(() => checkBg(false), delay);
    }

    function triggerManualResync() {
        ignoredBg = "";
        currentBg = "";
        failedBg = "";
        failCount = 0;
        retryCount = 0;
        isTranscoding = false;
        transcodeDeadline = 0;
        localStorage.removeItem("we-sync-ignored-bg");
        localStorage.removeItem("we-sync-current-bg");

        const existingPrompt = document.getElementById("we-sync-prompt");
        if (existingPrompt) existingPrompt.remove();

        clearMediaElement();
        debugText.style.opacity = "1";
        debugText.innerText = t("resyncing");
        checkBg(true);
    }

    async function checkBg(isManual = false) {
        clearTimeout(pollTimerId);
        if (isCheckingBg) {
            if (!isManual) return;
            if (activeAbortController) {
                try { activeAbortController.abort(); } catch (e) {}
            }
        }
        const mySeq = ++checkSeq;
        isCheckingBg = true;

        try {
            if (!isManual && isTranscoding && Date.now() < transcodeDeadline) {
                scheduleNextCheck(5000);
                return;
            }
            isTranscoding = false;

            const controller = new AbortController();
            activeAbortController = controller;
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetch("http://127.0.0.1:8989/path", { signal: controller.signal });
            clearTimeout(timeoutId);
            if (activeAbortController === controller) activeAbortController = null;
            if (mySeq !== checkSeq) return;

            if (!res.ok) {
                scheduleNextCheck(5000);
                return;
            }

            const mediaType = (res.headers.get("X-Media-Type") || "").toLowerCase();
            const bgFile = await res.text();
            if (mySeq !== checkSeq) return;

            if (!bgFile) {
                // If no wallpaper is found (WE not running & no Windows wallpaper), hide the loading text
                debugText.style.opacity = "0";
                scheduleNextCheck(5000);
                return;
            }

            if (!initialized || retryCount > 0) {
                initialized = true;
                if (!isManual) debugText.style.opacity = "0";
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
                isVideo = !!rawPath.toLowerCase().match(/\.(mp4|webm|avi|mkv|mov|m4v)$/);
                isImage = !!rawPath.toLowerCase().match(/\.(jpg|jpeg|png|bmp|webp|gif)$/) ||
                          rawPath.toLowerCase().endsWith("transcodedwallpaper") ||
                          rawPath.toLowerCase().includes("transcodedwallpaper");
            }

            if (!isVideo && !isImage) {
                if (currentBg === "") {
                    debugText.style.opacity = "1";
                    debugText.innerText = t("unsupportedInitial");
                    document.body.style.backgroundImage = "none";
                } else if (bgFile !== ignoredBg) {
                    debugText.style.opacity = "1";
                    debugText.innerText = t("unsupportedKeep");
                    setTimeout(() => { debugText.style.opacity = "0"; }, 4000);
                    ignoredBg = bgFile;
                    localStorage.setItem("we-sync-ignored-bg", ignoredBg);
                }
                scheduleNextCheck(5000);
                return;
            }

            if (failedBg === bgFile && failCount >= 3) {
                // Failed 3 times for this wallpaper in this session; wait for change or manual resync
            } else if (!mediaEl) {
                applyBackground(bgFile, isImage, isVideo);
            } else if (bgFile !== currentBg && bgFile !== ignoredBg) {
                if (currentBg === "") {
                    applyBackground(bgFile, isImage, isVideo); // silent retry after a failed load
                } else {
                    showUpdatePrompt(bgFile, isImage, isVideo);
                }
            }
            scheduleNextCheck(3000);
        } catch (e) {
            if (mySeq !== checkSeq) return;
            retryCount++;
            debugText.style.opacity = "1";
            if (retryCount <= 3) {
                debugText.innerText = t("waitingServer", retryCount);
            } else {
                debugText.innerText = t("serverOffline");
            }
            scheduleNextCheck(retryCount > 3 ? 10000 : 3000);
        } finally {
            if (mySeq === checkSeq) {
                isCheckingBg = false;
            }
        }
    }

    checkBg();
})();
