<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useMarimoKernel } from "../composables/useMarimoKernel";
import { useCellRegistry } from "../composables/useCellRegistry";
import { createSingleIsland, isMarimoInitialized } from "../setup/island-manager";
import "../utils/debugMarimo"; // Side effect: adds window.debugMarimo()

/**
 * Marimo Island Component
 *
 * Embeds interactive marimo code cells directly into Slidev presentations using Pyodide/WASM.
 * Each island is self-contained and can execute Python code without requiring a server.
 *
 * Architecture:
 * - Uses deterministic cell IDs matching marimo's seeded random (seed 42)
 * - Islands are moved INTO the Vue component tree for proper positioning
 * - No absolute positioning - islands flow with the document
 *
 * @example
 * ```vue
 * <template>
 *   <MarimoIsland
 *     :code="import marimo as mo
 * import polars as pl
 *
 * df = pl.DataFrame({
 *     'name': ['Alice', 'Bob', 'Charlie'],
 *     'score': [95, 87, 91]
 * })
 * df"
 *   />
 * </template>
 * ```
 */

// Component props
const props = withDefaults(
  defineProps<{
    code: string;
    displayCode?: boolean;
    hideLines?: number | number[];
    codePosition?: "top" | "bottom";
  }>(),
  {
    displayCode: true,
    hideLines: () => [],
    codePosition: "top",
  },
);

// Normalize hideLines to always be an array (handles number | number[])
const normalizedHideLines = computed<number[]>(() => {
  if (typeof props.hideLines === "number") {
    return [props.hideLines];
  }
  return props.hideLines || [];
});

// Process code to hide specified lines
const processedCode = computed(() => {
  if (normalizedHideLines.value.length === 0) {
    return props.code;
  }

  const lines = props.code.split("\n");
  return lines
    .filter((_, index) => !normalizedHideLines.value.includes(index + 1))
    .join("\n");
});

// Get kernel and registry from Vue context
const kernel = useMarimoKernel();
const registry = useCellRegistry();

// Component state
const cellId = ref<string | null>(null);
const outputContainer = ref<HTMLElement | null>(null);
const codeElement = ref<HTMLElement | null>(null);
const error = ref<string | null>(null);
const isLoading = ref(true);

// Highlight code when element is available
const highlightCode = async () => {
  await nextTick();
  if (codeElement.value && typeof window !== "undefined") {
    // Use Prism if available (loaded by setup)
    const Prism = (window as any).Prism;
    if (Prism?.languages?.python) {
      Prism.highlightElement(codeElement.value);
    }
  }
};

// Watch for code element and highlight
watch(codeElement, highlightCode);

// Listen for Prism ready event (fired after Python language loads)
if (typeof window !== "undefined") {
  window.addEventListener("prism-ready", highlightCode, { once: true });
}

// Observers and timeouts for cleanup
let contentObserver: MutationObserver | null = null;
let spinnerTimeout: ReturnType<typeof setTimeout> | null = null;
let noOutputTimeout: ReturnType<typeof setTimeout> | null = null;

// Module-level flag to prevent multiple components from starting slider polling
let sliderPollingStarted = false;

// Retry configuration for finding island elements
const FIND_ISLAND_MAX_ATTEMPTS = 20;
const FIND_ISLAND_INTERVAL_MS = 250;

/**
 * Find the island element with retries.
 * Handles cases where kernel is still initializing.
 */
