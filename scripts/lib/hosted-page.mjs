/**
 * WHAT A HOSTED PAGE CARRIES BEFORE THE APP DRAWS (FR-57).
 *
 * Graview Cloud's shell — every app on <slug>.graview.app — is `openRemote`
 * plus the embed over a document-compiled app, and it carried 1.11 MB of
 * framework up front: zod alone was 443 KB of it. This builds the same page
 * the way Cloud builds it (`packages/client/bundles.mjs` there: esbuild,
 * ESM, split, minified, for the browser, React bundled in, zod's locales cut
 * to English, `@graview/studio` stubbed to a studio that draws nothing) over
 * the vendors document, and reads what it carries from esbuild's metafile:
 * the entry and every chunk it imports outright, never one it imports only
 * when asked.
 *
 * The packages are read from the workspace's sources, as `bundle-budget.mjs`
 * reads them, with each package's own `sideEffects` honored, as a bundler
 * honors it in the tarball a stranger installs.
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve, sep } from "node:path";

/** What each face fetches as it is first drawn (`@graview/embed`'s doors). */
export const FACE_DOORS = {
  scene: ["embed/src/scene-face.tsx", "primitives/src/framework-views.ts"],
  pages: ["embed/src/pages-content.tsx", "primitives/src/framework-views.ts"],
};

