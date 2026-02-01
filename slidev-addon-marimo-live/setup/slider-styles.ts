/**
 * Slider Styles
 *
 * Marimo sliders use shadow DOM which isolates them from global styles.
 * This module injects CSS directly into slider shadow roots to ensure
 * they render correctly and match the presentation theme.
 *
 * The problem: Shadow DOM encapsulation prevents external CSS from styling
 * the slider internals. Marimo's bundled styles may not load correctly
 * or may conflict with Slidev's styles.
 *
 * The solution: Poll for slider elements, wait for their shadow roots
 * to be created, then inject CSS directly into each shadow root.
 */

// Track styling state
let pollingStarted = false;
let pollingInterval: ReturnType<typeof setInterval> | null = null;
let styledSliders = new WeakSet<HTMLElement>();

/**
 * CSS styles to inject into slider shadow roots.
 * Uses CSS custom properties for theme compatibility.
 */
const SLIDER_STYLES = `
/* Horizontal slider container */
[data-orientation="horizontal"] {
  width: 200px !important;
  display: flex !important;
  align-items: center !important;
  position: relative !important;
}

/* Slider track */
[data-testid="track"] {
  width: 100% !important;
  height: 8px !important;
  background-color: var(--ring, #64748b) !important;
  border-radius: 9999px !important;
  position: relative !important;
}

/* Filled range (left side of thumb) */
[data-testid="range"] {
  height: 100% !important;
  background-color: var(--primary, #3b82f6) !important;
  border-radius: 9999px !important;
  position: absolute !important;
  left: 0 !important;
}

/* Slider thumb (draggable handle) */
[data-testid="thumb"] {
  width: 16px !important;
  height: 16px !important;
  background-color: var(--background, white) !important;
  border: 2px solid var(--primary, #3b82f6) !important;
  border-radius: 50% !important;
  cursor: pointer !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2) !important;
  transition: transform 0.1s ease !important;
}

[data-testid="thumb"]:hover {
  transform: scale(1.1) !important;
}

[data-testid="thumb"]:active {
  transform: scale(0.95) !important;
}

[data-testid="thumb"]:focus {
  outline: 2px solid var(--primary, #3b82f6) !important;
  outline-offset: 2px !important;
}

/* Vertical slider orientation */
[data-orientation="vertical"] {
  height: 200px !important;
  width: 20px !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
}

/* Dark mode support - uses CSS custom properties */
`;

/**
 * Inject styles into a single slider's shadow root.
 *
 * @param slider - The marimo-slider element
 * @returns true if styles were injected, false if already styled or no shadow root
 */
function injectSliderStyles(slider: HTMLElement): boolean {
  // Skip if already styled
  if (styledSliders.has(slider)) {
    return false;
  }

  const shadowRoot = slider.shadowRoot;
  if (!shadowRoot) {
    return false;
  }

  // Check if our styles are already present
  if (shadowRoot.querySelector("#marimo-live-slider-styles")) {
    styledSliders.add(slider);
    return false;
  }

  // Create and inject style element
  const style = document.createElement("style");
  style.id = "marimo-live-slider-styles";
  style.textContent = SLIDER_STYLES;
  shadowRoot.appendChild(style);

  styledSliders.add(slider);
  return true;
}

/**
 * Find and style all marimo-slider elements on the page.
 *
 * @returns Number of newly styled sliders
 */
export function injectAllSliderStyles(): number {
  if (typeof document === "undefined") return 0;

  const sliders = document.querySelectorAll("marimo-slider");
  let injectedCount = 0;

  sliders.forEach((slider) => {
    if (injectSliderStyles(slider as HTMLElement)) {
      injectedCount++;
    }
  });

  if (injectedCount > 0) {
    console.log(`[marimo-live] Styled ${injectedCount} slider(s)`);
  }

  return injectedCount;
}

/**
 * Poll for slider elements and inject styles when ready.
 * Handles lazy-loaded sliders that may appear after initial page load.
 *
 * @param maxAttempts - Maximum polling attempts (default: 40 = 20 seconds)
 * @param intervalMs - Milliseconds between attempts (default: 500)
 */
export function pollForSliders(maxAttempts = 40, intervalMs = 500): void {
  // Prevent multiple polling loops
  if (pollingStarted) {
    return;
  }

  pollingStarted = true;
  let attempts = 0;
  let lastSliderCount = 0;

  const check = () => {
    attempts++;

    const sliders = document.querySelectorAll("marimo-slider");
    const currentCount = sliders.length;

    if (currentCount > 0) {
      // Count sliders with shadow roots
      const slidersWithShadowRoots = Array.from(sliders).filter(
        (s) => (s as HTMLElement).shadowRoot
      );

      if (slidersWithShadowRoots.length > 0) {
        const injected = injectAllSliderStyles();

        // If we found new sliders, reset attempt counter
        if (currentCount > lastSliderCount || injected > 0) {
          lastSliderCount = currentCount;
          attempts = Math.max(0, attempts - 10); // Give more time for new sliders
        }
      }
    }

    // Continue polling if under max attempts
    if (attempts < maxAttempts) {
      setTimeout(check, intervalMs);
    } else {
      pollingStarted = false;
      console.debug(`[marimo-live] Slider polling complete after ${attempts} attempts`);
    }
  };

  // Start after a short delay to let marimo initialize
  setTimeout(check, 500);
}

/**
 * Start a MutationObserver to watch for new slider elements.
 * More efficient than polling for dynamic content.
 */
export function observeSliders(): MutationObserver | null {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return null;
  }

  const observer = new MutationObserver((mutations) => {
    let foundNewSliders = false;

    for (const mutation of mutations) {
      // Check added nodes
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;

          // Direct slider
          if (element.tagName === "MARIMO-SLIDER") {
            foundNewSliders = true;
          }

          // Sliders inside added subtree
          if (element.querySelectorAll) {
            const sliders = element.querySelectorAll("marimo-slider");
            if (sliders.length > 0) {
              foundNewSliders = true;
            }
          }
        }
      }
    }

    if (foundNewSliders) {
      // Delay to let shadow root initialize
      setTimeout(injectAllSliderStyles, 100);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("[marimo-live] Slider observer started");
  return observer;
}

/**
 * Stop polling for sliders.
 */
export function stopPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  pollingStarted = false;
}

/**
 * Reset slider styling state (for testing or HMR).
 */
export function resetSliderStyles(): void {
  stopPolling();
  styledSliders = new WeakSet();
  console.log("[marimo-live] Slider styles reset");
}

/**
 * Check if a specific slider has been styled.
 */
export function isSliderStyled(slider: HTMLElement): boolean {
  return styledSliders.has(slider);
}

/**
 * Check if polling is currently active.
 */
export function isPollingActive(): boolean {
  return pollingStarted;
}
