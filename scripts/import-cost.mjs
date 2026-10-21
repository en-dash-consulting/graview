#!/usr/bin/env node
// What each entry Graview Cloud's worker imports costs at module scope, in a
// fresh Node process per run (median of --runs, default 5).
//
//   node scripts/import-cost.mjs                 every worker entry
//   node scripts/import-cost.mjs @graview/core   only these
//   node scripts/import-cost.mjs --bundled       each entry bundled first, as a Worker receives it
//   node scripts/import-cost.mjs --worker        the names Cloud's worker imports, bundled together
//   node scripts/import-cost.mjs --profile @graview/core
//       also writes a CPU profile and prints the heaviest module-scope
//       functions and files (self time) under packages/ and node_modules/
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { bundleEntry, entryFile, measure, WORKER_ENTRIES, WORKER_SHAPED } from "./lib/import-cost.mjs";

const args = process.argv.slice(2);
const profile = args.includes("--profile");
const bundled = args.includes("--bundled");
const scratch = mkdtempSync(join(tmpdir(), "graview-import-cost-"));
const runsAt = args.indexOf("--runs");
const runs = runsAt >= 0 ? Number(args[runsAt + 1]) : 5;
const named = args.filter((a, i) => a.startsWith("@") && args[i - 1] !== "--runs");
const worker = args.includes("--worker");
const entries = worker ? [WORKER_SHAPED] : named.length ? named : WORKER_ENTRIES;

for (const entry of entries) {
  const target = bundled || worker ? await bundleEntry(entry, scratch) : null;
  const { cpu, wall } = measure(target?.file ?? entry, runs);
  const size = target ? `   ${(target.bytes / 1024).toFixed(0).padStart(5)} KB (zod ${(target.zod / 1024).toFixed(0)} KB)` : "";
  console.log(`${(worker ? "Cloud's worker imports" : entry).padEnd(30)} cpu ${cpu.toFixed(1).padStart(6)} ms   wall ${wall.toFixed(1).padStart(6)} ms${size}`);
  if (profile) top(target?.file ?? entryFile(entry));
}

function top(file) {
  const dir = mkdtempSync(join(tmpdir(), "graview-import-cost-"));
  execFileSync(
    process.execPath,
    ["--cpu-prof", "--cpu-prof-interval", "50", "--cpu-prof-dir", dir, "--input-type=module", "-e", "await import(process.argv[1])", pathToFileURL(file).href],
    { encoding: "utf8" },
  );
  const written = readdirSync(dir).find((f) => f.endsWith(".cpuprofile"));
  const prof = JSON.parse(readFileSync(join(dir, written), "utf8"));
  // A bundle keeps each module's path as a comment above its code: a line's
  // module is the nearest such comment above it.
  const marks = [];
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, at) => {
      const m = /^\s*\/\/ (\S+\.m?js)$/.exec(line);
      if (m) marks.push([at, m[1]]);
    });
  const moduleAt = (url, line) => {
    if (!url.endsWith(file.split("/").pop()) || !marks.length) return url;
    let lo = 0;
    let hi = marks.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (marks[mid][0] <= line) lo = mid;
      else hi = mid - 1;
    }
    return marks[lo][0] <= line ? marks[lo][1] : "(bundle preamble)";
  };
  const dt = new Map();
  prof.samples.forEach((id, i) => dt.set(id, (dt.get(id) ?? 0) + (prof.timeDeltas[i] ?? 0)));
  const self = new Map();
  const byFile = new Map();
  const charged = new Map();
  const parent = new Map();
  const byId = new Map(prof.nodes.map((n) => [n.id, n]));
  for (const node of prof.nodes) for (const child of node.children ?? []) parent.set(child, node.id);
  const sourceOf = (node) => {
    const { url, lineNumber } = node.callFrame;
    if (!url || url.startsWith("node:")) return null;
    return moduleAt(url, lineNumber)
      .replace(/^.*?(packages\/|node_modules\/(?!\.pnpm))/, "$1")
      .replace(/^node_modules\/\.pnpm\/[^/]+\/node_modules\//, "");
  };
  // Charged: a sample's time goes to the nearest framework module on its
  // stack, so the zod schemas a module builds at its top level count as that
  // module's cost rather than zod's.
  for (const node of prof.nodes) {
    const us = dt.get(node.id) ?? 0;
    if (!us) continue;
    let at = node;
    let owner = null;
    while (at) {
      const source = sourceOf(at);
      if (source?.startsWith("packages/")) {
        owner = source;
        break;
      }
      at = byId.get(parent.get(at.id));
    }
    if (owner) charged.set(owner, (charged.get(owner) ?? 0) + us);
  }
  let loader = 0;
  for (const node of prof.nodes) {
    const us = dt.get(node.id) ?? 0;
    const { functionName, url, lineNumber } = node.callFrame;
    if (!url || url.startsWith("node:")) {
      if (url?.startsWith("node:internal/modules") || functionName === "(program)") loader += us;
      continue;
    }
    const source = moduleAt(url, lineNumber).replace(/^.*?(packages\/|node_modules\/(?!\.pnpm))/, "$1").replace(/^node_modules\/\.pnpm\/[^/]+\/node_modules\//, "");
    const key = `${functionName || "(module)"} ${source}`;
    self.set(key, (self.get(key) ?? 0) + us);
    byFile.set(source, (byFile.get(source) ?? 0) + us);
  }
  const print = (map, n) =>
    [...map].sort((a, b) => b[1] - a[1]).slice(0, n).forEach(([k, us]) => console.log(`    ${(us / 1000).toFixed(1).padStart(6)} ms  ${k}`));
  console.log(`  loading and compiling: ${(loader / 1000).toFixed(1)} ms`);
  console.log("  heaviest modules (self time of their code):");
  print(byFile, 15);
  console.log("  heaviest framework modules (their code and the zod and library calls it makes):");
  print(charged, 15);
  console.log("  heaviest functions:");
  print(self, 15);
}
