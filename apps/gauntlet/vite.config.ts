import { defineConfig } from "vite";
import { moved } from "../../scripts/lib/ports.mjs";
import { fileURLToPath } from "node:url";

const pkg = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@graview/core/document": fileURLToPath(new URL("../../packages/core/src/document/index.ts", import.meta.url)),
      "@graview/core": pkg("core"),
      "@graview/layout": pkg("layout"),
      "@graview/tools": pkg("tools"),
      // The subpath first: a bare-name alias would swallow it.
      "@graview/render/gpu": fileURLToPath(
        new URL("../../packages/render/src/gpu.ts", import.meta.url),
      ),
      "@graview/render": pkg("render"),
      "@graview/react": pkg("react"),
      "@graview/primitives": pkg("primitives"),
      "@graview/pages": pkg("pages"),
      // The browser entry, so the file adapter's node:fs never meets the bundler.
      "@graview/ship/browser": fileURLToPath(
        new URL("../../packages/ship/src/browser.ts", import.meta.url),
      ),
    },
  },
  // Top-level await in main.tsx (the store opens before the first render);
  // the page goes to build/ so tsc's dist/ (the declaration, for graview check) stays.
  build: { target: "es2022", outDir: "build" },
  server: { port: moved(5191), strictPort: true },
});
