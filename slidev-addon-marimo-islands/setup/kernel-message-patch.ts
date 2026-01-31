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
 * Monkey-patch bridge methods (putControlRequest, sendComponentValues, etc.)
 * to add the missing type field before messages reach the kernel.
 */

// Type for the bridge interface
interface IslandsBridge {
  putControlRequest: (request: unknown) => Promise<unknown>;
  sendComponentValues: (request: unknown) => Promise<unknown>;
  [key: string]: unknown;
}

// Type for control request messages
interface ControlRequest {
  type?: string;
  objectIds?: string[];
  values?: unknown[];
  [key: string]: unknown;
}

// Store original functions for restoration
const originalMethods: Map<string, (request: unknown) => Promise<unknown>> = new Map();
// Store reference to our wrappers to detect bridge recreation
const patchedMethods: Map<string, (request: unknown) => Promise<unknown>> = new Map();
let isPatched = false;

// Methods that need patching - they may send messages without the type field
const METHODS_TO_PATCH = ["putControlRequest", "sendComponentValues"];

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
function patchRequest(request: unknown, methodName: string): unknown {
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
    console.debug(`🔧 [${methodName}] Patching request: adding type="${inferredType}"`);
    return {
      type: inferredType,
      ...req,
    };
  }

  // Unknown request shape - log for debugging but pass through
  console.warn(`⚠️ [${methodName}] Unknown request shape, passing through without type:`, req);
  return request;
}

/**
 * Create a wrapper for a bridge method that patches requests.
 */
function createPatchedMethod(
  methodName: string,
  original: (request: unknown) => Promise<unknown>
): (request: unknown) => Promise<unknown> {
  return async (request: unknown): Promise<unknown> => {
    const patchedRequest = patchRequest(request, methodName);
    return original(patchedRequest);
  };
}

/**
 * Install the kernel message patch.
 *
 * This patches window._marimo_private_IslandsPyodideBridge methods
 * (putControlRequest, sendComponentValues, etc.) to add the missing
 * `type` field to messages before they reach the kernel.
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

  // Check if any patched method no longer matches (bridge was recreated)
  const bridgeRecreated = isPatched && METHODS_TO_PATCH.some((method) => {
    const patched = patchedMethods.get(method);
    const current = bridge[method] as ((request: unknown) => Promise<unknown>) | undefined;
    return patched && current !== patched;
  });

  if (bridgeRecreated) {
    console.debug("🔧 Bridge recreated, resetting patch state");
    isPatched = false;
    originalMethods.clear();
    patchedMethods.clear();
  }

  if (isPatched) {
    console.debug("🔧 Kernel messages already patched");
    return true;
  }

  // Patch each method
  let patchedCount = 0;
  for (const methodName of METHODS_TO_PATCH) {
    const originalMethod = bridge[methodName];
    if (typeof originalMethod !== "function") {
      console.debug(`🔧 Method ${methodName} not found on bridge, skipping`);
      continue;
    }

    // Store original for restoration
    const boundOriginal = (originalMethod as (request: unknown) => Promise<unknown>).bind(bridge);
    originalMethods.set(methodName, boundOriginal);

    // Create and install wrapper
    const wrapper = createPatchedMethod(methodName, boundOriginal);
    patchedMethods.set(methodName, wrapper);
    (bridge as Record<string, unknown>)[methodName] = wrapper;
    patchedCount++;
    console.debug(`🔧 Patched bridge method: ${methodName}`);
  }

  if (patchedCount === 0) {
    console.warn("⚠️ No bridge methods were patched");
    return false;
  }

  isPatched = true;
  console.log(`✓ Kernel message patch installed (${patchedCount} methods)`);

  return true;
}

/**
 * Remove the kernel message patch and restore original behavior.
 */
export function unpatchKernelMessages(): boolean {
  if (!isPatched || originalMethods.size === 0) {
    return false;
  }

  const win = window as unknown as {
    _marimo_private_IslandsPyodideBridge?: IslandsBridge;
  };

  const bridge = win._marimo_private_IslandsPyodideBridge;

  if (bridge) {
    // Restore all original methods
    for (const [methodName, original] of originalMethods) {
      (bridge as Record<string, unknown>)[methodName] = original;
    }
  }

  originalMethods.clear();
  patchedMethods.clear();
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
