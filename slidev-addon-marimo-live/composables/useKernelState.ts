/**
 * Kernel State Composable
 *
 * Provides reactive state for cell outputs, variables, and execution status.
 * Used by MarimoLive components to render cell results.
 */

import { computed, reactive, readonly, ref } from "vue";
import type {
  CellOpData,
  CellOutput,
  CellStatus,
  VariableInfo,
} from "../setup/message-parser";

// Cell state
export interface CellState {
  id: string;
  code: string;
  output: CellOutput | null;
  console: CellOutput[];
  status: CellStatus;
  error: string | null;
  lastUpdated: number;
}

// Store all cell states
const cellStates = reactive<Map<string, CellState>>(new Map());

// Store notebook cells from kernel-ready (original cells from the .py file)
// Maps cell ID -> { code, name, index }
export interface NotebookCell {
  id: string;
  code: string;
  name: string; // Function name from marimo notebook (e.g., "plot_chart")
  index: number;
}
const notebookCells = reactive<Map<string, NotebookCell>>(new Map());
const notebookCellsByName = reactive<Map<string, NotebookCell>>(new Map());
const notebookCellsByIndex = reactive<Map<number, NotebookCell>>(new Map());

// Store variable graph
const variables = ref<VariableInfo[]>([]);

// Global kernel state
const isKernelReady = ref(false);
const lastExecutionTime = ref<number>(0);
// Version counter to trigger reactivity when notebook cells change
const notebookCellsVersion = ref(0);

/**
 * Create or get cell state
 */
function ensureCellState(cellId: string, code = ""): CellState {
  if (!cellStates.has(cellId)) {
    cellStates.set(cellId, {
      id: cellId,
      code,
      output: null,
      console: [],
      status: "idle",
      error: null,
      lastUpdated: Date.now(),
    });
  }
  return cellStates.get(cellId)!;
}

/**
 * Update cell state from cell-op message
 */
export function updateCellState(data: CellOpData): void {
  const state = ensureCellState(data.cellId);

  if (data.output) {
    state.output = data.output;
  }

  if (data.console) {
    state.console = data.console;
  }

  if (data.status) {
    state.status = data.status;
  }

  if (data.interrupted) {
    state.status = "idle";
    state.error = "Execution interrupted";
  }

  state.lastUpdated = Date.now();
  lastExecutionTime.value = Date.now();
}

/**
 * Update variables from variables message
 */
export function updateVariables(vars: VariableInfo[]): void {
  variables.value = vars;
}

/**
 * Mark kernel as ready
 */
export function setKernelReady(ready: boolean): void {
  isKernelReady.value = ready;
}

/**
 * Register notebook cells from kernel-ready message
 * This stores the original cells from the marimo notebook
 */
export function registerNotebookCells(
  cellIds: string[],
  codes: string[],
  names: string[],
): void {
  // Clear existing
  notebookCells.clear();
  notebookCellsByName.clear();
  notebookCellsByIndex.clear();

  for (let i = 0; i < cellIds.length; i++) {
    const cell: NotebookCell = {
      id: cellIds[i],
      code: codes[i] || "",
      name: names[i] || "",
      index: i,
    };

    notebookCells.set(cell.id, cell);
    notebookCellsByIndex.set(i, cell);

    // Also register by name if it has one (and isn't just "_")
    if (cell.name && cell.name !== "_") {
      notebookCellsByName.set(cell.name, cell);
    }
  }

  // Increment version to trigger reactive updates in components
  notebookCellsVersion.value++;

  console.log(
    `[marimo-live] Registered ${cellIds.length} notebook cells:`,
    Array.from(notebookCellsByName.keys()),
  );
}

/**
 * Get a notebook cell by ID
 */
export function getNotebookCellById(cellId: string): NotebookCell | undefined {
  return notebookCells.get(cellId);
}

/**
 * Get a notebook cell by name (function name in marimo)
 */
export function getNotebookCellByName(name: string): NotebookCell | undefined {
  // IMPORTANT: Accessing .size creates a Vue reactive dependency on the Map.
  // Without this line, computed properties using this function won't re-evaluate
  // when the Map changes (e.g., when cells are registered after kernel-ready).
  // This is a standard Vue 3 pattern for reactive Maps. Do not remove.
  void notebookCellsByName.size;
  return notebookCellsByName.get(name);
}

/**
 * Get a notebook cell by index (0-based)
 */
export function getNotebookCellByIndex(
  index: number,
): NotebookCell | undefined {
  return notebookCellsByIndex.get(index);
}

/**
 * Get all notebook cells
 */
export function getAllNotebookCells(): NotebookCell[] {
  return Array.from(notebookCells.values()).sort((a, b) => a.index - b.index);
}

/**
 * Register a cell with initial code
 */
export function registerCell(cellId: string, code: string): void {
  const state = ensureCellState(cellId, code);
  state.code = code;
}

/**
 * Clear cell output
 */
export function clearCellOutput(cellId: string): void {
  const state = cellStates.get(cellId);
  if (state) {
    state.output = null;
    state.console = [];
    state.error = null;
    state.status = "idle";
  }
}

/**
 * Set cell to running state
 */
export function setCellRunning(cellId: string): void {
  const state = ensureCellState(cellId);
  state.status = "running";
  state.error = null;
}

/**
 * Set cell error
 */
export function setCellError(cellId: string, error: string): void {
  const state = ensureCellState(cellId);
  state.status = "idle";
  state.error = error;
}

/**
 * Composable for accessing kernel state
 */
export function useKernelState() {
  return {
    // Reactive state
    cellStates: readonly(cellStates) as ReadonlyMap<string, CellState>,
    notebookCells: readonly(notebookCells) as ReadonlyMap<string, NotebookCell>,
    notebookCellsVersion: readonly(notebookCellsVersion),
    variables: readonly(variables),
    isKernelReady: readonly(isKernelReady),
    lastExecutionTime: readonly(lastExecutionTime),

    // Helper to get a specific cell's state
    getCellState(cellId: string): CellState | undefined {
      return cellStates.get(cellId);
    },

    // Computed for a specific cell
    useCellState(cellId: string) {
      return computed(() => cellStates.get(cellId));
    },

    // Notebook cell lookups
    getNotebookCellById,
    getNotebookCellByName,
    getNotebookCellByIndex,
    getAllNotebookCells,

    // Actions
    registerCell,
    clearCellOutput,
    setCellRunning,
    setCellError,
  };
}
