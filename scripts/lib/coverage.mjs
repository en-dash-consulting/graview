/**
 * WHAT EACH HARNESS READ, so a branch runs only the harnesses its change
 * can reach.
 *
 * Every change on a branch ran the whole chain, because nothing said which
 * harness a file reaches: nearly every pull request touches packages/core,
 * and every harness imports @graview/core, so a map by package says "all of
 * them" every time. The files a harness actually loads say much less: a
 * change to the checker reaches the harnesses that run `graview check` or
 * the compiler, not the forty that only draw a page.
 *
 * So a harness the chain runs records what it read, from every process it
 * starts (GRAVIEW_COVERAGE_FILE, and `--import` of coverage-hook.mjs in
 * NODE_OPTIONS, so a `graview preview` or a journey's own run is counted):
 *
 *   - every module Node loads, by import or require (`module.registerHooks`);
 *   - every file it reads under the checkout (fixtures, documents, a served
 *     site's pages): `fs` read calls, wrapped;
 *   - every input of a bundle it builds with esbuild (its metafile);
 *   - every module a watched page asks a dev server for (watch.mjs hands
 *     each request to `recordUrl`), and the preview page's inputs when a
 *     page opens `graview preview`'s bundle (build-preview-page.mjs writes
 *     them, PREVIEW_INPUTS).
 *
 * A path is kept relative to the checkout, built output mapped back to its
 * source (packages/core/dist/x.js is packages/core/src/x.ts), and a file
 * with no source to map to stands for its whole package (`packages/core/`).
 * The chain merges each run into docs/watch/coverage.json, and
 * changed.mjs reads it.
 */
