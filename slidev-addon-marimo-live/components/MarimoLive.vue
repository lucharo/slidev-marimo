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
      <div class="code-wrapper">
        <div class="line-numbers" aria-hidden="true">
          <span v-for="(_, idx) in highlightedLines" :key="idx" class="line-number">{{ idx + 1 }}</span>
        </div>
        <pre class="code-block"><code ref="codeElement" class="language-python"><span
  v-for="(lineHtml, idx) in highlightedLines"
  :key="idx"
  class="code-line"
><span class="line-content" v-html="lineHtml || ' '"></span>
</span></code></pre>
      </div>
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
/* ==========================================================================
   One Dark Pro Code Theme - Refined for Presentations
   Inspired by Atom One Dark with enhanced readability
   ========================================================================== */

/* CSS Custom Properties for easy theming */
.marimo-live {
  --code-bg: #282c34;
  --code-gutter-bg: #21252b;
  --code-gutter-border: #181a1f;
  --code-text: #abb2bf;
  --code-line-number: #495162;
  --code-line-number-active: #636d83;

  /* One Dark Pro syntax colors */
  --syntax-comment: #5c6370;
  --syntax-keyword: #c678dd;
  --syntax-string: #98c379;
  --syntax-number: #d19a66;
  --syntax-function: #61afef;
  --syntax-class: #e5c07b;
  --syntax-operator: #56b6c2;
  --syntax-punctuation: #abb2bf;
  --syntax-boolean: #d19a66;
  --syntax-decorator: #e5c07b;

  /* Output area */
  --output-bg: #1e2227;
  --output-border: #181a1f;
  --output-text: #d4d4d4;

  /* Accent colors */
  --accent-blue: #528bff;
  --accent-green: #98c379;
  --accent-red: #e06c75;
  --accent-yellow: #e5c07b;
}

.marimo-live {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: var(--code-bg);
  margin: 1rem 0;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.2),
    0 2px 4px -2px rgba(0, 0, 0, 0.1),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
}

.marimo-live:focus {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}

.marimo-live.is-running {
  box-shadow:
    0 0 0 2px var(--accent-blue),
    0 4px 6px -1px rgba(0, 0, 0, 0.2);
}

/* Code position variants */
.marimo-live.code-position-top {
  display: flex;
  flex-direction: column;
}

.marimo-live.code-position-top .code-container { order: 1; }
.marimo-live.code-position-top .output-container { order: 2; }
.marimo-live.code-position-bottom .code-container { order: 2; }
.marimo-live.code-position-bottom .output-container { order: 1; }

/* ==========================================================================
   Status Bar
   ========================================================================== */

.status-bar {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 1rem;
  background: var(--code-gutter-bg);
  border-bottom: 1px solid var(--code-gutter-border);
  font-size: 0.75rem;
  color: var(--code-line-number-active);
}

.status-indicator {
  width: 10px;
  height: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-indicator .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--code-line-number);
}

