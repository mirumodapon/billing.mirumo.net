# Travel Split

旅行分帳的 PWA：記下旅途中每一筆花費、誰付的、誰要分，最後算出誰該給誰多少。
資料只存在自己的裝置上，不需要帳號，也可以離線使用。

## 功能

- **旅程**：成員、日期、本位幣、預算；每趟旅程有自己一份類別與付款方式清單（建立時從設定複製）
- **記帳**：內建計算機鍵盤；多幣別與匯率表（可線上取得或手動輸入）；還沒填完的可以先存成草稿
- **分攤**：均分、指定金額，或依明細品項分攤（服務費可按比例或平均攤回）
- **預存卡**：例如交通卡，記錄儲值與餘額，用卡付的只扣餘額
- **收據照片**：拍照或從相簿選，存在裝置上
- **統計**：類別占比、每日花費與每日預算，可以切換全團或任一成員的角度
- **結算**：建議盡量少筆的轉帳（最多成員數減一筆），並記錄已經付清的款項
- **備份**：匯出 JSON（可含照片，可匯入還原）或 CSV（給試算表分析）
- 繁體中文與英文介面；Catppuccin 與 Tokyo Night 配色，深淺色自動切換

## 開發

需要 Node.js 24 以上與 pnpm。

```sh
pnpm install
pnpm dev          # 開發伺服器
pnpm test         # 所有套件的測試
pnpm typecheck
pnpm lint
pnpm build        # 建置到 apps/web/dist
pnpm --filter @billing/ui storybook   # 元件庫
```

## 專案結構

pnpm monorepo：

| 路徑 | 內容 |
| --- | --- |
| `packages/core` | 分帳、匯率換算、結算、統計等純計算，不依賴瀏覽器 |
| `packages/ui` | 設計系統與 React 元件（附 Storybook） |
| `apps/web` | 應用本體：React 19、zustand、IndexedDB、vite-plugin-pwa |

## 部署

推到 `main` 且 CI 通過後，GitHub Actions 會建置並部署到 GitHub Pages（`.github/workflows/deploy.yml`）。
第一次使用前，到 repo 的 Settings → Pages 把 Source 設成 **GitHub Actions**。

## 授權

[MIT](LICENSE)
