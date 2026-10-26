// What importing a framework entry costs at startup: the CPU a fresh Node
// process spends on `await import(entry)`, read from process.cpuUsage()
// before and after. A Cloudflare Worker's cold isolate pays this on its first
// request, so it is the number to keep small.
//
// An entry is measured the way a Worker receives it — one esbuild bundle, as
// wrangler makes — so that Node's own per-file loading (resolving, reading
// and compiling each of a few hundred modules apart) is out of the number,
// and what is left is compiling one file and running its module scope.
// Unbundled, the same import is measured too (`node scripts/import-cost.mjs`
// without --bundled), which is what a Node server pays.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hasSideEffects } from "./side-effects.mjs";
import { readRaises } from "./bundle-budget.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/*
 * THE ENTRIES GRAVIEW CLOUD'S WORKER IMPORTS (workers/cloud/src and the
 * @graview-cloud/* packages it bundles, as of 0.1.41), each with the most CPU
 * its bundle may take to load in a fresh process, median of a few: about
 * three times what it took on an M-series Mac when this was written, and
 * never under 10 ms, so a slower CI runner passes and a module that starts
 * building its schemas at import again does not. Measured then (ms):
 *
 *   entry                    before   after
 *   @graview/core              19.9    19.5   (the whole entry keeps zod's `z`, which it re-exports)
 *   @graview/core/check        37.9    13.9
 *   @graview/core/document     34.3    10.8
 *   @graview/core/scene        10.8     5.8
 *   @graview/studio            73.5    50.0   (React and the studio's UI; Cloud's keptBy shakes to 1 KB)
 *   Cloud's worker imports     52.3    29.5   (WORKER_SHAPED, below)
 */
export const IMPORT_BUDGET = {
  "@graview/core": 50,
  "@graview/core/check": 40,
  "@graview/core/describe": 12,
  "@graview/core/json-schema": 10,
  "@graview/core/import": 10,
  "@graview/core/sync": 10,
  "@graview/core/seat": 10,
  "@graview/core/scene": 18,
  "@graview/core/linked": 16,
  "@graview/core/subscriptions": 10,
  "@graview/core/search": 10,
  "@graview/core/lines": 10,
  "@graview/core/history": 10,
  "@graview/core/document": 30,
  "@graview/core/compiled": 16,
  "@graview/core/catalog": 10,
  "@graview/tools": 40,
  "@graview/ship/runtime": 24,
  "@graview/studio": 140,
  "@graview/guest/headless": 18,
  "@graview/guest/client": 10,
  "@graview/guest/host": 18,
};
export const WORKER_ENTRIES = Object.keys(IMPORT_BUDGET);

/** The names Cloud's worker imports, in one module: what its cold isolate evaluates. */
export const WORKER_SHAPED = join(ROOT, "scripts/fixtures/cloud-worker-imports.mjs");

/**
 * What the names Cloud's worker imports may cost together: CPU (about two and
 * a half times the 29.5 ms measured, against 52.3 ms before), and bytes —
 * which do not vary by machine. Of those bytes, zod's are held apart: a
 * framework module that imports `{ z }` from "zod" makes esbuild keep every
 * part of zod and its forty-odd locales (805 KB, against 219 KB now).
 * 2.01 MB since every form came to ask in one order and a document came to
 * name an act in another spelling in a grant or a repair (`asked-order.ts`,
 * `act-spellings.ts`): 2_003_320 B, 6_434 more than before them (1_996_886).
 *
 * 2.004 MB measured alone when three 1.0 foundations — a link's own id and
 * data, a caller's id honored by every creating act, an opaque cursor on
 * the wire — took the worker from 1_999_926 to 2_003_930 (4_004 more, in
 * the graph, the store and the live protocol a worker serves).
 *
 * Edits came to reach readers when they are published (Roadmap
 * f-publishing-lifecycle): a reader's view folds the last publish
 * (`pastOf`), the store and the live protocol serve it, and the checker
 * judges `publishing` — 2_017_361 bytes alone, against 1_997_994 before.
 */
// 2_010_000 since a text field takes a splice (collaborative text, phase 1: the `splice-text` primitive folded, undone, served and read back wherever a patch is): 2_005_731 B measured, 5_787 more than before it (1_999_944).
// 2_026_000 since text is typed together (collaborative text, phase 2: `@graview/ship/runtime` loads `@graview/core/typing`, the `type-text` act and a whole write merged as a splice, so `transformSplices`, `diffSplice` and `text/since.ts` are in the worker): 2_021_456 B measured, 15_725 more than before it (2_005_731).
// 2_020_000 since the 0.1.49 batch came together (every form in one order, act spellings, suggestion and lineage shapes): 2_010_374 B measured.
// 2_250_000 — Nick, 2026-10-23: one deliberate raise for the road to 1.0; the 75 ms startup CPU still guards cold starts. The 0.1.50 batch together measured 2_059_703 B.
/**
 * What the worker's bytes are held to past that base: raise files, like the
 * bundles' (`scripts/budget-raises/`), that name `"Cloud's worker"`, the
 * bytes they add and a note saying what grew and what it measured — never
 * an edit of the base.
 */
