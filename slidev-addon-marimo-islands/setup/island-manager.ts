/**
 * Island Manager
 *
 * Manages the marimo islands initialization with the CORRECT sequence:
 *
 * 1. Components mount and register cells in registry
 * 2. Wait for cell count to stabilize (all components mounted)
 * 3. Create <marimo-island> elements in DOM from registry
 * 4. Load marimo script (which parses existing islands)
 * 5. Script sends kernel-ready message
 * 6. Components can now find and position their islands
 *
 * The key insight is that islands must exist in DOM BEFORE the marimo script
 * loads because the script immediately calls parseMarimoIslandApps() to
 * discover them on load.
 */

import type { MarimoKernel } from "../composables/useMarimoKernel";
import type { CellRegistry } from "../composables/useCellRegistry";
import { MARIMO_VERSION } from "./constants";

// Track initialization state
let isInitialized = false;
let resourcesLoaded = false;

/**
 * Load marimo CSS and font resources into document head.
 * Idempotent - safe to call multiple times.
 */
export function loadMarimoResources(): void {
  if (resourcesLoaded) return;
  if (typeof document === "undefined") return;

  // Check if already loaded
  if (document.getElementById("marimo-islands-css")) {
    resourcesLoaded = true;
    return;
  }

  console.log("📦 Loading marimo resources...");

  // Google Fonts preconnect
  const preconnect1 = document.createElement("link");
  preconnect1.rel = "preconnect";
  preconnect1.href = "https://fonts.googleapis.com";
  document.head.appendChild(preconnect1);

  const preconnect2 = document.createElement("link");
  preconnect2.rel = "preconnect";
  preconnect2.href = "https://fonts.gstatic.com";
  preconnect2.crossOrigin = "anonymous";
  document.head.appendChild(preconnect2);

  // Google Fonts
  const fonts = document.createElement("link");
  fonts.rel = "stylesheet";
  fonts.href =
    "https://fonts.googleapis.com/css2?family=Fira+Mono:wght@400;500;700&family=Lora&family=PT+Sans:wght@400;700&display=swap";
  document.head.appendChild(fonts);

  // KaTeX CSS for math rendering
  const katex = document.createElement("link");
  katex.rel = "stylesheet";
  katex.href = "https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css";
  katex.integrity =
    "sha384-wcIxkf4k558AjM3Yz3BBFQUbk/zgIYC2R0QpeeYb+TwlBVMrlgLqwRjRtGZiK7ww";
  katex.crossOrigin = "anonymous";
  document.head.appendChild(katex);

  // Marimo islands CSS
  const link = document.createElement("link");
  link.id = "marimo-islands-css";
  link.rel = "stylesheet";
  link.href = `https://cdn.jsdelivr.net/npm/@marimo-team/islands@${MARIMO_VERSION}/dist/style.css`;
  link.crossOrigin = "anonymous";
  link.onerror = () => {
    console.error("❌ Failed to load marimo islands stylesheet");
  };
  document.head.appendChild(link);

  // Required marimo-filename tag
  const marimoFilename = document.createElement("marimo-filename");
  marimoFilename.hidden = true;
  document.head.appendChild(marimoFilename);

  // Required marimo-mode tag (set to "read" for islands)
  const marimoMode = document.createElement("marimo-mode");
  marimoMode.setAttribute("data-mode", "read");
  marimoMode.hidden = true;
  document.head.appendChild(marimoMode);

  resourcesLoaded = true;
  console.log("✓ Marimo resources loaded");
}

/**
 * Create <marimo-island> elements in DOM from registry data.
 * This MUST happen BEFORE the marimo script loads.
 */
export function createIslandElements(registry: CellRegistry): number {
  const cells = registry.getAllCells();
  let created = 0;

  console.log(`🏝️ Creating ${cells.length} island elements...`);

  cells.forEach((cell, idx) => {
    // Skip if island already exists for this cell
    if (document.querySelector(`marimo-island[data-cell-id="${cell.id}"]`)) {
      return;
    }

    // Create the marimo-island element structure
    const island = document.createElement("marimo-island");
    island.setAttribute("data-app-id", "slidev-app");
    island.setAttribute("data-cell-id", cell.id);
    island.setAttribute("data-cell-idx", String(idx));
    island.setAttribute("data-reactive", String(cell.reactive));
    island.style.display = "none"; // Hidden until positioned by component

    // Create output container
    const output = document.createElement("marimo-cell-output");

    // Create code container (hidden, used by marimo internally)
    const code = document.createElement("marimo-cell-code");
    code.hidden = true;
    code.textContent = cell.code;

    island.appendChild(output);
    island.appendChild(code);
    document.body.appendChild(island);

    // Update registry with element reference
    registry.setCellElement(cell.id, island);
    registry.updateCellState(cell.id, "registered");

    created++;
  });

  console.log(`✓ Created ${created} island elements`);
  return created;
}

/**
 * Create a single island element for a late-mounting cell.
 * Called when a component mounts after initial initialization.
 */
