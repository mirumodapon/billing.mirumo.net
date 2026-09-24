import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  // 宣告檔由 tsc -b 產生（見 Global Constraints 的工具鏈表）
  dts: false,
  // 必須為 false：build script 是 `tsc -b && tsup`，清空會刪掉剛產生的 .d.ts
  clean: false,
  sourcemap: true,
  external: ['react', 'react-dom'],
  injectStyle: false,
})
