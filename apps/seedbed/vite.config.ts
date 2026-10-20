import { aiDevProxy, sourceAliases, studioDoor } from "@graview/ship/dev";
import { defineConfig } from "vite";
import { moved } from "../../scripts/lib/ports.mjs";
import { fileURLToPath } from "node:url";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  /*
   * THE STUDIO WRITES INTO THIS APP'S OWN src/domain, in development: a
   * change made in the studio is made in these files, inside their own
   * declarations. The harnesses drive the studio over the todo app, so no
   * check run edits this one.
   */
  /*
   * A MODEL FOR THE SEAT IN DEVELOPMENT: `ANTHROPIC_API_KEY=… pnpm dev`
   * (and `GRAVIEW_AI_MODEL` to choose one) lends the seat a model through
   * `/__graview/ai`, the key held here and never in the page. Serve only:
   * a build carries none of it.
   */
  plugins: [studioDoor({ root: fileURLToPath(new URL(".", import.meta.url)) }), aiDevProxy()],
  resolve: {
    // Every export of every framework package, from its source: read from the
    // packages' own `exports`, so a new entry point needs no line here.
    alias: sourceAliases(),
  },
  server: { port: moved(5194), strictPort: true },
});
