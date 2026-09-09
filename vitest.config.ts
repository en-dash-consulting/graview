import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const src = (p: string) => fileURLToPath(new URL(`./packages/${p}/src/index.ts`, import.meta.url));

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@graview/core": src("core"),
      "@graview/layout": src("layout"),
      "@graview/tools": src("tools"),
      // The subpath first, or the bare-name alias swallows it.
      "@graview/render/gpu": fileURLToPath(
        new URL("./packages/render/src/gpu.ts", import.meta.url),
      ),
      "@graview/render": src("render"),
      "@graview/react": src("react"),
      "@graview/primitives": src("primitives"),
      "@graview/pages": src("pages"),
      "@graview/ship/browser": fileURLToPath(new URL("./packages/ship/src/browser.ts", import.meta.url)),
      "@graview/ship": src("ship"),
      "@graview/embed": src("embed"),
    },
  },
  test: {
    include: ["packages/*/tests/**/*.test.ts", "packages/*/tests/**/*.test.tsx", "apps/*/tests/**/*.test.ts", "apps/*/tests/**/*.test.tsx"],
    environment: "node",
    globals: false,
  },
});
