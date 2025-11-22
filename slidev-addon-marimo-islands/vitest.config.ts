import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const vue = await import("@vitejs/plugin-vue");

  return {
    plugins: [vue.default()],
    testEnvironment: "jsdom",
    testTimeout: 10000,
    setupFiles: ["tests/setup.ts"],
    // Include component files if needed
    exclude: ["node_modules", "dist"],
  };
});
