/**
 * Cell ID Generator
 *
 * Generates 4-character alphanumeric IDs matching marimo's cell ID format.
 * Marimo expects cell IDs like "MJUe", "Xk3P", etc.
 *
 * Features:
 * - Generates unique 4-char alphanumeric IDs
 * - Tracks used IDs to prevent collisions
 * - Provides release and reset functions for cleanup
 */

// Character set for ID generation (alphanumeric)
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const ID_LENGTH = 4;

// Track used IDs to prevent collisions
const usedIds = new Set<string>();

/**
 * Generate a random 4-character alphanumeric ID
 */
function generateRandomId(): string {
  let id = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    id += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return id;
}

/**
 * Generate a unique cell ID that hasn't been used before.
 * The ID format matches marimo's expected 4-char alphanumeric format.
 *
 * @returns A unique 4-character alphanumeric cell ID
 */
export function generateCellId(): string {
  let id = generateRandomId();

  // Keep generating until we get a unique one
  // With 62^4 = ~14.7M possibilities, collisions are rare
  let attempts = 0;
  const maxAttempts = 100;

  while (usedIds.has(id) && attempts < maxAttempts) {
    id = generateRandomId();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    console.warn("⚠️ Cell ID generator: high collision rate, consider resetting");
  }

  usedIds.add(id);
  return id;
}

/**
 * Release a cell ID so it can be reused.
 * Called when a cell is unregistered/unmounted.
 *
 * @param id - The cell ID to release
 */
export function releaseCellId(id: string): void {
  usedIds.delete(id);
}

/**
 * Reset all tracked cell IDs.
 * Useful for HMR or full page reloads.
 */
export function resetCellIds(): void {
  usedIds.clear();
}

/**
 * Get the count of currently used cell IDs.
 * Useful for debugging.
 */
export function getUsedIdCount(): number {
  return usedIds.size;
}

/**
 * Check if a specific ID is currently in use.
 * Useful for debugging.
 */
export function isIdUsed(id: string): boolean {
  return usedIds.has(id);
}
