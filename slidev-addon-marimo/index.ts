/**
 * Slidev Marimo Addon
 *
 * Embed interactive marimo notebooks in your presentations.
 * Supports two modes:
 *
 * 1. Islands Mode (Pyodide/WASM) - No server required, fully self-contained
 *    Use ```marimo code blocks
 *
 * 2. Live Mode (WebSocket kernel) - Full Python kernel with pip ecosystem
 *    Use ```marimo-live code blocks with a running marimo server
 */

// ============================================================================
// Islands Mode - Pyodide/WASM execution
// ============================================================================

// Main component for embedding marimo code (WASM execution)
export { default as MarimoIsland } from "./components/islands/MarimoIsland.vue";

// ============================================================================
// Live Mode - WebSocket kernel execution
// ============================================================================

// Main component for live cells
export { default as MarimoLive } from "./components/live/MarimoLive.vue";

// Output renderer component
export { default as MarimoOutput } from "./components/live/MarimoOutput.vue";

// UI element wrapper
export { default as MarimoUI } from "./components/live/MarimoUI.vue";

// Kernel state composable
export { useKernelState } from "./composables/live/useKernelState";

// Composables for custom integrations
export {
  KERNEL_CONNECTION_KEY,
  useMarimoKernel,
} from "./composables/live/useMarimoKernel";

// Connection utilities
export { createKernelConnection } from "./setup/live/kernel-connection";
export type {
  ConnectionState,
  KernelConfig,
  KernelConnection,
} from "./setup/live/kernel-connection";

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
} from "./setup/live/message-parser";

// UI sync utilities
export { useUISync } from "./setup/live/ui-sync";

// ============================================================================
// Main Setup & Preparsers - Automatically loaded by Slidev
// ============================================================================

// Main addon setup - initializes both modes as needed
export { default } from "./setup/main";

// Preparser for marimo code blocks - handles both ```marimo and ```marimo-live
export { default as preparser } from "./setup/preparser";
