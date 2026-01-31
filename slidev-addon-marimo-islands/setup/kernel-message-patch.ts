/**
 * Kernel Message Patch
 *
 * Patches marimo-islands kernel communication to fix missing `type` field bug.
 *
 * The Problem:
 * marimo-islands sends messages like: {"objectIds":["Hbol-0"],"values":[58]}
 * But the kernel expects: {"type":"update-ui-element","objectIds":["Hbol-0"],"values":[58]}
 *
 * This causes: msgspec.ValidationError: Object missing required field `type`
 *
 * The Fix:
 * Monkey-patch the bridge's putControlRequest to add the missing type field.
 */

// Type for the bridge interface
interface IslandsBridge {
  putControlRequest: (request: unknown) => Promise<unknown>;
  [key: string]: unknown;
}

// Type for control request messages
interface ControlRequest {
  type?: string;
  objectIds?: string[];
  values?: unknown[];
  [key: string]: unknown;
}

// Store original function for restoration
let originalPutControlRequest: ((request: unknown) => Promise<unknown>) | null = null;
// Store reference to our wrapper to detect bridge recreation
let patchedPutControlRequest: ((request: unknown) => Promise<unknown>) | null = null;
let isPatched = false;

/**
 * Determine the message type based on the request structure.
 * Maps request shapes to their expected type discriminator values.
 */
function inferMessageType(request: ControlRequest): string | null {
  // UI element value update: has objectIds and values arrays
  if (
    Array.isArray(request.objectIds) &&
    Array.isArray(request.values)
  ) {
    return "update-ui-element";
  }

  // Add more type mappings as needed for other message types
  // e.g., function calls, code completion, etc.

  return null;
}

/**
 * Patch a control request to add the missing type field if needed.
 */
function patchRequest(request: unknown): unknown {
  if (typeof request !== "object" || request === null) {
    return request;
  }

  const req = request as ControlRequest;

  // If type is already present, pass through unchanged
  if (req.type) {
    return request;
  }

  // Infer the type based on request structure
  const inferredType = inferMessageType(req);

  if (inferredType) {
    console.debug(`🔧 Patching request: adding type="${inferredType}"`);
    return {
      type: inferredType,
      ...req,
    };
  }

  // Unknown request shape - log for debugging but pass through
  console.warn("⚠️ Unknown request shape, passing through without type:", req);
  return request;
}

/**
 * Install the kernel message patch.
 *
 * This patches window._marimo_private_IslandsPyodideBridge.putControlRequest
 * to add the missing `type` field to messages before they reach the kernel.
 *
 * Should be called after the marimo script has initialized the bridge.
 */
export function patchKernelMessages(): boolean {
  if (typeof window === "undefined") {
    console.warn("⚠️ Cannot patch kernel messages: not in browser");
    return false;
  }

  const win = window as unknown as {
    _marimo_private_IslandsPyodideBridge?: IslandsBridge;
  };

  const bridge = win._marimo_private_IslandsPyodideBridge;

  if (!bridge) {
    console.warn("⚠️ Cannot patch kernel messages: bridge not found");
    return false;
  }

  if (typeof bridge.putControlRequest !== "function") {
    console.warn("⚠️ Cannot patch kernel messages: putControlRequest not found");
    return false;
  }

  // Reset state if bridge was recreated (e.g., during HMR edge cases)
  // Detect when we think we're patched but the bridge function is not our wrapper
  if (isPatched && patchedPutControlRequest && bridge.putControlRequest !== patchedPutControlRequest) {
    console.debug("🔧 Bridge recreated, resetting patch state");
    isPatched = false;
    originalPutControlRequest = null;
    patchedPutControlRequest = null;
  }

  if (isPatched) {
    console.debug("🔧 Kernel messages already patched");
    return true;
  }

  // Store original for potential restoration
  originalPutControlRequest = bridge.putControlRequest.bind(bridge);

  // Install the patched version and store reference
  const wrapper = async (request: unknown): Promise<unknown> => {
    const patchedRequest = patchRequest(request);
    return originalPutControlRequest!(patchedRequest);
  };
  patchedPutControlRequest = wrapper;
  bridge.putControlRequest = wrapper;

  isPatched = true;
  console.log("✓ Kernel message patch installed");

  return true;
}

/**
 * Remove the kernel message patch and restore original behavior.
 */
export function unpatchKernelMessages(): boolean {
  if (!isPatched || !originalPutControlRequest) {
    return false;
  }

  const win = window as unknown as {
    _marimo_private_IslandsPyodideBridge?: IslandsBridge;
  };

  const bridge = win._marimo_private_IslandsPyodideBridge;

  if (bridge) {
    bridge.putControlRequest = originalPutControlRequest;
  }

  originalPutControlRequest = null;
  patchedPutControlRequest = null;
  isPatched = false;
  console.log("✓ Kernel message patch removed");

  return true;
}

/**
 * Check if the patch is currently installed.
 */
export function isPatchInstalled(): boolean {
  return isPatched;
}

// HMR: Force full page reload when this file changes
if (import.meta.hot) {
  import.meta.hot.decline();
}
