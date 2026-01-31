<script setup lang="ts">
/**
 * MarimoOutput Component
 *
 * Renders cell output from the marimo kernel.
 * Supports HTML, images, JSON, and plain text.
 */

import { computed } from "vue";
import type { CellOutput } from "../setup/message-parser";
import { extractHtml } from "../setup/message-parser";

const props = defineProps<{
  output: CellOutput | null;
  console?: CellOutput[];
  error?: string | null;
}>();

const htmlContent = computed(() => {
  if (!props.output) return null;
  return extractHtml(props.output);
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

    <!-- Console output -->
    <pre
      v-if="consoleOutput"
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