export const WORKER_BUDGET_NAME = "Cloud's worker";
const WORKER_BASE = { cpu: 75, bytes: 2_250_000, zod: 260_000 };
export const WORKER_BUDGET = { ...WORKER_BASE, bytes: WORKER_BASE.bytes + workerRaises(readRaises()).reduce((sum, raise) => sum + raise.bytes, 0) };

/** The raises filed for the worker's bytes, each judged: whole bytes above 0, and a note. */
export function workerRaises(raises) {
  const mine = raises.filter((raise) => raise.budget === WORKER_BUDGET_NAME);
  for (const raise of mine) {
    const where = `scripts/budget-raises/${raise.file ?? "(a raise)"}`;
    if (!Number.isInteger(raise.bytes) || raise.bytes <= 0) throw new Error(`${where} must say how many bytes it adds to ${WORKER_BUDGET_NAME}, as a whole number above 0`);
    if (typeof raise.note !== "string" || raise.note.trim().length < 20) throw new Error(`${where} carries no note: say what grew, why, and what it measured, in a sentence`);
  }
  return mine;
}

/** The file an entry resolves to in its package's dist/. */
export function entryFile(entry) {
  const [, pkg, ...rest] = entry.split("/");
  const dir = join(ROOT, "packages", pkg);
  const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const key = rest.length ? `./${rest.join("/")}` : ".";
  const target = manifest.exports?.[key];
  const file = typeof target === "string" ? target : (target?.import ?? target?.default);
  if (!file) throw new Error(`${entry}: no export ${key} in packages/${pkg}/package.json`);
  return join(dir, file);
}

const PROBE = `
const url = process.argv[1];
const before = process.cpuUsage();
const t0 = performance.now();
await import(url);
const wall = performance.now() - t0;
const cpu = process.cpuUsage(before);
process.stdout.write(JSON.stringify({ cpu: (cpu.user + cpu.system) / 1000, wall }));
`;

/**
 * Resolves @graview/* to this checkout's built packages, wherever the
 * importer lives — with the package's `sideEffects` said, as wrangler reads
 * it: a path a plugin answers is otherwise kept whole, so a bare import of
 * an entry the package does not name was measured here and dropped there
 * (FR-209).
 */
const workspace = {
  name: "graview-workspace",
  setup(build) {
    build.onResolve({ filter: /^@graview\// }, (args) => {
      const path = entryFile(args.path);
      const dir = join(ROOT, "packages", args.path.split("/")[1]);
      return { path, sideEffects: hasSideEffects(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")), relative(dir, path)) };
    });
  },
};

/**
 * The entry (a name, or a file that imports names) as one esbuild bundle in
 * `dir`, the way wrangler ships a Worker. Returns its path, its bytes and how
 * many of them are zod's.
 */
export async function bundleEntry(entry, dir) {
  const { build } = await import("esbuild");
  mkdirSync(dir, { recursive: true });
  const name = entry.startsWith("@") ? entry.replaceAll("/", "-").slice(1) : basename(entry).replace(/\.m?js$/, "");
  const outfile = join(dir, `${name}.mjs`);
  const result = await build({
    entryPoints: [entry.startsWith("@") ? entryFile(entry) : entry],
    plugins: [workspace],
    bundle: true,
    format: "esm",
    platform: "neutral",
    mainFields: ["module", "main"],
    conditions: ["workerd", "worker", "browser"],
    external: ["node:*"],
    outfile,
    metafile: true,
    logLevel: "error",
  });
  const output = Object.values(result.metafile.outputs)[0];
  const zod = Object.entries(output.inputs)
    .filter(([path]) => /node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?zod\//.test(path))
    .reduce((sum, [, input]) => sum + input.bytesInOutput, 0);
  return { file: outfile, bytes: output.bytes, zod };
}

/** One fresh process: the CPU and wall milliseconds `await import(entry)` took (entry is a name or a file). */
export function measureOnce(entry) {
  const url = pathToFileURL(entry.startsWith("@") ? entryFile(entry) : entry).href;
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", PROBE, url], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return JSON.parse(out);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The median CPU and wall milliseconds over `runs` fresh processes. */
export function measure(entry, runs = 5) {
  const samples = Array.from({ length: runs }, () => measureOnce(entry));
  return { cpu: median(samples.map((s) => s.cpu)), wall: median(samples.map((s) => s.wall)) };
}

/*
 * HOW FAST THIS MACHINE IS. CPU milliseconds depend on the machine: CI's
 * shared runners loaded the names Cloud's worker imports in 87.6 ms where
 * this checkout's Mac took 29.5. A fixed reference — the whole of zod,
 * bundled as `import { z } from "zod"` keeps it — is loaded the same way, and
 * the budgets stretch by how much slower it was here than when they were set
 * (never shrink): a regression is the framework growing against the
 * reference, not a slower runner.
 */
export const REFERENCE = join(ROOT, "packages/core/tests/fixtures/zod-whole.mjs");
/** What the reference took on the machine the budgets were set on (2026-10-21, median of 7). */
export const REFERENCE_CPU = 12;

/** How many times slower than the budgets' machine this one loads the reference; at least 1. */
export async function machineFactor(dir) {
  const reference = await bundleEntry(REFERENCE, dir);
  const { cpu } = measure(reference.file, 5);
  return Math.max(1, cpu / REFERENCE_CPU);
}
