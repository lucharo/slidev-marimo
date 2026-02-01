/**
 * Message Bridge
 *
 * Intercepts marimo UI component communications and redirects them to the
 * WebSocket kernel connection. This bridges the gap between marimo's frontend
 * (which expects a Pyodide bridge) and our live kernel backend.
 *
 * The Problem:
 * marimo-islands frontend uses window._marimo_private_IslandsPyodideBridge
 * to communicate with a Pyodide kernel. In our case, we have a WebSocket
 * connection to a live marimo server, so we need to intercept these calls.
 *
 * The Solution:
 * Install a property trap that intercepts when marimo creates the bridge,
 * then patch the bridge methods to forward requests to our WebSocket kernel.
 */

import type { KernelConnection } from "./kernel-connection";

// Type for the bridge interface
interface IslandsBridge {
  putControlRequest: (request: ControlRequest) => Promise<unknown>;
  sendComponentValues?: (request: ControlRequest) => Promise<unknown>;
  [key: string]: unknown;
}

// Type for control request messages
interface ControlRequest {
  type?: string;
  objectIds?: string[];
  values?: unknown[];
  object_id?: string;
  value?: unknown;
  updates?: Array<{ object_id: string; value: unknown }>;
  [key: string]: unknown;
}

// Track bridge installation state
let bridgeInstalled = false;
let bridgeTrapInstalled = false;
let kernelRef: KernelConnection | null = null;

/**
 * Determine the message type based on the request structure.
 * Maps request shapes to their expected type discriminator values.
 */
function inferMessageType(request: ControlRequest): string | null {
  // UI element value update: has objectIds and values arrays
  if (Array.isArray(request.objectIds) && Array.isArray(request.values)) {
    return "update-ui-element";
  }

  // Component values update: singular object_id with value
  if ("object_id" in request && "value" in request) {
    return "update-ui-element";
  }

  // Batch component values: array of updates
  if (Array.isArray(request.updates)) {
    return "update-ui-element";
  }

  // Generic values payload
  if ("values" in request && !("objectIds" in request)) {
    return "update-ui-element";
  }

  return null;
}

/**
 * Process a control request and send it to the WebSocket kernel.
 */
async function handleControlRequest(request: ControlRequest): Promise<unknown> {
  if (!kernelRef) {
    console.warn("[marimo-live] Bridge: kernel not available, ignoring request");
    return null;
  }

  if (!kernelRef.isConnected) {
    console.warn("[marimo-live] Bridge: kernel not connected, ignoring request");
    return null;
  }

  // Handle array format: objectIds and values
  if (Array.isArray(request.objectIds) && Array.isArray(request.values)) {
    const results: unknown[] = [];
    for (let i = 0; i < request.objectIds.length; i++) {
      const objectId = request.objectIds[i];
      const value = request.values[i];
      try {
        await kernelRef.setUIElementValue(objectId, value);
        console.log(`[marimo-live] Bridge: UI update sent ${objectId}`, value);
        results.push({ success: true, objectId });
      } catch (err) {
        console.error(`[marimo-live] Bridge: failed to update ${objectId}`, err);
        results.push({ success: false, objectId, error: err });
      }
    }
    return results;
  }

  // Handle singular format: object_id and value
  if ("object_id" in request && "value" in request) {
    const objectId = request.object_id as string;
    const value = request.value;
    try {
      await kernelRef.setUIElementValue(objectId, value);
      console.log(`[marimo-live] Bridge: UI update sent ${objectId}`, value);
      return { success: true };
    } catch (err) {
      console.error(`[marimo-live] Bridge: failed to update ${objectId}`, err);
      return { success: false, error: err };
    }
  }

  // Handle batch format: updates array
  if (Array.isArray(request.updates)) {
    const results: unknown[] = [];
    for (const update of request.updates) {
      try {
        await kernelRef.setUIElementValue(update.object_id, update.value);
        console.log(`[marimo-live] Bridge: UI update sent ${update.object_id}`, update.value);
        results.push({ success: true, objectId: update.object_id });
      } catch (err) {
        console.error(`[marimo-live] Bridge: failed to update ${update.object_id}`, err);
        results.push({ success: false, objectId: update.object_id, error: err });
      }
    }
    return results;
  }

  console.warn("[marimo-live] Bridge: unknown request format", request);
  return null;
}

/**
 * Patch an existing bridge object to intercept its methods.
 */
