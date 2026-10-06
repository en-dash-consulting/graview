import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

/*
 * The page's chapters, as one script. A library build in IIFE form — no
 * module loader, nothing external — so the page loads it by name and the
 * artifact build inlines it whole. React and the framework ride inside.
 */
const pkg = (name: string) => fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  esbuild: { jsx: "automatic" },
  define: { "process.env.NODE_ENV": '"production"' },
  resolve: {
    alias: {
      "@graview/core/blocks": fileURLToPath(new URL("../../packages/core/src/blocks.ts", import.meta.url)),
      "@graview/core/check": fileURLToPath(new URL("../../packages/core/src/check.ts", import.meta.url)),
      "@graview/core/scene": fileURLToPath(new URL("../../packages/core/src/scene.ts", import.meta.url)),
      "@graview/core/figures": fileURLToPath(new URL("../../packages/core/src/figures.ts", import.meta.url)),
      "@graview/core/describe": fileURLToPath(new URL("../../packages/core/src/describe.ts", import.meta.url)),
      "@graview/core/document": fileURLToPath(new URL("../../packages/core/src/document/index.ts", import.meta.url)),
      "@graview/core": pkg("core"),
      "@graview/layout/view": fileURLToPath(new URL("../../packages/layout/src/view.ts", import.meta.url)),
      "@graview/layout": pkg("layout"),
      "@graview/tools/frame": fileURLToPath(new URL("../../packages/tools/src/frame.ts", import.meta.url)),
      "@graview/tools": pkg("tools"),
      "@graview/render/gpu": fileURLToPath(new URL("../../packages/render/src/gpu.ts", import.meta.url)),
      "@graview/render": pkg("render"),
      "@graview/react/provider": fileURLToPath(new URL("../../packages/react/src/provider.ts", import.meta.url)),
      "@graview/react": pkg("react"),
      "@graview/primitives/frame": fileURLToPath(new URL("../../packages/primitives/src/frame.ts", import.meta.url)),
      "@graview/primitives/pages": fileURLToPath(new URL("../../packages/primitives/src/pages.ts", import.meta.url)),
      "@graview/primitives/scene": fileURLToPath(new URL("../../packages/primitives/src/scene.ts", import.meta.url)),
      "@graview/primitives": pkg("primitives"),
      "@graview/pages": pkg("pages"),
      "@graview/studio": pkg("studio"),
      "@graview/ship/browser": fileURLToPath(new URL("../../packages/ship/src/browser.ts", import.meta.url)),
      "@graview/ship": pkg("ship"),
      "@graview/embed": pkg("embed"),
      /*
       * THE ROTA RIDES ALONG. The lenses section's claim is one calendar
       * over two domains — written for the rota, unchanged over the garden
       * — and the page used to make the first half with a photograph
       * because this bundle carried the garden alone. The rota's
       * declaration, seed and views come from its source, as the
       * framework's do.
       */
      "@graview/rota/views": fileURLToPath(new URL("../rota/src/ui/views.tsx", import.meta.url)),
      "@graview/rota": fileURLToPath(new URL("../rota/src/index.ts", import.meta.url)),
    },
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL("./src/site-embed.ts", import.meta.url)),
      name: "graviewChapters",
      formats: ["iife"],
      fileName: () => "chapters.js",
    },
    outDir: fileURLToPath(new URL("../../docs/site", import.meta.url)),
    emptyOutDir: false,
    sourcemap: false,
    minify: true,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
