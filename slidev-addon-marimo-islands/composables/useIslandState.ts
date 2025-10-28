/**
 * Composable for tracking marimo islands readiness
 * Provides observable state and helper methods
 */

import { ref, readonly } from 'vue'

// Shared state across all instances
const isReady = ref(false)
const lastCheckTime = ref(0)

/**
 * Check if marimo islands custom element is registered
 *
 * @returns true if marimo-island custom element is defined
 */
export function checkIslandReady(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const ready = !!customElements.get('marimo-island')

  if (ready && !isReady.value) {
    isReady.value = true
    console.log('✓ Marimo islands custom element registered')
  }

  lastCheckTime.value = Date.now()
  return ready
}

/**
 * Wait for marimo islands to be ready
 *
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @returns Promise that resolves when ready or rejects on timeout
 */
export function waitForIslandReady(timeoutMs: number = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check immediately
    if (checkIslandReady()) {
      resolve()
      return
    }

    const startTime = Date.now()
    const interval = setInterval(() => {
      if (checkIslandReady()) {
        clearInterval(interval)
        resolve()
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval)
        reject(new Error(`Marimo islands not ready after ${timeoutMs}ms`))
      }
    }, 100)
  })
}

/**
 * Composable for managing island state
 *
 * @example
 * const { isReady, checkReady, waitUntilReady } = useIslandState()
 *
 * // In component
 * onMounted(async () => {
 *   await waitUntilReady()
 *   // Now safe to render islands
 * })
 */
export function useIslandState() {
  return {
    isReady: readonly(isReady),
    lastCheckTime: readonly(lastCheckTime),
    checkReady: checkIslandReady,
    waitUntilReady: waitForIslandReady
  }
}
