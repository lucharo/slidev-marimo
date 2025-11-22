/**
 * Test setup for slidev-marimo-islands
 * Mocks DOM environment and provides global test utilities
 */

import { vi, afterEach } from 'vitest'

// Mock Vue composition API
vi.mock('vue', () => ({
  ref: (initialValue) => ({ value: initialValue }),
  computed: (fn) => ({ value: fn() }),
  onMounted: (fn) => fn(),
  onUnmounted: (fn) => fn(),
  getCurrentInstance: () => ({ uid: 'test-123' })
}))

// Mock DOM
Object.defineProperty(global, 'document', {
  value: {
    createElement: vi.fn(() => ({
      hidden: false,
      setAttribute: vi.fn(),
      appendChild: vi.fn(),
      querySelector: vi.fn(() => null),
      head: {
        appendChild: vi.fn()
      }
    })),
  writable: true,
  configurable: true
})

// Mock window
Object.defineProperty(global, 'window', {
  value: {
    customElements: {
      get: vi.fn()
    },
    location: {
      href: 'http://localhost:3000'
    },
    setTimeout: vi.fn()
  },
  writable: true,
  configurable: true
})

// customElements is already mocked in the window object above

// Mock debugMarimo utility
vi.mock('../utils/debugMarimo', () => ({
  // Side effect: adds window.debugMarimo
}), { virtual: true })

// Global test utilities
Object.defineProperty(global, 'debugMarimo', {
  value: {
    log: vi.fn(),
    inspect: vi.fn(),
    clear: vi.fn()
  },
  writable: true,
  configurable: true
})

// Add custom matchers for DOM testing
expect.extend({
  toBeDOMElement: (received) => {
    return received !== null && typeof received === 'object' &&
           typeof received.tagName === 'string'
  },
  toHaveAttribute: (attribute) => (element, attrName) => {
    return element.getAttribute && element.getAttribute(attrName) === attribute
  }
})

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
})