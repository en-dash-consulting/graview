import { defineConfig } from "vite";
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

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@graview/core": pkg("core"),
      "@graview/layout": pkg("layout"),
      "@graview/tools": pkg("tools"),
      // The subpath first: an alias for the bare name would otherwise swallow
      // "@graview/render/gpu" and resolve it to the main entry, which has no
      // Compositor on it.
      "@graview/render/gpu": fileURLToPath(
        new URL("../../packages/render/src/gpu.ts", import.meta.url),
      ),
      "@graview/render": pkg("render"),
      "@graview/react": pkg("react"),
      "@graview/primitives": pkg("primitives"),
      "@graview/pages": pkg("pages"),
      "@graview/ship/browser": fileURLToPath(
        new URL("../../packages/ship/src/browser.ts", import.meta.url),
      ),
      // Longest first: Vite matches an alias as a prefix, so the bare package
      // name would otherwise swallow the `/ui` sub-path.
      "@graview/todo/ui": ui("todo"),
      "@graview/seedbed/ui": ui("seedbed"),
      "@graview/todo": app("todo"),
      "@graview/seedbed": app("seedbed"),
    },
  },
  server: { port: 5199, strictPort: true },
});
