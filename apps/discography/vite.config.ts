import { aiDevProxy, sourceAliases } from "@graview/ship/dev";
import { defineConfig } from "vite";
import { moved } from "../../scripts/lib/ports.mjs";
import { fileURLToPath } from "node:url";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  /*
   * A MODEL FOR THE SEAT IN DEVELOPMENT: `ANTHROPIC_API_KEY=… pnpm dev`
   * (and `GRAVIEW_AI_MODEL` to choose one) lends the seat a model through
   * `/__graview/ai`, the key held here and never in the page. Serve only:
   * a build carries none of it.
   */
  plugins: [aiDevProxy()],
  resolve: {
    // Every export of every framework package, from its source: read from the
    // packages' own `exports`, so a new entry point needs no line here.
    alias: sourceAliases(),
  },
  // Top-level await in main.tsx (the store opens before the first render);
  // the page goes to build/ so tsc's dist/ (the declaration, for graview check) stays.
  // live.html: the catalog's songs as N live views on the GPU path, for verify-scale (src/live.ts).
  build: {
    target: "es2022",
    outDir: "build",
    rollupOptions: { input: { main: fileURLToPath(new URL("index.html", import.meta.url)), live: fileURLToPath(new URL("live.html", import.meta.url)) } },
  },
  preview: { port: moved(5198), strictPort: true },
  server: { port: moved(5197), strictPort: true },
});
