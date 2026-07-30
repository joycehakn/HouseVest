# HouseVest 2.0 Starter

HouseVest 是房地產投資決策儀表板。本版本先完成可部署的 React + TypeScript 基礎架構，以及 Dashboard、CAGR、槓桿 IRR、淨資產與成交價情境。

## 本機執行

```bash
npm install
npm run dev
```

## 部署到目前的 GitHub Pages

此專案已將 Vite base 設為 `/house-investment-app/`，並附上 GitHub Actions workflow。

1. 將壓縮檔內容放到 `joycehakn/house-investment-app` 儲存庫根目錄。
2. GitHub → Settings → Pages。
3. Source 選擇 `GitHub Actions`。
4. Commit 到 `main` 後，Actions 會自動建置並部署。

## 第一階段已完成

- HouseVest 品牌與響應式版面
- Dashboard
- 預估市值、貸款餘額、淨值、出售實拿
- 房屋 CAGR
- 槓桿 IRR（目前為簡化版年化現金報酬，下一階段改為逐月 XIRR）
- 稅後獲利
- 成交價滑桿
- 淨資產曲線
- GitHub Pages 自動部署

## 下一階段

- 將 IRR 改為逐月現金流 XIRR
- 完整設定頁
- 多種出售年份與稅制情境
- ETF 比較
- 資料儲存與多間房屋