async function findIsland(
  id: string,
  maxAttempts = FIND_ISLAND_MAX_ATTEMPTS,
  intervalMs = FIND_ISLAND_INTERVAL_MS,
): Promise<HTMLElement | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const island = document.querySelector<HTMLElement>(
      `marimo-island[data-cell-id="${id}"]`,
    );
    if (island) return island;

    // Log progress periodically
    if ((attempt + 1) % 5 === 0) {
      console.debug(`🔍 Cell ${id}: finding island, attempt ${attempt + 1}/${maxAttempts}...`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

/**
 * Inject styles into ALL marimo-slider shadow DOMs on the page.
 * Shadow DOM isolates styles, so Tailwind classes inside don't work without this.
 * Searches globally because sliders are deeply nested inside marimo-island internals.
 */
function injectAllSliderStyles() {
  // Search globally - sliders are inside marimo-island's React-rendered structure
  const sliders = document.querySelectorAll('marimo-slider');
  let injectedCount = 0;

  sliders.forEach((slider) => {
    const shadowRoot = (slider as HTMLElement).shadowRoot;
    if (shadowRoot && !shadowRoot.querySelector('#marimo-slider-fix')) {
      const style = document.createElement('style');
      style.id = 'marimo-slider-fix';
      // Use CSS custom properties with fallbacks for theme compatibility
      // CSS custom properties inherit into shadow DOM
      style.textContent = `
        [data-orientation="horizontal"] {
          width: 200px !important;
          display: flex !important;
          align-items: center !important;
        }
        [data-testid="track"] {
          width: 100% !important;
          height: 8px !important;
          background-color: var(--ring, #64748b) !important;
          border-radius: 9999px !important;
        }
        [data-testid="range"] {
          height: 100% !important;
          background-color: var(--primary, #3b82f6) !important;
          border-radius: 9999px !important;
        }
        [data-testid="thumb"] {
          width: 16px !important;
          height: 16px !important;
          background-color: var(--background, white) !important;
          border: 2px solid var(--primary, #3b82f6) !important;
          border-radius: 50% !important;
        }
      `;
      shadowRoot.appendChild(style);
      injectedCount++;
    }
  });

  return injectedCount;
}

/**
 * Poll for slider shadow roots and inject styles when ready.
 * Runs globally with longer polling to handle slow marimo initialization.
 */
function pollForSliders(maxAttempts = 20) {
  let attempts = 0;
  const check = () => {
    const sliders = document.querySelectorAll('marimo-slider');
    if (sliders.length === 0) {
      // No sliders yet, keep polling
      if (attempts < maxAttempts) {
        attempts++;
        setTimeout(check, 500);
      }
      return;
    }

    // Check if all sliders have shadow roots
    const slidersWithShadowRoots = Array.from(sliders).filter(
      (s) => (s as HTMLElement).shadowRoot
    );

    if (slidersWithShadowRoots.length > 0) {
      const injected = injectAllSliderStyles();
      // If we injected some but not all, keep polling for more
      if (injected < sliders.length && attempts < maxAttempts) {
        attempts++;
        setTimeout(check, 500);
      }
    } else if (attempts < maxAttempts) {
      attempts++;
      setTimeout(check, 500);
    }
  };
  setTimeout(check, 1000); // Start after 1 second to let marimo initialize
}

/**
 * Move the island element into our output container.
 * This keeps the island in Vue's DOM flow for proper positioning.
 */
function moveIslandToContainer(island: HTMLElement, container: HTMLElement) {
  // Remove absolute positioning that marimo might have set
  island.style.position = 'relative';
  island.style.left = '';
  island.style.top = '';
  island.style.width = '100%';
  island.style.display = 'block';
  island.style.zIndex = '';

  // Move the island into our container
  container.appendChild(island);

  console.debug(`📍 Island moved into container for inline positioning`);
}

// Mount: register cell and set up island
onMounted(async () => {
  // Highlight code block (runs synchronously before async operations)
  highlightCode();

  try {
    // Step 1: Register this cell in the registry
    cellId.value = registry.registerCell(processedCode.value, true);
    console.debug(`📝 Cell ${cellId.value}: mounted, waiting for kernel...`);

    // Step 2: Wait for kernel to be ready
    await kernel.waitForReady();
    console.log(`✓ Cell ${cellId.value}: kernel ready`);

    // Step 3: Find or create the island element
    // If marimo was already initialized, we need to create the island ourselves
    let island: HTMLElement | null = null;

    if (isMarimoInitialized()) {
      // Late-mounting component - create island directly
      island = createSingleIsland(registry, cellId.value);
      // Fall back to findIsland if direct creation failed
      if (!island) {
        console.debug(`⚠️ Cell ${cellId.value}: createSingleIsland failed, falling back to findIsland`);
        island = await findIsland(cellId.value);
      }
    } else {
      // Island should have been created during initial batch
      island = await findIsland(cellId.value);
    }

    if (!island) {
      error.value = "Island element not found. Try refreshing the page.";
      isLoading.value = false;
      console.warn(`⏸️ Cell ${cellId.value}: island not found after retries`);
      return;
    }

    // Store in const for type narrowing in async callbacks
    const islandEl = island;

    console.log(`✓ Cell ${cellId.value}: found island element`);

    // Step 4: Watch for actual rendered content
    const outputEl = islandEl.querySelector("marimo-cell-output");
    if (outputEl) {
      const checkForContent = () => {
        // Check for any content (children, text, or shadow DOM content)
        const hasContent =
          outputEl.children.length > 0 ||
          (outputEl.textContent?.trim().length ?? 0) > 0 ||
          (outputEl.shadowRoot?.children.length ?? 0) > 0;
        return hasContent;
      };

      if (checkForContent()) {
        isLoading.value = false;
        console.log(`✓ Cell ${cellId.value}: output already rendered`);
      } else {
        contentObserver = new MutationObserver(() => {
          if (checkForContent()) {
            isLoading.value = false;
            contentObserver?.disconnect();
            contentObserver = null;
            if (spinnerTimeout) {
              clearTimeout(spinnerTimeout);
              spinnerTimeout = null;
            }
            console.log(`✓ Cell ${cellId.value}: output rendered`);
          }
        });
        contentObserver.observe(outputEl, {
          childList: true,
          subtree: true,
          characterData: true,
        });

        // Fallback: hide spinner after 30 seconds regardless
        spinnerTimeout = setTimeout(() => {
          if (isLoading.value) {
            isLoading.value = false;
            contentObserver?.disconnect();
            contentObserver = null;
            console.log(`⏰ Cell ${cellId.value}: spinner timeout, hiding loader`);
          }
          spinnerTimeout = null;
        }, 30000);
      }
    } else {
      // No output element found, hide spinner after delay
      console.debug(`⚠️ Cell ${cellId.value}: no output element found, hiding spinner in 5s`);
      noOutputTimeout = setTimeout(() => {
        isLoading.value = false;
        noOutputTimeout = null;
      }, 5000);
    }

    // Step 5: Move island into our container for inline positioning
    if (outputContainer.value) {
      moveIslandToContainer(islandEl, outputContainer.value);
      console.log(`✓ Cell ${cellId.value}: positioned inline`);

      // Step 6: Poll for sliders and inject styles globally
      // Run once per page, not per component
      if (!sliderPollingStarted) {
        sliderPollingStarted = true;
        pollForSliders();
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unknown error";
    isLoading.value = false;
    console.error(`❌ Cell ${cellId.value} failed:`, err);
  }
});

// Cleanup when component unmounts
onUnmounted(() => {
  if (contentObserver) {
    contentObserver.disconnect();
    contentObserver = null;
  }
  if (spinnerTimeout) {
    clearTimeout(spinnerTimeout);
    spinnerTimeout = null;
  }
  if (noOutputTimeout) {
    clearTimeout(noOutputTimeout);
    noOutputTimeout = null;
  }

  // Unregister cell from registry
  if (cellId.value) {
    registry.unregisterCell(cellId.value);
    console.log(`🗑️ Cell ${cellId.value}: unmounted`);
  }
});

// HMR: Force full page reload when this component changes
// Marimo island state cannot be hot-reloaded
if (import.meta.hot) {
  import.meta.hot.decline();
}
</script>

<template>
  <div class="marimo-island-wrapper">
    <!-- Code display (top position) -->
    <div v-if="displayCode && !error && codePosition === 'top'" class="code-block">
      <pre><code ref="codeElement" class="language-python">{{ processedCode }}</code></pre>
    </div>

    <!-- Error state -->
    <div v-if="error" class="error-box">
      <div class="error-icon">⚠️</div>
      <div class="error-message">{{ error }}</div>
      <div class="error-hint">
        Open browser console and run: <code>window.debugMarimo()</code>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading && !error" class="loading-box">
      <div class="spinner"></div>
      <div class="loading-message">Initializing Python runtime...</div>
    </div>

    <!-- Output container - marimo island will be moved HERE for inline flow -->
    <div ref="outputContainer" class="output-container"></div>

    <!-- Code display (bottom position) -->
    <div v-if="displayCode && !error && codePosition === 'bottom'" class="code-block">
      <pre><code ref="codeElement" class="language-python">{{ processedCode }}</code></pre>
    </div>
  </div>
</template>

<style scoped>
.marimo-island-wrapper {
  position: relative;
  margin: 1rem 0;
  min-height: 80px;
}

.error-box {
  border: 2px solid #ef4444;
  border-radius: 8px;
  padding: 1rem;
  background: #fee2e2;
  color: #991b1b;
}

.error-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.error-message {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.error-hint {
  font-size: 0.875rem;
  color: #7f1d1d;
}

.error-hint code {
  background: #fca5a5;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-family: monospace;
}

.loading-box {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem 2rem;
  background: rgba(243, 244, 246, 0.95);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-message {
  color: #6b7280;
  font-size: 0.875rem;
}

.output-container {
  /* Container for marimo island - flows with document */
  min-height: 50px;
}

/* Style marimo islands when they're inside our container */
.output-container :deep(marimo-island) {
  display: block;
  width: 100%;
}

/* Hide marimo's built-in copy/run buttons for cleaner presentation */
.output-container :deep(.marimo-copy-button),
.output-container :deep(.marimo-run-button),
.output-container :deep([data-testid="copy-button"]),
.output-container :deep([data-testid="run-button"]) {
  display: none;
}

/* Clean up marimo output styling */
.output-container :deep(marimo-cell-output) {
  padding: 1rem;
  background: var(--slidev-code-background, #f8f9fa);
  border-radius: 6px;
  overflow-x: auto;
}

.code-block {
  margin-bottom: 0.5rem;
  border-radius: 6px;
  overflow: hidden;
}

.code-block pre {
  margin: 0;
  padding: 1rem;
  background: #1e1e1e;
  overflow-x: auto;
}

.code-block code {
  font-family: 'Fira Code', 'Fira Mono', Menlo, Monaco, 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #d4d4d4;
  white-space: pre;
}
</style>
