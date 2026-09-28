// vite-plugin-pwa 的虛擬模組型別（virtual:pwa-register/react）。
// 根目錄的 tsconfig.tests.json 也會檢查 src，那裡沒有載入這組型別，所以在這裡引用
/// <reference types="vite-plugin-pwa/react" />

// 建置時由 appDefines() 寫死的版本與日期（設定頁「關於」）
declare const __APP_VERSION__: string
declare const __BUILD_DATE__: string
