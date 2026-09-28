import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

type Conditions = string | Record<string, string>
const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8')) as {
  exports: Record<string, Conditions>
  files: string[]
  publishConfig: { exports: Record<string, Conditions> }
}

/** 拿掉 development 條件；只剩 default 時攤平成字串，與 publishConfig 的寫法一致 */
function withoutDevelopment(conditions: Conditions): Conditions {
  if (typeof conditions === 'string') return conditions
  const rest = Object.fromEntries(Object.entries(conditions).filter(([k]) => k !== 'development'))
  return Object.keys(rest).length === 1 && 'default' in rest ? rest.default! : rest
}

describe('published exports (task#67)', () => {
  // development 條件指向 src/，但發佈的 tarball 只有 dist/：對外一律不能帶這個條件
  it('publishes the same entry points without the development condition', () => {
    const expected = Object.fromEntries(Object.entries(pkg.exports).map(([path, c]) => [path, withoutDevelopment(c)]))
    expect(pkg.publishConfig.exports).toEqual(expected)
    expect(JSON.stringify(pkg.publishConfig.exports)).not.toContain('./src/')
  })

  it('ships dist without the build cache', () => {
    expect(pkg.files).toEqual(['dist', '!dist/tsconfig.tsbuildinfo'])
  })
})
