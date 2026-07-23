import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Standalone test config: intentionally does NOT use the Lovable TanStack Start
// vite config (which wires SSR/nitro). Tests run against pure modules and
// components in jsdom.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      // Focus coverage on our own logic + nutrition UI; exclude generated,
      // vendored shadcn primitives, demo seed and framework glue.
      include: ["src/lib/**", "src/components/nutrition/**"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/lib/demo-data.ts",
        "src/lib/food-catalog.ts",
        "src/routeTree.gen.ts",
      ],
    },
  },
});
