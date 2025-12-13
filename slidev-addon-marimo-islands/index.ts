/**
 * Slidev Marimo Islands Addon
 *
 * Embed interactive marimo notebooks in your presentations using Pyodide/WASM.
 * No server required - fully self-contained presentations.
 */

// Main component for embedding marimo code
export { default as MarimoIsland } from "./components/MarimoIsland.vue";
// Main addon setup - automatically loaded by Slidev
export { default } from "./setup/main";
// Preparser for marimo code blocks - automatically loaded by Slidev
export { default as preparser } from "./setup/preparser";
