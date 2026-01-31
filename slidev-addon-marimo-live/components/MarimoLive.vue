<script setup lang="ts">
/**
 * MarimoLive Component
 *
 * Displays a read-only Python code cell with live execution via the marimo kernel.
 * Code is authored in marimo notebook, presented in Slidev with live execution
 * and interactive outputs (sliders, dropdowns, etc.).
 *
 * @example Reference a notebook cell by name
 * ```vue
 * <MarimoLive cell="plot_chart" />
 * ```
 *
 * @example Reference a notebook cell by index
 * ```vue
 * <MarimoLive cell="2" />
 * ```
 *
 * @example Markdown syntax (reference cell)
 * ```marimo-live cell=plot_chart
 * ```
 *
 * @example Inline code (not recommended - prefer referencing notebook cells)
 * ```marimo-live
 * import pandas as pd
 * df = pd.read_csv('data.csv')
 * df.head()
 * ```
 */

import { computed, getCurrentInstance, onMounted, onUnmounted, ref, watch } from "vue";
import { useMarimoKernel } from "../composables/useMarimoKernel";
import MarimoOutput from "./MarimoOutput.vue";

const props = withDefaults(
  defineProps<{
    /** Reference to a notebook cell (ID, function name, or index) */
    cell?: string;
    /** Python code to execute (only used if cell is not provided) */
    code?: string;
    /** Show the code editor (read-only) */
    displayCode?: boolean;
    /** Line numbers to hide from display */
    hideLines?: number[];
    /** Position of code relative to output */
    codePosition?: "top" | "bottom";
    /** Custom cell ID (only used with inline code) */
    cellId?: string;
    /** Auto-run code on mount */
    autoRun?: boolean;
  }>(),
  {
    displayCode: true,
    hideLines: () => [],
    codePosition: "bottom",
    autoRun: true,
  },
);

// Kernel access
const kernel = useMarimoKernel();

// Resolve cell reference to notebook cell
// Depend on isKernelReady to re-compute when notebook cells are registered
const notebookCell = computed(() => {
  // Access isKernelReady to create reactive dependency
  const ready = kernel.isKernelReady.value;

  if (!props.cell) return null;

  // Try by ID first
  let cell = kernel.getNotebookCellById(props.cell);
  if (cell) return cell;

  // Try by name
  cell = kernel.getNotebookCellByName(props.cell);
  if (cell) return cell;

  // Try by index
  const index = Number.parseInt(props.cell, 10);
  if (!Number.isNaN(index)) {
    cell = kernel.getNotebookCellByIndex(index);
    if (cell) return cell;
  }

  return null;
});

// Get the actual cell ID (from notebook or generated)
const instance = getCurrentInstance();
const myCellId = computed(() => {
  if (notebookCell.value) {
    return notebookCell.value.id;
  }
  return (
    props.cellId ||
    `live_${instance?.uid || Math.random().toString(36).slice(2)}`
  );
});

// Get the code (from notebook or props)
const cellCode = computed(() => {
  if (notebookCell.value) {
    return notebookCell.value.code;
  }
  return props.code || "";
});

// Local state
const isRunning = ref(false);
const localError = ref<string | null>(null);
const hasRun = ref(false);
const isStartingRun = ref(false); // Guard against double execution from watchers

// Check if we're waiting for notebook cell to be loaded
const waitingForCell = computed(() => {
  return props.cell && !notebookCell.value && kernel.isKernelReady.value;
});

// Process code to hide specified lines
const processedCode = computed(() => {
  const code = cellCode.value;
  if (!props.hideLines || props.hideLines.length === 0) {
    return code;
  }
  const lines = code.split("\n");
  return lines
    .filter((_, index) => !props.hideLines.includes(index + 1))
    .join("\n");
});

// Display code with syntax highlighting placeholder
const displayLines = computed(() => {
  return processedCode.value.split("\n");
});

// Get cell state from kernel
const cellState = computed(() => kernel.getCellState(myCellId.value));

