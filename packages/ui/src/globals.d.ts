// CSS 以副作用方式匯入（tsup 會抽成 dist/index.css），
// 這裡只需要讓型別系統知道該模組存在，不產生任何值。
declare module '*.css'
