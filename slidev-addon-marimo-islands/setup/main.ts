/**
 * Slidev Setup for Marimo Islands
 *
 * This file is automatically loaded by Slidev and handles:
 * 1. Vue app configuration for marimo custom elements
 * 2. Providing kernel and registry singletons to the app
 * 3. Initializing marimo after all cells are registered
 *
 * Architecture:
 * - Kernel and registry are provided as Vue injectables
 * - Components mount and register cells in the registry
 * - After a stability period, we create island elements and load marimo
 * - The marimo script parses existing islands on load
 */

import { installMarimoKernel } from "../composables/useMarimoKernel";
import { installCellRegistry, type CellRegistry } from "../composables/useCellRegistry";
import {
  initializeMarimoIslands,
  loadMarimoResources,
  createSingleIsland,
  isMarimoInitialized,
} from "./island-manager";
import type { MarimoKernel } from "../composables/useMarimoKernel";

export default ({ app }) => {
  // Register marimo custom elements so Vue doesn't try to compile them
  const originalIsCustomElement = app.config.compilerOptions.isCustomElement;

  app.config.compilerOptions.isCustomElement = (tag: string) => {
    if (tag.startsWith("marimo-")) {
      return true;
    }
    return originalIsCustomElement ? originalIsCustomElement(tag) : false;
  };

  // Install kernel and registry singletons into Vue app
  const kernel = installMarimoKernel(app);
  const registry = installCellRegistry(app);

  // Only run initialization on client side
  if (typeof window !== "undefined") {
    // Load CSS resources immediately (doesn't need to wait for cells)
    loadMarimoResources();

    // Wait for cells to register, then initialize marimo
    setupCellStabilityCheck(kernel, registry);

    // Watch for late-arriving cells (e.g., navigating to a new slide)
    setupLateArrivalWatcher(kernel, registry);
  }
};

/**
 * Wait for cell count to stabilize before initializing marimo.
 *
 * Slidev preloads adjacent slides, so components mount in batches.
 * We wait for the cell count to be stable for 2 seconds before
 * creating islands and loading the marimo script.
 */
function setupCellStabilityCheck(
  kernel: MarimoKernel,
  registry: CellRegistry
): void {
  let lastCount = 0;
  let stableChecks = 0;
  let totalChecks = 0;
  const maxChecks = 50; // 5 seconds max (50 * 100ms)
  const requiredStableChecks = 20; // Must be stable for 20 checks (2000ms = 2 seconds)

  const checkForStability = () => {
    totalChecks++;
    const currentCount = registry.getCellCount();

    // Debug logging every 10 checks
    if (totalChecks % 10 === 0) {
      console.debug(`⏱️ Stability check #${totalChecks}: ${currentCount} cells, stable for ${stableChecks} checks`);
    }

    if (currentCount === lastCount) {
      // Count is stable - increment stability counter
      stableChecks++;

      if (stableChecks >= requiredStableChecks && currentCount > 0) {
        // Stable for required period with cells - initialize!
        console.log(
          `⏰ Found ${currentCount} cells (stable for 2s), initializing marimo...`
        );
        initializeMarimoIslands(kernel, registry);
        return; // Done
      }
      // If stable but count=0, keep checking (components may not have mounted yet)
    } else {
      // Count changed - reset stability counter
      console.debug(`⏱️ Cell count changed: ${lastCount} → ${currentCount}`);
      stableChecks = 0;
      lastCount = currentCount;
    }

    // Keep checking if we haven't timed out
    if (totalChecks < maxChecks) {
      setTimeout(checkForStability, 100);
    } else {
      // Timeout reached - initialize with whatever we have
      const finalCount = registry.getCellCount();
      if (finalCount > 0) {
        console.log(`⏰ Timeout: Initializing with ${finalCount} cells`);
        initializeMarimoIslands(kernel, registry);
      } else {
        console.log("⏰ Timeout: No cells found after 5 seconds");
      }
    }
  };

  // Start checking after a small initial delay to let Vue start mounting
  setTimeout(checkForStability, 500);
}

/**
 * Watch for components that mount after initial initialization.
 *
 * When navigating to a new slide, components mount but marimo is
 * already initialized. We need to create island elements for these
 * late-arriving cells.
 */
function setupLateArrivalWatcher(
  kernel: MarimoKernel,
  registry: CellRegistry
): void {
  // Initialize from current count to avoid processing existing cells as "new"
  let knownCellCount = registry.getCellCount();

  const checkForNewCells = () => {
    // Only process after marimo is initialized
    if (!isMarimoInitialized()) {
      return;
    }

    const currentCount = registry.getCellCount();
    if (currentCount > knownCellCount) {
      // New cells registered - create islands for them
      const cells = registry.getAllCells();
      for (const cell of cells) {
        // Skip cells that already have elements
        if (cell.element) continue;

        // Skip cells that aren't in pending state
        if (cell.state !== "pending") continue;

        // Create island for this late-arriving cell
        createSingleIsland(registry, cell.id);
      }

      knownCellCount = currentCount;
    }
  };

  // Poll for new cells periodically
  // Note: In SPA navigation, interval continues but exits early if marimo
  // isn't initialized. This is acceptable overhead vs. complex route tracking.
  const intervalId = setInterval(checkForNewCells, 500);

  // Clean up interval when page unloads to prevent memory leaks
  // Use { once: true } to prevent listener accumulation during HMR
  window.addEventListener("beforeunload", () => {
    clearInterval(intervalId);
  }, { once: true });
}

// HMR handling: Force full page reload when marimo-related files change
// This is necessary because marimo's internal state can't be hot-reloaded
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.log("🔄 Marimo: HMR detected, reloading page...");
    window.location.reload();
  });
}
