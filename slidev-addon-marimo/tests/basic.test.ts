/**
 * Tests for slidev-addon-marimo islands mode
 *
 * Tests cover:
 * - Cell ID generation (4-char alphanumeric format)
 * - Kernel state management
 * - Cell registry operations
 * - hideLines normalization
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Store original globals for restoration
let originalDocument: typeof global.document;
let originalWindow: typeof global.window;
let originalCustomElements: typeof global.customElements;

// Mock DOM environment for testing
const mockDom = () => {
  global.document = {
    createElement: vi.fn(() => ({
      hidden: false,
      textContent: "",
      style: {},
      setAttribute: vi.fn(),
      appendChild: vi.fn(),
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      classList: { add: vi.fn(), contains: vi.fn() },
    })),
    head: {
      appendChild: vi.fn(),
    },
    body: {
      appendChild: vi.fn(),
    },
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    getElementById: vi.fn(() => null),
  } as any;

  global.window = {
    customElements: {
      get: vi.fn(),
      define: vi.fn(),
    },
    location: {
      href: "http://localhost:3000",
    },
    setTimeout: vi.fn((fn) => fn()),
    addEventListener: vi.fn(),
  } as any;

  global.customElements = global.window.customElements;
};

describe("slidev-addon-marimo (islands mode)", () => {
  beforeEach(() => {
    // Save original globals before mocking
    originalDocument = global.document;
    originalWindow = global.window;
    originalCustomElements = global.customElements;
    mockDom();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original globals after each test
    if (originalDocument !== undefined) global.document = originalDocument;
    if (originalWindow !== undefined) global.window = originalWindow;
    if (originalCustomElements !== undefined)
      global.customElements = originalCustomElements;
  });

  describe("Cell ID Generator", () => {
    it("should generate 4-character alphanumeric IDs", async () => {
      const { generateCellId, resetCellIds } = await import("../utils/cellId");
      resetCellIds();

      const id = generateCellId();
      expect(id).toHaveLength(4);
      expect(id).toMatch(/^[A-Za-z0-9]{4}$/);
    });

    it("should generate unique IDs", async () => {
      const { generateCellId, resetCellIds } = await import("../utils/cellId");
      resetCellIds();

      const ids = new Set<string>();
      // Generate up to the limit of 30 cells
      for (let i = 0; i < 30; i++) {
        ids.add(generateCellId());
      }

      // All 30 should be unique
      expect(ids.size).toBe(30);
    });

    it("should track and release IDs", async () => {
      const { generateCellId, releaseCellId, isIdUsed, resetCellIds } =
        await import("../utils/cellId");
      resetCellIds();

      const id = generateCellId();
      expect(isIdUsed(id)).toBe(true);

      releaseCellId(id);
      expect(isIdUsed(id)).toBe(false);
    });

    it("should reset all IDs", async () => {
      const { generateCellId, getUsedIdCount, resetCellIds } = await import(
        "../utils/cellId"
      );
      resetCellIds();

      generateCellId();
      generateCellId();
      generateCellId();
      expect(getUsedIdCount()).toBe(3);

      resetCellIds();
      expect(getUsedIdCount()).toBe(0);
    });
  });

  describe("Kernel State Manager", () => {
    it("should start in idle state", async () => {
      const { createMarimoKernel } = await import(
        "../composables/islands/useMarimoKernel"
      );
      const kernel = createMarimoKernel();

      expect(kernel.state).toBe("idle");
      expect(kernel.errorMessage).toBeNull();
    });

    it("should transition through states correctly", async () => {
      const { createMarimoKernel } = await import(
        "../composables/islands/useMarimoKernel"
      );
      const kernel = createMarimoKernel();

      kernel.startLoading();
      expect(kernel.state).toBe("loading");

      kernel.markReady();
      expect(kernel.state).toBe("ready");
    });

    it("should handle error state", async () => {
      const { createMarimoKernel } = await import(
        "../composables/islands/useMarimoKernel"
      );
      const kernel = createMarimoKernel();

      kernel.startLoading();
      kernel.markError("Test error");

      expect(kernel.state).toBe("error");
      expect(kernel.errorMessage).toBe("Test error");
    });

    it("should resolve waitForReady when already ready", async () => {
      const { createMarimoKernel } = await import(
        "../composables/islands/useMarimoKernel"
      );
      const kernel = createMarimoKernel();

      kernel.startLoading();
      kernel.markReady();

      await expect(kernel.waitForReady()).resolves.toBeUndefined();
    });

    it("should reject waitForReady on error", async () => {
      const { createMarimoKernel } = await import(
        "../composables/islands/useMarimoKernel"
      );
      const kernel = createMarimoKernel();

      kernel.startLoading();
      kernel.markError("Test error");

      await expect(kernel.waitForReady()).rejects.toThrow("Test error");
    });

    it("should reset state", async () => {
      const { createMarimoKernel } = await import(
        "../composables/islands/useMarimoKernel"
      );
      const kernel = createMarimoKernel();

      kernel.startLoading();
      kernel.markReady();
      kernel.reset();

      expect(kernel.state).toBe("idle");
    });
  });

  describe("Cell Registry", () => {
    it("should register cells and return IDs", async () => {
      const { createCellRegistry } = await import(
        "../composables/islands/useCellRegistry"
      );
      // Need to reset cell IDs before creating registry
      const { resetCellIds } = await import("../utils/cellId");
      resetCellIds();

      const registry = createCellRegistry();

      const id = registry.registerCell("print('hello')");
      expect(id).toHaveLength(4);
      expect(id).toMatch(/^[A-Za-z0-9]{4}$/);
    });

    it("should track cell state", async () => {
      const { createCellRegistry } = await import(
        "../composables/islands/useCellRegistry"
      );
      const { resetCellIds } = await import("../utils/cellId");
      resetCellIds();

      const registry = createCellRegistry();

      const id = registry.registerCell("x = 1");
      const cell = registry.getCell(id);

      expect(cell).toBeDefined();
      expect(cell?.state).toBe("pending");
      expect(cell?.code).toBe("x = 1");
    });

    it("should update cell state", async () => {
      const { createCellRegistry } = await import(
        "../composables/islands/useCellRegistry"
      );
      const { resetCellIds } = await import("../utils/cellId");
      resetCellIds();

      const registry = createCellRegistry();

      const id = registry.registerCell("x = 1");
      registry.updateCellState(id, "running");

      expect(registry.getCell(id)?.state).toBe("running");
    });

    it("should unregister cells", async () => {
      const { createCellRegistry } = await import(
        "../composables/islands/useCellRegistry"
      );
      const { resetCellIds } = await import("../utils/cellId");
      resetCellIds();

      const registry = createCellRegistry();

      const id = registry.registerCell("x = 1");
      expect(registry.getCellCount()).toBe(1);

      registry.unregisterCell(id);
      expect(registry.getCellCount()).toBe(0);
      expect(registry.getCell(id)).toBeUndefined();
    });

    it("should get all cells", async () => {
      const { createCellRegistry } = await import(
        "../composables/islands/useCellRegistry"
      );
      const { resetCellIds } = await import("../utils/cellId");
      resetCellIds();

      const registry = createCellRegistry();

      registry.registerCell("x = 1");
      registry.registerCell("y = 2");
      registry.registerCell("z = 3");

      const cells = registry.getAllCells();
      expect(cells).toHaveLength(3);
    });

    it("should reset registry", async () => {
      const { createCellRegistry } = await import(
        "../composables/islands/useCellRegistry"
      );
      const { resetCellIds } = await import("../utils/cellId");
      resetCellIds();

      const registry = createCellRegistry();

      registry.registerCell("x = 1");
      registry.registerCell("y = 2");
      registry.reset();

      expect(registry.getCellCount()).toBe(0);
    });
  });

  describe("hideLines Normalization", () => {
    it("should handle number type", () => {
      // Test the normalization logic that's now in the component
      const hideLines: number | number[] = 1;
      const normalized =
        typeof hideLines === "number" ? [hideLines] : hideLines || [];

      expect(normalized).toEqual([1]);
    });

    it("should handle array type", () => {
      const hideLines: number | number[] = [1, 3, 5];
      const normalized =
        typeof hideLines === "number" ? [hideLines] : hideLines || [];

      expect(normalized).toEqual([1, 3, 5]);
    });

    it("should handle empty/undefined", () => {
      const hideLines: number | number[] | undefined = undefined;
      const normalized =
        typeof hideLines === "number" ? [hideLines] : hideLines || [];

      expect(normalized).toEqual([]);
    });
  });

  describe("Code Processing", () => {
    it("should filter lines correctly", () => {
      const code =
        'print("Line 1")\nprint("Line 2")\nprint("Line 3")\nprint("Line 4")';
      const hideLines = [2, 4];

      const lines = code.split("\n");
      const result = lines
        .filter((_, index) => !hideLines.includes(index + 1))
        .join("\n");

      expect(result).toBe('print("Line 1")\nprint("Line 3")');
    });

    it("should handle empty hideLines", () => {
      const code = 'print("Hello")';
      const hideLines: number[] = [];

      const lines = code.split("\n");
      const result = lines
        .filter((_, index) => !hideLines.includes(index + 1))
        .join("\n");

      expect(result).toBe(code);
    });
  });

  describe("Preparser hideLines Normalization", () => {
    it("should normalize single number to array", () => {
      // Test the preparser normalization logic
      const value = "1";
      const normalized = value.startsWith("[") ? value : `[${value}]`;
      expect(normalized).toBe("[1]");
    });

    it("should preserve existing array format", () => {
      const value = "[1,2,3]";
      const normalized = value.startsWith("[") ? value : `[${value}]`;
      expect(normalized).toBe("[1,2,3]");
    });
  });

  describe("Integration", () => {
    it("should have correct package structure", () => {
      const packageJson = require("../package.json");

      expect(packageJson.name).toBe("slidev-addon-marimo");
      expect(packageJson.peerDependencies).toHaveProperty("@slidev/cli");
      expect(packageJson.peerDependencies).toHaveProperty("vue");
    });
  });
});
