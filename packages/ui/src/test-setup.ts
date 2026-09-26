import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// vitest.config.ts doesn't set test.globals, so @testing-library/react's own
// afterEach-based auto-cleanup never triggers — without this, DOM from one
// test leaks into the next and getByRole starts matching multiple elements.
afterEach(() => {
  cleanup()
})
