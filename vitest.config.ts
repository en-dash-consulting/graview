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
      "@graview/core/document": fileURLToPath(new URL("./packages/core/src/document/index.ts", import.meta.url)),
      "@graview/core/conformance": fileURLToPath(new URL("./packages/core/src/conformance/index.ts", import.meta.url)),
      "@graview/core": src("core"),
      // The narrow entries (FR-57): the subpath first, or the bare-name alias swallows it.
      "@graview/layout/view": fileURLToPath(new URL("./packages/layout/src/view.ts", import.meta.url)),
      "@graview/layout": src("layout"),
      "@graview/tools/cli": fileURLToPath(new URL("./packages/tools/src/cli.ts", import.meta.url)),
      "@graview/tools/frame": fileURLToPath(new URL("./packages/tools/src/frame.ts", import.meta.url)),
      "@graview/tools": src("tools"),
      // The subpath first, or the bare-name alias swallows it.
      "@graview/render/gpu": fileURLToPath(
        new URL("./packages/render/src/gpu.ts", import.meta.url),
      ),
      "@graview/render": src("render"),
      "@graview/react/provider": fileURLToPath(new URL("./packages/react/src/provider.ts", import.meta.url)),
      "@graview/react": src("react"),
      "@graview/primitives/frame": fileURLToPath(new URL("./packages/primitives/src/frame.ts", import.meta.url)),
      "@graview/primitives/pages": fileURLToPath(new URL("./packages/primitives/src/pages.ts", import.meta.url)),
      "@graview/primitives": src("primitives"),
      "@graview/pages": src("pages"),
      "@graview/ship/browser": fileURLToPath(new URL("./packages/ship/src/browser.ts", import.meta.url)),
      "@graview/ship/runtime": fileURLToPath(new URL("./packages/ship/src/runtime.ts", import.meta.url)),
      "@graview/ship/cli": fileURLToPath(new URL("./packages/ship/src/cli.ts", import.meta.url)),
      "@graview/ship": src("ship"),
      // The subpath first, or the bare-name alias swallows it.
      "@graview/embed/pages": fileURLToPath(new URL("./packages/embed/src/pages.tsx", import.meta.url)),
      "@graview/embed": src("embed"),
      // The subpaths first, or the bare-name alias swallows them.
      "@graview/guest/host/worker": fileURLToPath(new URL("./packages/guest/src/host/worker.ts", import.meta.url)),
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
