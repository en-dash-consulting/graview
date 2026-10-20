import { aiDevProxy, devFiles, sourceAliases } from "@graview/ship/dev";
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
  plugins: [
    aiDevProxy(),
    /*
     * A TASK'S ATTACHMENTS IN DEVELOPMENT (FR-163): the dev server keeps what
     * the editor sends in memory and serves it back at `/__graview/files`.
     * Serve only, like the model's door.
     */
    devFiles(),
  ],
  resolve: {
    // Every export of every framework package, from its source: read from the
    // packages' own `exports`, so a new entry point needs no line here.
    alias: sourceAliases(),
  },
  server: { port: moved(5193), strictPort: true },
});
