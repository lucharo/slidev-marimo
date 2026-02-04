/**
 * Unified Slidev Setup for Marimo
 *
 * This file is automatically loaded by Slidev and handles initialization for
 * both Islands (Pyodide/WASM) and Live (WebSocket kernel) modes.
 *
 * Mode Detection:
 * - If MarimoIsland components are registered → initialize islands mode
 * - If MarimoLive components are used → initialize live mode
 * - Both modes can coexist in the same presentation
 *
 * Architecture:
 * - Islands mode: Uses Pyodide/WASM for client-side Python execution
 * - Live mode: Uses WebSocket connection to a running marimo kernel
 */

// ============================================================================
// Islands Mode Imports
// ============================================================================
import { installMarimoKernel } from "../composables/islands/useMarimoKernel";
import { installCellRegistry, type CellRegistry } from "../composables/islands/useCellRegistry";
import {
  initializeMarimoIslands,
  loadMarimoResources,
  createSingleIsland,
  isMarimoInitialized,
} from "./islands/island-manager";
import type { MarimoKernel } from "../composables/islands/useMarimoKernel";

// ============================================================================
// Live Mode Imports
// ============================================================================
import {
  initializeKernelListeners,
  KERNEL_CONNECTION_KEY,
} from "../composables/live/useMarimoKernel";
import { createKernelConnection, type KernelConfig } from "./live/kernel-connection";
import { initializeUISync } from "./live/ui-sync";

// Global styling
import "../styles/marimo-overrides.css";

// ============================================================================
// Live Mode Configuration
// ============================================================================
const DEFAULT_KERNEL_CONFIG: KernelConfig = {
  wsUrl: "ws://localhost:2718/ws",
  httpUrl: "http://localhost:2718",
  autoInstantiate: true,
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
};

// ============================================================================
// Main Setup
// ============================================================================
export default ({ app }) => {
  // Register marimo custom elements so Vue doesn't try to compile them
  const originalIsCustomElement = app.config.compilerOptions.isCustomElement;

  app.config.compilerOptions.isCustomElement = (tag: string) => {
    if (tag.startsWith("marimo-")) {
      return true;
    }
    return originalIsCustomElement ? originalIsCustomElement(tag) : false;
  };

  // Install islands mode kernel and registry (always available)
  const kernel = installMarimoKernel(app);
  const registry = installCellRegistry(app);

  // Only run initialization on client side
  if (typeof window !== "undefined") {
    // Initialize islands mode
    initializeIslandsMode(kernel, registry);

    // Initialize live mode (connects to WebSocket if configured)
    initializeLiveMode(app);
  }
};

// ============================================================================
// Islands Mode Initialization
// ============================================================================
function initializeIslandsMode(kernel: MarimoKernel, registry: CellRegistry): void {
  // Load CSS resources immediately (doesn't need to wait for cells)
  loadMarimoResources();

  // Wait for cells to register, then initialize marimo
  setupCellStabilityCheck(kernel, registry);

  // Watch for late-arriving cells (e.g., navigating to a new slide)
  setupLateArrivalWatcher(kernel, registry);
}

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
  const intervalId = setInterval(checkForNewCells, 500);

  // Clean up interval when page unloads
  window.addEventListener("beforeunload", () => {
    clearInterval(intervalId);
  }, { once: true });
}

// ============================================================================
// Live Mode Initialization
// ============================================================================
function initializeLiveMode(app: any): void {
  // Check for custom configuration in window (can be set via slidev config)
  const userConfig = (window as any).__MARIMO_LIVE_CONFIG__ || {};

  // Only initialize live mode if explicitly configured
  // This prevents unnecessary WebSocket connection attempts
  if (!userConfig.wsUrl && !userConfig.httpUrl) {
    console.debug("[marimo-live] No live kernel configuration found, skipping live mode");
    return;
  }

  const config: KernelConfig = {
    ...DEFAULT_KERNEL_CONFIG,
    ...userConfig,
  };

  console.log("[marimo-live] Initializing with config:", config);

  // Create kernel connection
  const kernel = createKernelConnection(config);

  // Set up event listeners for state management
  initializeKernelListeners(kernel);

  // Set up UI element synchronization
  initializeUISync(kernel);

  // Provide kernel to all components
  app.provide(KERNEL_CONNECTION_KEY, kernel);

  // Auto-connect when the app starts
  kernel
    .connect()
    .then(() => {
      console.log("[marimo-live] Connected to marimo server");
    })
    .catch((err) => {
      console.error("[marimo-live] Failed to connect:", err);
      console.log(
        "[marimo-live] Make sure marimo is running: marimo edit notebook.py --headless --port 2718 --no-token --no-skew-protection --allow-origins '*'",
      );
    });

  // Clean up on app unmount
  if (app.unmount) {
    const originalUnmount = app.unmount.bind(app);
    app.unmount = () => {
      kernel.disconnect();
      originalUnmount();
    };
  }
}

// HMR handling: Force full page reload when marimo-related files change
if (import.meta.hot) {
  import.meta.hot.decline();
}
