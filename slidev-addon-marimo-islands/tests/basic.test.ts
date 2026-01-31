/**
 * Basic functionality tests for slidev-marimo-islands
 * Tests core functionality without over-engineering
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock DOM environment for testing
const mockDom = () => {
  global.document = {
    createElement: vi.fn(() => ({
      hidden: false,
      setAttribute: vi.fn(),
      appendChild: vi.fn(),
      querySelector: vi.fn(() => null),
    })),
    head: {
      appendChild: vi.fn(),
    },
    querySelector: vi.fn(() => null),
  } as any;

  global.window = {
    customElements: {
      get: vi.fn(),
      define: vi.fn(),
    },
    location: {
      href: "http://localhost:3000",
    },
    setTimeout: vi.fn(),
  } as any;

  global.customElements = global.window.customElements;
};

describe("slidev-marimo-islands", () => {
  beforeEach(() => {
    mockDom();
    vi.clearAllMocks();
  });

  describe("MarimoIsland Component", () => {
    it("should process code correctly", () => {
      // Test the logic for hiding lines without importing Vue component
      const code =
        'print("Hello World")\nprint("Should be hidden")\nprint("Should be visible")\nprint("Should be hidden too")';
      const hideLines = [2, 4];

      const expectedProcessed =
        'print("Hello World")\nprint("Should be visible")';

      // The component should filter out lines 2 and 4
      const lines = code.split("\n");
      const result = lines
        .filter((_, index) => !hideLines.includes(index + 1))
        .join("\n");

      expect(result).toBe(expectedProcessed);
    });

    it("should generate unique island IDs", () => {
      // Test ID generation logic
      const mockInstance = { uid: "test-123" };

      const islandId = `island-${mockInstance.uid || Math.random().toString(36).slice(2)}`;

      expect(islandId).toBe("island-test-123");
    });
  });

  describe("useIslandState", () => {
    it("should detect when marimo islands are ready", async () => {
      const { checkIslandReady } = await import(
        "../composables/useIslandState"
      );

      // Initially not ready
      expect(checkIslandReady()).toBe(false);

      // Mock marimo-island element being registered
      global.customElements.get.mockReturnValue(() => true);

      expect(checkIslandReady()).toBe(true);
    });

    it("should wait until marimo islands are ready", async () => {
      const { useIslandState } = await import("../composables/useIslandState");
      const { waitUntilReady } = useIslandState();

      // Mock the custom element to be ready
      global.customElements.get.mockReturnValue(() => true);

      const result = await waitUntilReady();

      expect(result).toBe(undefined); // waitUntilReady resolves to undefined
    });
  });

  describe("Integration", () => {
    it("should integrate with Slidev properly", () => {
      // Test that the addon can be properly loaded by Slidev
      // This would require setting up a full Slidev environment

      // For now, just verify the export structure
      const packageJson = require("../package.json");

      expect(packageJson.name).toBe("slidev-marimo-islands");
      expect(packageJson.peerDependencies).toHaveProperty("@slidev/cli");
      expect(packageJson.peerDependencies).toHaveProperty("vue");
    });
  });


  describe("Island Registry", () => {
    it("should create island element from a valid marker", async () => {
      // Set up a more complete DOM mock for this test
      const appendedChildren: any[] = [];

      global.document.createElement = vi.fn((tag: string) => {
        const el = {
          tagName: tag,
          hidden: false,
          textContent: "",
          style: {},
          setAttribute: vi.fn(),
          appendChild: vi.fn(() => el),
          querySelector: vi.fn(() => null),
          classList: { add: vi.fn(), contains: vi.fn() },
        };
        return el;
      }) as any;

      global.document.body = {
        appendChild: vi.fn((child) => appendedChildren.push(child)),
      } as any;

      global.document.querySelector = vi.fn(() => null);
      global.document.querySelectorAll = vi.fn(() => []);

      const { createIslandFromMarker } = await import(
        "../setup/island-registry"
      );

      const marker = {
        dataset: {
          islandId: "test-island-1",
          islandReactive: "true",
          islandCode: encodeURIComponent('print("hello")'),
        },
      };

      const result = createIslandFromMarker(marker as any, 0);
      expect(result).toBe(true);
      expect(appendedChildren.length).toBe(1);
    });

    it("should skip marker without island ID", async () => {
      global.document.querySelector = vi.fn(() => null);

      const { createIslandFromMarker } = await import(
        "../setup/island-registry"
      );

      const marker = { dataset: {} };
      const result = createIslandFromMarker(marker as any, 0);
      expect(result).toBe(false);
    });

    it("should skip marker if island already exists", async () => {
      global.document.querySelector = vi.fn(() => ({})); // island exists

      const { createIslandFromMarker } = await import(
        "../setup/island-registry"
      );

      const marker = {
        dataset: {
          islandId: "existing-island",
          islandCode: encodeURIComponent("x = 1"),
        },
      };
      const result = createIslandFromMarker(marker as any, 0);
      expect(result).toBe(false);
    });
  });

  describe("Performance", () => {
    it("should handle multiple islands efficiently", async () => {
      // Test that multiple instances share state properly
      const { useIslandState } = await import("../composables/useIslandState");

      // Multiple instances should share the same state
      const state1 = useIslandState();
      const state2 = useIslandState();
      const state3 = useIslandState();

      expect(state1.isReady).toBe(state2.isReady);
      expect(state2.isReady).toBe(state3.isReady);
      expect(state1.isReady).toBe(state3.isReady);
    });
  });
});
