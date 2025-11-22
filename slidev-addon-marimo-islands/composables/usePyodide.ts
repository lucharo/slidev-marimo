import { readonly, ref } from "vue";

// Global state for Pyodide initialization
const isPyodideReady = ref(false);
const isInitializing = ref(false);
const initializationError = ref<string | null>(null);

/**
 * Composable for managing shared Pyodide instance across all islands
 * This ensures we only initialize Pyodide once for the entire presentation
 */
export function usePyodide() {
  const checkPyodideReady = async (): Promise<boolean> => {
    // Check if marimo islands library is loaded
    if (typeof window === "undefined") {
      return false;
    }

    // Marimo islands handles Pyodide initialization internally
    // We just need to check if the library is ready
    const marimoLoaded =
      !!(window as any).marimoIslands ||
      !!document.querySelector('script[src*="marimo-team/islands"]');

    if (marimoLoaded && !isPyodideReady.value && !isInitializing.value) {
      isInitializing.value = true;

      // Wait for marimo islands to be fully initialized
      try {
        await new Promise<void>((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 100; // 10 seconds max

          const checkInterval = setInterval(() => {
            attempts++;

            // Check if web components are defined
            if (customElements.get("marimo-island")) {
              clearInterval(checkInterval);
              isPyodideReady.value = true;
              isInitializing.value = false;
              resolve();
            } else if (attempts >= maxAttempts) {
              clearInterval(checkInterval);
              isInitializing.value = false;
              const error = "Marimo islands initialization timeout";
              initializationError.value = error;
              reject(new Error(error));
            }
          }, 100);
        });
      } catch (error) {
        console.error("Failed to initialize Pyodide:", error);
        initializationError.value =
          error instanceof Error ? error.message : "Unknown error";
      }
    }

    return isPyodideReady.value;
  };

  const waitForPyodide = async (
    timeoutMs: number = 15000,
  ): Promise<boolean> => {
    const startTime = Date.now();

    while (!isPyodideReady.value && Date.now() - startTime < timeoutMs) {
      await checkPyodideReady();
      if (!isPyodideReady.value) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    return isPyodideReady.value;
  };

  return {
    isPyodideReady: readonly(isPyodideReady),
    isInitializing: readonly(isInitializing),
    initializationError: readonly(initializationError),
    checkPyodideReady,
    waitForPyodide,
  };
}
