/**
 * Marimo Frontend Loader
 *
 * Loads the marimo islands frontend from CDN to enable interactive UI elements
 * like sliders, dropdowns, and charts. The frontend defines custom elements
 * (marimo-slider, marimo-dropdown, etc.) that render and handle user interactions.
 *
 * This module should be called AFTER the message bridge is installed so that
 * UI component communications are properly intercepted and routed to WebSocket.
 */

// Match the marimo-islands version used by marimo server
// TODO: Update to stable release when available
// See: https://github.com/marimo-team/marimo/releases
// Note: Dev versions may be removed from CDN
const MARIMO_VERSION = "0.19.8-dev4";

// Track loading state
let isLoading = false;
let isLoaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * Load marimo frontend CSS from CDN.
 * Adds the stylesheet to document head if not already present.
 */
function loadMarimoCSS(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("marimo-live-css")) return;

  const link = document.createElement("link");
  link.id = "marimo-live-css";
  link.rel = "stylesheet";
  link.href = `https://cdn.jsdelivr.net/npm/@marimo-team/islands@${MARIMO_VERSION}/dist/style.css`;
  link.crossOrigin = "anonymous";
  link.onerror = () => {
    console.error("[marimo-live] Failed to load marimo CSS from CDN");
  };
  document.head.appendChild(link);
  console.log("[marimo-live] Marimo CSS loaded");
}

/**
 * Load marimo frontend JavaScript from CDN.
 * The script defines all marimo custom elements.
 * Returns a promise that resolves when the script is loaded.
 */
function loadMarimoScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Not in browser environment"));
      return;
    }

    if (document.getElementById("marimo-live-script")) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = "marimo-live-script";
    script.type = "module";
    script.src = `https://cdn.jsdelivr.net/npm/@marimo-team/islands@${MARIMO_VERSION}/dist/main.js`;

    script.onload = () => {
      console.log(`[marimo-live] Marimo script loaded (v${MARIMO_VERSION})`);
      resolve();
    };

    script.onerror = () => {
      const error = new Error("Failed to load marimo script from CDN");
      console.error("[marimo-live]", error.message);
      reject(error);
    };

    document.head.appendChild(script);
  });
}

/**
 * Add required marimo meta elements to the document.
 * These are needed by the marimo frontend for proper initialization.
 */
function addMarimoMetaElements(): void {
  if (typeof document === "undefined") return;

  // Required marimo-filename tag
  if (!document.querySelector("marimo-filename")) {
    const marimoFilename = document.createElement("marimo-filename");
    marimoFilename.hidden = true;
    document.head.appendChild(marimoFilename);
  }

  // Required marimo-mode tag (set to "read" for presentation mode)
  if (!document.querySelector("marimo-mode")) {
    const marimoMode = document.createElement("marimo-mode");
    marimoMode.setAttribute("data-mode", "read");
    marimoMode.hidden = true;
    document.head.appendChild(marimoMode);
  }
}

/**
 * Load additional fonts and resources used by marimo.
 */
function loadFontsAndResources(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("marimo-live-fonts")) return;

  // Google Fonts preconnect
  const preconnect1 = document.createElement("link");
  preconnect1.id = "marimo-live-fonts";
  preconnect1.rel = "preconnect";
  preconnect1.href = "https://fonts.googleapis.com";
  document.head.appendChild(preconnect1);

  const preconnect2 = document.createElement("link");
  preconnect2.rel = "preconnect";
  preconnect2.href = "https://fonts.gstatic.com";
  preconnect2.crossOrigin = "anonymous";
  document.head.appendChild(preconnect2);

  // Fonts used by marimo UI
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

  // Load Prism.js for syntax highlighting
  loadPrism();
}

/**
 * Load Prism.js for Python syntax highlighting.
 */
function loadPrism(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("marimo-live-prism")) return;

  // Use dark theme for code blocks (matches One Dark styling in component)
  const prismCss = document.createElement("link");
  prismCss.id = "marimo-live-prism";
  prismCss.rel = "stylesheet";
  prismCss.href = "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css";
  document.head.appendChild(prismCss);

  // Load Prism core
  const prismJs = document.createElement("script");
  prismJs.src = "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js";
  prismJs.onload = () => {
    // Load Python language component after core is ready
    const prismPython = document.createElement("script");
    prismPython.src =
      "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-python.min.js";
    prismPython.onload = () => {
      // Dispatch event so components know Prism is fully ready
      window.dispatchEvent(new Event("prism-ready"));
      console.log("[marimo-live] Prism.js loaded with Python support");
    };
    document.head.appendChild(prismPython);
  };
  document.head.appendChild(prismJs);
}

/**
 * Wait for a specific custom element to be defined.
 * Useful for ensuring UI components are ready.
 *
 * @param tagName - The custom element tag name (e.g., "marimo-slider")
 * @param timeout - Maximum time to wait in ms (default: 30000)
 */
export async function waitForCustomElement(
  tagName: string,
  timeout = 30000,
): Promise<void> {
  if (typeof customElements === "undefined") {
    throw new Error("CustomElements API not available");
  }

  // Check if already defined
  if (customElements.get(tagName)) {
    return;
  }

  // Wait for definition with timeout
  return Promise.race([
    customElements.whenDefined(tagName),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout waiting for ${tagName}`)), timeout)
    ),
  ]);
}

/**
 * Load the marimo frontend resources (CSS, JS, fonts).
 * This is the main entry point for loading the marimo UI system.
 *
 * The function is idempotent - calling it multiple times will only load once.
 * It returns a promise that resolves when the frontend is ready.
 *
 * @returns Promise that resolves when frontend is loaded
 */
export async function loadMarimoFrontend(): Promise<void> {
  console.log("[marimo-live] loadMarimoFrontend() CALLED");

  // Return existing promise if already loading
  if (loadPromise) {
    console.log("[marimo-live] loadMarimoFrontend() returning existing promise");
    return loadPromise;
  }

  // Already loaded
  if (isLoaded) {
    console.log("[marimo-live] loadMarimoFrontend() already loaded");
    return Promise.resolve();
  }

  console.log("[marimo-live] loadMarimoFrontend() starting load");
  isLoading = true;

  loadPromise = (async () => {
    try {
      // Add meta elements first
      addMarimoMetaElements();

      // Load resources in parallel
      loadFontsAndResources();
      loadMarimoCSS();

      // Load and wait for script
      await loadMarimoScript();

      // Wait for at least one custom element to be defined
      // This ensures the marimo frontend has initialized
      try {
        await waitForCustomElement("marimo-slider", 10000);
        console.log("[marimo-live] Custom elements ready");
      } catch {
        // Not all pages may have sliders; this is not fatal
        console.debug("[marimo-live] marimo-slider not defined yet (may be normal)");
      }

      isLoaded = true;
      isLoading = false;
      console.log("[marimo-live] Frontend loaded successfully");
    } catch (error) {
      isLoading = false;
      loadPromise = null;
      throw error;
    }
  })();

  return loadPromise;
}

/**
 * Check if the marimo frontend has been loaded.
 */
export function isMarimoFrontendLoaded(): boolean {
  return isLoaded;
}

/**
 * Check if the marimo frontend is currently loading.
 */
export function isMarimoFrontendLoading(): boolean {
  return isLoading;
}

/**
 * Get the marimo version being used.
 */
export function getMarimoVersion(): string {
  return MARIMO_VERSION;
}
