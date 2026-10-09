import { defineConfig } from "vite";
import { DESK_SERVES, moved, portsFor } from "../../scripts/lib/ports.mjs";
import { fileURLToPath } from "node:url";

const pkg = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url));
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
      "@graview/tools/suggest": fileURLToPath(new URL("../../packages/tools/src/suggest.ts", import.meta.url)),
      "@graview/tools/go": fileURLToPath(new URL("../../packages/tools/src/go.ts", import.meta.url)),
      "@graview/tools/draft": fileURLToPath(new URL("../../packages/tools/src/draft.ts", import.meta.url)),
      "@graview/tools": pkg("tools"),
      // The subpath first: an alias for the bare name would otherwise swallow
      // "@graview/render/gpu" and resolve it to the main entry, which has no
      // Compositor on it.
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
      "@graview/ship/browser": fileURLToPath(
        new URL("../../packages/ship/src/browser.ts", import.meta.url),
      ),
      "@graview/ship": pkg("ship"),
      "@graview/studio": pkg("studio"),
      "@graview/embed": pkg("embed"),
      // Longest first: Vite matches an alias as a prefix, so the bare package
      // name would otherwise swallow the `/ui` and `/open` sub-paths.
      "@graview/todo/open": opens("todo"),
      "@graview/seedbed/open": opens("seedbed"),
      "@graview/rota/open": opens("rota"),
      "@graview/todo/ui": ui("todo"),
      "@graview/seedbed/ui": ui("seedbed"),
      "@graview/rota/ui": ui("rota"),
      "@graview/todo": app("todo"),
      "@graview/seedbed": app("seedbed"),
      "@graview/rota": app("rota"),
    },
  },
  // The ports this checkout serves the demos on, moved onto GRAVIEW_PORT_BASE when it is set: a page cannot read the environment.
  define: { __GRAVIEW_PORTS__: JSON.stringify(portsFor(DESK_SERVES)) },
  server: { port: moved(5199), strictPort: true },
});
