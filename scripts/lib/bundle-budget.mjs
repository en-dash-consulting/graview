/**
 * WHAT A FACE COSTS A HOST'S PAGE (FR-19).
 *
 * The whole embed (every face, the studio, the lenses) bundled to over a
 * megabyte, and a chat's widget that only ever shows the pages paid for
 * all of it. `@graview/embed/pages` is the routed face alone; each entry
 * here is bundled the way a product's bundler would (minified, for the
 * browser, React left to the host) from the workspace's sources, and held
 * to a budget. `scripts/inspect-pack.mjs` fails CI when one is over.
 *
 * A budget is the size it was when it was set, with room for ordinary
 * growth. Raising one is a decision, said in the changeset that raises it.
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { graviewSources } from "./graview-sources.mjs";

/** Bytes, minified and gzipped. */
export const BUDGETS = [
  {
    name: "the pages face alone",
    entry: `import { mount } from "@graview/embed/pages"; globalThis.mount = mount;`,
    /*
     * Raised from 765_000 / 205_000 when the pages alone took the app's
     * views (FR-35 over FR-19): the framework's default views and the
     * declaration's view specs, which the pages now draw their cards, rows
     * and record pages from — about 48 kB minified, 15.5 kB gzipped.
     */
    minified: 815_000,
    gzipped: 220_000,
  },
  {
    name: "every face",
    entry: `import { mount } from "@graview/embed"; globalThis.mount = mount;`,
    /*
     * Raised from 1_100_000 / 315_000 when the studio learned to hand a host
     * back a document (FR-54): its changes are `editDocument`'s own ops, so
     * the studio every face carries now carries the editor and the document
     * schema it checks against — about 43 kB minified, 13 kB gzipped.
     */
    minified: 1_150_000,
    gzipped: 330_000,
  },
];

/** The host's own: a page has one React, and the embed is not it. */
const HOSTS_OWN = ["react", "react-dom", "react/jsx-runtime", "react-dom/client"];

/** One entry, bundled as a product would bundle it. */
export async function bundleSize(repo, entry) {
  const require = createRequire(join(repo, "package.json"));
  const esbuild = require("esbuild");
  const result = await esbuild.build({
    stdin: { contents: entry, resolveDir: join(repo, "packages", "embed"), loader: "js" },
    bundle: true,
    minify: true,
    format: "esm",
    platform: "browser",
    external: HOSTS_OWN,
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [graviewSources(repo)],
    write: false,
    logLevel: "silent",
  });
  const bytes = result.outputFiles[0].contents;
  return { minified: bytes.length, gzipped: gzipSync(bytes).length };
}

/** Every budget, measured: what it is, what it may be, and whether it is over. */
export async function measureBudgets(repo, budgets = BUDGETS) {
  const measured = [];
  for (const budget of budgets) {
    const size = await bundleSize(repo, budget.entry);
    const over = size.minified > budget.minified || size.gzipped > budget.gzipped;
    measured.push({ name: budget.name, ...size, budget: { minified: budget.minified, gzipped: budget.gzipped }, over });
  }
  return measured;
}
