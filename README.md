# Disney Adventure 房號 Full Deck 高亮定位器

這是 GitHub Pages 可直接部署的純前端版本。

## 功能

- 輸入多個房號
- 自動依 Deck 分組
- 載入完整 `DCL_DeckPlans_Adventure_Flat_DeckXX.svg`
- 保留所有房間匡線
- 直接高亮 `room-房號` 房間框
- 同步高亮 `number-房號` 房號文字
- 支援 `?rooms=17096,12259,15110` 分享查詢

## 部署到 GitHub Pages

1. 將本 ZIP 解壓後所有檔案放到 repo 根目錄。
2. 到 GitHub repo `Settings → Pages`。
3. Source 選 `Deploy from a branch`。
4. Branch 選 `main`，Folder 選 `/root`。
5. 儲存後等待 Pages 發布。

## 本機測試

```bash
python3 -m http.server 8000
```

然後開啟：

```text
http://localhost:8000/
```

## 檔案結構

```text
index.html
styles.css
app.js
adventure-room-map.json
assets/
  flat/
    DCL_DeckPlans_Adventure_Flat_Deck09.svg
    DCL_DeckPlans_Adventure_Flat_Deck10.svg
    DCL_DeckPlans_Adventure_Flat_Deck11.svg
    DCL_DeckPlans_Adventure_Flat_Deck12.svg
    DCL_DeckPlans_Adventure_Flat_Deck13.svg
    DCL_DeckPlans_Adventure_Flat_Deck15.svg
    DCL_DeckPlans_Adventure_Flat_Deck16.svg
    DCL_DeckPlans_Adventure_Flat_Deck17.svg
    DCL_DeckPlans_Adventure_Flat_Deck18.svg
  mini/
    adventure-mini-deck-09.svg
    ...
```

目前資料筆數：2111 筆房號。
