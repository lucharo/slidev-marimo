<script setup lang="ts">
/**
 * MarimoOutput Component
 *
 * Renders cell output from the marimo kernel.
 * Supports HTML, images, JSON, and plain text.
 * Also handles hydration of marimo UI elements like sliders.
 */

import DOMPurify from "dompurify";
import { computed, nextTick, watch } from "vue";
import type { CellOutput } from "../setup/message-parser";
import { extractHtml } from "../setup/message-parser";
import { injectAllSliderStyles } from "../setup/slider-styles";

const props = defineProps<{
  output: CellOutput | null;
  console?: CellOutput[];
  error?: string | null;
}>();

// Configure DOMPurify to allow marimo's custom elements
const MARIMO_TAGS = [
  "marimo-ui-element",
  "marimo-slider",
  "marimo-dropdown",
  "marimo-checkbox",
  "marimo-switch",
  "marimo-text",
  "marimo-text-area",
  "marimo-button",
  "marimo-number",
  "marimo-date",
  "marimo-radio",
  "marimo-multiselect",
  "marimo-file",
  "marimo-dataframe",
  "marimo-table",
  "marimo-code-editor",
  "marimo-chart",
  "marimo-altair",
  "marimo-plotly",
  "marimo-html",
  "marimo-md",
  "marimo-accordion",
  "marimo-tabs",
  "marimo-tree",
  "marimo-stat",
  "marimo-callout",
  "marimo-progress",
  "marimo-status",
  "marimo-lazy",
  "marimo-anywidget",
];

// Attributes allowed on marimo custom elements
const MARIMO_ATTRS = [
  "object-id",
  "random-id",
  "label",
  "min",
  "max",
  "step",
  "value",
  "disabled",
  "placeholder",
];

// Whitelist of safe attribute names for marimo elements (prevents XSS via attribute injection)
const SAFE_ATTR_NAMES = new Set([
  ...MARIMO_ATTRS,
  "class",
  "style",
  "id",
  "name",
  "type",
  "aria-label",
  "aria-describedby",
  "aria-hidden",
  "role",
  "tabindex",
  "title",
  "checked",
  "selected",
  "readonly",
  "required",
  "multiple",
  "pattern",
  "maxlength",
  "minlength",
  "autocomplete",
  "autofocus",
  "form",
  "list",
  "accept",
  "src",
  "alt",
  "width",
  "height",
]);

const htmlContent = computed(() => {
  if (!props.output) return null;
  const html = extractHtml(props.output);
  // Sanitize HTML to prevent XSS, but allow marimo's custom elements
  return html
    ? DOMPurify.sanitize(html, {
        ADD_TAGS: MARIMO_TAGS,
        ADD_ATTR: MARIMO_ATTRS,
        CUSTOM_ELEMENT_HANDLING: {
          tagNameCheck: (tagName) => tagName.startsWith("marimo-"),
          attributeNameCheck: (attrName) => {
            // Allow known safe attributes and data-* attributes
            return (
              SAFE_ATTR_NAMES.has(attrName) || attrName.startsWith("data-")
            );
          },
          allowCustomizedBuiltInElements: true,
        },
      })
    : null;
});

// Console array is normalized by kernel-connection.ts; this handles data field rendering
const consoleOutput = computed(() => {
  if (!props.console || props.console.length === 0) return null;
  return props.console
    .map((c) => {
      const prefix = c.channel === "stderr" ? "[stderr] " : "";
      const data = typeof c.data === "string" ? c.data : JSON.stringify(c.data);
      return `${prefix}${data}`;
    })
    .join("\n");
});

// Check if console output contains actual HTML tags from marimo's formatter
// More specific pattern to avoid false positives with comparison operators
const consoleHasHtml = computed(() => {
  if (!consoleOutput.value) return false;
  // Match marimo's traceback HTML patterns: <span class="..."> or paired tags
  return (
    /<(span|div|pre|code)[^>]*class=/i.test(consoleOutput.value) ||
    /<(span|div|pre|code)[^>]*>[\s\S]*<\/\1>/i.test(consoleOutput.value)
  );
});

// Sanitize console HTML output
const sanitizedConsoleHtml = computed(() => {
  if (!consoleOutput.value) return "";
  return DOMPurify.sanitize(consoleOutput.value);
});

// Track timeout for cleanup
let sliderStyleTimeout: ReturnType<typeof setTimeout> | null = null;

// When HTML content changes, trigger slider styling after render
// This ensures sliders that are dynamically added get proper styling
watch(htmlContent, (newContent, _oldContent, onCleanup) => {
  // Clear any pending timeout from previous watch
  if (sliderStyleTimeout) {
    clearTimeout(sliderStyleTimeout);
    sliderStyleTimeout = null;
  }

  if (newContent && newContent.includes("marimo-slider")) {
    // Wait for DOM update then inject slider styles
    nextTick(() => {
      // Small delay to let custom elements initialize
      sliderStyleTimeout = setTimeout(() => {
        injectAllSliderStyles();
        sliderStyleTimeout = null;
      }, 100);
    });
  }

  // Cleanup on unmount or before next watch callback
  onCleanup(() => {
    if (sliderStyleTimeout) {
      clearTimeout(sliderStyleTimeout);
      sliderStyleTimeout = null;
    }
  });
});
</script>

<template>
  <div class="marimo-output">
    <!-- Error display -->
    <div v-if="error" class="output-error">
      <div class="error-icon">&#9888;</div>
      <div class="error-message">{{ error }}</div>
    </div>

    <!-- Main output -->
    <div
      v-else-if="htmlContent"
      class="output-content"
      v-html="htmlContent"
    />

    <!-- Console output (render as sanitized HTML if it contains HTML tags) -->
    <div
      v-if="consoleOutput && consoleHasHtml"
      class="output-console output-console-html"
      v-html="sanitizedConsoleHtml"
    />
    <pre
      v-else-if="consoleOutput"
      class="output-console"
    >{{ consoleOutput }}</pre>

    <!-- Empty state -->
    <div
      v-else-if="!error && !htmlContent"
      class="output-empty"
    >
      No output
    </div>
  </div>
</template>

<style scoped>
.marimo-output {
  min-height: 20px;
  width: 100%;
}

.output-content {
  width: 100%;
  overflow-x: auto;
}

/* Deep styles for rendered HTML content */
.output-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.875rem;
}

.output-content :deep(th),
.output-content :deep(td) {
  border: 1px solid #e5e7eb;
  padding: 0.5rem;
  text-align: left;
}

.output-content :deep(th) {
  background: #f9fafb;
  font-weight: 600;
}

.output-content :deep(tr:hover) {
  background: #f3f4f6;
}

.output-content :deep(img) {
  max-width: 100%;
  height: auto;
}

.output-content :deep(pre) {
  background: #f9fafb;
  padding: 0.75rem;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.875rem;
}

.output-content :deep(code) {
  font-family: "Fira Mono", monospace;
}

.output-error {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
}

.error-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.error-message {
  font-family: "Fira Mono", monospace;
  font-size: 0.875rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.output-console {
  background: #1f2937;
  color: #e5e7eb;
  padding: 0.75rem;
  border-radius: 4px;
  font-family: "Fira Mono", monospace;
  font-size: 0.75rem;
  margin-top: 0.5rem;
  overflow-x: auto;
  white-space: pre-wrap;
}

.output-empty {
  color: #9ca3af;
  font-style: italic;
  font-size: 0.875rem;
}
</style>
