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
      "@graview/core": pkg("core"),
      "@graview/layout": pkg("layout"),
      "@graview/tools": pkg("tools"),
      "@graview/render/gpu": fileURLToPath(new URL("../../packages/render/src/gpu.ts", import.meta.url)),
      "@graview/render": pkg("render"),
      "@graview/react": pkg("react"),
      "@graview/primitives": pkg("primitives"),
      "@graview/pages": pkg("pages"),
      "@graview/studio": pkg("studio"),
      "@graview/ship/browser": fileURLToPath(new URL("../../packages/ship/src/browser.ts", import.meta.url)),
      "@graview/ship": pkg("ship"),
      "@graview/embed": pkg("embed"),
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
