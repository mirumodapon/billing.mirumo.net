import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { createAppStores } from './app/createAppStores'
import { readSession } from './data/session'
import { detectLocale, setLocale } from './i18n'
import { initialHash } from './session/coldStart'
import './index.css'

// 主題已由 index.html 的 inline script 套好，這裡不再重複——
// 重複套用會在 React 掛載那一刻造成第二次重繪

// 設定還沒從 IndexedDB 讀回來之前的暫定語系，settingsStore.load() 會覆寫它。
// 不設的話英文使用者會在載入的那一瞬間看到中文
setLocale(detectLocale())

// 冷啟動第 1 步（規格 7.9）：同步讀 session 決定初始路由，第一次繪製就是正確的頁面。
// 用 replaceState 而不是設 location.hash：後者會多一筆瀏覽紀錄，返回鍵會退到空白首頁
const hash = initialHash(location.hash, readSession())
if (hash) history.replaceState(null, '', `#${hash}`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App stores={createAppStores()} />
  </StrictMode>,
)
