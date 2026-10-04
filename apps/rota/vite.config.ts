import { studioDoor } from "@graview/ship/dev";
import { defineConfig } from "vite";
import { moved } from "../../scripts/lib/ports.mjs";
import { fileURLToPath } from "node:url";

const pkg = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  esbuild: { jsx: "automatic" },
  /*
   * THE STUDIO WRITES INTO THIS APP'S OWN src/domain, in development: a
   * change made in the studio is made in these files, inside their own
   * declarations. The harnesses drive the studio over the todo app, so no
   * check run edits this one.
   */
  plugins: [studioDoor({ root: fileURLToPath(new URL(".", import.meta.url)) })],
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
      "@graview/studio": pkg("studio"),
      "@graview/embed": pkg("embed"),
    },
  },
  server: { port: moved(5195), strictPort: true },
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
