/**
 * 新成員、新類別依這個順序拿身分色（task#81）。
 *
 * 原本是依序指派 accent1、accent2……但槽位順序裡相鄰的常常正是最像的那一對
 * （teal 與 sky 相鄰，Macchiato 下色差只有 3.6，並排分不出來的門檻是 15）。
 *
 * 這個順序是貪婪地算出來的：每一步挑「與已經指派出去的所有顏色，最小色差最大」
 * 的那一格，而色差取八個主題裡最差的值——同一個人的槽位在每個主題都一樣。
 * 效果：三人團的最小色差從 6.1 拉到 12.7；紅綠色弱下從 1.0 拉到 5.9。
 *
 * 但超過兩人之後，任何順序都到不了 15，這是 12 個色票本身的限制。所以顏色
 * 永遠不能是唯一的辨識方式，名字或圖示必須一起出現。
 *
 * accentOrder.test.ts 會從產生出來的主題檔重算一次；色票改了而這裡沒跟著改就會紅。
 */
export const ACCENT_ORDER = [
  'accent4',
  'accent10',
  'accent7',
  'accent3',
  'accent11',
  'accent9',
  'accent8',
  'accent6',
  'accent2',
  'accent12',
  'accent1',
  'accent5',
] as const

export type AccentSlot = (typeof ACCENT_ORDER)[number]

/**
 * 下一個該用的槽位：依 ACCENT_ORDER 挑第一個還沒人用的。
 *
 * 十二格都用完之後，挑使用次數最少的那格（平手取順序較前的），而不是從頭循環——
 * 從頭循環會讓第 13 位與第 1 位撞色，即使那時有別的顏色才被用過一次。
 */
export function pickAccent(used: readonly string[]): AccentSlot {
  const counts = new Map<string, number>()
  for (const key of used) counts.set(key, (counts.get(key) ?? 0) + 1)
  let best: AccentSlot = ACCENT_ORDER[0]
  let bestCount = Infinity
  for (const slot of ACCENT_ORDER) {
    const count = counts.get(slot) ?? 0
    if (count < bestCount) {
      best = slot
      bestCount = count
    }
  }
  return best
}
