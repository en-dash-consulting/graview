import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const src = (p: string) => fileURLToPath(new URL(`./packages/${p}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@graview/core": src("core"),
      "@graview/layout": src("layout"),
      "@graview/tools": src("tools"),
      "@graview/render": src("render"),
      "@graview/react": src("react"),
      "@graview/primitives": src("primitives"),
    },
  },
  test: {
    include: ["packages/*/tests/**/*.test.ts", "packages/*/tests/**/*.test.tsx", "apps/*/tests/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
