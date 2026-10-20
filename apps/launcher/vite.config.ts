import { aiDevProxy, sourceAliases } from "@graview/ship/dev";
import { defineConfig } from "vite";
import { DESK_SERVES, moved, portsFor } from "../../scripts/lib/ports.mjs";
import { fileURLToPath } from "node:url";

const app = (name: string) =>
  fileURLToPath(new URL(`../${name}/src/index.ts`, import.meta.url));
/**
 * The apps' UI entry points.
 *
 * Their `src/index.ts` deliberately exports only the DOMAIN — the declaration
 * `graview check` reads — so importing a React component from one goes
 * through an explicit alias rather than by widening what an app package
 * means.
 */
const ui = (name: string) =>
  fileURLToPath(new URL(`../${name}/src/ui/app.tsx`, import.meta.url));
/**
 * And how each app OPENS itself: its adapter, its scope, its seat. The desk
 * mounts through this so an edit made here is the same edit the app has at
 * its own port — see `open.ts` in any of them.
 */
const opens = (name: string) =>
  fileURLToPath(new URL(`../${name}/src/open.ts`, import.meta.url));

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
    // Every export of every framework package, from its source (read from the
    // packages' own `exports`), then the apps the desk opens.
    alias: [
      ...sourceAliases(),
      // Longest first: Vite matches an alias as a prefix, so the bare package
      // name would otherwise swallow the `/ui` and `/open` sub-paths.
      { find: "@graview/todo/open", replacement: opens("todo") },
      { find: "@graview/seedbed/open", replacement: opens("seedbed") },
      { find: "@graview/rota/open", replacement: opens("rota") },
      { find: "@graview/todo/ui", replacement: ui("todo") },
      { find: "@graview/seedbed/ui", replacement: ui("seedbed") },
      { find: "@graview/rota/ui", replacement: ui("rota") },
      { find: "@graview/todo", replacement: app("todo") },
      { find: "@graview/seedbed", replacement: app("seedbed") },
      { find: "@graview/rota", replacement: app("rota") },
    ],
  },
  // The ports this checkout serves the demos on, moved onto GRAVIEW_PORT_BASE when it is set: a page cannot read the environment.
  define: { __GRAVIEW_PORTS__: JSON.stringify(portsFor(DESK_SERVES)) },
  server: { port: moved(5199), strictPort: true },
});
