/**
 * Kernel Connection Manager
 *
 * Handles WebSocket connection to marimo server and HTTP requests for kernel operations.
 * Provides auto-reconnection, session management, and message routing.
 */

import type {
  CellOpData,
  KernelReadyData,
  MarimoMessage,
  UIElementMessage,
  VariablesData,
} from "./message-parser";
import { parseMessage } from "./message-parser";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface KernelConfig {
  /** WebSocket URL (default: ws://localhost:2718/ws) */
  wsUrl?: string;
  /** HTTP API URL (default: http://localhost:2718) */
  httpUrl?: string;
  /** Session ID (auto-generated if not provided) */
  sessionId?: string;
  /** Auto-instantiate notebook on connect */
  autoInstantiate?: boolean;
  /** Reconnect on disconnect */
  autoReconnect?: boolean;
  /** Max reconnect attempts */
  maxReconnectAttempts?: number;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
}

export interface KernelConnection {
  // State
  readonly state: ConnectionState;
  readonly sessionId: string;
  readonly isConnected: boolean;

  // Connection lifecycle
  connect(): Promise<void>;
  disconnect(): void;

  // Cell operations
  runCells(cellIds: string[], codes: string[]): Promise<void>;
  interrupt(): Promise<void>;
  instantiate(): Promise<void>;

  // UI element operations
  setUIElementValue(objectId: string, value: unknown): Promise<void>;

  // Event handlers
  onMessage(handler: (msg: MarimoMessage) => void): () => void;
  onCellOp(handler: (data: CellOpData) => void): () => void;
  onKernelReady(handler: (data: KernelReadyData) => void): () => void;
  onVariables(handler: (data: VariablesData) => void): () => void;
  onUIElementMessage(handler: (data: UIElementMessage) => void): () => void;
  onStateChange(handler: (state: ConnectionState) => void): () => void;
}

const DEFAULT_CONFIG: Required<KernelConfig> = {
  wsUrl: "ws://localhost:2718/ws",
  httpUrl: "http://localhost:2718",
  sessionId: "",
  autoInstantiate: true,
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
};

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a kernel connection manager
 */
