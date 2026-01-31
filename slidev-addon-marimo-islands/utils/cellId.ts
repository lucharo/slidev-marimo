/**
 * Cell ID Generator
 *
 * Uses pre-computed cell IDs that match marimo's seeded random generator (seed 42).
 * Marimo uses Python's random.Random(42) which produces Mersenne Twister output.
 *
 * The first 30 cell IDs from marimo's generator are pre-computed here to ensure
 * our cell IDs match what marimo's JavaScript expects internally. This is critical
 * for widget rendering - if cell IDs don't match, marimo can't find the correct
 * DOM elements for output.
 *
 * Features:
 * - Deterministic IDs matching marimo's seeded random (seed 42)
 * - Sequential allocation ensures consistent ordering
 * - Supports up to 30 cells per presentation
 */

// Pre-computed marimo cell IDs from Python's random.Random(42)
// Generated with: marimo/_ast/cell_id.py CellIdRegistry.create()
const MARIMO_CELL_IDS = [
  'Hbol', 'MJUe', 'vblA', 'bkHC', 'lEQa', 'PKri', 'Xref', 'SFPL', 'BYtC', 'RGSE',
  'Kclp', 'emfo', 'Hstk', 'nWHF', 'iLit', 'ZHCJ', 'ROlb', 'qnkX', 'TqIu', 'Vxnm',
  'DnEU', 'ulZA', 'ecfG', 'Pvdt', 'ZBYS', 'aLJB', 'nHfw', 'xXTn', 'AjVT', 'pHFh'
] as const;

// Track which index we're at in the sequence
let nextIdIndex = 0;

// Track used IDs for validation and debugging
const usedIds = new Set<string>();

/**
 * Generate the next cell ID in marimo's deterministic sequence.
 * IDs are allocated sequentially to match marimo's internal ordering.
 *
 * @returns A 4-character cell ID matching marimo's expected format
 * @throws Error if more than 30 cells are requested
 */
export function generateCellId(): string {
  if (nextIdIndex >= MARIMO_CELL_IDS.length) {
    throw new Error(
      `Maximum ${MARIMO_CELL_IDS.length} marimo cells supported per presentation. ` +
      `Consider splitting into multiple slides or reducing cell count.`
    );
  }

  const id = MARIMO_CELL_IDS[nextIdIndex];
  nextIdIndex++;
  usedIds.add(id);

  console.log(`🆔 Cell ID allocated: ${id} (index ${nextIdIndex - 1})`);
  return id;
}

/**
 * Release a cell ID so it can be reused.
 * Note: With deterministic IDs, released IDs are NOT reused to maintain ordering.
 * This function is kept for API compatibility.
 *
 * @param id - The cell ID to release
 */
export function releaseCellId(id: string): void {
  usedIds.delete(id);
  // Note: We don't decrement nextIdIndex to maintain deterministic ordering
  // across component mount/unmount cycles
}

/**
 * Reset the cell ID sequence.
 * Must be called on full page reload or HMR to restart from index 0.
 */
export function resetCellIds(): void {
  nextIdIndex = 0;
  usedIds.clear();
  console.log('🔄 Cell ID sequence reset');
}

/**
 * Get the count of currently used cell IDs.
 * Useful for debugging.
 */
export function getUsedIdCount(): number {
  return usedIds.size;
}

/**
 * Get the next index that will be allocated.
 * Useful for debugging.
 */
export function getNextIdIndex(): number {
  return nextIdIndex;
}

/**
 * Check if a specific ID is currently in use.
 * Useful for debugging.
 */
export function isIdUsed(id: string): boolean {
  return usedIds.has(id);
}

/**
 * Get all pre-computed cell IDs (for debugging).
 */
export function getAllMarimoIds(): readonly string[] {
  return MARIMO_CELL_IDS;
}
