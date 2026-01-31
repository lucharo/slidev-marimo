/**
 * Marimo Kernel State Manager
 *
 * Manages the lifecycle state of the marimo kernel as a singleton.
 * Provides observable state and methods for coordinating island initialization.
 *
 * States:
 *   idle     → Initial state, kernel not yet loading
 *   loading  → Kernel script is loading, waiting for ready signal
 *   ready    → Kernel is ready, islands can render
 *   error    → Kernel failed to initialize
 *
 * Usage:
 *   const kernel = useMarimoKernel();
 *   await kernel.waitForReady();
 */

import type { App, InjectionKey } from "vue";
import { inject, reactive, readonly } from "vue";

export type KernelState = "idle" | "loading" | "ready" | "error";

export interface MarimoKernel {
  /** Current kernel state */
  state: KernelState;
  /** Error message if state is 'error' */
  errorMessage: string | null;
  /** Start loading the kernel (called by island-manager) */
  startLoading(): void;
  /** Mark kernel as ready (called when kernel-ready message received) */
  markReady(): void;
  /** Mark kernel as failed with an error message */
  markError(message: string): void;
  /** Wait for kernel to be ready, rejects on error */
  waitForReady(timeoutMs?: number): Promise<void>;
  /** Reset kernel state (for HMR) */
  reset(): void;
}

// Injection key for the kernel singleton
export const MARIMO_KERNEL_KEY: InjectionKey<MarimoKernel> =
  Symbol("marimo-kernel");

/**
 * Create a new MarimoKernel instance.
 * Should be called once in setup/main.ts and provided to the app.
 */
export function createMarimoKernel(): MarimoKernel {
  const state = reactive({
    current: "idle" as KernelState,
    errorMessage: null as string | null,
  });

  // Promise resolvers for waitForReady
  let readyResolvers: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];

  function notifyResolvers(success: boolean, error?: string) {
    const resolvers = readyResolvers;
    readyResolvers = [];

    for (const { resolve, reject } of resolvers) {
      if (success) {
        resolve();
      } else {
        reject(new Error(error || "Kernel failed to initialize"));
      }
    }
  }

  const kernel: MarimoKernel = {
    get state() {
      return state.current;
    },

    get errorMessage() {
      return state.errorMessage;
    },

    startLoading() {
      if (state.current === "idle") {
        state.current = "loading";
        console.log("🔄 Marimo kernel: loading...");
      }
    },

    markReady() {
      if (state.current === "loading") {
        state.current = "ready";
        console.log("✓ Marimo kernel: ready");
        notifyResolvers(true);
      }
    },

    markError(message: string) {
      state.current = "error";
      state.errorMessage = message;
      console.error("❌ Marimo kernel error:", message);
      notifyResolvers(false, message);
    },

    waitForReady(timeoutMs = 60000): Promise<void> {
      // Already ready
      if (state.current === "ready") {
        return Promise.resolve();
      }

      // Already failed
      if (state.current === "error") {
        return Promise.reject(new Error(state.errorMessage || "Kernel error"));
      }

      return new Promise((resolve, reject) => {
        // Add to resolvers list
        readyResolvers.push({ resolve, reject });

        // Set timeout
        const timeoutId = setTimeout(() => {
          // Remove this resolver from the list
          const index = readyResolvers.findIndex((r) => r.resolve === resolve);
          if (index !== -1) {
            readyResolvers.splice(index, 1);
            reject(new Error(`Kernel not ready after ${timeoutMs}ms`));
          }
        }, timeoutMs);

        // Clear timeout when resolved
        const originalResolve = resolve;
        const originalReject = reject;
        readyResolvers[readyResolvers.length - 1] = {
          resolve: () => {
            clearTimeout(timeoutId);
            originalResolve();
          },
          reject: (e: Error) => {
            clearTimeout(timeoutId);
            originalReject(e);
          },
        };
      });
    },

    reset() {
      state.current = "idle";
      state.errorMessage = null;
      readyResolvers = [];
      console.log("🔄 Marimo kernel: reset");
    },
  };

  return kernel;
}

/**
 * Use the marimo kernel from Vue context.
 * Must be called after the kernel has been provided by setup/main.ts.
 *
 * @throws Error if kernel is not provided (development safety)
 */
export function useMarimoKernel(): MarimoKernel {
  const kernel = inject(MARIMO_KERNEL_KEY);

  if (!kernel) {
    throw new Error(
      "MarimoKernel not provided. Ensure setup/main.ts has been executed."
    );
  }

  return kernel;
}

/**
 * Install the kernel into a Vue app.
 * Called by setup/main.ts.
 */
export function installMarimoKernel(app: App): MarimoKernel {
  const kernel = createMarimoKernel();
  app.provide(MARIMO_KERNEL_KEY, kernel);
  return kernel;
}
