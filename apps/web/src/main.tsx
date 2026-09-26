import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { detectLocale, setLocale } from './i18n'
import './index.css'

// 主題已由 index.html 的 inline script 套好，這裡不再重複——
// 重複套用會在 React 掛載那一刻造成第二次重繪
setLocale(detectLocale())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
