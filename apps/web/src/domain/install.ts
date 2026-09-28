import { useSyncExternalStore } from 'react'

/**
 * 安裝到主畫面（規格 7.4）。iOS Safari 會清掉 7 天沒開的網站資料，加到主畫面的 PWA 不受影響，
 * 所以建了旅程之後要引導使用者安裝：Android/Chrome 用 beforeinstallprompt 叫出系統的安裝提示，
 * iOS 沒有這個 API，只能用圖示教「分享 → 加入主畫面」。
 */

/** Chrome 的 beforeinstallprompt 事件（標準型別裡沒有） */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const INSTALL_DISMISSED_KEY = 'bi-install-dismissed'

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/**
 * 開機時就要接住：瀏覽器很早就發出 beforeinstallprompt，而且只發一次。
 * 攔下預設的迷你資訊列，留著等使用者在我們的卡片上按「安裝」。
 */
export function captureInstallPrompt(target: Window = window): void {
  target.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as InstallPromptEvent
    notify()
  })
  // 裝好了就不必再提示
  target.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 可以叫出系統安裝提示時回傳 prompt 函式，否則 null */
export function useInstallPrompt(): (() => Promise<void>) | null {
  const event = useSyncExternalStore(subscribe, () => deferred)
  if (!event) return null
  return async () => {
    await event.prompt()
    await event.userChoice
    deferred = null
    notify()
  }
}

/** 已經是從主畫面開的（standalone），就不用再教 */
export function isStandalone(win: Window = window): boolean {
  return win.matchMedia?.('(display-mode: standalone)').matches === true || (win.navigator as { standalone?: boolean }).standalone === true
}

/** iPhone / iPad 的 Safari：沒有安裝 API，要用圖示教學 */
export function isIos(nav: Navigator = navigator): boolean {
  // iPadOS 13 起自稱 Mac，靠觸控點數分辨
  return /iPhone|iPad|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
}

export function installDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissInstall(): void {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
  } catch {
    // 記不住只是下次還會出現
  }
}

/** 測試用：模擬瀏覽器發出 beforeinstallprompt */
export function setDeferredPromptForTest(event: InstallPromptEvent | null): void {
  deferred = event
  notify()
}
