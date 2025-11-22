/**
 * Debug utilities for marimo islands integration
 * Run these in browser console to diagnose issues
 */

export interface DebugInfo {
  resourcesLoaded: {
    script: boolean;
    css: boolean;
    fonts: boolean;
    katex: boolean;
    marimoFilename: boolean;
  };
  customElement: {
    registered: boolean;
    elementCount: number;
  };
  vueConfig: {
    isCustomElementConfigured: boolean;
  };
  recommendations: string[];
}

/**
 * Comprehensive debug check
 * Run in browser console: window.debugMarimo()
 */
export function debugMarimo(): DebugInfo {
  const info: DebugInfo = {
    resourcesLoaded: {
      script: false,
      css: false,
      fonts: false,
      katex: false,
      marimoFilename: false,
    },
    customElement: {
      registered: false,
      elementCount: 0,
    },
    vueConfig: {
      isCustomElementConfigured: false,
    },
    recommendations: [],
  };

  // Check script loading
  info.resourcesLoaded.script = !!document.querySelector(
    "#marimo-islands-script",
  );
  if (!info.resourcesLoaded.script) {
    info.recommendations.push(
      "❌ Marimo islands script not loaded. Check setup/main.ts",
    );
  }

  // Check CSS loading
  info.resourcesLoaded.css = !!document.querySelector("#marimo-islands-css");
  if (!info.resourcesLoaded.css) {
    info.recommendations.push("❌ Marimo islands CSS not loaded");
  }

  // Check Google Fonts
  info.resourcesLoaded.fonts = !!document.querySelector(
    'link[href*="fonts.googleapis.com"]',
  );
  if (!info.resourcesLoaded.fonts) {
    info.recommendations.push(
      "⚠️  Google Fonts not loaded (may cause rendering issues)",
    );
  }

  // Check KaTeX
  info.resourcesLoaded.katex = !!document.querySelector('link[href*="katex"]');
  if (!info.resourcesLoaded.katex) {
    info.recommendations.push("⚠️  KaTeX not loaded (math rendering may fail)");
  }

  // Check marimo-filename element
  info.resourcesLoaded.marimoFilename =
    !!document.querySelector("marimo-filename");
  if (!info.resourcesLoaded.marimoFilename) {
    info.recommendations.push("⚠️  <marimo-filename> element missing");
  }

  // Check custom element registration
  info.customElement.registered = !!customElements.get("marimo-island");
  if (!info.customElement.registered) {
    info.recommendations.push(
      "❌ marimo-island custom element NOT registered. Script may not have loaded/executed.",
    );
  } else {
    info.recommendations.push("✓ marimo-island custom element registered");
  }

  // Count island elements in DOM
  info.customElement.elementCount =
    document.querySelectorAll("marimo-island").length;
  if (info.customElement.elementCount === 0) {
    info.recommendations.push("⚠️  No <marimo-island> elements found in DOM");
  } else {
    info.recommendations.push(
      `✓ Found ${info.customElement.elementCount} island element(s)`,
    );
  }

  // Check Vue custom element config
  // This is harder to check directly, but we can infer from behavior
  const vueApp = document.querySelector("#app");
  if (vueApp) {
    info.vueConfig.isCustomElementConfigured = true;
  }

  // Print formatted output
  console.group("🔍 Marimo Islands Debug Info");
  console.log("Resources Loaded:", info.resourcesLoaded);
  console.log("Custom Element:", info.customElement);
  console.log("Vue Config:", info.vueConfig);
  console.groupEnd();

  console.group("📋 Recommendations");
  info.recommendations.forEach((rec) => console.log(rec));
  console.groupEnd();

  return info;
}

/**
 * Check specific island element
 */
export function inspectIsland(index: number = 0) {
  const islands = document.querySelectorAll("marimo-island");
  if (islands.length === 0) {
    console.error("No <marimo-island> elements found");
    return null;
  }

  const island = islands[index] as HTMLElement;
  console.group(`🏝️  Island #${index}`);
  console.log("Element:", island);
  console.log("Attributes:", {
    appId: island.dataset.appId,
    cellId: island.dataset.cellId,
    reactive: island.dataset.reactive,
  });
  console.log("Has output:", !!island.querySelector("marimo-cell-output"));
  console.log("Has code:", !!island.querySelector("marimo-cell-code"));

  const code = island.querySelector("marimo-cell-code");
  if (code) {
    console.log("Code (URL-encoded):", code.textContent);
    try {
      const decoded = decodeURIComponent(code.textContent || "");
      console.log("Code (decoded):", decoded);
    } catch (e) {
      console.error("Failed to decode code:", e);
    }
  }

  console.groupEnd();
  return island;
}

/**
 * Test if Pyodide is loaded
 */
export function checkPyodide() {
  const win = window as any;
  console.group("🐍 Pyodide Check");

  if (win.loadPyodide) {
    console.log("✓ loadPyodide function available");
  } else {
    console.log("❌ loadPyodide function NOT available");
  }

  if (win.pyodide) {
    console.log("✓ Pyodide instance exists");
    console.log("Pyodide version:", win.pyodide.version);
  } else {
    console.log(
      "⚠️  Pyodide not yet initialized (this is normal until first island runs)",
    );
  }

  console.groupEnd();
}

// Make available on window for easy console access
if (typeof window !== "undefined") {
  const win = window as any;
  win.debugMarimo = debugMarimo;
  win.inspectIsland = inspectIsland;
  win.checkPyodide = checkPyodide;
}
