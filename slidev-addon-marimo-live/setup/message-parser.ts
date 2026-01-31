/**
 * Marimo Protocol Message Parser
 *
 * Parses WebSocket messages from the marimo server into typed structures.
 * Based on marimo/_messaging/ops.py
 */

// Output types
export type OutputChannel = "output" | "console" | "media" | "stderr";

export interface CellOutput {
  channel: OutputChannel;
  mimetype: string;
  data: string | unknown[];
  timestamp: number;
}

// Cell status
export type CellStatus = "idle" | "running" | "queued" | "stale" | "disabled";

// Cell operation data
export interface CellOpData {
  cellId: string;
  output?: CellOutput;
  console?: CellOutput[];
  status?: CellStatus;
  staleInputs?: boolean;
  interrupted?: boolean;
}

// Kernel ready data (sent on initial connection)
export interface KernelReadyData {
  cellIds: string[];
  codes: string[];
  names: string[];
  configs: CellConfig[];
  resumed: boolean;
  uiValues: Record<string, unknown>;
  lastExecutedCode: Record<string, string>;
  lastCellExecutionTime: Record<string, number>;
  appConfig: AppConfig;
}

export interface CellConfig {
  hideCode?: boolean;
  disabled?: boolean;
}

export interface AppConfig {
  width?: "normal" | "medium" | "full";
  appTitle?: string;
}

// Variables data (dependency graph)
export interface VariableInfo {
  name: string;
  declaredBy: string[];
  usedBy: string[];
}

export interface VariablesData {
  variables: VariableInfo[];
}

// UI element message
export interface UIElementMessage {
  objectId: string;
  message: unknown;
}

// Function call result
export interface FunctionCallResult {
  functionCallId: string;
  return_value: unknown;
  status: "success" | "error";
}

// All operation types
export type MarimoOp =
  | "kernel-ready"
  | "cell-op"
  | "variables"
  | "completed-run"
  | "interrupted"
  | "send-ui-element-message"
  | "function-call-result"
  | "alert"
  | "reload"
  | "query-params-append"
  | "query-params-set"
  | "query-params-delete"
  | "query-params-clear";

// Base message structure
export interface MarimoMessage {
  op: MarimoOp;
  data: unknown;
}

// Typed message interfaces
export interface KernelReadyMessage extends MarimoMessage {
  op: "kernel-ready";
  data: KernelReadyData;
}

export interface CellOpMessage extends MarimoMessage {
  op: "cell-op";
  data: CellOpData;
}

export interface VariablesMessage extends MarimoMessage {
  op: "variables";
  data: VariablesData;
}

export interface CompletedRunMessage extends MarimoMessage {
  op: "completed-run";
  data: Record<string, never>;
}

export interface InterruptedMessage extends MarimoMessage {
  op: "interrupted";
  data: Record<string, never>;
}

export interface UIElementMessageType extends MarimoMessage {
  op: "send-ui-element-message";
  data: UIElementMessage;
}

/**
 * Parse a raw WebSocket message into a typed MarimoMessage
 *
 * @param data - Raw message data (string or ArrayBuffer)
 * @returns Parsed message or null if parsing fails
 */
export function parseMessage(data: string | ArrayBuffer): MarimoMessage | null {
  try {
    const text =
      typeof data === "string" ? data : new TextDecoder().decode(data);
    const parsed = JSON.parse(text);

    if (!parsed.op || parsed.data === undefined) {
      console.warn("[marimo-live] Invalid message format:", parsed);
      return null;
    }

    return parsed as MarimoMessage;
  } catch (err) {
    console.error("[marimo-live] Failed to parse message:", err);
    return null;
  }
}

/**
 * Check if a message is a specific operation type
 */
export function isKernelReady(msg: MarimoMessage): msg is KernelReadyMessage {
  return msg.op === "kernel-ready";
}

export function isCellOp(msg: MarimoMessage): msg is CellOpMessage {
  return msg.op === "cell-op";
}

export function isVariables(msg: MarimoMessage): msg is VariablesMessage {
  return msg.op === "variables";
}

export function isCompletedRun(msg: MarimoMessage): msg is CompletedRunMessage {
  return msg.op === "completed-run";
}

export function isInterrupted(msg: MarimoMessage): msg is InterruptedMessage {
  return msg.op === "interrupted";
}

export function isUIElementMessage(
  msg: MarimoMessage,
): msg is UIElementMessageType {
  return msg.op === "send-ui-element-message";
}

/**
 * Extract HTML content from a cell output
 *
 * @param output - Cell output object
 * @returns HTML string or null if not HTML content
 */
export function extractHtml(output: CellOutput | undefined): string | null {
  if (!output) return null;

  // Normalize data to string (marimo sends arrays for error outputs)
  // For non-string data, validate it's a simple array before stringifying
  let dataStr: string;
  if (typeof output.data === "string") {
    dataStr = output.data;
  } else if (Array.isArray(output.data)) {
    // Array data is expected for error mimetypes - stringify for fallback display
    dataStr = output.data.map((item) => String(item)).join("\n");
  } else {
    // Unexpected type - convert safely
    dataStr = String(output.data);
  }

  // Handle marimo error format
  if (output.mimetype === "application/vnd.marimo+error") {
    const errors = Array.isArray(output.data) ? output.data : [output.data];
    const messages = errors.map((e: unknown) => {
      const err = e as { type?: string; msg?: string; name?: string };
      let msg: string;
      if (err.type === "multiple-defs") {
        msg = `Multiple definitions: "${err.name}" is defined in multiple cells`;
      } else {
        msg = err.msg || err.type || String(e);
      }
      // Escape each message individually to prevent XSS
      return msg
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    });
    return `<pre class="marimo-error">${messages.join("\n")}</pre>`;
  }

  if (output.mimetype === "text/html") {
    return dataStr;
  }

  if (output.mimetype === "text/plain") {
    // Escape HTML and wrap in pre tag for plain text
    const escaped = dataStr
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre>${escaped}</pre>`;
  }

  if (output.mimetype === "image/png" || output.mimetype === "image/jpeg") {
    return `<img src="data:${output.mimetype};base64,${dataStr}" />`;
  }

  if (output.mimetype === "image/svg+xml") {
    return dataStr;
  }

  if (output.mimetype === "application/json") {
    try {
      const formatted = JSON.stringify(JSON.parse(dataStr), null, 2);
      return `<pre><code class="language-json">${formatted}</code></pre>`;
    } catch {
      // Invalid JSON - show as raw preformatted text
      return `<pre>${dataStr}</pre>`;
    }
  }

  if (output.mimetype === "text/markdown") {
    // Return markdown wrapped in a container for the renderer to handle
    return `<div class="markdown-content">${dataStr}</div>`;
  }

  // Unknown mimetype - show as preformatted text
  return `<pre>${dataStr}</pre>`;
}
