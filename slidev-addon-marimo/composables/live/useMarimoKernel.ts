/**
 * Marimo Kernel Composable
 *
 * Main composable for interacting with the live marimo kernel.
 * Provides methods for cell execution, UI element updates, and state access.
 */

import { computed, type InjectionKey, inject, type Ref, ref } from "vue";
import type {
  ConnectionState,
  KernelConnection,
} from "../../setup/live/kernel-connection";
import type {
  CellOpData,
  KernelReadyData,
  VariablesData,
} from "../../setup/live/message-parser";
import {
  registerNotebookCells,
  setCellError,
  setCellRunning,
  setKernelReady,
  updateCellState,
  updateVariables,
  useKernelState,
} from "./useKernelState";

// Injection key for kernel connection
export const KERNEL_CONNECTION_KEY: InjectionKey<KernelConnection> =
  Symbol("marimo-kernel");

// Track connection state reactively
const connectionState = ref<ConnectionState>("disconnected");
const connectionError = ref<string | null>(null);

/**
 * Initialize kernel event listeners
 * Called once when kernel connection is established
 */
export function initializeKernelListeners(kernel: KernelConnection): void {
  // Handle connection state changes
  kernel.onStateChange((state) => {
    connectionState.value = state;
    if (state === "error") {
      connectionError.value = "Connection failed";
      setKernelReady(false);
    } else if (state === "connected") {
      connectionError.value = null;
    } else if (state === "disconnected") {
      setKernelReady(false);
    }
  });

  // Handle kernel ready
  kernel.onKernelReady((data: KernelReadyData) => {
    console.log("[marimo-live] Kernel ready", data);
    setKernelReady(true);

    // Register notebook cells (from the .py file)
    if (data.cellIds && data.codes) {
      registerNotebookCells(
        data.cellIds,
        data.codes,
        data.names || [], // Cell names (function names in marimo)
      );

      // Also register cell states for each
      const { registerCell } = useKernelState();
      for (let i = 0; i < data.cellIds.length; i++) {
        registerCell(data.cellIds[i], data.codes[i] || "");
      }
    }
  });

  // Handle cell operations
  kernel.onCellOp((data: CellOpData) => {
    updateCellState(data);
  });

  // Handle variable updates
  kernel.onVariables((data: VariablesData) => {
    updateVariables(data.variables);
  });
}

/**
 * Generate a unique cell ID
 */
function generateCellId(): string {
  return `cell_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Main composable for kernel operations
 */
export function useMarimoKernel() {
  const kernel = inject(KERNEL_CONNECTION_KEY);
  const state = useKernelState();

  if (!kernel) {
    console.warn(
      "[marimo-live] Kernel not available. Make sure the addon is properly configured.",
    );
  }

  return {
    // Connection state
    connectionState: computed(() => connectionState.value),
    connectionError: computed(() => connectionError.value),
    isConnected: computed(() => connectionState.value === "connected"),
    isKernelReady: state.isKernelReady,

    // Kernel state access
    ...state,

    /**
     * Run a cell with the given code
     *
     * @param code - Python code to execute
     * @param cellId - Optional cell ID (auto-generated if not provided)
     * @returns Promise that resolves when execution starts
     */
    async runCell(code: string, cellId?: string): Promise<string> {
      if (!kernel) {
        throw new Error("Kernel not available");
      }

      const id = cellId || generateCellId();

      // Register and set running state
      state.registerCell(id, code);
      setCellRunning(id);

      try {
        await kernel.runCells([id], [code]);
        return id;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Execution failed";
        setCellError(id, message);
        throw err;
      }
    },

    /**
     * Run a notebook cell by reference (ID, name, or index)
     *
     * @param ref - Cell ID, function name, or index (number or "0", "1", etc.)
     * @returns Promise that resolves with the cell ID
     */
    async runNotebookCell(ref: string | number): Promise<string> {
      if (!kernel) {
        throw new Error("Kernel not available");
      }

      // Find the cell
      let cell = state.getNotebookCellById(String(ref));

      if (!cell) {
        cell = state.getNotebookCellByName(String(ref));
      }

      if (!cell) {
        const index = typeof ref === "number" ? ref : Number.parseInt(ref, 10);
        if (!Number.isNaN(index)) {
          cell = state.getNotebookCellByIndex(index);
        }
      }

      if (!cell) {
        throw new Error(`Notebook cell not found: ${ref}`);
      }

      // Run the cell
      setCellRunning(cell.id);

      try {
        await kernel.runCells([cell.id], [cell.code]);
        return cell.id;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Execution failed";
        setCellError(cell.id, message);
        throw err;
      }
    },

    /**
     * Run multiple cells
     *
     * @param cells - Array of { cellId, code } objects
     */
    async runCells(
      cells: Array<{ cellId: string; code: string }>,
    ): Promise<void> {
      if (!kernel) {
        throw new Error("Kernel not available");
      }

      const cellIds = cells.map((c) => c.cellId);
      const codes = cells.map((c) => c.code);

      // Set all cells to running
      for (const { cellId, code } of cells) {
        state.registerCell(cellId, code);
        setCellRunning(cellId);
      }

      try {
        await kernel.runCells(cellIds, codes);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Execution failed";
        for (const cellId of cellIds) {
          setCellError(cellId, message);
        }
        throw err;
      }
    },

    /**
     * Interrupt current execution
     */
    async interrupt(): Promise<void> {
      if (!kernel) {
        throw new Error("Kernel not available");
      }
      await kernel.interrupt();
    },

    /**
     * Set UI element value
     *
     * @param objectId - UI element object ID
     * @param value - New value
     */
    async setUIValue(objectId: string, value: unknown): Promise<void> {
      if (!kernel) {
        throw new Error("Kernel not available");
      }
      await kernel.setUIElementValue(objectId, value);
    },

    /**
     * Re-instantiate the notebook
     */
    async instantiate(): Promise<void> {
      if (!kernel) {
        throw new Error("Kernel not available");
      }
      await kernel.instantiate();
    },

    /**
     * Manually connect to kernel
     */
    async connect(): Promise<void> {
      if (!kernel) {
        throw new Error("Kernel not available");
      }
      await kernel.connect();
    },

    /**
     * Disconnect from kernel
     */
    disconnect(): void {
      if (kernel) {
        kernel.disconnect();
      }
    },
  };
}
