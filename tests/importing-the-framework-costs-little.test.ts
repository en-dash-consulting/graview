import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, without types.
import { bundleEntry, IMPORT_BUDGET, machineFactor, measure, WORKER_BUDGET, WORKER_SHAPED } from "../scripts/lib/import-cost.mjs";

/**
 * IMPORTING THE FRAMEWORK COSTS LITTLE (Roadmap f-smaller-worker). A Worker's
 * cold isolate runs every module's top level before it answers its first
 * request, so a framework entry that builds its zod schemas, tables and
 * templates at import makes every cold start pay for them. Each entry Graview
 * Cloud's worker imports is bundled as wrangler bundles it and loaded in a
 * fresh Node process, and its CPU (not wall time; the median of three) is
 * held to a budget (`scripts/lib/import-cost.mjs`). `node
 * scripts/import-cost.mjs --bundled --profile <entry>` says where the time goes.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const budget = IMPORT_BUDGET as Record<string, number>;
type Bundle = { file: string; bytes: number; zod: number };

let dir: string;
let worker: Bundle;
// CPU budgets stretch by how much slower this machine loads a fixed reference than the one they were set on.
let factor = 1;
const bundles = new Map<string, Bundle>();
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "graview-import-cost-"));
  factor = (await machineFactor(dir)) as number;
  worker = (await bundleEntry(WORKER_SHAPED, dir)) as Bundle;
  for (const entry of Object.keys(budget)) bundles.set(entry, (await bundleEntry(entry, dir)) as Bundle);
}, 120_000);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("importing the framework", () => {
  it(`the names Cloud's worker imports load together in under ${WORKER_BUDGET.cpu} ms of CPU`, () => {
    const { cpu } = measure(worker.file, 5) as { cpu: number };
    expect(cpu, `${cpu.toFixed(1)} ms, this machine ${factor.toFixed(2)}x the budgets'`).toBeLessThanOrEqual(WORKER_BUDGET.cpu * factor);
  }, 60_000);

  it(`the names Cloud's worker imports come to at most ${WORKER_BUDGET.bytes / 1_000_000} MB, at most ${WORKER_BUDGET.zod / 1000} KB of it zod's`, () => {
    expect(worker.bytes, `${Math.round(worker.bytes / 1024)} KB`).toBeLessThanOrEqual(WORKER_BUDGET.bytes);
    expect(worker.zod, `${Math.round(worker.zod / 1024)} KB of zod`).toBeLessThanOrEqual(WORKER_BUDGET.zod);
  });

  it("each entry Cloud's worker imports loads within its budget of CPU", () => {
    const over: string[] = [];
    for (const [entry, most] of Object.entries(budget)) {
      const { cpu } = measure(bundles.get(entry)!.file, 3) as { cpu: number };
      if (cpu > most * factor) over.push(`${entry}: ${cpu.toFixed(1)} ms, budget ${(most * factor).toFixed(1)} ms (${factor.toFixed(2)}x)`);
    }
    expect(over).toEqual([]);
  }, 120_000);

  it("reading the document format brings in only the zod it calls: @graview/core/document carries under 260 KB of it", () => {
    const zod = bundles.get("@graview/core/document")!.zod;
    expect(zod, `${Math.round(zod / 1024)} KB of zod`).toBeLessThanOrEqual(260_000);
  });

  it('no framework module imports zod\'s `z` by name, which makes a bundler keep all of zod; it is `import * as z from "zod"`, and only the main entry re-exports `z` for a product', () => {
    const named: string[] = [];
    const walk = (at: string) => {
      for (const name of readdirSync(at)) {
        const path = join(at, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !name.endsWith(".d.ts")) {
          const text = readFileSync(path, "utf8");
          if (/^import \{[^}]*\bz\b[^}]*\} from "zod";/m.test(text)) named.push(relative(repo, path));
        }
      }
    };
    for (const pkg of readdirSync(join(repo, "packages"))) {
      const src = join(repo, "packages", pkg, "src");
      try {
        walk(src);
      } catch {
        // a package without src/
      }
    }
    expect(named).toEqual([]);
  });
});
