import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// vitest.config.ts doesn't set test.globals, so @testing-library/react's own
// afterEach-based auto-cleanup never triggers — without this, DOM from one
// test leaks into the next and getByRole starts matching multiple elements.
afterEach(() => {
  cleanup()
})

// jsdom does no layout, so the real offsetParent getter always returns null —
// even for a plain visible <button>. Code that uses offsetParent as a
// "is this actually rendered" check (useFocusTrap's focusableWithin, and any
// future overlay code that does the same) would see every element as hidden
// and silently do nothing. This approximates the real getter closely enough
// for tests: null only for elements removed from the document or explicitly
// display:none.
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  configurable: true,
  get(this: HTMLElement) {
    if (!this.isConnected) return null
    if (this.style.display === 'none') return null
    return this.parentElement
  },
})
