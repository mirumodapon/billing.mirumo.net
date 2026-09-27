import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test-setup.ts'],
    /*
     * 刻意不在 UTC 下跑。日期相關的程式在 UTC 機器上，把 ISO 字串當本地時間解析
     * 或忘了指定 timeZone 都測不出來——而 CI 正好通常是 UTC。apps/web 已經因此
     * 踩過一次。
     */
    env: { TZ: 'America/Los_Angeles' },
  },
})
