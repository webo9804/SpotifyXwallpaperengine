# Spotify x Wallpaper Engine Sync Plugin

把你正在使用的 **Wallpaper Engine 動態／靜態桌布**（或 Windows 桌布）同步成 **Spotify 桌面版的背景**，透過 [Spicetify](https://spicetify.app/) 注入。

*Syncs your current Wallpaper Engine (or Windows) wallpaper into the Spotify desktop client as a live background, using Spicetify.*

> [!NOTE]
> 這是非官方的個人專案，與 Spotify、Wallpaper Engine、Spicetify 皆無關聯。

> [!WARNING]
> **安裝前必讀**
> 安裝腳本會：寫入開機啟動項、常駐背景伺服器、（可選）鎖定 Spotify 自動更新，並從網路下載 Spicetify。這類行為**容易被防毒軟體誤判**。
> 1. **SmartScreen**：若出現「Windows 已保護您的電腦」，點「其他資訊」→「仍要執行」。
> 2. **Windows Defender**：若檔案被隔離，請將解壓縮後的資料夾加入排除清單。
> 3. 建議先閱讀原始碼（只有 3 支 `.bat` 和 2 支 `.js`），並核對下方的 SHA256。

---

## ✨ 功能

- **即時同步**：偵測目前的 Wallpaper Engine 桌布並顯示在 Spotify 背景。
- **自動回退**：沒有執行 Wallpaper Engine 時，改用 Windows 桌布。
- **支援影片與圖片**：影片桌布會用 FFmpeg 轉成 WebM 並快取，圖片直接顯示。
- **更換確認**：桌布變更時，Spotify 會詢問是否同步，也可以選擇保持原樣。
- **自動清理快取**：只保留最近 10 部轉檔影片，過期暫存檔會自動刪除。
- **透明化佈景**：保留 Spotify 介面與文字可讀性。
- **自動安裝與常駐**：缺少 Node.js、FFmpeg、Spicetify 時自動安裝；背景伺服器當機會自動重啟，開機自動啟動。
- **可選的更新鎖定**：安裝時可選擇是否阻擋 Spotify 自動更新（更新會清掉 Spicetify 設定）。

## 💻 系統需求

- Windows 10 / 11
- **Spotify 桌面版（官方 .exe）**，**不支援 Microsoft Store 版**
- 缺少 Node.js 或 FFmpeg 時需要 `winget`（Windows 10/11 通常內建）
- 選用：Wallpaper Engine（Steam 版）

## 🚀 安裝

1. 到 [Releases](../../releases) 下載最新的 ZIP。
2. **右鍵 ZIP → 解壓縮全部**（不要在 ZIP 內直接執行）。
3. 雙擊 `install.bat`，依提示操作。
4. 安裝過程會詢問是否鎖定 Spotify 自動更新（預設：是）。
5. 完成後開啟 Spotify 即可。

### 核對下載檔案（建議）

在 PowerShell 執行，並與 Release 頁面公布的 SHA256 比對（檔名請換成你下載的版本）：

```powershell
Get-FileHash .\Spotify_WESync_Plugin_Release_Fixed_v2.zip -Algorithm SHA256
```

## 🗑️ 解除安裝 / 更新

- **完整移除**：執行 `uninstall.bat`。會停止背景伺服器、刪除外掛檔案與快取、還原 Spicetify 設定，並解除更新鎖定。Node.js、FFmpeg、Spicetify 本身**不會**被移除。
- **只解除更新鎖定**：執行 `unlock_update.bat`。注意：Spotify 更新後可能需要重新執行 `install.bat`。
- **升級外掛**：下載新版 ZIP，重新執行 `install.bat` 即可覆蓋。

## 🔒 隱私與安全

- 背景伺服器只監聽 `127.0.0.1:8989`，**不對外網開放**。
- 桌布路徑掃描、檔案讀取與轉檔都在本機完成，**不會上傳任何桌布或個人資料**。
- 伺服器只接受來自 Spotify / Spicetify 網域的請求，並檢查 Host 標頭。
- 唯一的對外連線是安裝時下載相依套件（winget、Spicetify 官方安裝腳本）。

## ⚙️ 運作方式

| 元件 | 說明 |
|------|------|
| `WESyncServer.js` | Node.js 本機伺服器：讀取 WE 設定檔取得目前桌布、必要時以 FFmpeg 轉成 VP8/WebM 並快取，提供給 Spotify。 |
| `we-sync.js` | Spicetify 擴充功能：輪詢伺服器、顯示背景、處理更換提示。 |
| `user.css` / `color.ini` | 透明化佈景 `WESyncTheme`。 |
| `install.bat` / `uninstall.bat` / `unlock_update.bat` | 安裝、移除與解除更新鎖定。 |

安裝位置：`%APPDATA%\WESync\`（伺服器與記錄檔）、`%APPDATA%\spicetify\`（擴充與佈景）、`%TEMP%\spotify_we_cache\`（轉檔快取）。

## ⚠️ 已知限制

- 多螢幕時只同步**第一個螢幕**的桌布。
- 只支援影片（mp4、webm、avi、mkv、mov）與圖片（jpg、png、bmp、webp、gif）；Wallpaper Engine 的網頁類、應用程式類桌布不支援。
- 影片以軟體編碼轉成最高 1080p、30 fps，首次轉檔高畫質桌布可能需要數十秒。
- Spotify 更新後 Spicetify 可能失效，需重新執行 `install.bat`。

## ❓ 疑難排解

| 症狀 | 可能原因 | 解法 |
|------|----------|------|
| `install.bat` 視窗直接閃退 | 在 ZIP 內直接執行 | 右鍵 ZIP → 解壓縮全部，再執行 |
| `install.bat` 卡住超過 2 分鐘 | winget 等待同意條款或帳號登入 | 手動開 CMD 執行 `winget search node`，依提示按 `Y` |
| 安裝後提示找不到 Node.js / FFmpeg | 剛安裝完 PATH 尚未更新 | 重新開機後再執行 `install.bat` |
| 顯示「🔌 伺服器未啟動」且持續閃爍 | 8989 埠被占用 | CMD 執行 `netstat -ano \| findstr 8989` 找出程式並關閉，或重開機 |
| 顯示「🔌 伺服器未啟動」（不閃爍） | 背景伺服器沒在跑 | 查看 `%APPDATA%\WESync\server.log`，再手動執行 `%APPDATA%\WESync\WESyncServer_Loop.bat` |
| 顯示「⚠️ 瀏覽器阻擋自動播放」 | Spotify 內建瀏覽器限制 | 點擊 Spotify 畫面任意處 |
| 背景全黑、沒有圖 | 找不到 Wallpaper Engine 設定檔 | 確認 WE 已執行過一次；若仍失敗，改用 Windows 靜態桌布，並把 `server.log` 附在 Issue |
| 影片載入失敗／卡在轉檔 | FFmpeg 未正確安裝 | CMD 執行 `ffmpeg -version`；轉檔錯誤原因會記錄在 `server.log` |
| 重開機後背景沒自動啟動 | 啟動項 VBS 被防毒軟體攔截 | 檢查 `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\` 是否有 `StartWESyncServer.vbs` |
| Spotify 無法更新 | 安裝時選擇了鎖定更新 | 執行 `unlock_update.bat` |

## 🐞 回報問題

請在 [Issues](../../issues) 提供：Windows 版本、Spotify 版本、`%APPDATA%\WESync\server.log` 最後 50 行，以及問題發生的步驟。

## 🛠️ 技術

Node.js（本機伺服器）、FFmpeg（VP8/WebM 轉檔）、Spicetify（介面注入）。

---

*Created by bobo*
