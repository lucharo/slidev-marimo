<script setup lang="ts">
/**
 * MarimoCell Component
 *
 * Semantic alias for MarimoLive when referencing notebook cells.
 * Use this component to embed cells from your marimo notebook in slides.
 *
 * @example Reference a notebook cell by name
 * ```vue
 * <MarimoCell cell="plot_chart" />
 * ```
 *
 * @example Reference a notebook cell by index
 * ```vue
 * <MarimoCell cell="2" />
 * ```
 *
 * @example Hide code display
 * ```vue
 * <MarimoCell cell="chart_demo" :displayCode="false" />
 * ```
 */

import MarimoLive from "./MarimoLive.vue";

defineProps<{
  /** Required: Cell name, ID, or index from the notebook */
  cell: string;
  /** Show the code editor (default: true) */
  displayCode?: boolean;
  /** Auto-execute on mount (default: true) */
  autoRun?: boolean;
}>();
</script>

<template>
  <MarimoLive :cell="cell" :displayCode="displayCode" :autoRun="autoRun" />
</template>