/*
 * Bytes, minified. A page over either is over.
 *
 * Cloud's brief set 600 KB, and the page stood at 611 900 bytes (598 KB)
 * against it once the columns lens, template labels, currency, walks from
 * a set and the hidden-kind check had landed (FR-97–FR-101, FR-105). The
 * scene's own rules moved to the scene face and the frame's measures and
 * descent to files of their own (FR-104), and it is 589 079 bytes
 * (575 KB); Cloud's own shell built from the same sources agreed, 596.0 KB
 * before and 573.7 KB after, its own code in it.
 *
 * Then what only a fetched face, an agent's seat or the checker uses left
 * the barrels the page imports up front for subpaths of their own —
 * `@graview/core/blocks`, `/check`, `/scene` and `/figures` — since a
 * bundler places a whole module in every chunk that can reach it: 575 357
 * bytes (562 KB), and this round's features brought it to 583 715 (570 KB).
 *
 * Graview Cloud's shell holds itself to 595 KB with ~25 KB of its own on
 * top of this page, so the page has to stay near 565 KB for Cloud to have
 * room. Then what only a drawn view uses left the entries the frame imports
 * up front — the measured text, the kit's connector, the boundary, the
 * emphasis sets and the others placed (`@graview/react/drawing`), the
 * fields edited in place (`@graview/tools/edit`), the reader's pins, a
 * label's fit, and the arranging of a list (`@graview/core/arrange`) — and
 * it is 568 306 bytes (555 KB); Cloud's shell built from the same sources
 * measured 569 KB before and 554 KB after, against its 595. The claim is
 * that figure with 8 KB of headroom, so the room is spent on purpose: a
 * feature that needs it raises this number in the same change and says why.
 * The whole brand in the document (FR-124–FR-128) raised it to 567 KB, and
 * the notices that float (FR-133) took the page to 566.3 KB. The one app
 * bar (FR-131, FR-132) replaced the strip, the routed face's masthead and
 * its tabs with one bar, and fetches what is behind its tools when they are
 * first reached for — the person's menu, the problems' rows — and the blocks
 * a view is drawn with with the face that draws one: 574 574 bytes
 * (561.1 KB), against the 563 KB it was asked to come back under. Then a
 * brand's mark came to be read element by element as the browser reads it
 * before it is put in the page (the review after 0.1.15: the rules that
 * searched the string could be talked past), about 3.9 KB the page needs
 * before it draws the bar's logo: 579 107 bytes (565.5 KB). The claim is
 * that figure with about 1.5 KB of headroom: 567 KB, which leaves Cloud's
 * shell its ~25 KB under its 595 with 3 to spare. Reading a document's old
 * key names (FR-134) took it to 579 936 bytes (566.3 KB).
 *
 * Then the scene and the pages became two things on the bar, and the places
 * left it (FR-137, FR-138): measured at 583 543 bytes (569.9 KB), 3 607
 * more. What costs what, minified: the bar itself 2.4 KB — the switch (two
 * buttons, their two marks), the place control and the list it opens (the
 * home, the Lists and the Pictures, each with its mark, grouped and
 * labeled), the phone's place line, and their rules (4.4 KB of CSS where
 * 3.5 KB were), less the tabs' measuring and "More" they replace; the embed
 * 0.8 KB — opening on the home view at a desk (FR-136), the switch's two
 * faces, and the place line in the frame's own height; the scene's name
 * on the switch and its old spelling read as the new 0.1 KB. The claim
 * rises by that and no more: 570.5 KB, which leaves Cloud's shell 24.5 KB
 * under its 595. The review after 0.1.16 (a long word cut on the switch,
 * the narrow embed's way back to the pages) paid for itself by saying an
 * address within the app one way in the embed where it said it four:
 * 583 814 bytes (570.1 KB). The bar fitting its box (it lays itself out
 * by its own width: Find a small box that says its shortcut, the switch's
 * marks alone when its words do not fit, the name broken only between
 * words, a phone's Find list the bar's width) took it from 583 896 to
 * 586 278 bytes (572.5 KB), 2 382 more: the bar's rules 1.0 KB, weighing
 * whether the switch's words fit 0.9 KB, the shortcut and the slot 0.5 KB.
 * The claim rises by that: 572.8 KB, which leaves Cloud's shell 22.2 KB
 * under its 595. FR-140 (a pick kept for the routed face until it listens)
 * took it to 586 433 bytes (572.7 KB), inside the claim.
 *
 * Then, over the bar that fits its box and FR-140, a part fetched as it is
 * first drawn came to try again after it failed to arrive, and to say so in
 * its place rather than throw into the embed (FR-139): Cloud's realtime
 * harness took the browser offline before the person's menu had arrived,
 * and the menu was broken until a reload. `lazyModule` and its one line
 * with "Try again" (2.1 KB, most of it the line and keeping the keyboard on
 * what arrives), `retryingImport` (0.5 KB), the menu fetched when the page
 * is idle and online, and the guest host's worker asked for again: 589 642
 * bytes (575.8 KB), 3 209 more. The claim rises by that and no more:
 * 576.0 KB, which leaves Cloud's shell 19 KB under its 595.
 * A selected record drawn once (FR-141–FR-143: a relation said in its words,
 * the record in focus held to its box, drawn with the scene), over FR-139,
 * took it to 589 828 bytes (576.0 KB), 186 more; the claim rises by that
 * with about 0.2 KB of room: 576.2 KB, which leaves Cloud's shell 18.8 KB
 * under its 595.
 *
 * A lens double-clicked from Up opening it (the one stop down into a
 * picture that the bar's places and `go.place` now share), over the security
 * review before 0.1.18, took it to 590 033 bytes, 41 more than without it;
 * the claim rises by 0.1 KB to 576.3 KB, which leaves Cloud's shell 18.7 KB
 * under its 595.
 * Views beside editing (FR-149–FR-151), long text on a record page
 * (FR-146–FR-148) and the places in the bar (FR-144, FR-145), landed in
 * one integration over a record drawn once, the security review before
 * 0.1.18 and a lens double-clicked from Up, took it to 597 234 bytes
 * (583.2 KB), 7 201 more; the claim rises
 * by that with about 0.2 KB of room: 583.4 KB, which leaves Cloud's shell
 * 11.6 KB under its 595.
 * The review after 0.1.17 (the pages face's Ask and its drawer placed inside
 * their embed's box, a pane hung from a control in an embed kept inside it,
 * a notice put away while its embed is scrolled out of the window) took it
 * to 597 503 bytes (583.5 KB), 269 more; the claim rises by that with about
 * 0.1 KB of room: 583.6 KB, which leaves Cloud's shell 11.4 KB under its 595.
 * The seat floating and quiet took it to 598 806 bytes (584.8 KB), 1 303
 * more: the conversation is the app's now, held by the provider every face
 * draws under (`seat-talk.ts`), so a face switch keeps it. The field itself
 * is drawn with each face, and its panel, the conversation and what it
 * offers are fetched when it is first opened; the scene's face before it
 * draws is 28 KB smaller for the rail that left it. The claim rises by that
 * with about 0.2 KB of room: 585.0 KB, which leaves Cloud's shell 10 KB
 * under its 595.
 * The seat taking you where you ask and drawing a view kept as a lens took
 * it to 600 716 bytes (586.6 KB), 1 858 more over the resolver's and the
 * drafting engine's own branches (598 858): the lenses a reader kept,
 * laid beside the app's own places as a face opens (`reader-lenses.ts`, a
 * place registered `beside` and taken away again in the view registry),
 * the host's `onKeepLens` carried by the provider, a drawn view held with
 * the conversation, and the day the app is pinned to (`Store.today`). The
 * frame a view is drawn in, the resolver, the drafting engine and keeping
 * are fetched when asked, and `@graview/tools/keep` never. The claim rises
 * by that with about 0.2 KB of room: 586.8 KB, which leaves Cloud's shell
 * 8.2 KB under its 595.
 * The cleanup after the seat, over main at 600 647 bytes (586.6 KB), took
 * it to 591 125 (577.3 KB), 9 522 fewer: the district's card and drive-in,
 * the altitude control, the others in the city and the seat's marks — about
 * 9.8 KB of rules only the scene draws — left the frame's sheet, which every
 * face draws up front, for the scene face's (`sceneCss`); a keystroke in
 * Find fitting one frame at a hub added about 0.4 KB. The claim falls to
 * that with about 0.2 KB of room: 577.5 KB, which leaves Cloud's shell
 * 17.5 KB under its 595.
 * The scene wearing the one bar, over the cleanup at 577.3 KB, took it to
 * 578.0 KB: a day said as it is read in every rule's sentence and template
 * and a record's facts, a choice as it is declared (the stored value kept
 * for the edit control), and the bar's place for the scene's own tool —
 * less the place tabs' rules, which left the frame's sheet for the tabs'
 * own, and the channel's words (`viaSaid`), which left the author's module
 * for one Activity fetches with the scene. 578.2 KB, which leaves Cloud's
 * shell 16.8 KB under its 595.
 */