import { syncBuiltinESMExports } from "node:module";
import fs, { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const COVERAGE_ENV = "GRAVIEW_COVERAGE_FILE";
/** Set for a dev server's process: its module loads count, its file reads (a dependency scan reads everything) do not. */
export const COVERAGE_NO_FS_ENV = "GRAVIEW_COVERAGE_NO_FS";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const realRoot = (() => {
  try {
    return realpathSync(repoRoot);
  } catch {
    return repoRoot;
  }
})();

/** Where the coverage of every harness is kept, committed. */
export const COVERAGE_FILE = "docs/watch/coverage.json";
/** The preview page's inputs, written where it is built; local to the machine that built it. */
export const PREVIEW_INPUTS = resolve(repoRoot, "node_modules/.cache/graview-harness/preview-inputs.json");
/** The hook a harness's processes are started with. */
export const HOOK = resolve(repoRoot, "scripts/lib/coverage-hook.mjs");

/**
 * NODE_OPTIONS for a process whose reads count: what it had, with the hook.
 * The hook's own path is quoted, since a checkout's path may have a space.
 */
const HOOK_OPTION = `--import="${HOOK}"`;
export const withHook = (options = "") => (options.includes(HOOK_OPTION) ? options : `${options} ${HOOK_OPTION}`.trim());

/** NODE_OPTIONS without the hook: for a process that must not be counted. */
export const withoutHook = (options = "") => options.split(HOOK_OPTION).join("").replace(/\s+/g, " ").trim();

/** The preview page's bundle, as `normalized` says it: never kept, always expanded to its inputs. */
export const PREVIEW = "@preview";
const BUILT = /^(packages|apps)\/([^/]+)\/dist\/(.+?)(?:\.d)?\.(?:m?js|cjs)(?:\.map)?$/;
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs", ".jsx"];

/** Paths under the checkout that say nothing about what a harness depends on. */
const NOT_AN_INPUT = [/^node_modules\//, /\/node_modules\//, /^\.git\//, /^\.generated\//, /\/\.generated\//, /^apps\/\.studio-rehearsal\//, /^\.claude\//, /^\.ndx\//];

/**
 * A path a harness read, as coverage keeps it: relative to the checkout,
 * built output mapped to its source, or null when it is no input of the
 * checkout's (outside it, a dependency, a verdict the harness writes).
 */
export function normalized(path, { root = repoRoot } = {}) {
  if (!path) return null;
  let file = String(path);
  if (file.startsWith("file://")) {
    try {
      file = fileURLToPath(file);
    } catch {
      return null;
    }
  }
  file = file.split("?")[0].split("#")[0];
  if (!isAbsolute(file)) file = resolve(process.cwd(), file);
  const roots = root === repoRoot ? [repoRoot, realRoot] : [root];
  const under = roots.map((one) => relative(one, file)).find((rel) => rel && !rel.startsWith("..") && !isAbsolute(rel));
  if (!under) return null;
  const rel = under.split(sep).join("/");
  if (NOT_AN_INPUT.some((pattern) => pattern.test(rel))) return null;
  // What a harness writes and reads back (docs/<name>.json, its shots) is no input; the site it serves (docs/site) is.
  if (rel.startsWith("docs/") && !rel.startsWith("docs/site/")) return null;
  // `graview preview`'s page is one bundle, said by what it was built from (`record`).
  if (rel.startsWith("packages/graview/dist/preview/")) return PREVIEW;
  const built = BUILT.exec(rel);
  if (built) {
    const [, tier, name, stem] = built;
    for (const extension of SOURCE_EXTENSIONS) {
      const source = `${tier}/${name}/src/${stem}${extension}`;
      if (existsSync(resolve(root, source))) return source;
    }
    return `${tier}/${name}/`;
  }
  if (/^packages\/[^/]+\/dist\//.test(rel) || /^apps\/[^/]+\/(dist|build)\//.test(rel)) return `${rel.split("/").slice(0, 2).join("/")}/`;
  return rel;
}

/** What `graview preview`'s page bundles, as build-preview-page.mjs last wrote it: every input, normalized. */
export function previewInputs() {
  try {
    return JSON.parse(readFileSync(PREVIEW_INPUTS, "utf8"));
  } catch {
    return null;
  }
}

/** Written by build-preview-page.mjs from its metafile. */
export function writePreviewInputs(metafile, absWorkingDir = repoRoot) {
  const inputs = [...new Set(Object.keys(metafile?.inputs ?? {}).map((input) => resolve(absWorkingDir, input.replace(/^[a-z-]+:/, ""))).filter((input) => existsSync(input)).map((input) => normalized(input)).filter(Boolean))].sort();
  mkdirSync(dirname(PREVIEW_INPUTS), { recursive: true });
  writeFileSync(PREVIEW_INPUTS, `${JSON.stringify(inputs)}\n`);
  return inputs;
}

/* ------------------------------------------------------------------ */
/* Recording, inside a harness's processes.                           */
/* ------------------------------------------------------------------ */

const seen = new Set();
let pending = [];
let recording = false;
let target = null;

const flush = () => {
  if (!target || pending.length === 0) return;
  const lines = pending;
  pending = [];
  try {
    appendFileSync(target, `${lines.join("\n")}\n`);
  } catch {
    // Coverage is never worth a harness.
  }
};

/** A path this process read: kept once, written out in batches. */
export function record(path) {
  if (!recording) return;
  const file = normalized(path);
  if (!file || seen.has(file)) return;
  seen.add(file);
  // The preview page is one bundle: what it was built from is what the harness read (its package, when nobody wrote that down).
  if (file === PREVIEW) {
    for (const input of previewInputs() ?? ["packages/embed/", "packages/pages/", "packages/primitives/"]) record(resolve(repoRoot, input));
    return;
  }
  pending.push(file);
  if (pending.length >= 200) flush();
}

/**
 * A URL a watched page asked for. A dev server serves the checkout's files
 * at `/@fs/<absolute path>` and an app's own at its root (`/src/app.tsx`,
 * resolved against `root` when the page's server is an app's, `apps/todo`);
 * `graview preview` serves its bundle at `/page.js` and its chunks.
 */
export function recordUrl(url, { appRoot = null, preview = false } = {}) {
  if (!recording) return;
  let path;
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol) || !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(parsed.hostname)) return;
    path = decodeURIComponent(parsed.pathname);
  } catch {
    return;
  }
  if (path.startsWith("/@fs/")) return record(path.slice("/@fs".length));
  if (path.startsWith("/@") || path.startsWith("/node_modules/") || path === "/") return;
  if (appRoot) return record(resolve(appRoot, `.${path}`));
  if (preview && /^\/(page|chunk\.[^/]+|splash)\.js$/.test(path)) return record(resolve(repoRoot, "packages/graview/dist/preview", path.slice(1)));
}

