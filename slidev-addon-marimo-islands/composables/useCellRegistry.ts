/**
 * Cell Registry
 *
 * Centralized registry for tracking all marimo cells and their states.
 * This is the source of truth for what cells exist and need to be rendered.
 *
 * Cell States:
 *   pending     → Cell registered, waiting for kernel
 *   registered  → Cell registered with marimo, island element created
 *   running     → Cell is executing
 *   complete    → Cell execution complete, output rendered
 *   error       → Cell execution failed
 *
 * Usage:
 *   const registry = useCellRegistry();
 *   const cellId = registry.registerCell(code);
 *   // Later...
 *   registry.unregisterCell(cellId);
 */

import type { App, InjectionKey } from "vue";
import { inject, reactive } from "vue";
import { generateCellId, releaseCellId, resetCellIds } from "../utils/cellId";

export type CellState =
  | "pending"
  | "registered"
  | "running"
  | "complete"
  | "error";

export interface CellData {
  /** Unique 4-char cell ID */
  id: string;
  /** Python code for this cell */
  code: string;
  /** Current execution state */
  state: CellState;
  /** Reference to the marimo-island element once created */
  element: HTMLElement | null;
  /** Whether this cell is reactive */
  reactive: boolean;
  /** Error message if state is 'error' */
  errorMessage: string | null;
}

export interface CellRegistry {
  /** Map of cell ID to cell data */
  cells: Map<string, CellData>;
  /** Register a new cell and get its ID */
  registerCell(code: string, reactive?: boolean): string;
  /** Unregister a cell by ID */
  unregisterCell(id: string): void;
  /** Update a cell's state */
  updateCellState(id: string, state: CellState, errorMessage?: string): void;
  /** Set the element reference for a cell */
  setCellElement(id: string, element: HTMLElement): void;
  /** Get cell data by ID */
  getCell(id: string): CellData | undefined;
  /** Get all cells for creating marimo app */
  getAllCells(): CellData[];
  /** Get count of registered cells */
  getCellCount(): number;
  /** Reset registry (for HMR) */
  reset(): void;
}

// Injection key for the registry singleton
export const CELL_REGISTRY_KEY: InjectionKey<CellRegistry> =
  Symbol("cell-registry");

/**
 * Create a new CellRegistry instance.
 * Should be called once in setup/main.ts and provided to the app.
 */
export function createCellRegistry(): CellRegistry {
  // Use reactive Map for Vue reactivity
  const cells = reactive(new Map<string, CellData>());

  const registry: CellRegistry = {
    get cells() {
      return cells;
    },

    registerCell(code: string, isReactive = true): string {
      const id = generateCellId();

      const cellData: CellData = {
        id,
        code,
        state: "pending",
        element: null,
        reactive: isReactive,
        errorMessage: null,
      };

      cells.set(id, cellData);
      console.log(`📝 Cell ${id}: registered (${cells.size} total)`);

      return id;
    },

    unregisterCell(id: string): void {
      const cell = cells.get(id);
      if (cell) {
        cells.delete(id);
        releaseCellId(id);
        console.log(`🗑️ Cell ${id}: unregistered (${cells.size} remaining)`);
      }
    },

    updateCellState(id: string, state: CellState, errorMessage?: string): void {
      const cell = cells.get(id);
      if (cell) {
        cell.state = state;
        if (errorMessage !== undefined) {
          cell.errorMessage = errorMessage;
        }
        console.log(`🔄 Cell ${id}: state → ${state}`);
      }
    },

    setCellElement(id: string, element: HTMLElement): void {
      const cell = cells.get(id);
      if (cell) {
        cell.element = element;
      }
    },

    getCell(id: string): CellData | undefined {
      return cells.get(id);
    },

    getAllCells(): CellData[] {
      return Array.from(cells.values());
    },

    getCellCount(): number {
      return cells.size;
    },

    reset(): void {
      cells.clear();
      resetCellIds();
      console.log("🔄 Cell registry: reset");
    },
  };

  return registry;
}

/**
 * Use the cell registry from Vue context.
 * Must be called after the registry has been provided by setup/main.ts.
 *
 * @throws Error if registry is not provided (development safety)
 */
export function useCellRegistry(): CellRegistry {
  const registry = inject(CELL_REGISTRY_KEY);

  if (!registry) {
    throw new Error(
      "CellRegistry not provided. Ensure setup/main.ts has been executed."
    );
  }

  return registry;
}

/**
 * Install the registry into a Vue app.
 * Called by setup/main.ts.
 */
export function installCellRegistry(app: App): CellRegistry {
  const registry = createCellRegistry();
  app.provide(CELL_REGISTRY_KEY, registry);
  return registry;
}

// HMR: Force full page reload when this file changes
// Cell registry state cannot be hot-reloaded
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}
