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

import { MARIMO_VERSION } from "./constants";

/**
 * Get all island marker elements from DOM
 */
function getIslandMarkers(): NodeListOf<HTMLElement> {
  return document.querySelectorAll(".marimo-island-marker");
}

/**
 * Create a marimo-island element from a single marker.
 * Returns true if island was created, false if skipped.
 */
export function createIslandFromMarker(
  marker: HTMLElement,
  idx: number,
): boolean {
  const islandId = marker.dataset.islandId;
  const islandReactive = marker.dataset.islandReactive;
  const islandCode = marker.dataset.islandCode;

  if (!islandId) {
    console.warn(`⚠️ Skipping marker ${idx}: missing island ID`);
    return false;
  }

  // Skip if island already exists for this marker
  if (document.querySelector(`marimo-island[data-marker-id="${islandId}"]`)) {
    return false;
  }

  if (!islandCode) {
    console.warn(`⚠️ Skipping marker ${idx} (${islandId}): missing island code`);
    return false;
  }

  let decodedCode: string;
  try {
    decodedCode = decodeURIComponent(islandCode);
  } catch (err) {
    console.warn(
      `⚠️ Skipping marker ${idx} (${islandId}): failed to decode code - ${err}`,
    );
    return false;
  }

  const island = document.createElement("marimo-island");
  island.setAttribute("data-app-id", "slidev-app");
  island.setAttribute("data-cell-id", islandId);
  island.setAttribute("data-cell-idx", String(idx));
  island.setAttribute("data-reactive", islandReactive || "true");
  island.setAttribute("data-marker-id", islandId);
  island.style.display = "none";

  const output = document.createElement("marimo-cell-output");

  const code = document.createElement("marimo-cell-code");
  code.hidden = true;
  code.textContent = decodedCode;

  island.appendChild(output);
  island.appendChild(code);
  document.body.appendChild(island);
  return true;
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

  markers.forEach((marker, idx) => {
    createIslandFromMarker(marker, idx);
  });

  console.log("✓ Created all island elements in DOM from markers");

  // Now load marimo script - it will parse these islands
  loadMarimoScript();
}

/**
 * Load marimo islands script from CDN
 */
function loadMarimoScript() {
  if (document.getElementById("marimo-islands-script")) {
    console.warn("⚠️ Marimo script already loaded");
    return;
  }

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