/* What the hook wraps. */

const ESBUILD_HOOK = Symbol.for("graview.coverage.esbuild");
const patchedEsbuild = new WeakSet();
function wrapEsbuild(esbuild) {
  if (!esbuild || typeof esbuild !== "object" || patchedEsbuild.has(esbuild)) return;
  patchedEsbuild.add(esbuild);
  const inputsOf = (result, options) => {
    const base = options?.absWorkingDir ?? process.cwd();
    for (const input of Object.keys(result?.metafile?.inputs ?? {})) record(resolve(base, input.replace(/^[a-z-]+:/, "")));
  };
  for (const name of ["build", "context"]) {
    const original = esbuild[name];
    if (typeof original !== "function") continue;
    const wrapped = async (options = {}, ...rest) => {
      const asked = options.metafile === true;
      const answer = await original.call(esbuild, { ...options, metafile: true }, ...rest);
      if (name === "build") {
        inputsOf(answer, options);
        if (!asked && answer && typeof answer === "object") delete answer.metafile;
        return answer;
      }
      // A context: each rebuild's inputs.
      const rebuild = answer?.rebuild;
      if (typeof rebuild === "function") {
        answer.rebuild = async (...args) => {
          const result = await rebuild.call(answer, ...args);
          inputsOf(result, options);
          return result;
        };
      }
      return answer;
    };
    try {
      Object.defineProperty(esbuild, name, { value: wrapped, writable: true, enumerable: true, configurable: true });
    } catch {
      // Not ours to wrap: its bundles go uncounted.
    }
  }
  const sync = esbuild.buildSync;
  if (typeof sync === "function") {
    try {
      const wrapped = (options = {}) => {
        const answer = sync.call(esbuild, { ...options, metafile: true });
        inputsOf(answer, options);
        if (options.metafile !== true && answer && typeof answer === "object") delete answer.metafile;
        return answer;
      };
      Object.defineProperty(esbuild, "buildSync", { value: wrapped, writable: true, enumerable: true, configurable: true });
    } catch {
      // As above.
    }
  }
}

function wrapFs() {
  const readers = ["readFileSync", "readFile", "createReadStream"];
  for (const name of readers) {
    const original = fs[name];
    if (typeof original !== "function") continue;
    fs[name] = function (path, ...rest) {
      if (typeof path === "string" || path instanceof URL) record(path instanceof URL ? path.href : path);
      return original.call(this, path, ...rest);
    };
  }
  const promised = fs.promises;
  for (const name of ["readFile"]) {
    const original = promised[name];
    if (typeof original !== "function") continue;
    promised[name] = function (path, ...rest) {
      if (typeof path === "string" || path instanceof URL) record(path instanceof URL ? path.href : path);
      return original.call(this, path, ...rest);
    };
  }
  syncBuiltinESMExports();
}

/**
 * THE HOOK, installed by coverage-hook.mjs in every process the chain
 * starts for a harness. Does nothing unless GRAVIEW_COVERAGE_FILE is set.
 */
export async function install() {
  target = process.env[COVERAGE_ENV];
  if (!target || recording) return;
  recording = true;
  process.on("exit", flush);
  setInterval(flush, 2_000).unref();
  const module = await import("node:module");
  if (typeof module.registerHooks === "function") {
    /*
     * esbuild's exports are getters that cannot be reassigned, so its main
     * module is handed back with one more statement: its exports copied onto
     * an object whose build can be wrapped (`wrapEsbuild`).
     */
    globalThis[ESBUILD_HOOK] = wrapEsbuild;
    module.registerHooks({
      load(url, context, nextLoad) {
        if (url.startsWith("file:")) record(url);
        const answer = nextLoad(url, context);
        if (process.env[COVERAGE_NO_FS_ENV] !== "1" && /\/esbuild\/lib\/main\.js$/.test(url) && answer?.source != null) {
          const source = typeof answer.source === "string" ? answer.source : Buffer.from(answer.source).toString("utf8");
          return { ...answer, source: `${source}\n;{const original=module.exports;const copy={};for(const key of Object.keys(original))Object.defineProperty(copy,key,{enumerable:true,configurable:true,writable:true,value:original[key]});globalThis[Symbol.for("graview.coverage.esbuild")]?.(copy);module.exports=copy;}\n` };
        }
        return answer;
      },
    });
  }
  if (process.env[COVERAGE_NO_FS_ENV] !== "1") wrapFs();
}