.status-indicator.running .spinner {
  width: 10px;
  height: 10px;
  border: 2px solid var(--accent-blue);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.status-indicator.idle .check {
  color: var(--accent-green);
  font-size: 0.875rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-text {
  text-transform: capitalize;
  letter-spacing: 0.02em;
}

.status-actions {
  margin-left: auto;
}

.run-button,
.interrupt-button {
  padding: 0.25rem 0.625rem;
  border: none;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  letter-spacing: 0.02em;
}

.run-button {
  background: var(--accent-blue);
  color: white;
}

.run-button:hover:not(:disabled) {
  background: #4080f0;
  transform: translateY(-1px);
}

.run-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.interrupt-button {
  background: var(--accent-red);
  color: white;
}

.interrupt-button:hover {
  background: #d35d66;
}

/* ==========================================================================
   Code Container - The Heart of the Component
   ========================================================================== */

.code-container {
  background: var(--code-bg);
}

.code-wrapper {
  display: flex;
  overflow-x: auto;
}

/* Line Numbers Gutter - Separate column for clean alignment */
.line-numbers {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 1rem 0;
  background: var(--code-gutter-bg);
  border-right: 1px solid var(--code-gutter-border);
  text-align: right;
  user-select: none;
  min-width: 3.5rem;
}

.line-number {
  display: block;
  padding: 0 1rem 0 0.75rem;
  font-size: 0.8125rem;
  line-height: 1.625;
  color: var(--code-line-number);
  font-variant-numeric: tabular-nums;
  transition: color 0.15s ease;
}

.line-number:hover {
  color: var(--code-line-number-active);
}

/* Code Block */
.code-block {
  flex: 1;
  margin: 0;
  padding: 1rem 1.25rem;
  background: transparent;
  overflow-x: auto;
}

.code-line {
  display: block;
  line-height: 1.625;
  min-height: 1.625em;
}

.line-content {
  font-size: 0.8125rem;
  color: var(--code-text);
  white-space: pre;
}

/* ==========================================================================
   Syntax Highlighting - One Dark Pro Colors
   ========================================================================== */

/* Comments */
.line-content :deep(.token.comment),
.line-content :deep(.token.prolog),
.line-content :deep(.token.doctype),
.line-content :deep(.token.cdata) {
  color: var(--syntax-comment);
  font-style: italic;
}

/* Keywords: if, for, def, class, return, import, etc. */
.line-content :deep(.token.keyword) {
  color: var(--syntax-keyword);
}

/* Built-in functions and types */
.line-content :deep(.token.builtin) {
  color: var(--syntax-class);
}

/* Function names */
.line-content :deep(.token.function) {
  color: var(--syntax-function);
}

/* Strings */
.line-content :deep(.token.string),
.line-content :deep(.token.triple-quoted-string),
.line-content :deep(.token.attr-value) {
  color: var(--syntax-string);
}

/* Numbers */
.line-content :deep(.token.number),
.line-content :deep(.token.boolean) {
  color: var(--syntax-number);
}

/* Operators: =, +, -, *, /, etc. */
.line-content :deep(.token.operator) {
  color: var(--syntax-operator);
}

/* Punctuation: (), [], {}, etc. */
.line-content :deep(.token.punctuation) {
  color: var(--syntax-punctuation);
}

/* Class names */
.line-content :deep(.token.class-name) {
  color: var(--syntax-class);
}

/* Decorators: @property, @staticmethod */
.line-content :deep(.token.decorator),
.line-content :deep(.token.annotation) {
  color: var(--syntax-decorator);
}

/* Attribute names */
.line-content :deep(.token.attr-name) {
  color: var(--syntax-number);
}

/* ==========================================================================
   Output Container
   ========================================================================== */

.output-container {
  padding: 1rem 1.25rem;
  min-height: 2.5rem;
  background: var(--output-bg);
  border-top: 1px solid var(--output-border);
  color: var(--output-text);
  font-size: 0.875rem;
  line-height: 1.5;
}

/* When output is empty, show subtle placeholder state */
.output-container:empty::before {
  content: '';
  display: block;
  height: 1.5rem;
}

/* ==========================================================================
   Warning States
   ========================================================================== */

.cell-not-found {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 1rem 1.25rem;
  background: rgba(229, 192, 123, 0.1);
  border-left: 3px solid var(--accent-yellow);
  font-size: 0.8125rem;
  color: var(--accent-yellow);
}

.connection-warning {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 1rem;
  background: rgba(229, 192, 123, 0.08);
  border-top: 1px solid rgba(229, 192, 123, 0.2);
  font-size: 0.75rem;
  color: var(--accent-yellow);
}

.warning-icon {
  font-size: 0.875rem;
  opacity: 0.9;
}

.reconnect-button {
  margin-left: auto;
  padding: 0.25rem 0.5rem;
  background: var(--accent-yellow);
  color: #1e2227;
  border: none;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.reconnect-button:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

/* ==========================================================================
   Light Mode Overrides (when Slidev is in light mode)
   ========================================================================== */

:root:not(.dark) .marimo-live {
  --code-bg: #fafafa;
  --code-gutter-bg: #f0f0f0;
  --code-gutter-border: #e0e0e0;
  --code-text: #383a42;
  --code-line-number: #9d9d9f;
  --code-line-number-active: #6a6a6c;

  /* One Light syntax colors */
  --syntax-comment: #a0a1a7;
  --syntax-keyword: #a626a4;
  --syntax-string: #50a14f;
  --syntax-number: #986801;
  --syntax-function: #4078f2;
  --syntax-class: #c18401;
  --syntax-operator: #0184bc;
  --syntax-punctuation: #383a42;
  --syntax-boolean: #986801;
  --syntax-decorator: #c18401;

  --output-bg: #ffffff;
  --output-border: #e8e8e8;
  --output-text: #383a42;

  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.08),
    0 2px 4px -2px rgba(0, 0, 0, 0.04),
    inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}
</style>