export const HOSTED_PAGE_BUDGET = { minified: 578.2 * 1024, zod: 150 * 1024 };

/** The vendors document Cloud's tests are written against, kept here too. */
export const VENDORS = "packages/core/tests/document/fixtures/vendors.gdd.json";

/*
 * Cloud's shell, cut to what decides what it bundles: the document compiled
 * in the page, the room opened with ship's client, the embed mounted with
 * `studio: false`, and a Tier 2 view drawn in a sandboxed frame. The document
 * is fetched, as Cloud fetches it, so the page is the framework and not the
 * app.
 */
export const HOSTED_PAGE_ENTRY = `
import { compileDocumentWithoutCheck } from "@graview/core/document";
import { mount } from "@graview/embed";
import { guestView } from "@graview/guest/host";
import { openRemote } from "@graview/ship/browser";

const root = document.getElementById("graview-app");
const opened = await (await fetch("/graview/document")).json();
const compiled = compileDocumentWithoutCheck(opened.document);
if (!compiled.ok) throw new Error("does not compile");
const me = { kind: "human", id: opened.principal.id, roles: opened.principal.roles };
const remote = await openRemote({ app: compiled.app, url: location.origin, principal: me, live: true, subprotocol: true, pollMs: 1200, openTimeoutMs: 3000 });
mount(root, {
  app: compiled.app,
  store: remote.store,
  principal: me,
  presence: remote.presence,
  studio: false,
  face: window.innerWidth < 768 ? "pages" : "graview",
  bar: true,
  height: "100dvh",
  label: compiled.app.name,
  heading: 1,
  views: (_schema, registry) => { registry.register("vendor", { cardinality: "one", fidelity: "full" }, guestView({ url: "https://example.org/view.html", name: "card" })); return registry; },
});
`;

/*
 * THE SAME SHELL, HANDED A COMPILED APP (FR-123). Cloud compiles the
 * document on its server at every change; its `/graview/document` answer
 * carries `compiled: serializeCompiled(compileDocument(document))` beside
 * the document, and the shell builds the app from it with
 * `appFromOrCompile` — which fetches the compiler only when the compiled
 * app is missing or of a format this build cannot read. Everything is
 * imported from `@graview/core/compiled`: the document barrel, imported up
 * front for anything at all, would bring the compiler back.
 */
