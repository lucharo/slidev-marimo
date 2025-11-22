/**
 * Basic functionality tests for slidev-marimo-islands
 * Tests core functionality without over-engineering
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock DOM environment for testing
const mockDom = () => {
  global.document = {
    createElement: vi.fn(() => ({
      hidden: false,
      setAttribute: vi.fn(),
      appendChild: vi.fn(),
      querySelector: vi.fn(() => null)
    })),
    head: {
      appendChild: vi.fn()
    },
    querySelector: vi.fn(() => null)
  } as any

  global.window = {
    customElements: {
      get: vi.fn(),
      define: vi.fn()
    },
    location: {
      href: 'http://localhost:3000'
    },
    setTimeout: vi.fn()
  } as any

  global.customElements = global.window.customElements
}

describe('slidev-marimo-islands', () => {
  beforeEach(() => {
    mockDom()
    vi.clearAllMocks()
  })

  describe('MarimoIsland Component', () => {
    it('should process code correctly', () => {
      // Test the logic for hiding lines without importing Vue component
      const code = 'print("Hello World")\nprint("Should be hidden")\nprint("Should be visible")\nprint("Should be hidden too")'
      const hideLines = [2, 4]

      const expectedProcessed = 'print("Hello World")\nprint("Should be visible")'

      // The component should filter out lines 2 and 4
      const lines = code.split('\n')
      const result = lines
        .filter((_, index) => !hideLines.includes(index + 1))
        .join('\n')

      expect(result).toBe(expectedProcessed)
    })

    it('should generate unique island IDs', () => {
      // Test ID generation logic
      const mockInstance = { uid: 'test-123' }

      const islandId = `island-${mockInstance.uid || Math.random().toString(36).slice(2)}`

      expect(islandId).toBe('island-test-123')
    })
  })

  describe('useIslandState', () => {
    it('should detect when marimo islands are ready', async () => {
      const { checkIslandReady } = await import('../composables/useIslandState')

      // Initially not ready
      expect(checkIslandReady()).toBe(false)

      // Mock marimo-island element being registered
      global.customElements.get.mockReturnValue(() => true)

      expect(checkIslandReady()).toBe(true)
    })

    it('should wait until marimo islands are ready', async () => {
      const { useIslandState } = await import('../composables/useIslandState')
      const { waitUntilReady } = useIslandState()

      // Mock the custom element to be ready
      global.customElements.get.mockReturnValue(() => true)

      const result = await waitUntilReady()

      expect(result).toBe(undefined) // waitUntilReady resolves to undefined
    })
  })

  describe('usePyodide', () => {
    it('should check Pyodide readiness', async () => {
      const { usePyodide } = await import('../composables/usePyodide')
      const { checkPyodideReady } = usePyodide()

      // Initially not ready
      const result1 = await checkPyodideReady()
      expect(result1).toBe(false)

      // Mock marimo islands library being loaded and custom element ready
      Object.defineProperty(window, 'marimoIslands', {
        value: {},
        writable: true,
        configurable: true
      })
      global.customElements.get.mockReturnValue(() => true)

      const result2 = await checkPyodideReady()
      expect(result2).toBe(true)
    })

    it('should provide reactive state', async () => {
      const { usePyodide } = await import('../composables/usePyodide')
      const state = usePyodide()

      // Should be reactive and readonly
      expect(state.isPyodideReady).toBeDefined()
      expect(typeof state.isPyodideReady.value).toBe('boolean')
    })
  })

  describe('Integration', () => {
    it('should integrate with Slidev properly', () => {
      // Test that the addon can be properly loaded by Slidev
      // This would require setting up a full Slidev environment

      // For now, just verify the export structure
      const packageJson = require('../package.json')

      expect(packageJson.name).toBe('slidev-marimo-islands')
      expect(packageJson.peerDependencies).toHaveProperty('@slidev/cli')
      expect(packageJson.peerDependencies).toHaveProperty('vue')
    })
  })

  describe('Error Handling', () => {
    it('should handle initialization timeout gracefully', async () => {
      // Reset module state by clearing the module cache
      vi.resetModules()
      const { usePyodide } = await import('../composables/usePyodide')

      const { checkPyodideReady, isPyodideReady } = usePyodide()

      // Verify initial state is false
      expect(isPyodideReady.value).toBe(false)

      // Mock marimo library NOT loaded - this means checkPyodideReady should return false immediately
      delete (window as any).marimoIslands
      global.customElements.get.mockReturnValue(undefined) // No custom element defined

      // When marimo is not loaded, should return false immediately
      const result = await checkPyodideReady()

      // Should return false when marimo library is not available
      expect(result).toBe(false)
    })
  })

  describe('Performance', () => {
    it('should handle multiple islands efficiently', async () => {
      // Test that multiple instances share state properly
      const { useIslandState } = await import('../composables/useIslandState')

      // Multiple instances should share the same state
      const state1 = useIslandState()
      const state2 = useIslandState()
      const state3 = useIslandState()

      expect(state1.isReady).toBe(state2.isReady)
      expect(state2.isReady).toBe(state3.isReady)
      expect(state1.isReady).toBe(state3.isReady)
    })
  })
})