import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const pkg = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
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
      "@graview/studio": pkg("studio"),
      "@graview/embed": pkg("embed"),
    },
  },
  server: { port: 5195, strictPort: true },
  build: {
    rollupOptions: {
      // Two pages: the app, and the article the app is embedded in.
      input: {
        index: fileURLToPath(new URL("index.html", import.meta.url)),
        embed: fileURLToPath(new URL("embed.html", import.meta.url)),
      },
    },
  },
});
