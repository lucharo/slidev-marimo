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
  }>(),
  {
    displayCode: true,
    hideLines: () => [],
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

    // Wait for marimo to be ready
    await waitUntilReady();

    console.log(
      `✓ Island ${myIslandId}: Marimo ready, finding island element...`,
    );

    // Find our island by the marker ID attribute
    const island = document.querySelector<HTMLElement>(
      `marimo-island[data-marker-id="${myIslandId}"]`,
    );

    if (!island) {
      // Don't throw error - this happens when Slidev preloads the next slide
      // The component mounts but marimo hasn't initialized this island yet
      // Just stay in loading state - will work when user navigates to this slide and refreshes
      console.warn(
        `⏸️  Island ${myIslandId}: Not yet initialized (preloaded slide). Navigate here and refresh to load.`,
      );
      return;
    }

    console.log(
      `✓ Island ${myIslandId}: Found element, waiting for visibility...`,
    );

    // DON'T move the island - that breaks React's internal state
    // Use IntersectionObserver to continuously monitor visibility
    // This handles Slidev's slide navigation correctly
    if (islandContainer.value) {
      observer = new IntersectionObserver((entries) => {
        // Guard against callback firing during unmount
        const container = islandContainer.value;
        if (!container) return;

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Container is visible - position and show island
            const rect = container.getBoundingClientRect();

            // Position island absolutely at the same location as our placeholder
            island.style.position = "absolute";
            island.style.left = `${rect.left + window.scrollX}px`;
            island.style.top = `${rect.top + window.scrollY}px`;
            island.style.width = `${rect.width || 800}px`;
            island.style.display = "block";
            island.style.zIndex = "10";

            // Use ResizeObserver to sync container height with island height
            // This ensures content below the island flows correctly
            if (!resizeObserver) {
              resizeObserver = new ResizeObserver(() => {
                // Guard against callback firing on detached elements
                if (!island.isConnected) return;
                const islandHeight = island.offsetHeight;
                if (islandContainer.value && islandHeight > 0) {
                  islandContainer.value.style.height = `${islandHeight}px`;
                }
              });
              resizeObserver.observe(island);
            }

            // Set initial height
            const initialHeight = island.offsetHeight;
            if (initialHeight > 0) {
              container.style.height = `${initialHeight}px`;
            } else {
              // Fallback until island renders
              container.style.minHeight = "100px";
            }

            isLoading.value = false;

            console.log(
              `✓ Island ${myIslandId}: Visible and positioned, height synced`,
            );
          } else {
            // Container is NOT visible - hide island
            island.style.display = "none";
            console.log(`🔒 Island ${myIslandId}: Hidden (not visible)`);
          }
        });
      });

      // Start observing the container - keep observer active!
      observer.observe(islandContainer.value);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unknown error";
    isLoading.value = false;
    console.error(`❌ Island ${myIslandId} failed:`, err);
  }
});

// Cleanup when component unmounts
onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (marker) {
    marker.remove();
    console.log(`🗑️  Island ${myIslandId}: Marker removed`);
    marker = null;
  }
});
</script>

<template>
  <div class="marimo-island-wrapper">
    <!-- Code display -->
    <div v-if="displayCode && !error" class="code-block">
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
