/**
 * Tracks the next available cell index for each marimo app
 *
 * Marimo's parseMarimoIslandApps() assigns sequential indices (0, 1, 2...)
 * to cells within each app during initialization. Since we're adding islands
 * dynamically after initialization, we need to manually track indices.
 *
 * The placeholder island gets index 0, so we start at 1 for dynamic islands.
 */

const cellIndices = new Map<string, number>()

export function useCellIndex() {
  /**
   * Get the next available cell index for an app
   *
   * @param appId - The marimo app ID
   * @returns The next sequential index to use
   */
  function getNextIndex(appId: string): number {
    const current = cellIndices.get(appId) || 1  // Start at 1 (placeholder is 0)
    cellIndices.set(appId, current + 1)
    return current
  }

  /**
   * Reset indices for an app (useful for testing)
   */
  function resetIndices(appId?: string) {
    if (appId) {
      cellIndices.delete(appId)
    } else {
      cellIndices.clear()
    }
  }

  return {
    getNextIndex,
    resetIndices
  }
}