// Derived state
const output = computed(() => cellState.value?.output || null);
const consoleMessages = computed(() => cellState.value?.console || []);
const error = computed(
  () => localError.value || cellState.value?.error || null,
);
const status = computed(() => {
  if (isRunning.value) return "running";
  return cellState.value?.status || "idle";
});

/**
 * Execute the cell code
 */
async function runCell() {
  // Guard against double execution from multiple watchers
  if (isStartingRun.value) return;
  isStartingRun.value = true;

  try {
    if (!kernel.isConnected.value) {
      localError.value = "Not connected to kernel";
      return;
    }

    const code = cellCode.value;
    if (!code) {
      localError.value = props.cell
        ? `Cell not found: ${props.cell}`
        : "No code to execute";
      return;
    }

    isRunning.value = true;
    localError.value = null;

    await kernel.runCell(code, myCellId.value);
    hasRun.value = true;
  } catch (err) {
    localError.value = err instanceof Error ? err.message : "Execution failed";
  } finally {
    isRunning.value = false;
    isStartingRun.value = false;
  }
}

// Track timeout for cleanup
let autoRunTimeout: ReturnType<typeof setTimeout> | null = null;

// Check if cell already has output from instantiation
// Checks for null, undefined, AND empty string to avoid false positives
const hasExistingOutput = computed(() => {
  const output = cellState.value?.output;
  return output !== null && output !== undefined && output !== '';
});

// Auto-run on mount if enabled and connected
onMounted(() => {
  if (props.autoRun) {
    // If cell already has output from auto_instantiate, don't re-run
    if (hasExistingOutput.value) {
      hasRun.value = true;
      return;
    }

    // Check if already ready - run immediately
    if (kernel.isKernelReady.value && kernel.isConnected.value && !hasRun.value) {
      runCell();
      return;
    }

    // Otherwise, watch for kernel to become ready
    let unwatch: (() => void) | null = null;
    let unwatchConnection: (() => void) | null = null;

    const cleanup = () => {
      if (autoRunTimeout) { clearTimeout(autoRunTimeout); autoRunTimeout = null; }
      if (unwatch) { unwatch(); unwatch = null; }
      if (unwatchConnection) { unwatchConnection(); unwatchConnection = null; }
    };

    unwatch = watch(
      () => kernel.isKernelReady.value,
      (ready) => {
        if (ready && !hasRun.value) {
          // Check again for existing output (may have arrived while waiting)
          if (hasExistingOutput.value) {
            hasRun.value = true;
            cleanup();
            return;
          }
          runCell();
          cleanup();
        }
      },
    );

    unwatchConnection = watch(
      () => kernel.isConnected.value,
      (connected) => {
        if (connected && kernel.isKernelReady.value && !hasRun.value) {
          // Check again for existing output
          if (hasExistingOutput.value) {
            hasRun.value = true;
            cleanup();
            return;
          }
          runCell();
          cleanup();
        }
      },
    );

    // Cleanup watchers after 10s if never triggered
    autoRunTimeout = setTimeout(cleanup, 10000);
  }
});

// Cleanup on unmount
onUnmounted(() => {
  if (autoRunTimeout) {
    clearTimeout(autoRunTimeout);
    autoRunTimeout = null;
  }
});

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent) {
  // Ctrl/Cmd + Enter to run
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    runCell();
  }
}
</script>

