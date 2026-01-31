/**
 * Slidev Marimo Live Addon
 *
 * Embed interactive marimo notebooks in your presentations with a live Python kernel.
 * Requires a running marimo server for execution.
 *
 * Features:
 * - Real-time cell execution via WebSocket
 * - Full Python package support (pip ecosystem)
 * - Interactive UI elements (sliders, dropdowns, etc.)
 * - File system access from the kernel
 * - Reactive cell dependencies
 */

// Main component for live cells
export { default as MarimoLive } from "./components/MarimoLive.vue";

// Output renderer component
export { default as MarimoOutput } from "./components/MarimoOutput.vue";

// UI element wrapper
export { default as MarimoUI } from "./components/MarimoUI.vue";
export { useKernelState } from "./composables/useKernelState";
// Composables for custom integrations
export {
  KERNEL_CONNECTION_KEY,
  useMarimoKernel,
} from "./composables/useMarimoKernel";
export type {
  ConnectionState,
  KernelConfig,
  KernelConnection,
} from "./setup/kernel-connection";
// Connection utilities
export { createKernelConnection } from "./setup/kernel-connection";
// Main addon setup - automatically loaded by Slidev
export { default } from "./setup/main";
// Message types
export type {
  CellOpData,
  CellOutput,
  CellStatus,
  KernelReadyData,
  MarimoMessage,
  MarimoOp,
  UIElementMessage,
  VariablesData,
} from "./setup/message-parser";
// Preparser for marimo-live code blocks - automatically loaded by Slidev
export { default as preparser } from "./setup/preparser";
export { useUISync } from "./setup/ui-sync";
