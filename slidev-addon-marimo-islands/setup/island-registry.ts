/**
 * Island Registry - DOM-based, No Global State
 *
 * This module manages marimo island initialization by reading from DOM markers:
 * 1. Components create marker elements in DOM when they mount
 * 2. We poll DOM to detect when markers are stable
 * 3. Read island data from markers and create marimo-island elements
 * 4. Load marimo script to parse the islands
 * 5. Components find and position their islands
 *
 * NO GLOBAL STATE - DOM is the single source of truth!
 */

/**
 * Get all island marker elements from DOM
 */
function getIslandMarkers(): NodeListOf<HTMLElement> {
  return document.querySelectorAll(".marimo-island-marker");
}

/**
 * Initialize marimo - reads island data from DOM markers
 * This is called by setup/main.ts when markers are stable
 */
export function initializeMarimo() {
  const markers = getIslandMarkers();

  if (markers.length === 0) {
    console.warn("⚠️ No island markers found in DOM");
    return;
  }

  console.log(`🚀 Initializing marimo with ${markers.length} islands from DOM`);

  // Create marimo-island elements from markers
  markers.forEach((marker, idx) => {
    const island = document.createElement("marimo-island");
    island.setAttribute("data-app-id", "slidev-app");
    island.setAttribute("data-cell-id", marker.dataset.islandId!);
    island.setAttribute("data-cell-idx", String(idx));
    island.setAttribute("data-reactive", marker.dataset.islandReactive!);
    island.setAttribute("data-marker-id", marker.dataset.islandId!); // Link back to marker
    island.style.display = "none";

    const output = document.createElement("marimo-cell-output");

    const displayCode = marker.dataset.islandDisplayCode;
    console.log(
      `Island ${marker.dataset.islandId}: displayCode="${displayCode}"`,
    );

    // Create code element if needed
    let codeElement: HTMLElement | null = null;
    if (displayCode === "true") {
      // Show code using code editor component
      codeElement = document.createElement("marimo-ui-element");
      const editor = document.createElement("marimo-code-editor");
      const codeText = decodeURIComponent(marker.dataset.islandCode!);
      // Use JSON.stringify to properly escape quotes, newlines, and special chars
      const escapedCode = JSON.stringify(codeText);
      editor.setAttribute("data-language", '"python"');
      editor.setAttribute("data-disabled", "false");
      editor.setAttribute("data-initial-value", escapedCode);
      editor.setAttribute("data-label", "null");
      editor.setAttribute("data-placeholder", '""');
      codeElement.appendChild(editor);
    } else {
      // Hide code but keep it for execution
      codeElement = document.createElement("marimo-cell-code");
      codeElement.setAttribute("hidden", "");
      (codeElement as HTMLElement).textContent = decodeURIComponent(
        marker.dataset.islandCode!,
      );
    }

    // Add elements in order: output first, then code
    island.appendChild(output);
    island.appendChild(codeElement);

    document.body.appendChild(island);
  });

  console.log("✓ Created all island elements in DOM from markers");

  // Now load marimo script - it will parse these islands
  loadMarimoScript();
}

/**
 * Load marimo islands script from CDN
 * Uses version 0.11.6 - last known good version before CSS bug
 */
function loadMarimoScript() {
  if (document.getElementById("marimo-islands-script")) {
    console.warn("⚠️ Marimo script already loaded");
    return;
  }

  const MARIMO_VERSION = "0.11.6";

  const script = document.createElement("script");
  script.id = "marimo-islands-script";
  script.src = `https://cdn.jsdelivr.net/npm/@marimo-team/islands@${MARIMO_VERSION}/dist/main.js`;
  script.type = "module";

  script.onerror = () => {
    console.error("❌ Failed to load marimo islands library");
  };

  script.onload = () => {
    console.log(
      `✓ Marimo islands script loaded successfully (v${MARIMO_VERSION})`,
    );
  };

  document.head.appendChild(script);
}

/**
 * Get the current number of island markers in DOM
 * Used by setup/main.ts to poll for stability
 */
export function getIslandCount(): number {
  return getIslandMarkers().length;
}

/**
 * Check if marimo has been initialized
 * Used for debugging and coordination
 */
export function isMarimoInitialized(): boolean {
  return !!document.getElementById("marimo-islands-script");
}

/**
 * Clean up all marimo islands and script
 * Used when reinitializing after HMR
 */
export function cleanupMarimo() {
  console.log("🧹 Cleaning up marimo islands...");

  // Remove all marimo-island elements
  const islands = document.querySelectorAll("marimo-island");
  islands.forEach((island) => island.remove());

  // Remove marimo script tag so it can be reloaded
  const script = document.getElementById("marimo-islands-script");
  if (script) {
    script.remove();
  }

  console.log("✓ Marimo cleanup complete");
}