<template>
  <div
    class="marimo-live"
    :class="[`code-position-${codePosition}`, { 'is-running': status === 'running' }]"
    @keydown="handleKeydown"
    tabindex="0"
  >
    <!-- Status bar -->
    <div class="status-bar">
      <div class="status-indicator" :class="status">
        <span v-if="status === 'running'" class="spinner"></span>
        <span v-else-if="status === 'idle' && hasRun" class="check">&#10003;</span>
        <span v-else class="dot"></span>
      </div>
      <span class="status-text">{{ status }}</span>
      <div class="status-actions">
        <button
          v-if="!isRunning"
          class="run-button"
          @click="runCell"
          :disabled="!kernel.isConnected.value"
          title="Run cell (Ctrl+Enter)"
        >
          &#9654; Run
        </button>
        <button
          v-else
          class="interrupt-button"
          @click="kernel.interrupt()"
          title="Interrupt execution"
        >
          &#9632; Stop
        </button>
      </div>
    </div>

    <!-- Cell not found warning -->
    <div v-if="waitingForCell" class="cell-not-found">
      <span class="warning-icon">&#9888;</span>
      <span>Cell "{{ cell }}" not found in notebook</span>
    </div>

    <!-- Code display (read-only) -->
    <div v-else-if="displayCode && cellCode" class="code-container">
      <pre class="code-block"><code class="language-python"><span
  v-for="(line, idx) in displayLines"
  :key="idx"
  class="code-line"
><span class="line-number">{{ idx + 1 }}</span><span class="line-content">{{ line }}</span>
</span></code></pre>
    </div>

    <!-- Output display -->
    <div class="output-container">
      <MarimoOutput
        :output="output"
        :console="consoleMessages"
        :error="error"
      />
    </div>

    <!-- Connection status warning -->
    <div v-if="!kernel.isConnected.value" class="connection-warning">
      <span class="warning-icon">&#9888;</span>
      <span>Not connected to marimo kernel</span>
      <button @click="kernel.connect()" class="reconnect-button">
        Reconnect
      </button>
    </div>
  </div>
</template>

<style scoped>
.marimo-live {
  position: relative;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: #ffffff;
  margin: 1rem 0;
}

.marimo-live:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.marimo-live.is-running {
  border-color: #3b82f6;
}

/* Code position variants */
.marimo-live.code-position-top {
  display: flex;
  flex-direction: column;
}

.marimo-live.code-position-top .code-container {
  order: 1;
}

.marimo-live.code-position-top .output-container {
  order: 2;
}

.marimo-live.code-position-bottom .code-container {
  order: 2;
}

.marimo-live.code-position-bottom .output-container {
  order: 1;
}

/* Status bar */
.status-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.75rem;
}

.status-indicator {
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-indicator .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9ca3af;
}

.status-indicator.running .spinner {
  width: 10px;
  height: 10px;
  border: 2px solid #3b82f6;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.status-indicator.idle .check {
  color: #22c55e;
  font-weight: bold;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-text {
  color: #6b7280;
  text-transform: capitalize;
}

.status-actions {
  margin-left: auto;
}

.run-button,
.interrupt-button {
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.15s;
}

.run-button {
  background: #3b82f6;
  color: white;
}

.run-button:hover:not(:disabled) {
  background: #2563eb;
}

.run-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.interrupt-button {
  background: #ef4444;
  color: white;
}

.interrupt-button:hover {
  background: #dc2626;
}

/* Code container */
.code-container {
  background: #1f2937;
  overflow-x: auto;
}

.code-block {
  margin: 0;
  padding: 0.75rem 0;
  font-family: "Fira Mono", monospace;
  font-size: 0.875rem;
  line-height: 1.5;
}

.code-line {
  display: block;
}

.line-number {
  display: inline-block;
  width: 3rem;
  padding-right: 1rem;
  text-align: right;
  color: #9ca3af;
  user-select: none;
}

.line-content {
  color: #f9fafb;
}

/* Output container */
.output-container {
  padding: 0.75rem;
  min-height: 40px;
}

/* Cell not found warning */
.cell-not-found {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: #fef3c7;
  font-size: 0.875rem;
  color: #92400e;
}

/* Connection warning */
.connection-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #fef3c7;
  border-top: 1px solid #fcd34d;
  font-size: 0.75rem;
  color: #92400e;
}

.warning-icon {
  font-size: 1rem;
}

.reconnect-button {
  margin-left: auto;
  padding: 0.25rem 0.5rem;
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
}

.reconnect-button:hover {
  background: #d97706;
}
</style>
