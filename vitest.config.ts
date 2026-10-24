import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const src = (p: string) => fileURLToPath(new URL(`./packages/${p}/src/index.ts`, import.meta.url));
// The example apps are workspace names too, and a test that reaches across to
// one of them must reach its source. `pnpm build` builds the packages, not the
// apps, so a dist-resolved app is a test suite that only runs on a machine
// that happened to run `pnpm typecheck` first.
const app = (p: string) => fileURLToPath(new URL(`./apps/${p}/src/index.ts`, import.meta.url));

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      // The subpath first, or the bare-name alias swallows it: a declaration
      // built to be awkward, for holding the derivation to properties.
      "@graview/core/testing": fileURLToPath(
        new URL("./packages/core/src/testing.ts", import.meta.url),
      ),
      // The command lines, reached by the packages that dispatch to one another.
      "@graview/core/cli": fileURLToPath(new URL("./packages/core/src/cli/index.ts", import.meta.url)),
      "@graview/core/typed": fileURLToPath(new URL("./packages/core/src/typed.ts", import.meta.url)),
      "@graview/core/scaffold": fileURLToPath(new URL("./packages/core/src/scaffold/index.ts", import.meta.url)),
      "@graview/core/blocks": fileURLToPath(new URL("./packages/core/src/blocks.ts", import.meta.url)),
      "@graview/core/arrange": fileURLToPath(new URL("./packages/core/src/arrange.ts", import.meta.url)),
      "@graview/core/navigate": fileURLToPath(new URL("./packages/core/src/navigate.ts", import.meta.url)),
      "@graview/core/search": fileURLToPath(new URL("./packages/core/src/search.ts", import.meta.url)),
      "@graview/core/words": fileURLToPath(new URL("./packages/core/src/words.ts", import.meta.url)),
      "@graview/core/csv": fileURLToPath(new URL("./packages/core/src/csv.ts", import.meta.url)),
      "@graview/core/shown": fileURLToPath(new URL("./packages/core/src/shown.ts", import.meta.url)),
      "@graview/core/markdown": fileURLToPath(new URL("./packages/core/src/markdown.ts", import.meta.url)),
      "@graview/core/seat": fileURLToPath(new URL("./packages/core/src/seat.ts", import.meta.url)),
      "@graview/core/field-sight": fileURLToPath(new URL("./packages/core/src/field-sight.ts", import.meta.url)),
      "@graview/core/publishing": fileURLToPath(new URL("./packages/core/src/publishing.ts", import.meta.url)),
      "@graview/core/typing": fileURLToPath(new URL("./packages/core/src/typing.ts", import.meta.url)),
      "@graview/core/provenance": fileURLToPath(new URL("./packages/core/src/provenance.ts", import.meta.url)),
      "@graview/core/history": fileURLToPath(new URL("./packages/core/src/history.ts", import.meta.url)),
      "@graview/core/past": fileURLToPath(new URL("./packages/core/src/past.ts", import.meta.url)),
      "@graview/core/linked": fileURLToPath(new URL("./packages/core/src/linked.ts", import.meta.url)),
      "@graview/core/tidying": fileURLToPath(new URL("./packages/core/src/tidying.ts", import.meta.url)),
      "@graview/core/catalog": fileURLToPath(new URL("./packages/core/src/catalog.ts", import.meta.url)),
      "@graview/core/subscriptions": fileURLToPath(new URL("./packages/core/src/subscriptions.ts", import.meta.url)),
      "@graview/core/forms": fileURLToPath(new URL("./packages/core/src/forms.ts", import.meta.url)),
      "@graview/core/lines": fileURLToPath(new URL("./packages/core/src/lines.ts", import.meta.url)),
      "@graview/core/json-schema": fileURLToPath(new URL("./packages/core/src/json-schema.ts", import.meta.url)),
      "@graview/core/check": fileURLToPath(new URL("./packages/core/src/check.ts", import.meta.url)),
      "@graview/core/scene": fileURLToPath(new URL("./packages/core/src/scene.ts", import.meta.url)),
      "@graview/core/city": fileURLToPath(new URL("./packages/core/src/city.ts", import.meta.url)),
      "@graview/core/figures": fileURLToPath(new URL("./packages/core/src/figures.ts", import.meta.url)),
      "@graview/core/describe": fileURLToPath(new URL("./packages/core/src/describe.ts", import.meta.url)),
      "@graview/core/retry": fileURLToPath(new URL("./packages/core/src/retry.ts", import.meta.url)),
      "@graview/core/compiled": fileURLToPath(new URL("./packages/core/src/compiled.ts", import.meta.url)),
      "@graview/core/document": fileURLToPath(new URL("./packages/core/src/document/index.ts", import.meta.url)),
      "@graview/core/conformance": fileURLToPath(new URL("./packages/core/src/conformance/index.ts", import.meta.url)),
      "@graview/core/sync": fileURLToPath(new URL("./packages/core/src/sync/index.ts", import.meta.url)),
      "@graview/core/import": fileURLToPath(new URL("./packages/core/src/import/index.ts", import.meta.url)),
      "@graview/core/snapshot": fileURLToPath(new URL("./packages/core/src/snapshot.ts", import.meta.url)),
      "@graview/core": src("core"),
      // The narrow entries (FR-57): the subpath first, or the bare-name alias swallows it.
      "@graview/layout/view": fileURLToPath(new URL("./packages/layout/src/view.ts", import.meta.url)),
      "@graview/layout/sizes": fileURLToPath(new URL("./packages/layout/src/sizes.ts", import.meta.url)),
      "@graview/layout/view-moves": fileURLToPath(new URL("./packages/layout/src/view-moves.ts", import.meta.url)),
      "@graview/layout": src("layout"),
      "@graview/tools/cli": fileURLToPath(new URL("./packages/tools/src/cli.ts", import.meta.url)),
      "@graview/tools/frame": fileURLToPath(new URL("./packages/tools/src/frame.ts", import.meta.url)),
      "@graview/tools/edit": fileURLToPath(new URL("./packages/tools/src/edit.ts", import.meta.url)),
      "@graview/tools/suggest": fileURLToPath(new URL("./packages/tools/src/suggest.ts", import.meta.url)),
      "@graview/tools/derive": fileURLToPath(new URL("./packages/tools/src/derive.ts", import.meta.url)),
      "@graview/tools/go": fileURLToPath(new URL("./packages/tools/src/go.ts", import.meta.url)),
      "@graview/tools/draft": fileURLToPath(new URL("./packages/tools/src/draft.ts", import.meta.url)),
      "@graview/tools/keep": fileURLToPath(new URL("./packages/tools/src/keep.ts", import.meta.url)),
      "@graview/tools/inline-ai": fileURLToPath(new URL("./packages/tools/src/inline-ai.ts", import.meta.url)),
      "@graview/tools/turn": fileURLToPath(new URL("./packages/tools/src/turn.ts", import.meta.url)),
      "@graview/tools/several": fileURLToPath(new URL("./packages/tools/src/several.ts", import.meta.url)),
      "@graview/tools": src("tools"),
      // The subpath first, or the bare-name alias swallows it.
      "@graview/render/gpu": fileURLToPath(
        new URL("./packages/render/src/gpu.ts", import.meta.url),
      ),
      "@graview/render": src("render"),
      "@graview/react/provider": fileURLToPath(new URL("./packages/react/src/provider.ts", import.meta.url)),
      "@graview/react/drawing": fileURLToPath(new URL("./packages/react/src/drawing.ts", import.meta.url)),
      "@graview/react": src("react"),
      "@graview/primitives/frame": fileURLToPath(new URL("./packages/primitives/src/frame.ts", import.meta.url)),
      "@graview/primitives/pages": fileURLToPath(new URL("./packages/primitives/src/pages.ts", import.meta.url)),
      "@graview/primitives/scene": fileURLToPath(new URL("./packages/primitives/src/scene.ts", import.meta.url)),
      "@graview/primitives": src("primitives"),
      "@graview/pages/static": fileURLToPath(new URL("./packages/pages/src/static.ts", import.meta.url)),
      "@graview/pages/visitor-form": fileURLToPath(new URL("./packages/pages/src/visitor-form.tsx", import.meta.url)),
      "@graview/pages": src("pages"),
      "@graview/ship/browser": fileURLToPath(new URL("./packages/ship/src/browser.ts", import.meta.url)),
      "@graview/ship/runtime": fileURLToPath(new URL("./packages/ship/src/runtime.ts", import.meta.url)),
      "@graview/ship/cli": fileURLToPath(new URL("./packages/ship/src/cli.ts", import.meta.url)),
      "@graview/ship": src("ship"),
      // The subpath first, or the bare-name alias swallows it.
      "@graview/embed/pages": fileURLToPath(new URL("./packages/embed/src/pages.tsx", import.meta.url)),
      "@graview/embed/first-draw": fileURLToPath(new URL("./packages/embed/src/first-draw.ts", import.meta.url)),
      "@graview/embed/form": fileURLToPath(new URL("./packages/embed/src/form.tsx", import.meta.url)),
      "@graview/embed": src("embed"),
      // The subpaths first, or the bare-name alias swallows them.
      "@graview/guest/host/frame": fileURLToPath(new URL("./packages/guest/src/host/frame.ts", import.meta.url)),
      "@graview/guest/host/worker": fileURLToPath(new URL("./packages/guest/src/host/worker.ts", import.meta.url)),
      "@graview/guest/host/views": fileURLToPath(new URL("./packages/guest/src/host/views.ts", import.meta.url)),
      "@graview/guest/headless/node": fileURLToPath(new URL("./packages/guest/src/headless/node.ts", import.meta.url)),
      "@graview/guest/headless": fileURLToPath(new URL("./packages/guest/src/headless/index.ts", import.meta.url)),
      "@graview/guest/cli": fileURLToPath(new URL("./packages/guest/src/cli.ts", import.meta.url)),
      "@graview/guest/client.js": fileURLToPath(new URL("./packages/guest/client.js", import.meta.url)),
      "@graview/guest/client": fileURLToPath(new URL("./packages/guest/src/client.ts", import.meta.url)),
      "@graview/guest/host": fileURLToPath(new URL("./packages/guest/src/host/index.ts", import.meta.url)),
      "@graview/guest/react": fileURLToPath(new URL("./packages/guest/src/react.ts", import.meta.url)),
      "@graview/guest/build": fileURLToPath(new URL("./packages/guest/src/build.ts", import.meta.url)),
      "@graview/guest/worker/view": fileURLToPath(new URL("./packages/guest/src/worker/view.ts", import.meta.url)),
      "@graview/guest/worker": fileURLToPath(new URL("./packages/guest/src/worker/index.ts", import.meta.url)),
      "@graview/guest": src("guest"),
      "@graview/studio": src("studio"),
      // The subpaths first, or the bare-name alias swallows them.
      "@graview/todo/ui": fileURLToPath(new URL("./apps/todo/src/ui/app.tsx", import.meta.url)),
      "@graview/todo/open": fileURLToPath(new URL("./apps/todo/src/open.ts", import.meta.url)),
      "@graview/todo": app("todo"),
      "@graview/seedbed/ui": fileURLToPath(new URL("./apps/seedbed/src/ui/app.tsx", import.meta.url)),
      "@graview/seedbed/open": fileURLToPath(new URL("./apps/seedbed/src/open.ts", import.meta.url)),
      "@graview/seedbed": app("seedbed"),
      // Rota is reached from the launcher's and seedbed's own source, never a
      // test's — so the setup check walks app sources too (W-153).
      "@graview/rota/ui": fileURLToPath(new URL("./apps/rota/src/ui/app.tsx", import.meta.url)),
      "@graview/rota/open": fileURLToPath(new URL("./apps/rota/src/open.ts", import.meta.url)),
      "@graview/rota/views": fileURLToPath(new URL("./apps/rota/src/ui/views.tsx", import.meta.url)),
      "@graview/rota": app("rota"),
    },
  },
  test: {
    include: [
      "packages/*/tests/**/*.test.ts",
      "packages/*/tests/**/*.test.tsx",
      "apps/*/tests/**/*.test.ts",
      "apps/*/tests/**/*.test.tsx",
      "tests/**/*.test.ts",
    ],
    environment: "node",
    globals: false,
  },
});