function patchBridge(bridge: IslandsBridge): void {
  if (bridgeInstalled) return;

  // Store original methods
  const originalPutControl = bridge.putControlRequest?.bind(bridge);
  const originalSendValues = bridge.sendComponentValues?.bind(bridge);

  // Patch putControlRequest
  if (originalPutControl) {
    bridge.putControlRequest = async (request: ControlRequest) => {
      console.debug("[marimo-live] Bridge: intercepted putControlRequest", request);

      // Add missing type field if needed (marimo bug workaround)
      if (!request.type) {
        const inferredType = inferMessageType(request);
        if (inferredType) {
          request = { type: inferredType, ...request };
        }
      }

      // Forward to WebSocket kernel
      const result = await handleControlRequest(request);

      // Also call original if it exists (for any local handling)
      // But wrap in try-catch as it may fail without Pyodide
      try {
        if (typeof originalPutControl === "function") {
          await originalPutControl(request);
        }
      } catch {
        // Expected to fail in live mode - Pyodide not available
      }

      return result;
    };
    console.log("[marimo-live] Bridge: patched putControlRequest");
  }

  // Patch sendComponentValues if it exists
  if (originalSendValues) {
    bridge.sendComponentValues = async (request: ControlRequest) => {
      console.debug("[marimo-live] Bridge: intercepted sendComponentValues", request);
      return handleControlRequest(request);
    };
    console.log("[marimo-live] Bridge: patched sendComponentValues");
  }

  bridgeInstalled = true;
  console.log("[marimo-live] Bridge: installation complete");
}

/**
 * Install a property trap to intercept when marimo creates the bridge.
 * This ensures we can patch the bridge methods as soon as they're available.
 */
function installBridgeTrap(): void {
  if (bridgeTrapInstalled) return;
  if (typeof window === "undefined") return;

  const BRIDGE_KEY = "_marimo_private_IslandsPyodideBridge";
  const win = window as unknown as Record<string, unknown>;

  // Check if bridge already exists
  if (win[BRIDGE_KEY]) {
    console.log("[marimo-live] Bridge: already exists, patching now");
    patchBridge(win[BRIDGE_KEY] as IslandsBridge);
    bridgeTrapInstalled = true;
    return;
  }

  let _bridge: IslandsBridge | undefined = undefined;

  Object.defineProperty(window, BRIDGE_KEY, {
    configurable: true,
    enumerable: true,
    get() {
      return _bridge;
    },
    set(newBridge: IslandsBridge) {
      console.log("[marimo-live] Bridge: created, intercepting...");
      _bridge = newBridge;

      // Patch synchronously when bridge is created
      if (newBridge) {
        patchBridge(newBridge);
      }
    },
  });

  bridgeTrapInstalled = true;
  console.log("[marimo-live] Bridge: trap installed");
}

/**
 * Poll for the bridge to become available.
 * Fallback if the trap doesn't catch it.
 */
function pollForBridge(maxAttempts = 100, interval = 50): void {
  const BRIDGE_KEY = "_marimo_private_IslandsPyodideBridge";
  let attempts = 0;

  const check = () => {
    attempts++;
    const win = window as unknown as Record<string, unknown>;
    const bridge = win[BRIDGE_KEY] as IslandsBridge | undefined;

    if (bridge && !bridgeInstalled) {
      console.log(`[marimo-live] Bridge: found via polling (attempt ${attempts})`);
      patchBridge(bridge);
      return;
    }

    if (attempts < maxAttempts && !bridgeInstalled) {
      setTimeout(check, interval);
    } else if (!bridgeInstalled) {
      console.debug("[marimo-live] Bridge: polling complete, bridge not found");
    }
  };

  setTimeout(check, interval);
}

/**
 * Install the message bridge to intercept marimo UI communications.
 * This should be called BEFORE loading the marimo frontend.
 *
 * @param kernel - The WebSocket kernel connection to use
 */
export function installMessageBridge(kernel: KernelConnection): void {
  if (typeof window === "undefined") {
    console.warn("[marimo-live] Bridge: not in browser environment");
    return;
  }

  // Store kernel reference for request handling
  kernelRef = kernel;

  // Install trap before bridge is created
  installBridgeTrap();

  // Also poll as fallback
  pollForBridge();

  console.log("[marimo-live] Bridge: initialized");
}

/**
 * Check if the message bridge is installed.
 */
export function isMessageBridgeInstalled(): boolean {
  return bridgeInstalled;
}

/**
 * Check if the bridge trap is installed.
 */
export function isBridgeTrapInstalled(): boolean {
  return bridgeTrapInstalled;
}

/**
 * Reset bridge state (for testing or HMR).
 */
export function resetMessageBridge(): void {
  bridgeInstalled = false;
  bridgeTrapInstalled = false;
  kernelRef = null;
  console.log("[marimo-live] Bridge: reset");
}

// HMR: Force full page reload when this file changes
// Bridge state cannot be hot-reloaded
if (import.meta.hot) {
  import.meta.hot.decline();
}
