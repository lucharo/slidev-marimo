<script setup lang="ts">
/**
 * MarimoUI Component
 *
 * Wrapper for marimo UI elements that syncs state with the kernel.
 * Renders interactive controls like sliders, dropdowns, checkboxes, etc.
 *
 * Note: This is a basic implementation. Full UI element support would require
 * rendering the actual marimo UI component HTML and intercepting events.
 *
 * For now, this component provides a framework for future expansion.
 */

import { computed, inject, onMounted, ref, watch } from "vue";
import { KERNEL_CONNECTION_KEY } from "../../composables/live/useMarimoKernel";
import type { KernelConnection } from "../../setup/live/kernel-connection";
import { syncUIValue, useUISync } from "../../setup/live/ui-sync";

const props = defineProps<{
  /** The marimo UI element object ID */
  objectId: string;
  /** The type of UI element */
  elementType: "slider" | "dropdown" | "checkbox" | "text" | "button";
  /** Initial value */
  initialValue?: unknown;
  /** Options for dropdowns */
  options?: string[];
  /** Min value for sliders */
  min?: number;
  /** Max value for sliders */
  max?: number;
  /** Step for sliders */
  step?: number;
  /** Label */
  label?: string;
}>();

const emit = defineEmits<{
  change: [value: unknown];
}>();

const kernel = inject<KernelConnection>(KERNEL_CONNECTION_KEY);
const { uiValues } = useUISync();

// Local value with initial state
const localValue = ref<unknown>(props.initialValue);

// Sync with global UI state
watch(
  () => uiValues.get(props.objectId),
  (newValue) => {
    if (newValue !== undefined && newValue !== localValue.value) {
      localValue.value = newValue;
    }
  },
  { immediate: true },
);

// Handle value changes
function handleChange(newValue: unknown) {
  localValue.value = newValue;
  emit("change", newValue);

  if (kernel) {
    syncUIValue(kernel, props.objectId, newValue);
  }
}

// Handle slider input
function handleSliderInput(event: Event) {
  const target = event.target as HTMLInputElement;
  handleChange(Number(target.value));
}

// Handle dropdown change
function handleDropdownChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  handleChange(target.value);
}

// Handle checkbox change
function handleCheckboxChange(event: Event) {
  const target = event.target as HTMLInputElement;
  handleChange(target.checked);
}

// Handle text input
function handleTextInput(event: Event) {
  const target = event.target as HTMLInputElement;
  handleChange(target.value);
}

// Handle button click
function handleButtonClick() {
  handleChange(Date.now()); // Buttons often use timestamps as "click" values
}
</script>

<template>
  <div class="marimo-ui" :class="`ui-${elementType}`">
    <label v-if="label" class="ui-label">{{ label }}</label>

    <!-- Slider -->
    <template v-if="elementType === 'slider'">
      <div class="slider-container">
        <input
          type="range"
          :min="min ?? 0"
          :max="max ?? 100"
          :step="step ?? 1"
          :value="localValue as number"
          @input="handleSliderInput"
          class="ui-slider"
        />
        <span class="slider-value">{{ localValue }}</span>
      </div>
    </template>

    <!-- Dropdown -->
    <template v-else-if="elementType === 'dropdown'">
      <select
        :value="localValue as string"
        @change="handleDropdownChange"
        class="ui-dropdown"
      >
        <option
          v-for="opt in options"
          :key="opt"
          :value="opt"
        >
          {{ opt }}
        </option>
      </select>
    </template>

    <!-- Checkbox -->
    <template v-else-if="elementType === 'checkbox'">
      <input
        type="checkbox"
        :checked="localValue as boolean"
        @change="handleCheckboxChange"
        class="ui-checkbox"
      />
    </template>

    <!-- Text Input -->
    <template v-else-if="elementType === 'text'">
      <input
        type="text"
        :value="localValue as string"
        @input="handleTextInput"
        class="ui-text"
        placeholder="Enter text..."
      />
    </template>

    <!-- Button -->
    <template v-else-if="elementType === 'button'">
      <button
        @click="handleButtonClick"
        class="ui-button"
      >
        {{ label || 'Click' }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.marimo-ui {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.ui-label {
  font-size: 0.875rem;
  color: #374151;
  font-weight: 500;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ui-slider {
  width: 150px;
  height: 6px;
  appearance: none;
  background: #e5e7eb;
  border-radius: 3px;
  cursor: pointer;
}

.ui-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.15s;
}

.ui-slider::-webkit-slider-thumb:hover {
  background: #2563eb;
}

.slider-value {
  min-width: 3rem;
  font-family: "Fira Mono", monospace;
  font-size: 0.875rem;
  color: #6b7280;
}

.ui-dropdown {
  padding: 0.375rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-size: 0.875rem;
  cursor: pointer;
  min-width: 120px;
}

.ui-dropdown:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.ui-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #3b82f6;
}

.ui-text {
  padding: 0.375rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  min-width: 200px;
}

.ui-text:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.ui-button {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.ui-button:hover {
  background: #2563eb;
}

.ui-button:active {
  background: #1d4ed8;
}
</style>
