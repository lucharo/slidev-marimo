/**
 * UI Element Sync
 *
 * Handles synchronization of marimo UI element state between the frontend
 * and the kernel. When a user interacts with a slider, dropdown, etc.,
 * this module sends the new value to the kernel.
 */

import { reactive, ref } from "vue";
import type { KernelConnection } from "./kernel-connection";
import type { UIElementMessage } from "./message-parser";

// Store UI element values
const uiValues = reactive<Map<string, unknown>>(new Map());

// Store pending updates (for debouncing)
const pendingUpdates = new Map<string, ReturnType<typeof setTimeout>>();

// Debounce delay in ms
const DEBOUNCE_DELAY = 100;

/**
 * Get the current value of a UI element
 */
export function getUIValue(objectId: string): unknown {
  return uiValues.get(objectId);
}

/**
 * Set a UI element value locally
 * Does not send to kernel - use syncUIValue for that
 */
export function setUIValueLocal(objectId: string, value: unknown): void {
  uiValues.set(objectId, value);
}

/**
 * Sync a UI element value to the kernel
 * Debounced to prevent excessive API calls
 */
export function syncUIValue(
  kernel: KernelConnection,
  objectId: string,
  value: unknown,
): void {
  // Update local state immediately
  uiValues.set(objectId, value);

  // Clear any pending update for this element
  const pending = pendingUpdates.get(objectId);
  if (pending) {
    clearTimeout(pending);
  }

  // Schedule the update
  pendingUpdates.set(
    objectId,
    setTimeout(async () => {
      pendingUpdates.delete(objectId);
      try {
        await kernel.setUIElementValue(objectId, value);
        console.log(`[marimo-live] UI value synced: ${objectId}`, value);
      } catch (err) {
        console.error(
          `[marimo-live] Failed to sync UI value: ${objectId}`,
          err,
        );
      }
    }, DEBOUNCE_DELAY),
  );
}

/**
 * Handle incoming UI element messages from the kernel
 */
export function handleUIElementMessage(data: UIElementMessage): void {
  console.log("[marimo-live] UI element message:", data);
  // The kernel sends updates when UI elements change
  // This is typically used for dependent UI elements
  if (data.objectId && data.message !== undefined) {
    uiValues.set(data.objectId, data.message);
  }
}

/**
 * Initialize UI sync with kernel event listeners
 */
export function initializeUISync(kernel: KernelConnection): void {
  kernel.onUIElementMessage(handleUIElementMessage);

  // Listen for kernel ready to populate initial UI values
  kernel.onKernelReady((data) => {
    if (data.uiValues) {
      for (const [objectId, value] of Object.entries(data.uiValues)) {
        uiValues.set(objectId, value);
      }
      console.log(
        "[marimo-live] Initialized UI values from kernel:",
        data.uiValues,
      );
    }
  });
}

/**
 * Composable for UI element state
 */
export function useUISync() {
  return {
    uiValues,
    getUIValue,
    setUIValueLocal,
  };
}
