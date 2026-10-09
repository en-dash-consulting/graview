import { defineConfig } from "vite";
import { moved } from "../../scripts/lib/ports.mjs";
import { fileURLToPath } from "node:url";

const pkg = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@graview/core/blocks": fileURLToPath(new URL("../../packages/core/src/blocks.ts", import.meta.url)),
      "@graview/core/arrange": fileURLToPath(new URL("../../packages/core/src/arrange.ts", import.meta.url)),
      "@graview/core/check": fileURLToPath(new URL("../../packages/core/src/check.ts", import.meta.url)),
      "@graview/core/scene": fileURLToPath(new URL("../../packages/core/src/scene.ts", import.meta.url)),
      "@graview/core/figures": fileURLToPath(new URL("../../packages/core/src/figures.ts", import.meta.url)),
      "@graview/core/describe": fileURLToPath(new URL("../../packages/core/src/describe.ts", import.meta.url)),
      "@graview/core/retry": fileURLToPath(new URL("../../packages/core/src/retry.ts", import.meta.url)),
      "@graview/core/document": fileURLToPath(new URL("../../packages/core/src/document/index.ts", import.meta.url)),
      "@graview/core": pkg("core"),
      "@graview/layout/view": fileURLToPath(new URL("../../packages/layout/src/view.ts", import.meta.url)),
      "@graview/layout": pkg("layout"),
      "@graview/tools/frame": fileURLToPath(new URL("../../packages/tools/src/frame.ts", import.meta.url)),
      "@graview/tools/edit": fileURLToPath(new URL("../../packages/tools/src/edit.ts", import.meta.url)),
      "@graview/tools/draft": fileURLToPath(new URL("../../packages/tools/src/draft.ts", import.meta.url)),
      "@graview/tools": pkg("tools"),
      // The subpath first: a bare-name alias would swallow it.
      "@graview/render/gpu": fileURLToPath(
        new URL("../../packages/render/src/gpu.ts", import.meta.url),
      ),
      "@graview/render": pkg("render"),
      "@graview/react/provider": fileURLToPath(new URL("../../packages/react/src/provider.ts", import.meta.url)),
      "@graview/react/drawing": fileURLToPath(new URL("../../packages/react/src/drawing.ts", import.meta.url)),
      "@graview/react": pkg("react"),
      "@graview/primitives/frame": fileURLToPath(new URL("../../packages/primitives/src/frame.ts", import.meta.url)),
      "@graview/primitives/pages": fileURLToPath(new URL("../../packages/primitives/src/pages.ts", import.meta.url)),
      "@graview/primitives/scene": fileURLToPath(new URL("../../packages/primitives/src/scene.ts", import.meta.url)),
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
  preview: { port: moved(5198), strictPort: true },
  server: { port: moved(5197), strictPort: true },
});