export function createSingleIsland(
  registry: CellRegistry,
  cellId: string
): HTMLElement | null {
  const cell = registry.getCell(cellId);
  if (!cell) {
    console.warn(`⚠️ Cannot create island: cell ${cellId} not in registry`);
    return null;
  }

  // Check if already exists
  const existing = document.querySelector<HTMLElement>(
    `marimo-island[data-cell-id="${cell.id}"]`
  );
  if (existing) {
    return existing;
  }

  const idx = registry.getCellCount();

  const island = document.createElement("marimo-island");
  island.setAttribute("data-app-id", "slidev-app");
  island.setAttribute("data-cell-id", cell.id);
  island.setAttribute("data-cell-idx", String(idx));
  island.setAttribute("data-reactive", String(cell.reactive));
  island.style.display = "none";

  const output = document.createElement("marimo-cell-output");
  const code = document.createElement("marimo-cell-code");
  code.hidden = true;
  code.textContent = cell.code;

  island.appendChild(output);
  island.appendChild(code);
  document.body.appendChild(island);

  registry.setCellElement(cell.id, island);
  registry.updateCellState(cell.id, "registered");

  console.log(`🏝️ Created late island for cell ${cellId}`);

  return island;
}

/**
 * Load the marimo islands script from CDN.
 * The script will parse existing islands and initialize the kernel.
 */
function loadMarimoScript(kernel: MarimoKernel): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById("marimo-islands-script")) {
      console.log("⚠️ Marimo script already loaded");
      resolve();
      return;
    }

    kernel.startLoading();

    const script = document.createElement("script");
    script.id = "marimo-islands-script";
    script.src = `https://cdn.jsdelivr.net/npm/@marimo-team/islands@${MARIMO_VERSION}/dist/main.js`;
    script.type = "module";

    script.onload = () => {
      console.log(`✓ Marimo script loaded (v${MARIMO_VERSION})`);
      // Note: kernel.markReady() will be called when we receive the kernel-ready message
      resolve();
    };

    script.onerror = () => {
      const error = "Failed to load marimo islands library";
      console.error(`❌ ${error}`);
      kernel.markError(error);
      reject(new Error(error));
    };

    document.head.appendChild(script);
  });
}

/**
 * Set up listener for kernel-ready message from marimo worker.
 */
function setupKernelReadyListener(kernel: MarimoKernel): void {
  // Marimo sends messages from its web worker
  window.addEventListener("message", (event) => {
    // Check for marimo kernel ready message
    if (
      event.data &&
      (event.data.type === "kernel-ready" ||
        event.data.channel === "marimo" && event.data.type === "ready")
    ) {
      kernel.markReady();
    }
  });

  // Also watch for custom element registration as a backup
  // The marimo-island custom element is defined when the kernel is ready
  const checkCustomElement = () => {
    if (customElements.get("marimo-island")) {
      kernel.markReady();
      return true;
    }
    return false;
  };

  // Poll for custom element registration
  if (!checkCustomElement()) {
    const interval = setInterval(() => {
      if (checkCustomElement()) {
        clearInterval(interval);
      }
    }, 100);

    // Stop polling after 60 seconds
    setTimeout(() => clearInterval(interval), 60000);
  }
}

/**
 * Initialize the marimo islands system.
 *
 * This is the main entry point called by setup/main.ts after cells are stable.
 *
 * @param kernel - The kernel state manager
 * @param registry - The cell registry
 */
export async function initializeMarimoIslands(
  kernel: MarimoKernel,
  registry: CellRegistry
): Promise<void> {
  if (isInitialized) {
    console.log("⚠️ Marimo islands already initialized");
    return;
  }

  const cellCount = registry.getCellCount();
  if (cellCount === 0) {
    console.log("⚠️ No cells registered, skipping initialization");
    return;
  }

  console.log(`🚀 Initializing marimo with ${cellCount} cells...`);

  isInitialized = true;

  // Step 1: Load CSS and other resources
  loadMarimoResources();

  // Step 2: Create island elements from registry BEFORE loading script
  createIslandElements(registry);

  // Step 3: Set up kernel ready listener
  setupKernelReadyListener(kernel);

  // Step 4: Load the marimo script (it will parse existing islands)
  await loadMarimoScript(kernel);

  console.log("✓ Marimo initialization complete, waiting for kernel...");
}

/**
 * Check if marimo has been initialized.
 */
export function isMarimoInitialized(): boolean {
  return isInitialized;
}

/**
 * Reset initialization state (for HMR).
 */
export function resetMarimoState(): void {
  isInitialized = false;
  resourcesLoaded = false;
  console.log("🔄 Marimo state reset");
}

/**
 * Clean up all marimo islands and reset state.
 */
export function cleanupMarimo(): void {
  console.log("🧹 Cleaning up marimo islands...");

  // Remove all marimo-island elements
  document.querySelectorAll("marimo-island").forEach((el) => el.remove());

  // Remove script
  const script = document.getElementById("marimo-islands-script");
  if (script) script.remove();

  resetMarimoState();

  console.log("✓ Marimo cleanup complete");
}
