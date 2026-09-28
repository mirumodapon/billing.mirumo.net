import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    /*
     * 刻意不在 UTC 下跑。日期相關的防護（parseDate 補 Z、格式化指定 timeZone）
     * 在 UTC 機器上全部測不出來——拿掉它們測試照樣全綠，而 CI 正好通常是 UTC。
     * 固定一個負偏移時區，讓「忘記指定 timeZone」當場現形。
     * 反方向（把 ISO 當本地時間解析）由 parseDate 自己的測試涵蓋，那條與時區無關。
     */
    env: { TZ: 'America/Los_Angeles' },
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
    // 多數是整個 app 掛起來、點十幾下的整合測試；整個 monorepo 平行跑時 5 秒不夠
    testTimeout: 15_000,
  },
})
