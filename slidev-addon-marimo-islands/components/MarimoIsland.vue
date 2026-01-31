<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
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
 * - Uses proper 4-char cell IDs matching marimo's expected format
 * - Coordinates with kernel and registry singletons for state management
 * - Islands are created BEFORE marimo script loads for correct initialization
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
 *
 * @example Markdown Syntax
 * ```markdown
 * ```marimo
 * import marimo as mo
 * import polars as pl
 *
 * df = pl.DataFrame(...)
 * df
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
const islandContainer = ref<HTMLElement | null>(null);
const error = ref<string | null>(null);
const isLoading = ref(true);

// Observers and handlers for cleanup
let observer: IntersectionObserver | null = null;
let resizeObserver: ResizeObserver | null = null;
let contentObserver: MutationObserver | null = null;
let resizeHandler: (() => void) | null = null;

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
 * Position the island element over our container placeholder.
 */
function updateIslandPosition(island: HTMLElement, container: HTMLElement) {
  const rect = container.getBoundingClientRect();
  island.style.position = "absolute";
  island.style.left = `${rect.left + window.scrollX}px`;
  island.style.top = `${rect.top + window.scrollY}px`;
  island.style.width = `${rect.width || 800}px`;
}

// Mount: register cell and set up island
onMounted(async () => {
  try {
    // Step 1: Register this cell in the registry
    cellId.value = registry.registerCell(processedCode.value, true);
    console.log(`📝 Cell ${cellId.value}: mounted, waiting for kernel...`);

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
      contentObserver = new MutationObserver(() => {
        if (outputEl.children.length > 0) {
          isLoading.value = false;
          contentObserver?.disconnect();
          contentObserver = null;
          console.log(`✓ Cell ${cellId.value}: output rendered`);
        }
      });
      contentObserver.observe(outputEl, { childList: true, subtree: true });

      // Check if content already exists
      if (outputEl.children.length > 0) {
        isLoading.value = false;
        contentObserver.disconnect();
        contentObserver = null;
      }
    }

    // Step 5: Set up positioning via IntersectionObserver
    if (islandContainer.value) {
      const container = islandContainer.value;

      const syncPosition = () => {
        if (!container || !islandEl.isConnected) return;
        updateIslandPosition(islandEl, container);
      };

      // Listen for window resize
      resizeHandler = syncPosition;
      window.addEventListener("resize", resizeHandler);

      observer = new IntersectionObserver((entries) => {
        if (!islandContainer.value) return;

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            syncPosition();
            islandEl.style.display = "block";
            islandEl.style.zIndex = "10";

            // Sync container height with island height
            if (!resizeObserver) {
              resizeObserver = new ResizeObserver(() => {
                if (!islandEl.isConnected) return;
                const islandHeight = islandEl.offsetHeight;
                if (islandContainer.value && islandHeight > 0) {
                  islandContainer.value.style.height = `${islandHeight}px`;
                }
              });
              resizeObserver.observe(islandEl);
            }

            const initialHeight = islandEl.offsetHeight;
            if (initialHeight > 0) {
              container.style.height = `${initialHeight}px`;
            } else {
              container.style.minHeight = "100px";
            }

            console.log(`✓ Cell ${cellId.value}: visible and positioned`);
          } else {
            islandEl.style.display = "none";
          }
        });
      });

      observer.observe(container);
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
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
  }

  // Unregister cell from registry
  if (cellId.value) {
    registry.unregisterCell(cellId.value);
    console.log(`🗑️ Cell ${cellId.value}: unmounted`);
  }
});
</script>

<template>
  <div class="marimo-island-wrapper">
    <!-- Code display (top position) -->
    <div v-if="displayCode && !error && codePosition === 'top'" class="code-block">
      <pre><code class="language-python">{{ processedCode }}</code></pre>
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

    <!-- Island container - marimo output will be positioned here -->
    <div ref="islandContainer" class="island-content"></div>

    <!-- Code display (bottom position) -->
    <div v-if="displayCode && !error && codePosition === 'bottom'" class="code-block">
      <pre><code class="language-python">{{ processedCode }}</code></pre>
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
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem 2rem;
  background: rgba(243, 244, 246, 0.95);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
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

.island-content {
  /* Island will be rendered here */
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
