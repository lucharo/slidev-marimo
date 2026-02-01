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

import DOMPurify from "dompurify";
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useMarimoKernel } from "../composables/useMarimoKernel";
import MarimoOutput from "./MarimoOutput.vue";

// Declare Prism type for syntax highlighting
declare global {
  interface Window {
    Prism?: {
      highlight: (code: string, grammar: unknown, language: string) => string;
      languages: Record<string, unknown>;
      highlightElement: (element: Element) => void;
    };
  }
}

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
    /** Show status bar with run button (hidden by default for clean presentation) */
    showStatusBar?: boolean;
  }>(),
  {
    displayCode: true,
    hideLines: () => [],
    codePosition: "bottom",
    autoRun: true,
    showStatusBar: false,
  },
);

// Kernel access
const kernel = useMarimoKernel();

// Resolve cell reference to notebook cell
// Depend on notebookCellsVersion which increments when cells are registered
const notebookCell = computed(() => {
  // Access notebookCellsVersion to create reactive dependency
  // This triggers re-computation when registerNotebookCells() is called
  const version = kernel.notebookCellsVersion?.value ?? 0;

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

// Ref for code element (for Prism highlighting)
const codeElement = ref<HTMLElement | null>(null);

// Highlighted code (with Prism syntax highlighting)
const highlightedCode = computed(() => {
  const code = processedCode.value;
  if (!code) return "";

  // Try to use Prism if available
  if (typeof window !== "undefined" && window.Prism?.languages?.python) {
    try {
      const highlighted = window.Prism.highlight(code, window.Prism.languages.python, "python");
      // Sanitize to prevent XSS - only allow span tags with class attributes
      return DOMPurify.sanitize(highlighted, {
        ALLOWED_TAGS: ['span'],
        ALLOWED_ATTR: ['class']
      });
    } catch {
      // Fall back to plain text
    }
  }

  // Fallback: escape HTML and return plain code
  return code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
});

// Add line numbers to highlighted code
const highlightedLines = computed(() => {
  const html = highlightedCode.value;
  if (!html) return [];
  return html.split("\n");
});

// Highlight code when Prism becomes available
function highlightCode() {
  nextTick(() => {
    if (codeElement.value && window.Prism?.highlightElement) {
      window.Prism.highlightElement(codeElement.value);
    }
  });
}

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
  // Listen for Prism ready event for syntax highlighting
  if (typeof window !== "undefined") {
    window.addEventListener("prism-ready", highlightCode, { once: true });
  }

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
  // Remove prism-ready listener in case it hasn't fired yet
  if (typeof window !== "undefined") {
    window.removeEventListener("prism-ready", highlightCode);
  }

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
    <!-- Status bar (hidden by default for clean presentation) -->
    <div v-if="showStatusBar" class="status-bar">
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

    <!-- Code display (read-only, with syntax highlighting) -->
    <div v-else-if="displayCode && cellCode" class="code-container">
      <pre class="code-block"><code ref="codeElement" class="language-python"><span
  v-for="(lineHtml, idx) in highlightedLines"
  :key="idx"
  class="code-line"
><span class="line-number">{{ idx + 1 }}</span><span class="line-content" v-html="lineHtml || '&nbsp;'"></span>
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

    <!-- Connection status warning (only show when status bar is visible) -->
    <div v-if="showStatusBar && !kernel.isConnected.value" class="connection-warning">
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
  border: 1px solid #374151;
  border-radius: 8px;
  overflow: hidden;
  background: #1f2937;
  margin: 1rem 0;
}

/* Light mode */
:root:not(.dark) .marimo-live {
  border-color: #e5e7eb;
  background: #ffffff;
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
  background: #374151;
  border-bottom: 1px solid #4b5563;
  font-size: 0.75rem;
  color: #9ca3af;
}

:root:not(.dark) .status-bar {
  background: #f9fafb;
  border-bottom-color: #e5e7eb;
  color: #6b7280;
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
  color: #abb2bf;
}

/* Prism.js syntax highlighting - One Dark theme colors */
.line-content :deep(.token.comment),
.line-content :deep(.token.prolog),
.line-content :deep(.token.doctype),
.line-content :deep(.token.cdata) {
  color: #5c6370;
  font-style: italic;
}

.line-content :deep(.token.keyword) {
  color: #c678dd;
}

.line-content :deep(.token.builtin) {
  color: #e5c07b;
}

.line-content :deep(.token.function) {
  color: #61afef;
}

.line-content :deep(.token.string),
.line-content :deep(.token.triple-quoted-string) {
  color: #98c379;
}

.line-content :deep(.token.number) {
  color: #d19a66;
}

.line-content :deep(.token.operator) {
  color: #56b6c2;
}

.line-content :deep(.token.punctuation) {
  color: #abb2bf;
}

.line-content :deep(.token.class-name) {
  color: #e5c07b;
}

.line-content :deep(.token.boolean) {
  color: #d19a66;
}

.line-content :deep(.token.decorator) {
  color: #e5c07b;
}

.line-content :deep(.token.attr-name) {
  color: #d19a66;
}

.line-content :deep(.token.attr-value) {
  color: #98c379;
}

/* Output container */
.output-container {
  padding: 0.75rem;
  min-height: 40px;
  background: #1f2937;
  color: #f9fafb;
}

:root:not(.dark) .output-container {
  background: #ffffff;
  color: #1f2937;
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
