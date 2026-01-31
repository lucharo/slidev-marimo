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
import { patchKernelMessages } from "./kernel-message-patch";

// Track if bridge trap is installed
let bridgeTrapInstalled = false;

/**
 * Install a property trap to intercept when marimo creates the bridge.
 * This allows us to patch putControlRequest immediately when the bridge is created,
 * BEFORE marimo sends any messages through it.
 */
function installBridgeTrap(): void {
  if (bridgeTrapInstalled) return;
  if (typeof window === "undefined") return;

  const BRIDGE_KEY = "_marimo_private_IslandsPyodideBridge";

  // Check if bridge already exists (shouldn't happen if we call this early enough)
  if ((window as Record<string, unknown>)[BRIDGE_KEY]) {
    console.log("⚠️ Bridge already exists, patching now");
    patchKernelMessages();
    bridgeTrapInstalled = true;
    return;
  }

  let _bridge: unknown = undefined;

  Object.defineProperty(window, BRIDGE_KEY, {
    configurable: true,
    enumerable: true,
    get() {
      return _bridge;
    },
    set(newBridge) {
      console.log("🎯 Bridge being created, intercepting...");
      _bridge = newBridge;

      // Patch synchronously - we need to wrap putControlRequest
      // BEFORE marimo calls it for the first time
      if (newBridge && typeof newBridge.putControlRequest === "function") {
        const originalPut = newBridge.putControlRequest.bind(newBridge);
        newBridge.putControlRequest = async (request: unknown) => {
          // Add type field if missing
          if (request && typeof request === "object" && !("type" in request)) {
            const req = request as Record<string, unknown>;
            if (Array.isArray(req.objectIds) && Array.isArray(req.values)) {
              console.debug('🔧 Inline patch: adding type="update-ui-element"');
              return originalPut({ type: "update-ui-element", ...req });
            }
          }
          return originalPut(request);
        };
        console.log("✓ Bridge patched inline on creation");
      }
    },
  });

  bridgeTrapInstalled = true;
  console.log("✓ Bridge trap installed");
}

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

  // Install bridge trap FIRST - before any marimo code loads
  // This ensures we can patch putControlRequest the moment the bridge is created
  installBridgeTrap();

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

  // Prism.js for syntax highlighting (Tomorrow Night theme)
  const prismCss = document.createElement("link");
  prismCss.rel = "stylesheet";
  prismCss.href =
    "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css";
  document.head.appendChild(prismCss);

  // Load Prism core first, then Python language support
  const prismJs = document.createElement("script");
  prismJs.src =
    "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js";
  prismJs.onload = () => {
    // Load Python language component after core is ready
    const prismPython = document.createElement("script");
    prismPython.src =
      "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-python.min.js";
    prismPython.onload = () => {
      // Dispatch event so components know Prism is fully ready
      window.dispatchEvent(new Event("prism-ready"));
      console.log("✓ Prism.js loaded with Python support");
    };
    document.head.appendChild(prismPython);
  };
  document.head.appendChild(prismJs);

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
    // Use try-catch in case custom element is already defined
    let island: HTMLElement;
    try {
      island = document.createElement("marimo-island");
      island.setAttribute("data-app-id", "slidev-app");
      island.setAttribute("data-cell-id", cell.id);
      island.setAttribute("data-cell-idx", String(idx));
      island.setAttribute("data-reactive", String(cell.reactive));
    } catch {
      // Fallback: create via template when custom element constructor conflicts
      const template = document.createElement("template");
      template.innerHTML = `<marimo-island data-app-id="slidev-app" data-cell-id="${cell.id}" data-cell-idx="${idx}" data-reactive="${cell.reactive}"></marimo-island>`;
      island = template.content.firstElementChild as HTMLElement;
    }
    island.style.display = "none"; // Hidden until positioned by component

    // Create output container
    const output = document.createElement("marimo-cell-output");

    // Create code container (hidden, used by marimo internally)
    // Marimo expects URL-encoded code in this element.
    // IMPORTANT: cell.code must be raw/unencoded - it is URL-encoded here before
    // insertion into the DOM. Do not pre-encode the code when registering cells.
    const code = document.createElement("marimo-cell-code");
    code.hidden = true;
    code.textContent = encodeURIComponent(cell.code);

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

  // Create island element - use innerHTML as fallback if createElement fails
  // (can happen when marimo has already defined the custom element)
  let island: HTMLElement;
  try {
    island = document.createElement("marimo-island");
    island.setAttribute("data-app-id", "slidev-app");
    island.setAttribute("data-cell-id", cell.id);
    island.setAttribute("data-cell-idx", String(idx));
    island.setAttribute("data-reactive", String(cell.reactive));
  } catch {
    // Fallback: create via innerHTML when custom element constructor conflicts
    const template = document.createElement("template");
    template.innerHTML = `<marimo-island data-app-id="slidev-app" data-cell-id="${cell.id}" data-cell-idx="${idx}" data-reactive="${cell.reactive}"></marimo-island>`;
    island = template.content.firstElementChild as HTMLElement;
  }
  island.style.display = "none";

  const output = document.createElement("marimo-cell-output");
  // Marimo expects URL-encoded code in this element.
  // IMPORTANT: cell.code must be raw/unencoded - it is URL-encoded here before
  // insertion into the DOM. Do not pre-encode the code when registering cells.
  const code = document.createElement("marimo-cell-code");
  code.hidden = true;
  code.textContent = encodeURIComponent(cell.code);

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

    // Start polling for the bridge BEFORE loading the script
    // This ensures we patch putControlRequest as soon as it becomes available,
    // before marimo sends any initialization messages
    applyKernelPatch();

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

