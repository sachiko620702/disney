# Disney Adventure 房號甲板定位器（GitHub Pages 靜態版）

這是一個純前端工具，可直接部署到 GitHub Pages。

## 檔案

- `index.html`：主網頁
- `adventure-room-map.json`：房號到 Deck / 座標的索引
- `assets/adventure-mini-deck-XX.svg`：mini deck 底圖

## 本機測試

建議用簡單 HTTP server 開啟，避免瀏覽器直接開 file:// 時阻擋 fetch JSON。

```bash
python3 -m http.server 8000
```

然後開啟：

```text
http://localhost:8000/
```

## GitHub Pages 部署

1. 建立 GitHub repo
2. 把本資料夾內的所有檔案上傳到 repo 根目錄
3. 到 Settings → Pages
4. Source 選 `Deploy from a branch`
5. Branch 選 `main`，資料夾選 `/root`
6. 儲存後等待 GitHub Pages 發布

## 查詢連結

支援 URL query，例如：

```text
?rooms=17096,12104,15110
```