/* ------------------------------------------------------------------ */
/* Kept, across runs.                                                  */
/* ------------------------------------------------------------------ */

/** The paths a coverage file holds, one per line. */
export function readRecorded(file) {
  if (!file || !existsSync(file)) return [];
  return [...new Set(readFileSync(file, "utf8").split("\n").filter(Boolean))];
}

/**
 * docs/watch/coverage.json: the files, each with the harnesses that read it
 * (indices into `harnesses`), and each harness with the commit it was
 * recorded on. One file a line, so a run's change to it reads as a diff.
 *
 * @returns {{ harnesses: { name: string, sha: string, at: string }[], files: Record<string, number[]> }}
 */
export function readCoverage(root = repoRoot) {
  try {
    const kept = JSON.parse(readFileSync(resolve(root, COVERAGE_FILE), "utf8"));
    if (Array.isArray(kept?.harnesses) && kept.files && typeof kept.files === "object") return kept;
  } catch {
    // None yet.
  }
  return { harnesses: [], files: {} };
}

/** Each harness's files, from the kept form. */
export function byHarness(kept) {
  const out = new Map(kept.harnesses.map((one) => [one.name, new Set()]));
  for (const [file, indices] of Object.entries(kept.files)) {
    for (const index of indices) out.get(kept.harnesses[index]?.name)?.add(file);
  }
  return out;
}

/**
 * This run's coverage merged into what was kept: a harness looked at whole
 * (`whole`; every harness that ran, when it is not said) is replaced by what
 * it read this time, one looked at in part adds what it read to its record,
 * and one that did not run keeps its record.
 *
 * @param {Map<string, string[]>} ran each harness that ran, and what it read
 * @param {{ sha: string, at?: string, whole?: Set<string> }} options
 */
export function mergeCoverage(kept, ran, { sha, at = new Date().toISOString(), whole = new Set(ran.keys()) }) {
  const files = byHarness(kept);
  const meta = new Map(kept.harnesses.map((one) => [one.name, one]));
  for (const [name, read] of ran) {
    const replaced = whole.has(name) || !files.has(name);
    files.set(name, new Set([...(replaced ? [] : files.get(name)), ...read]));
    // A record added to keeps the commit it was taken whole on: it is as stale as its oldest part.
    meta.set(name, replaced ? { name, sha, at } : (meta.get(name) ?? { name, sha, at }));
  }
  const harnesses = [...meta.values()].sort((a, b) => a.name.localeCompare(b.name));
  const index = new Map(harnesses.map((one, at) => [one.name, at]));
  const out = {};
  for (const [name, read] of files) {
    for (const file of read) (out[file] ??= []).push(index.get(name));
  }
  const sorted = Object.fromEntries(
    Object.keys(out)
      .sort()
      .map((file) => [file, out[file].sort((a, b) => a - b)]),
  );
  return { harnesses, files: sorted };
}

/** Written one file a line. */
export function writeCoverage(kept, root = repoRoot) {
  const lines = Object.entries(kept.files).map(([file, indices]) => `    ${JSON.stringify(file)}: ${JSON.stringify(indices)}`);
  const text = `{\n  "harnesses": ${JSON.stringify(kept.harnesses, null, 2).replace(/\n/g, "\n  ")},\n  "files": {\n${lines.join(",\n")}\n  }\n}\n`;
  mkdirSync(dirname(resolve(root, COVERAGE_FILE)), { recursive: true });
  writeFileSync(resolve(root, COVERAGE_FILE), text);
}