export const HOSTED_PAGE_COMPILED_ENTRY = HOSTED_PAGE_ENTRY.replace(
  `import { compileDocumentWithoutCheck } from "@graview/core/document";`,
  `import { appFromOrCompile, sayFindings } from "@graview/core/compiled";`,
).replace(
  `const compiled = compileDocumentWithoutCheck(opened.document);\nif (!compiled.ok) throw new Error("does not compile");`,
  `const compiled = await appFromOrCompile(opened);\nif (!compiled.ok) throw new Error(sayFindings(compiled.findings));`,
);
if (!HOSTED_PAGE_COMPILED_ENTRY.includes("appFromOrCompile(opened)")) throw new Error("the hosted page's entry no longer compiles its document where the compiled variant expects");

/*
 * Bytes, minified, of the page handed a compiled app. It measured 525 197
 * bytes (512.9 KB) when it arrived, 44 KB under the page that compiles in
 * the browser; Cloud's shell built from the same sources measured 554.8 KB
 * compiling and 511.4 KB handed the compiled app. The claim is that figure
 * with about 7 KB of headroom, spent on purpose as the other budget's is.
 * Raised to 523 KB for the whole brand in the document (FR-124–FR-128),
 * measured at 521.0 KB, and 522.6 KB with the notices that float (FR-133).
 * The one app bar (FR-131, FR-132) brought it to 529 773 bytes (517.4 KB):
 * 2.4 KB short of the 515 it was asked for, which FR-133's placing of a
 * notice (1.7 KB up front) took while it was built. A brand's mark read
 * element by element as the browser reads it (the review after 0.1.15)
 * took it to 534 306 bytes (521.8 KB). The claim is that figure with about
 * 1 KB of headroom: 523 KB. Reading old key names (FR-134) took it to
 * 535 157 bytes (522.6 KB). The switch and the place list (FR-137, FR-138)
 * and opening on the home view (FR-136) took it to 538 735 bytes
 * (526.1 KB), 3 578 more, the same bar and embed as the page that compiles
 * (above); the claim rises by that: 526.5 KB. The review after 0.1.16
 * left it at 539 006 bytes (526.4 KB), as above. The bar fitting its box
 * took it from 539 090 to 541 472 bytes (528.8 KB), the same 2 382 as the
 * page that compiles (above); the claim rises by that: 528.8 KB. A pick
 * made the moment the place list opens going to its place (FR-140: a path
 * asked for before the routed face listens, kept for it) took it to
 * 541 627 bytes (528.9 KB), 155 more; the claim rises by that: 529.0 KB.
 * A lazy part that tries again after it failed to arrive (FR-139), over
 * the bar that fits its box and FR-140, took it to 544 890 bytes (532.1 KB),
 * 3 263 more, as above: 532.25 KB.
 * A selected record drawn once (FR-141–FR-143), over FR-139, the same 186
 * bytes as the page that compiles, took it to 545 076 bytes (532.3 KB); the
 * claim rises by that with about 0.1 KB of room: 532.4 KB. The security
 * review before 0.1.18 (a retry imports only a chunk on the bundle's own
 * origin, and a link's pins and dimensions have no prototype) adds 169
 * bytes: 532.6 KB.
 * The same integration (FR-144–FR-151) took it to 551 604 bytes
 * (538.7 KB); the claim rises by that with about 0.1 KB of room: 538.8 KB.
 * The review after 0.1.17, the same 269 bytes as the page that compiles,
 * took it to 551 873 bytes (538.9 KB): 539.0 KB.
 * The seat floating and quiet, the same 1 303 bytes as the page that
 * compiles, took it to 553 176 bytes (540.2 KB): 540.4 KB.
 * The seat taking you where you ask and drawing a view kept as a lens, the
 * same reader's lenses and host's keeping as the page that compiles, took
 * it to 555 091 bytes (542.1 KB): 542.2 KB.
 * The cleanup after the seat, the same scene's rules moved to the scene
 * face's sheet as the page that compiles (above), took it from main's
 * 555 022 bytes (542.0 KB) to 545 500 (532.7 KB): 533.0 KB.
 * The scene wearing the one bar, the same days, choices and bar as the
 * page that compiles, took it to 533.4 KB: 533.6 KB.
 */
