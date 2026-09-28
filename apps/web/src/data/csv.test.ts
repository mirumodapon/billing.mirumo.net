import { describe, expect, it } from 'vitest'
import { buildCsvFiles, csvCell, toCsv } from './csv'
import { defaultSettings } from './defaults'
import { makeExpense, makeTransfer, makeTrip } from './testing/fixtures'
import { APP_ID, SNAPSHOT_VERSION, type Snapshot } from './types'

const names = { category: (id: string) => `C:${id}`, paymentMethod: (id: string) => `P:${id}` }

function snap(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    schemaVersion: SNAPSHOT_VERSION,
    exportedAt: '2026-03-20T00:00:00.000Z',
    app: APP_ID,
    settings: defaultSettings(),
    trips: [makeTrip()],
    expenses: [makeExpense()],
    transfers: [makeTransfer()],
    ...overrides,
  }
}

/** 去掉 BOM、以 CRLF 切行 */
const lines = (csv: string) => csv.replace(/^\uFEFF/, '').split('\r\n').filter(Boolean)

describe('csvCell', () => {
  it('leaves plain text alone', () => {
    expect(csvCell('一蘭拉麵')).toBe('一蘭拉麵')
  })

  it('quotes cells that contain commas, quotes or line breaks, doubling the quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
  })

  /*
   * CSV 公式注入：說明欄填 =HYPERLINK(...) 的話，使用者在試算表開檔時會被執行。
   * 加一個單引號前綴，試算表就把它當純文字。
   */
  it('defuses text that a spreadsheet would run as a formula', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`)
    expect(csvCell('+1234')).toBe("'+1234")
    expect(csvCell('-cmd')).toBe("'-cmd")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  // 數字不是使用者輸入的文字，負數不能被當成公式而加上前綴
  it('writes numbers as plain numbers, negatives included', () => {
    expect(csvCell(-300)).toBe('-300')
    expect(csvCell(0.21)).toBe('0.21')
  })

  it('writes an empty cell for a non-finite number rather than NaN', () => {
    expect(csvCell(Number.NaN)).toBe('')
  })
})

describe('toCsv', () => {
  // 沒有 BOM，Excel 會把 UTF-8 當本機編碼開，中文全變亂碼
  it('starts with a UTF-8 BOM so spreadsheets read the Chinese correctly', () => {
    expect(toCsv(['a'], [['餐飲']]).startsWith('\uFEFF')).toBe(true)
  })

  it('uses CRLF line endings', () => {
    expect(toCsv(['a', 'b'], [[1, 2]])).toBe('\uFEFFa,b\r\n1,2\r\n')
  })
})

describe('buildCsvFiles', () => {
  it('produces the three files the spec lists', () => {
    expect(Object.keys(buildCsvFiles(snap(), names)).sort()).toEqual(['expenses.csv', 'items.csv', 'transfers.csv'])
  })

  it('writes names instead of ids', () => {
    const [, row] = lines(buildCsvFiles(snap(), names)['expenses.csv']!)
    expect(row).toContain('東京五日')
    expect(row).toContain('C:cat.food')
    expect(row).toContain('P:pay.cash')
    expect(row).toContain('阿明 / 小美 / 大熊')
  })

  // 本位幣金額走 core 的換算：3000 JPY × 0.21 = 630 TWD（TWD 零小數）
  it('adds the amount in the trip’s base currency', () => {
    const [header, row] = lines(buildCsvFiles(snap(), names)['expenses.csv']!)
    const cols = header!.split(',')
    const cells = row!.split(',')
    expect(cells[cols.indexOf('base_amount')]).toBe('630')
    expect(cells[cols.indexOf('base_currency')]).toBe('TWD')
  })

  // CSV 是「現在的帳」，墓碑不列
  it('leaves out deleted records', () => {
    const files = buildCsvFiles(
      snap({ expenses: [makeExpense({ deletedAt: '2026-03-18T00:00:00.000Z' })], transfers: [makeTransfer({ deletedAt: '2026-03-18T00:00:00.000Z' })] }),
      names,
    )
    expect(lines(files['expenses.csv']!)).toHaveLength(1)
    expect(lines(files['transfers.csv']!)).toHaveLength(1)
  })

  it('lists line items one per row, naming unnamed items by position', () => {
    const itemised = makeExpense({
      split: { mode: 'items', overflowRule: 'even', items: [
        { id: 'i1', name: '豚骨拉麵', amount: 1200, participants: ['a'] },
        { id: 'i2', name: '', amount: 480, participants: ['a', 'b'] },
      ] },
    })
    const rows = lines(buildCsvFiles(snap({ expenses: [itemised] }), names)['items.csv']!)
    expect(rows).toHaveLength(3)
    expect(rows[1]).toContain('豚骨拉麵')
    expect(rows[2]).toContain('#2')
    expect(rows[2]).toContain('阿明 / 小美')
  })

  // task#108：草稿照列出，多一欄標示，分析時可以篩掉
  it('marks drafts in their own column instead of leaving them out', () => {
    const files = buildCsvFiles(snap({ expenses: [makeExpense({ draft: true })], transfers: [makeTransfer({ draft: true })] }), names)
    for (const file of [files['expenses.csv']!, files['transfers.csv']!]) {
      const [header, row] = lines(file)
      expect(row!.split(',')[header!.split(',').indexOf('draft')]).toBe('yes')
    }
    const [header, row] = lines(buildCsvFiles(snap(), names)['expenses.csv']!)
    expect(row!.split(',')[header!.split(',').indexOf('draft')]).toBe('')
  })

  // task#117：名稱解析拿得到那一筆所屬的旅程，旅程專用的類別與付款方式才解得出名字
  it('passes each record’s trip to the name lookups', () => {
    const seen: (string | undefined)[] = []
    buildCsvFiles(snap(), { category: (id, trip) => (seen.push(trip?.id), id), paymentMethod: (id) => id })
    expect(seen).toEqual(['t1'])
  })

  it('writes transfers with names on both ends', () => {
    const [, row] = lines(buildCsvFiles(snap(), names)['transfers.csv']!)
    expect(row).toContain('小美,阿明')
  })
})
