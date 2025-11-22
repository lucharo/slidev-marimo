/**
 * Slidev Marimo Islands Addon
 *
 * Embed interactive marimo notebooks in your presentations using Pyodide/WASM.
 * No server required - fully self-contained presentations.
 *
 * @example
 * ```vue
 * <template>
 *   <MarimoIsland
 *     :code="import marimo as mo
 * import polars as pl
 *
 * df = pl.DataFrame({
 *     'name': ['Alice', 'Bob', 'Charlie'],
 *     'score': [95, 87, 91]
 * })
 * df"
 *   />
 * </template>
 * ```
 */

// Main addon setup - automatically loaded by Slidev
export { default } from './setup/main'

// Main component for embedding marimo code
export { default as MarimoIsland } from './components/MarimoIsland.vue'

// Composables for advanced usage
export { useIslandState } from './composables/useIslandState'
export { usePyodide } from './composables/usePyodide'
export { useCellIndex } from './composables/useCellIndex'

// Re-export utility functions for advanced usage
export { initializeMarimo, getIslandCount } from './setup/island-registry'

// Export debug utility for development
export { default as debugMarimo } from './utils/debugMarimo'

// Types
export type { IslandState } from './composables/useIslandState'
export type { PyodideState } from './composables/usePyodide'