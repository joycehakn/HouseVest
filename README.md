# HouseVest 2.0 Starter

HouseVest 是房地產投資決策儀表板。本版本先完成可部署的 React + TypeScript 基礎架構，以及 Dashboard、CAGR、槓桿 IRR、淨資產與成交價情境。

## 本機執行

```bash
npm install
npm run dev
```

## HouseVest Engine v0.1

第一版引擎位於 `src/engine`，用純 TypeScript 描述：

- `PortfolioState`：現金、資產與負債
- `EffectEngine`：套用現金、資產與負債變化
- `SellProperty`：出售房產、清償房貸並增加現金
- `BuyProperty`：支付自備款、加入房產與房貸
- `InvestETF`：減少現金並加入 ETF 資產
- `ActionEngine`：依序解析 Action、套用 Effects、回傳新 State

執行測試：

```bash
npm test
```

最小使用方式：

```ts
import {
  SellProperty,
  executeAction,
  type PortfolioState,
} from "./src/engine";

const initialState: PortfolioState = {
  cash: 2_000_000,
  assets: [
    {
      id: "property-a",
      type: "PROPERTY",
      value: 15_000_000,
      costBasis: 12_000_000,
    },
  ],
  liabilities: [
    {
      id: "mortgage-a",
      type: "MORTGAGE",
      propertyId: "property-a",
      balance: 8_000_000,
      annualInterestRate: 0.025,
      termYears: 30,
    },
  ],
};

const result = executeAction(
  initialState,
  new SellProperty({
    propertyId: "property-a",
    salePrice: 16_000_000,
  }),
);

console.log(result.nextState);
```

## 部署到目前的 GitHub Pages

此專案已將 Vite base 設為 `/house-investment-app/`，並附上 GitHub Actions workflow。

1. 將壓縮檔內容放到 `joycehakn/house-investment-app` 儲存庫根目錄。
2. GitHub → Settings → Pages。
3. Source 選擇 `GitHub Actions`。
4. Commit 到 `main` 後，Actions 會自動建置並部署。

## 免費本機文件辨識

房屋基本資料可從一批最多 20 張 JPEG、PNG 或 WebP 照片擷取：

1. 瀏覽器第一次使用時下載免費的 Tesseract OCR 程式與繁體中文、英文辨識資料。
2. 照片只在使用者的電腦或手機瀏覽器中逐張處理，不會上傳房屋文件。
3. 本機規則從辨識文字中擷取成交日期、價格、稅費與貸款欄位，並保留來源照片。
4. 不同照片出現不同數字時會標示衝突。
5. 使用者逐項校準、套用到表單，再按一次「儲存並套用」才會更新房屋資料。

此功能不需要 API key，也沒有按次辨識費用。第一次下載辨識元件時仍需網路；本機 OCR 的準確度與速度會受照片清晰度及裝置效能影響。

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