export const HOSTED_PAGE_COMPILED_BUDGET = { minified: 533.6 * 1024 };

/** What only compiling a document needs, none of which a page handed a compiled app carries up front. */
export const COMPILER_MODULES = [
  "core/src/document/compile.ts",
  "core/src/document/views.ts",
  "core/src/document/schema.ts",
  "core/src/document/upgrade.ts",
  "core/src/document/computed.ts",
  "core/src/document/to-document.ts",
  "core/src/document/template-parse.ts",
  "core/src/document/expr/parse.ts",
  "core/src/document/expr/analyze.ts",
];

/** zod's ~50 translated message packs, resolved to English alone (Cloud's `englishOnly`). */
const englishOnly = {
  name: "zod-english-only",
  setup(b) {
    b.onResolve({ filter: /\/locales\/index\.js$/ }, (args) => {
      if (!args.importer.includes(`${sep}zod${sep}`)) return undefined;
      return { path: resolve(dirname(args.importer), args.path), namespace: "zod-locales" };
    });
    b.onLoad({ filter: /.*/, namespace: "zod-locales" }, (args) => ({
      contents: `export { default as en } from ${JSON.stringify(join(dirname(args.path), "en.js"))};`,
      resolveDir: dirname(args.path),
    }));
  },
};

/** The shell carries no studio, not even unopened (Cloud's `noStudio`). */
const noStudio = {
  name: "no-studio",
  setup(b) {
    b.onResolve({ filter: /^@graview\/studio$/ }, () => ({ path: "no-studio", namespace: "no-studio" }));
    b.onLoad({ filter: /.*/, namespace: "no-studio" }, () => ({ contents: "export function StudioPlace() { return null; }", loader: "js" }));
  },
};

/** Every import the page makes only when asked, left out: what the first chunk needs for itself, and no more. */
const leaveDoorsShut = {
  name: "leave-doors-shut",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => (args.kind === "dynamic-import" ? { path: args.path, external: true } : undefined));
  },
};

/** `@graview/*` from the workspace's sources, with the package's `sideEffects` as its tarball declares it. */
function workspaceSources(repo) {
  return {
    name: "workspace-sources",
    setup(b) {
      b.onResolve({ filter: /^@graview\/[^/]+(\/.*)?$/ }, (args) => {
        const [, pkg, sub] = args.path.match(/^@graview\/([^/]+)(?:\/(.*))?$/);
        const root = join(repo, "packages", pkg);
        if (!existsSync(join(root, "src"))) return undefined;
        const src = join(root, "src");
        const candidates = sub ? [join(src, `${sub}.ts`), join(src, `${sub}.tsx`), join(src, sub, "index.ts")] : [join(src, "index.ts")];
        const found = candidates.find((candidate) => existsSync(candidate));
        if (!found) return { errors: [{ text: `${args.path} has no source in packages/${pkg}/src` }] };
        const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
        return { path: found, sideEffects: manifest.sideEffects !== false };
      });
    },
  };
}

