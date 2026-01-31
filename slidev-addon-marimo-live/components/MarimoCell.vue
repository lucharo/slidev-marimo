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

import { computed } from "vue";
import MarimoLive from "./MarimoLive.vue";

const props = withDefaults(
  defineProps<{
    /** Required: Cell name, ID, or index from the notebook */
    cell: string;
    /** Show the code editor (default: inherited from MarimoLive) */
    displayCode?: boolean;
    /** Auto-execute on mount (default: inherited from MarimoLive) */
    autoRun?: boolean;
  }>(),
  {
    // Use undefined to inherit MarimoLive's defaults
    displayCode: undefined,
    autoRun: undefined,
  },
);

// Only include props that are explicitly set to avoid overriding MarimoLive defaults
const boundProps = computed(() => {
  const result: Record<string, unknown> = { cell: props.cell };
  if (props.displayCode !== undefined) result.displayCode = props.displayCode;
  if (props.autoRun !== undefined) result.autoRun = props.autoRun;
  return result;
});
</script>

<template>
  <MarimoLive v-bind="boundProps" />
</template>
