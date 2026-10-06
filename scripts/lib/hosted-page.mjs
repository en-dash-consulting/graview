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
 * reads them, with each package's own `sideEffects` honoured, as a bundler
 * honours it in the tarball a stranger installs.
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
 * Cloud's brief set 600 KB, and the page stood at 610 365 bytes (596 KB)
 * against it (FR-104). The scene's own rules moved to the scene face and
 * the frame's measures and descent to files of their own, and it is
 * 587 548 bytes (574 KB); Cloud's own shell built from these sources agreed
 * at 572 KB, its own code in it. The claim is that figure with 10 KB of
 * headroom, so the room is spent on purpose: a feature that needs it raises
 * this number in the same change and says why.
 */
export const HOSTED_PAGE_BUDGET = { minified: 584 * 1024, zod: 150 * 1024 };

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
  toggle: true,
  height: "100dvh",
  label: compiled.app.name,
  heading: 1,
  views: (_schema, registry) => { registry.register("vendor", { cardinality: "one", fidelity: "full" }, guestView({ url: "https://example.org/view.html", name: "card" })); return registry; },
});
`;

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