/** Which package an input of the metafile belongs to. */
export function packageOf(input) {
  const own = input.match(/(?:^|\/)packages\/([^/]+)\/src\//);
  if (own) return `@graview/${own[1]}`;
  if (input.startsWith("zod-locales:")) return "zod";
  const modules = input.split("node_modules/");
  if (modules.length > 1) {
    const rest = modules[modules.length - 1].split("/");
    return rest[0].startsWith("@") ? `${rest[0]}/${rest[1]}` : rest[0];
  }
  return "(the page)";
}

/**
 * Bundle the hosted page as Cloud bundles it, and say what it carries up
 * front and what only when asked. `eagerOnly` leaves every door shut (each
 * dynamic import external): what the first chunk needs for itself.
 * `files` is the chunks as built, for a reader of the code itself.
 */
export async function measureHostedPage(repo, entry = HOSTED_PAGE_ENTRY, { minify = true, eagerOnly = false } = {}) {
  const require = createRequire(join(repo, "packages", "embed", "package.json"));
  const esbuild = require("esbuild");
  const result = await esbuild.build({
    stdin: { contents: entry, resolveDir: join(repo, "packages", "embed"), loader: "js" },
    bundle: true,
    format: "esm",
    splitting: true,
    platform: "browser",
    target: "es2022",
    minify,
    metafile: true,
    write: false,
    outdir: join(repo, "out"),
    entryNames: "[name].[hash]",
    chunkNames: "chunk.[hash]",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [...(eagerOnly ? [leaveDoorsShut] : []), englishOnly, noStudio, workspaceSources(repo)],
    logLevel: "silent",
  });
  const outputs = result.metafile.outputs;
  /** A chunk and every chunk it imports outright: what is fetched before it runs. */
  const closure = (from) => {
    const found = new Set([from]);
    for (const file of found) for (const one of outputs[file].imports) if (one.kind === "import-statement" && outputs[one.path]) found.add(one.path);
    return found;
  };
  const [entryChunk] = Object.entries(outputs).find(([, output]) => output.entryPoint === "<stdin>");
  const eager = closure(entryChunk);
  const lazy = Object.keys(outputs).filter((file) => file.endsWith(".js") && !eager.has(file));
  const sumBy = (files, key) => {
    const sums = {};
    for (const file of files) for (const [input, { bytesInOutput }] of Object.entries(outputs[file].inputs)) if (bytesInOutput > 0) sums[key(input)] = (sums[key(input)] ?? 0) + bytesInOutput;
    return Object.fromEntries(Object.entries(sums).sort((a, b) => b[1] - a[1]));
  };
  const byPackage = (files) => sumBy(files, packageOf);
  const byModule = (files) => sumBy(files, (input) => input.replace(/^.*node_modules\//, "").replace(/^.*packages\//, ""));
  const bytes = (files) => [...files].reduce((sum, file) => sum + outputs[file].bytes, 0);
  /*
   * EACH DOOR: a module the page imports only when asked, and what asking
   * for it costs on top of what is already up front — so a face that is
   * fetched to draw is said as such, not hidden in "when asked".
   */
  const doors = Object.entries(outputs)
    .filter(([file, output]) => output.entryPoint && output.entryPoint !== "<stdin>" && !output.entryPoint.startsWith("no-studio") && !eager.has(file))
    .map(([file, output]) => {
      const more = [...closure(file)].filter((one) => !eager.has(one));
      return { module: byModuleName(output.entryPoint), minified: bytes(more), packages: byPackage(more) };
    })
    .sort((a, b) => b.minified - a.minified);
  /*
   * BEFORE EACH FACE DRAWS: what is up front, and what the face fetches as
   * it is first drawn — its own chunk and the framework's views, which every
   * face fetches beside it (FACE_DOORS). Not a budget of Cloud's; said so a
   * face that is merely moved out of the first chunk is not called smaller.
   */
  const doorChunk = (module) => Object.keys(outputs).find((file) => outputs[file].entryPoint && byModuleName(outputs[file].entryPoint) === module);
  const faces = Object.fromEntries(
    Object.entries(FACE_DOORS).map(([face, modules]) => {
      const fetched = new Set(modules.map(doorChunk).filter(Boolean).flatMap((file) => [...closure(file)]).filter((file) => !eager.has(file)));
      return [face, { minified: bytes(eager) + bytes(fetched), fetched: bytes(fetched), packages: byPackage(new Set([...eager, ...fetched])) }];
    }),
  );
  const upFront = byPackage(eager);
  const minified = bytes(eager);
  const zod = upFront.zod ?? 0;
  return {
    upFront: { minified, zod, chunks: eager.size, packages: upFront, modules: byModule(eager) },
    whenAsked: { minified: bytes(lazy), chunks: lazy.length, packages: byPackage(lazy), doors },
    beforeDrawn: faces,
    budget: HOSTED_PAGE_BUDGET,
    metafile: result.metafile,
    files: result.outputFiles,
    over: minified > HOSTED_PAGE_BUDGET.minified || zod > HOSTED_PAGE_BUDGET.zod,
  };
}

const byModuleName = (input) => input.replace(/^.*node_modules\//, "").replace(/^.*packages\//, "");
