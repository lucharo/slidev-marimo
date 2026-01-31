/**
 * AppSetup for Marimo Live Kernel Integration
 *
 * This file is automatically loaded by Slidev.
 * Initializes the WebSocket connection to the marimo server and provides
 * the kernel connection to all components via Vue's dependency injection.
 */

import {
  initializeKernelListeners,
  KERNEL_CONNECTION_KEY,
} from "../composables/useMarimoKernel";
import { createKernelConnection, type KernelConfig } from "./kernel-connection";
import { initializeUISync } from "./ui-sync";

// Default configuration - can be overridden via slidev frontmatter or global config
const DEFAULT_KERNEL_CONFIG: KernelConfig = {
  wsUrl: "ws://localhost:2718/ws",
  httpUrl: "http://localhost:2718",
  autoInstantiate: true,
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
};

export default ({ app }) => {
  // Only run on client side
  if (typeof window === "undefined") {
    return;
  }

  // Check for custom configuration in window (can be set via slidev config)
  const userConfig = (window as any).__MARIMO_LIVE_CONFIG__ || {};

  const config: KernelConfig = {
    ...DEFAULT_KERNEL_CONFIG,
    ...userConfig,
  };

  console.log("[marimo-live] Initializing with config:", config);

  // Create kernel connection
  const kernel = createKernelConnection(config);

  // Set up event listeners for state management
  initializeKernelListeners(kernel);

  // Set up UI element synchronization
  initializeUISync(kernel);

  // Provide kernel to all components
  app.provide(KERNEL_CONNECTION_KEY, kernel);

  // Auto-connect when the app starts
  kernel
    .connect()
    .then(() => {
      console.log("[marimo-live] Connected to marimo server");
    })
    .catch((err) => {
      console.error("[marimo-live] Failed to connect:", err);
      console.log(
        "[marimo-live] Make sure marimo is running: marimo edit notebook.py --headless --port 2718 --no-token --no-skew-protection --allow-origins '*'",
      );
    });

  // Clean up on app unmount (if needed)
  // Note: Slidev doesn't typically unmount the app, but this is here for completeness
  if (app.unmount) {
    const originalUnmount = app.unmount.bind(app);
    app.unmount = () => {
      kernel.disconnect();
      originalUnmount();
    };
  }
};
