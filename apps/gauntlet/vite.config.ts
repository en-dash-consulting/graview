import { aiDevProxy, sourceAliases } from "@graview/ship/dev";
import { defineConfig } from "vite";
import { moved } from "../../scripts/lib/ports.mjs";

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
  build: { target: "es2022", outDir: "build" },
  server: { port: moved(5191), strictPort: true },
});
