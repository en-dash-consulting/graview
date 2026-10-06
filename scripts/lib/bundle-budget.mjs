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
 *
 * WHAT A PAGE LOADS FIRST, AND WHAT IT LOADS IN ALL. The bundle is split
 * where the code says `import()`, as a product's bundler splits it: `load:
 * "first"` measures the chunks a page loads before anything is turned on
 * (the entry and what it imports outright), `load: "all"` every chunk. A
 * budget that `lacks` a package fails when any module of it is in what it
 * measures — so "the studio is not in a page that does not turn it on" is
 * a claim CI holds, not a size that happens to be small.
 */
import { createRequire } from "node:module";
import { join, relative } from "node:path";
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
     *
     * Raised again from 815_000 / 220_000 when the workspace moved to zod
     * 4.6, the zod a consumer resolves from the published ranges: 4.6 gives
     * every schema type its own JSON-schema processor, so zod no longer
     * shakes down to what the pages use — about 130 kB minified, 30 kB
     * gzipped, of zod's, which a host already paid on 4.6.
     *
     * Lowered from 950_000 / 252_000 when the framework built its own
     * schemas in zod/mini and the routed face stopped reaching the workbench
     * through its imports (FR-57): measured at 500_379 / 163_300.
     */
    minified: 530_000,
    gzipped: 175_000,
    load: "first",
  },
  {
    name: "embed without the studio",
    entry: `import { mount } from "@graview/embed"; globalThis.mount = mount;`,
    /*
     * Every face, as a page with `studio: false` loads it: the studio is
     * imported when it is turned on, and not before (it was about 104 kB
     * minified of every embed, whether it was offered or not). Set at
     * 1_175_514 / 329_683 measured, on zod 4.6.
     *
     * Lowered from 1_200_000 / 337_000 when each face came to be fetched as
     * it is first drawn, with the framework's own views (FR-57): what a page
     * loads first is the frame — measured at 747_000 / 190_229 — and the
     * faces are their own chunks.
     *
     * Gzipped raised from 200_000 when a declared lens came to draw (FR-79)
     * and the arrangement to be honoured (FR-80): the frame registers each
     * titled lens as a place and reads where the app opens, which is
     * `declaredLenses` and `openingOf` in what a page loads first — the
     * factories themselves are a chunk fetched when a lens is first drawn.
     * Measured at 773_663 / 200_080.
     *
     * Raised again when the rule language came to compute what pages need
     * (FR-83): computed fields, worked out for the seat a record is drawn
     * for, and the words, and and plural formatters. With both, measured at
     * 791_069 / 206_781.
     *
     * Raised again when the home and a view came to be written from blocks
     * (FR-81, FR-82): the document's vocabulary for headlines, figures and
     * lists (what the frame checks a document it compiles against) and the
     * blocks' stylesheet, in what a page loads first. Measured at
     * 802_562 / 209_988.
     */
    minified: 815_000,
    gzipped: 215_000,
    load: "first",
    lacks: ["@graview/studio"],
  },
  {
    name: "every face",
    entry: `import { mount } from "@graview/embed"; globalThis.mount = mount;`,
    /*
     * Raised from 1_100_000 / 315_000 when the studio learned to hand a host
     * back a document (FR-54): its changes are `editDocument`'s own ops, so
     * the studio every face carries now carries the editor and the document
     * schema it checks against — about 43 kB minified, 13 kB gzipped.
     *
     * Raised again from 1_150_000 / 330_000 with zod 4.6, for the same reason
     * as the pages face: about 130 kB minified, 30 kB gzipped, of zod's.
     *
     * And again when a studio opened on a document came to be judged by
     * compiling it (FR-54): the studio now carries `compileDocument`, about
     * 26 kB minified and 9 kB gzipped; and since the studio became a chunk of
     * its own, loaded when it is turned on, its chunk is gzipped on its own —
     * about 2 kB and 3 kB more. Measured at 1_285_784 / 365_101 (from
     * 1_259_216 / 354_049 before), so raised from 1_290_000 / 362_000. What
     * a page without the studio loads fell by about 110 kB: the budget above.
     *
     * Gzipped raised from 373_000 when each face became a chunk of its own,
     * fetched as it is drawn (FR-57): every face is about 11 kB smaller
     * minified (1_289_095 from 1_300_584), and about 2.5 kB larger gzipped
     * (372_654 from 370_200), because six chunks are each gzipped alone.
     *
     * Raised from 1_310_000 / 380_000 when a declared lens came to draw
     * (FR-79): the six shipped factories — timeline, calendar, coverage,
     * board, plan and reach — were shaken out of every embed while only an
     * app's own views could draw them, and now a document's lenses draw
     * through them. They are a chunk of their own, fetched when the first
     * lens is drawn, so no face loads them before it needs one. Measured at
     * 1_388_501 / 407_629.
     *
     * Raised again when the rule language came to compute what pages need
     * (FR-83): with both, measured at 1_399_742 / 412_177.
     *
     * Raised again when the home and a view came to be written from blocks
     * (FR-81, FR-82): headlines, figures and lists of records drawn by their
     * own cards, the home's landing over the scene, and the vocabulary that
     * checks them. Measured at 1_420_964 / 418_572.
     *
     * Raised again when every part of a document came to have an edit
     * (FR-84) and a place came to be described without a browser (FR-89):
     * the studio's editDocument rewrites lenses, the home, pages and
     * computed fields, and the chat seat's tools carry describePlace.
     * Measured at 1_450_367 / 427_424.
     */
    minified: 1_460_000,
    gzipped: 432_000,
    load: "all",
  },
  {
    name: "embed with the studio handed in",
    /*
     * A HOST WHOSE PAGE IS THE STUDIO (FR-63) hands `StudioPlace` in and
     * pays no round trip for it: the studio is in what the page loads
     * first, and `lazyLacks` fails the bundle if any module of it is left
     * in a chunk fetched later. Set at every face's budget: it is every
     * face, loaded at once.
     *
     * Gzipped raised from 373_000 to every face's 380_000, the budget it
     * is set at, when the embed's chrome became one family (FR-72, FR-75 –
     * FR-78: the popover family, the host's actions and notices, the seat
     * put away): measured at 1_297_634 / 373_048, with every face at
     * 1_302_133 / 377_358.
     *
     * Raised with every face when the rule language came to compute what
     * pages need (FR-83) and a declared lens came to draw (FR-79).
     */
    entry: `import { mount } from "@graview/embed"; import { StudioPlace } from "@graview/studio"; globalThis.mount = (element, options) => mount(element, { ...options, studio: { onApply() {}, place: StudioPlace } });`,
    // Raised with every face's when a declared lens came to draw (FR-79) and the rule language came to compute what pages need (FR-83): the studio reaches the lenses through `@graview/primitives`, so here they load with it. With both, measured at 1_393_930 / 407_048.
    // Raised with every face's again when the home and a view came to be written from blocks (FR-81, FR-82): measured at 1_414_220 / 413_619.
    // And with every face's when every part of a document came to have an edit (FR-84) and a place a description (FR-89): measured at 1_443_642 / 422_491.
    minified: 1_460_000,
    gzipped: 432_000,
    load: "first",
    lazyLacks: ["@graview/studio"],
  },
  {
    name: "a guest view in a frame",
    /*
     * The guest half a frame guest bundles (FR-04): the protocol and the
     * channel, nothing of the framework, and none of Remote DOM, which only
     * a worker guest needs (FR-68). Measured at 1_578 / 845.
     */
    entry: `import { connectGuest } from "@graview/guest"; globalThis.connect = connectGuest;`,
    minified: 3_000,
    gzipped: 1_500,
    load: "all",
    lacks: ["@graview/core", "@remote-dom/core", "@remote-dom/polyfill"],
  },
  {
    name: "a guest view in a worker",
    /*
     * The worker entry (FR-68–FR-71): Remote DOM's polyfill and remote
     * elements, the component kit, the hardening and the channel. Graview
     * Cloud's spike measured the polyfill and elements alone at 46.9 kB
     * minified, 15.5 kB gzipped. Measured at 55_935 / 18_726, with the hardening.
     */
    entry: `import { connectGuest } from "@graview/guest/worker"; globalThis.connect = connectGuest;`,
    minified: 60_000,
    gzipped: 20_000,
    load: "all",
    lacks: ["@graview/core"],
  },
  {
    name: "the guest host, before a worker is drawn",
    /*
     * What a host page loads first to draw guest views (FR-04, FR-68): the
     * frame's host, the session, and `guestView`. The worker's host and
     * the kit's renderer are `@graview/guest/host/worker`, a chunk fetched
     * when a worker view is drawn — while `@graview/guest/host` re-exported
     * them, esbuild put them in what the page loads first (16_898 / 6_652).
     * Remote DOM is in neither. Measured at 6_482 / 3_118.
     */
    entry: `import { guestView, mountGuestView } from "@graview/guest/host"; globalThis.host = { guestView, mountGuestView };`,
    minified: 8_000,
    gzipped: 4_000,
    load: "first",
    lacks: ["@remote-dom/core", "@remote-dom/polyfill"],
  },
  {
    name: "the guest host, drawing a worker",
    /*
     * `@graview/guest/host/worker` (FR-68, FR-69): the worker's host and the
     * kit's renderer, which read Remote DOM's records without Remote DOM.
     * Measured at 13_578 / 5_097.
     */
    entry: `import { mountGuestWorker } from "@graview/guest/host/worker"; globalThis.mount = mountGuestWorker;`,
    minified: 16_000,
    gzipped: 6_000,
    load: "all",
    lacks: ["@remote-dom/core", "@remote-dom/polyfill"],
  },
];

/** The host's own: a page has one React, and the embed is not it. */
const HOSTS_OWN = ["react", "react-dom", "react/jsx-runtime", "react-dom/client"];

/** One entry, bundled and split as a product would bundle it: its size, and the packages in it. */
export async function bundleSize(repo, entry, load = "all") {
  const require = createRequire(join(repo, "package.json"));
  const esbuild = require("esbuild");
  const result = await esbuild.build({
    stdin: { contents: entry, resolveDir: join(repo, "packages", "embed"), loader: "js" },
    bundle: true,
    splitting: true,
    outdir: "out",
    minify: true,
    format: "esm",
    platform: "browser",
    external: HOSTS_OWN,
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [graviewSources(repo)],
    metafile: true,
    write: false,
    logLevel: "silent",
  });
  const outputs = result.metafile.outputs;
  const name = (path) => relative(join(repo, "out"), join(repo, path));
  /*
   * THE PAGE'S OWN ENTRY, by name. Every chunk fetched by `import()` is an
   * entry point to esbuild too, and the first output carrying one was taken
   * for the page's: a new door (the declared lenses, FR-79) moved the
   * studio's chunk to the front of the list, and the page was measured as
   * though it began there.
   */
  const entryChunk = Object.keys(outputs).find((path) => outputs[path].entryPoint === "<stdin>");
  // What a page loads first: the entry, and every chunk it imports outright, never one it imports when asked.
  const loaded = new Set();
  const visit = (path) => {
    if (loaded.has(path)) return;
    loaded.add(path);
    for (const one of outputs[path].imports) if (one.kind === "import-statement" && outputs[one.path]) visit(one.path);
  };
  if (load === "first") visit(entryChunk);
  else for (const path of Object.keys(outputs)) loaded.add(path);
  const files = result.outputFiles.filter((file) => [...loaded].some((path) => name(path) === relative(join(repo, "out"), file.path)));
  const packagesIn = (paths) => {
    const packages = new Set();
    for (const path of paths) {
      for (const input of Object.keys(outputs[path].inputs)) {
        const found = input.match(/(?:^|\/)packages\/([^/]+)\/src\//);
        if (found) packages.add(`@graview/${found[1]}`);
      }
    }
    return [...packages].sort();
  };
  /* The third-party packages in some paths, by name, for a budget that must not carry one (`@remote-dom/core`). */
  const vendorsIn = (paths) => {
    const vendors = new Set();
    for (const path of paths) {
      for (const input of Object.keys(outputs[path].inputs)) {
        const found = input.match(/.*node_modules\/((?:@[^/]+\/)?[^/]+)\//);
        if (found) vendors.add(found[1]);
      }
    }
    return [...vendors].sort();
  };
  // What the page fetches only when it is asked for: every chunk the entry does not import outright.
  const statically = new Set();
  const reach = (path) => {
    if (statically.has(path)) return;
    statically.add(path);
    for (const one of outputs[path].imports) if (one.kind === "import-statement" && outputs[one.path]) reach(one.path);
  };
  reach(entryChunk);
  return {
    minified: files.reduce((sum, file) => sum + file.contents.length, 0),
    gzipped: files.reduce((sum, file) => sum + gzipSync(file.contents).length, 0),
    chunks: files.length,
    packages: packagesIn(loaded),
    vendors: vendorsIn(loaded),
    lazy: packagesIn(Object.keys(outputs).filter((path) => !statically.has(path))),
  };
}

/** Every budget, measured: what it is, what it may be, what it carries that it must not, and whether it is over. */
export async function measureBudgets(repo, budgets = BUDGETS) {
  const measured = [];
  for (const budget of budgets) {
    const { packages, vendors, lazy, ...size } = await bundleSize(repo, budget.entry, budget.load ?? "all");
    const carries = (budget.lacks ?? []).filter((name) => packages.includes(name) || vendors.includes(name));
    // A package that must not wait for a chunk of its own: any module of it fetched later fails the budget.
    const defers = (budget.lazyLacks ?? []).filter((name) => lazy.includes(name));
    const over = size.minified > budget.minified || size.gzipped > budget.gzipped || carries.length > 0 || defers.length > 0;
    measured.push({ name: budget.name, load: budget.load ?? "all", ...size, budget: { minified: budget.minified, gzipped: budget.gzipped }, carries, defers, lazy, over });
  }
  return measured;
}
