import { sourceAliases } from "@graview/ship/dev";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

/*
 * The page's chapters, as one script. A library build in IIFE form — no
 * module loader, nothing external — so the page loads it by name and the
 * artifact build inlines it whole. React and the framework ride inside.
 */
export default defineConfig({
  esbuild: { jsx: "automatic" },
  define: { "process.env.NODE_ENV": '"production"' },
  resolve: {
    // Every export of every framework package, from its source (read from the
    // packages' own `exports`), then what rides along with the chapters.
    alias: [
      ...sourceAliases(),
      /*
       * THE ROTA RIDES ALONG. The lenses section's claim is one calendar
       * over two domains — written for the rota, unchanged over the garden
       * — and the page used to make the first half with a photograph
       * because this bundle carried the garden alone. The rota's
       * declaration, seed and views come from its source, as the
       * framework's do.
       */
      { find: "@graview/rota/views", replacement: fileURLToPath(new URL("../rota/src/ui/views.tsx", import.meta.url)) },
      { find: "@graview/rota", replacement: fileURLToPath(new URL("../rota/src/index.ts", import.meta.url)) },
      /*
       * THE RECIPES RIDE ALONG TOO: each one's declaration document and
       * seed, from where the site serves them, so the app on a recipe's
       * page is the file an agent can fetch beside it.
       */
      { find: "@recipes", replacement: fileURLToPath(new URL("../../docs/site/recipes", import.meta.url)) },
      /*
       * AND THE ASKS: the turns graview.dev replays — a person's words, and
       * the worker view that came back — with the season app they were
       * asked of, from apps/site/asks/. The views ride as their own text,
       * run by the same host a product's views run in.
       */
      { find: "@site-asks", replacement: fileURLToPath(new URL("../site/asks", import.meta.url)) },
    ],
  },
  // The app's own favicons are its page's, not the docs site's: the site has its own in brand/.
  publicDir: false,
  build: {
    lib: {
      entry: fileURLToPath(new URL("./src/site-embed.ts", import.meta.url)),
      name: "graviewChapters",
      formats: ["iife"],
      fileName: () => "chapters.js",
    },
    outDir: fileURLToPath(new URL("../../docs/site", import.meta.url)),
    emptyOutDir: false,
    sourcemap: false,
    minify: true,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
