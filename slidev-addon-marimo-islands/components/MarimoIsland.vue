<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, onUnmounted, ref } from "vue";
import { useIslandState } from "../composables/useIslandState";
import "../utils/debugMarimo"; // Side effect: adds window.debugMarimo()

/**
 * Marimo Island Component
 *
 * Embeds interactive marimo code cells directly into Slidev presentations using Pyodide/WASM.
 * Each island is self-contained and can execute Python code without requiring a server.
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
    hideLines?: number[];
    codePosition?: "top" | "bottom";
  }>(),
  {
    displayCode: true,
    hideLines: () => [],
    codePosition: "top",
  },
);

// Process code to hide specified lines
const processedCode = computed(() => {
  if (!props.hideLines || props.hideLines.length === 0) {
    return props.code;
  }

  const lines = props.code.split("\n");
  return lines
    .filter((_, index) => !props.hideLines.includes(index + 1))
    .join("\n");
});

// Generate unique ID from Vue's component UID (HMR-safe!)
const instance = getCurrentInstance();
const myIslandId = `island-${instance?.uid || Math.random().toString(36).slice(2)}`;

// Refs
const { waitUntilReady } = useIslandState();
const islandContainer = ref<HTMLElement | null>(null);
const error = ref<string | null>(null);
const isLoading = ref(true);
let marker: HTMLElement | null = null;
let observer: IntersectionObserver | null = null;
let resizeObserver: ResizeObserver | null = null;
let contentObserver: MutationObserver | null = null;
let resizeHandler: (() => void) | null = null;

/**
 * Find the island element with retries. Late-mounting components
 * (e.g., navigating to a new slide) may not have their island
 * created immediately.
 */
async function findIsland(
  id: string,
  maxAttempts = 10,
  intervalMs = 500,
): Promise<HTMLElement | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const island = document.querySelector<HTMLElement>(
      `marimo-island[data-marker-id="${id}"]`,
    );
    if (island) return island;
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

// After component mounts, create marker and wait for marimo
onMounted(async () => {
  try {
    // Create marker element immediately - this registers the island
    marker = document.createElement("div");
    marker.classList.add("marimo-island-marker");
    marker.setAttribute("data-island-id", myIslandId);
    marker.setAttribute(
      "data-island-code",
      encodeURIComponent(processedCode.value),
    );
    marker.setAttribute("data-island-display-code", String(props.displayCode));
    marker.setAttribute("data-island-reactive", "true");
    marker.style.display = "none";
    document.body.appendChild(marker);

    console.log(`📝 Island ${myIslandId} marker created`);

    // Wait for marimo custom element to be registered
    await waitUntilReady();

    console.log(
      `✓ Island ${myIslandId}: Marimo ready, finding island element...`,
    );

    // Find our island with retries (handles late-mounting after navigation)
    const island = await findIsland(myIslandId);

    if (!island) {
      error.value =
        "Island element not found after retries. Try refreshing the page.";
      isLoading.value = false;
      console.warn(`⏸️  Island ${myIslandId}: Not found after 10 retries.`);
      return;
    }

    console.log(
      `✓ Island ${myIslandId}: Found element, waiting for visibility...`,
    );

    // Watch for actual rendered content inside the island output
    // This ensures we don't dismiss the spinner before Python output exists
    const outputEl = island.querySelector("marimo-cell-output");
    if (outputEl) {
      contentObserver = new MutationObserver(() => {
        if (outputEl.children.length > 0) {
          isLoading.value = false;
          contentObserver?.disconnect();
          contentObserver = null;
          console.log(`✓ Island ${myIslandId}: Output rendered`);
        }
      });
      contentObserver.observe(outputEl, { childList: true, subtree: true });
      // Check if content already exists (island may have rendered quickly)
      if (outputEl.children.length > 0) {
        isLoading.value = false;
        contentObserver.disconnect();
        contentObserver = null;
      }
    }

    // Set up positioning via IntersectionObserver
    if (islandContainer.value) {
      const container = islandContainer.value;

      // Reusable position updater
      const syncPosition = () => {
        if (!container || !island.isConnected) return;
        updateIslandPosition(island, container);
      };

      // Listen for window resize to reposition
      resizeHandler = syncPosition;
      window.addEventListener("resize", resizeHandler);

      observer = new IntersectionObserver((entries) => {
        if (!islandContainer.value) return;

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            syncPosition();
            island.style.display = "block";
            island.style.zIndex = "10";

            // Sync container height with island height
            if (!resizeObserver) {
              resizeObserver = new ResizeObserver(() => {
                if (!island.isConnected) return;
                const islandHeight = island.offsetHeight;
                if (islandContainer.value && islandHeight > 0) {
                  islandContainer.value.style.height = `${islandHeight}px`;
                }
              });
              resizeObserver.observe(island);
            }

            const initialHeight = island.offsetHeight;
            if (initialHeight > 0) {
              container.style.height = `${initialHeight}px`;
            } else {
              container.style.minHeight = "100px";
            }

            console.log(`✓ Island ${myIslandId}: Visible and positioned`);
          } else {
            island.style.display = "none";
          }
        });
      });

      observer.observe(container);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unknown error";
    isLoading.value = false;
    console.error(`❌ Island ${myIslandId} failed:`, err);
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
  if (marker) {
    marker.remove();
    marker = null;
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

    <!-- Loading state - independent so it shows alongside code display -->
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