export function createKernelConnection(
  userConfig: KernelConfig = {},
): KernelConnection {
  const config: Required<KernelConfig> = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    sessionId: userConfig.sessionId || generateSessionId(),
  };

  let ws: WebSocket | null = null;
  let state: ConnectionState = "disconnected";
  let reconnectAttempts = 0;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let serverToken: string | null = null;

  // Event handlers
  const messageHandlers = new Set<(msg: MarimoMessage) => void>();
  const cellOpHandlers = new Set<(data: CellOpData) => void>();
  const kernelReadyHandlers = new Set<(data: KernelReadyData) => void>();
  const variablesHandlers = new Set<(data: VariablesData) => void>();
  const uiElementHandlers = new Set<(data: UIElementMessage) => void>();
  const stateChangeHandlers = new Set<(state: ConnectionState) => void>();

  function setState(newState: ConnectionState) {
    if (state !== newState) {
      state = newState;
      stateChangeHandlers.forEach((h) => h(state));
    }
  }

  /**
   * Fetch the skew protection token from the marimo server.
   * This token is embedded in the HTML page and required for API requests.
   */
  async function fetchServerToken(): Promise<string | null> {
    try {
      const response = await fetch(config.httpUrl);
      const html = await response.text();
      const match = html.match(/data-token="([^"]+)"/);
      if (match) {
        console.log("[marimo-live] Obtained server token");
        return match[1];
      }
      console.warn("[marimo-live] No server token found in page");
      return null;
    } catch (err) {
      console.error("[marimo-live] Failed to fetch server token:", err);
      return null;
    }
  }

  function handleMessage(event: MessageEvent) {
    try {
      const msg = parseMessage(event.data);
      if (!msg) return;

      // Notify all message handlers
      messageHandlers.forEach((h) => h(msg));

      // Route to specific handlers (normalize snake_case from server to camelCase)
      switch (msg.op) {
        case "cell-op": {
          const raw = msg.data as Record<string, unknown>;
          const cellOp: CellOpData = {
            cellId: (raw.cell_id || raw.cellId) as string,
            output: raw.output as CellOpData["output"],
            console: raw.console
              ? Array.isArray(raw.console)
                ? (raw.console as CellOpData["console"])
                : [raw.console as NonNullable<CellOpData["console"]>[number]]
              : undefined,
            status: raw.status as CellOpData["status"],
            staleInputs: (raw.stale_inputs ?? raw.staleInputs) as
              | boolean
              | undefined,
            interrupted: raw.interrupted as boolean | undefined,
          };
          cellOpHandlers.forEach((h) => h(cellOp));
          break;
        }
        case "kernel-ready": {
          const rawKr = msg.data as Record<string, unknown>;
          const kernelReady: KernelReadyData = {
            cellIds: (rawKr.cell_ids || rawKr.cellIds) as string[],
            codes: rawKr.codes as string[],
            names: rawKr.names as string[],
            configs: rawKr.configs as KernelReadyData["configs"],
            resumed: rawKr.resumed as boolean,
            uiValues: (rawKr.ui_values || rawKr.uiValues) as Record<
              string,
              unknown
            >,
            lastExecutedCode: (rawKr.last_executed_code ||
              rawKr.lastExecutedCode) as Record<string, string>,
            lastCellExecutionTime: (rawKr.last_cell_execution_time ||
              rawKr.lastCellExecutionTime) as Record<string, number>,
            appConfig: (rawKr.app_config || rawKr.appConfig) as
              | KernelReadyData["appConfig"]
              | undefined,
          };
          kernelReadyHandlers.forEach((h) => h(kernelReady));
          break;
        }
        case "variables":
          variablesHandlers.forEach((h) => h(msg.data as VariablesData));
          break;
        case "send-ui-element-message":
          uiElementHandlers.forEach((h) => h(msg.data as UIElementMessage));
          break;
        case "completed-run":
          console.log("[marimo-live] Execution completed");
          break;
        case "interrupted":
          console.log("[marimo-live] Execution interrupted");
          break;
      }
    } catch (err) {
      console.error("[marimo-live] Failed to parse message:", err);
    }
  }

  function scheduleReconnect() {
    if (
      !config.autoReconnect ||
      reconnectAttempts >= config.maxReconnectAttempts
    ) {
      setState("error");
      return;
    }

    reconnectAttempts++;
    const delay = config.reconnectDelay * reconnectAttempts;
    console.log(
      `[marimo-live] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${config.maxReconnectAttempts})`,
    );

    reconnectTimeout = setTimeout(() => {
      connection.connect().catch(console.error);
    }, delay);
  }

  async function httpRequest(
    endpoint: string,
    method: "GET" | "POST" = "POST",
    body?: unknown,
  ): Promise<Response> {
    const url = `${config.httpUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Marimo-Session-Id": config.sessionId,
    };

    // Include server token for skew protection if available
    if (serverToken) {
      headers["Marimo-Server-Token"] = serverToken;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }

  const connection: KernelConnection = {
    get state() {
      return state;
    },
    get sessionId() {
      return config.sessionId;
    },
    get isConnected() {
      return state === "connected";
    },

    async connect() {
      if (state === "connecting" || state === "connected") {
        return;
      }

      setState("connecting");

      // Fetch server token for skew protection
      serverToken = await fetchServerToken();

      return new Promise<void>((resolve, reject) => {
        const wsUrl = new URL(config.wsUrl);
        wsUrl.searchParams.set("session_id", config.sessionId);
        if (config.autoInstantiate) {
          wsUrl.searchParams.set("auto_instantiate", "true");
        }

        ws = new WebSocket(wsUrl.toString());

        ws.onopen = () => {
          console.log(`[marimo-live] Connected (session: ${config.sessionId})`);
          setState("connected");
          reconnectAttempts = 0;
          resolve();
        };

        ws.onmessage = handleMessage;

        ws.onerror = (error) => {
          console.error("[marimo-live] WebSocket error:", error);
        };

        ws.onclose = (event) => {
          console.log(`[marimo-live] Disconnected (code: ${event.code})`);
          ws = null;

          if (state === "connecting") {
            setState("error");
            reject(new Error("Failed to connect"));
          } else {
            setState("disconnected");
            scheduleReconnect();
          }
        };
      });
    },

    disconnect() {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }

      if (ws) {
        ws.close();
        ws = null;
      }

      // Reset reconnect counter so future connections can retry
      reconnectAttempts = 0;
      setState("disconnected");
    },

    async runCells(cellIds: string[], codes: string[]) {
      if (state !== "connected") {
        throw new Error("Not connected to kernel");
      }

      await httpRequest("/api/kernel/run", "POST", { cellIds, codes });
    },

    async interrupt() {
      if (state !== "connected") {
        throw new Error("Not connected to kernel");
      }

      await httpRequest("/api/kernel/interrupt", "POST");
    },

    async instantiate() {
      if (state !== "connected") {
        throw new Error("Not connected to kernel");
      }

      await httpRequest("/api/kernel/instantiate", "POST");
    },

    async setUIElementValue(objectId: string, value: unknown) {
      if (state !== "connected") {
        throw new Error("Not connected to kernel");
      }

      await httpRequest("/api/kernel/set_ui_element_value", "POST", {
        objectId,
        value,
      });
    },

    onMessage(handler) {
      messageHandlers.add(handler);
      return () => messageHandlers.delete(handler);
    },

    onCellOp(handler) {
      cellOpHandlers.add(handler);
      return () => cellOpHandlers.delete(handler);
    },

    onKernelReady(handler) {
      kernelReadyHandlers.add(handler);
      return () => kernelReadyHandlers.delete(handler);
    },

    onVariables(handler) {
      variablesHandlers.add(handler);
      return () => variablesHandlers.delete(handler);
    },

    onUIElementMessage(handler) {
      uiElementHandlers.add(handler);
      return () => uiElementHandlers.delete(handler);
    },

    onStateChange(handler) {
      stateChangeHandlers.add(handler);
      return () => stateChangeHandlers.delete(handler);
    },
  };

  return connection;
}