// Track patch retry timeout for cancellation
let patchRetryTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Apply the kernel message patch with retries.
 * Called BEFORE loading the marimo script to intercept messages as early as possible.
 * Uses aggressive polling (10ms) to catch the bridge the moment it's created.
 */
function applyKernelPatch(): void {
  // Cancel any pending retry from previous initialization
  if (patchRetryTimeout) {
    clearTimeout(patchRetryTimeout);
    patchRetryTimeout = null;
  }

  let attempts = 0;
  const maxAttempts = 500; // 5 seconds at 10ms intervals
  const retryInterval = 10; // Poll aggressively to catch bridge creation

  const tryPatch = () => {
    attempts++;
    if (patchKernelMessages()) {
      console.log(`✓ Kernel message patch applied (attempt ${attempts})`);
      patchRetryTimeout = null;
      return;
    }

    if (attempts < maxAttempts) {
      patchRetryTimeout = setTimeout(tryPatch, retryInterval);
    } else {
      console.warn("⚠️ Failed to apply kernel message patch after max attempts");
      patchRetryTimeout = null;
    }
  };

  tryPatch();
}

/**
 * Set up listener for kernel-ready message from marimo worker.
 */
function setupKernelReadyListener(kernel: MarimoKernel): void {
  // Track polling interval so we can clear it when ready
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let pollingTimeout: ReturnType<typeof setTimeout> | null = null;
  let messageHandler: ((event: MessageEvent) => void) | null = null;

  const cleanup = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    if (pollingTimeout) {
      clearTimeout(pollingTimeout);
      pollingTimeout = null;
    }
    if (messageHandler) {
      window.removeEventListener("message", messageHandler);
      messageHandler = null;
    }
  };

  // Marimo sends messages from its web worker
  messageHandler = (event: MessageEvent) => {
    // Check for marimo kernel ready message
    // Use explicit parentheses for clarity on precedence
    if (
      event.data &&
      (event.data.type === "kernel-ready" ||
        (event.data.channel === "marimo" && event.data.type === "ready"))
    ) {
      cleanup();
      kernel.markReady();
      applyKernelPatch();
    }
  };
  window.addEventListener("message", messageHandler);

  // Also watch for custom element registration as a backup
  // The marimo-island custom element is defined when the kernel is ready
  const checkCustomElement = () => {
    if (customElements.get("marimo-island")) {
      cleanup();
      kernel.markReady();
      applyKernelPatch();
      return true;
    }
    return false;
  };

  // Poll for custom element registration
  if (!checkCustomElement()) {
    pollingInterval = setInterval(() => {
      checkCustomElement(); // Calls cleanup() internally when ready
    }, 100);

    // Stop polling after 60 seconds
    pollingTimeout = setTimeout(cleanup, 60000);
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

  // Step 3: Wait for any additional cells that might be mounting
  // Slidev lazy-loads slides, so more cells may register during this delay
  console.log("⏳ Waiting for additional cells to register...");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Step 4: Create any additional islands that registered during the delay
  const additionalCells = registry.getAllCells().filter(
    (cell) => cell.state === "pending"
  );
  if (additionalCells.length > 0) {
    console.log(`🏝️ Creating ${additionalCells.length} additional island elements...`);
    for (const cell of additionalCells) {
      createSingleIsland(registry, cell.id);
    }
  }

  // Step 5: Set up kernel ready listener
  setupKernelReadyListener(kernel);

  // Step 6: Load the marimo script (it will parse existing islands)
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

// HMR: Force full page reload when this file changes
// Marimo kernel state cannot be hot-reloaded
if (import.meta.hot) {
  // Clean up pending timeouts before reload
  import.meta.hot.dispose(() => {
    if (patchRetryTimeout) {
      clearTimeout(patchRetryTimeout);
      patchRetryTimeout = null;
    }
  });
  import.meta.hot.decline();
}
