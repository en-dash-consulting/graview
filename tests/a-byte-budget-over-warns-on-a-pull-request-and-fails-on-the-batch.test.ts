import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, without types.
import { budgetMode, bytesOver, holdBytes, keptOvers, oversMarkdown, reportOver } from "../scripts/lib/budget-mode.mjs";
// @ts-expect-error — a plain .mjs module, without types.
import { budgetFailures } from "../scripts/lib/bundle-budget.mjs";

/**
 * A BYTE BUDGET OVER WARNS ON A PULL REQUEST AND FAILS ON THE BATCH (HQ
 * feature f-budgets-raised-on-the-batch). Each pull request's raise was
 * measured against main alone, and batched they did not sum: the 0.2.4
 * batch needed five raises more, and #608, #612 and #614 each went red on a
 * budget first. A pull request that is not a batch runs with
 * GRAVIEW_BUDGET=warn; what guards a mistake fails everywhere.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const within = { name: "every face", minified: 900, gzipped: 300, budget: { minified: 1000, gzipped: 400 } };
const over = { name: "every face", minified: 1_234, gzipped: 456, budget: { minified: 1000, gzipped: 400 } };
const measured = (more: Record<string, unknown> = {}) => ({ ...over, carries: [], defers: [], lazy: [], over: true, ...more });

describe("the switch", () => {
  it("fails unless it is told to warn, and refuses a word it does not know rather than turning a budget off", () => {
    expect(budgetMode({})).toBe("fail");
    expect(budgetMode({ GRAVIEW_BUDGET: "" })).toBe("fail");
    expect(budgetMode({ GRAVIEW_BUDGET: "fail" })).toBe("fail");
    expect(budgetMode({ GRAVIEW_BUDGET: "warn" })).toBe("warn");
    expect(() => budgetMode({ GRAVIEW_BUDGET: "off" })).toThrow(/GRAVIEW_BUDGET is "off"/);
  });

  it("says the bytes over, minified and gzipped, and nothing for a size within its budget", () => {
    expect(bytesOver(over)).toEqual({ minified: 234, gzipped: 56 });
    expect(bytesOver(within)).toEqual({ minified: 0, gzipped: 0 });
    expect(bytesOver({ name: "Cloud's worker", minified: 1500, budget: { minified: 1000 } })).toEqual({ minified: 500, gzipped: 0 });
  });

  it("fails a byte ceiling over on the batch, on main, in Nightly and in the release, saying the entry and the bytes", () => {
    const warned: unknown[] = [];
    const failures = holdBytes(over, { env: {}, warn: (one: unknown) => warned.push(one) }) as string[];
    expect(failures).toEqual(["every face is 234 B minified and 56 B gzipped over its budget: 1,234 / 456 B against 1,000 / 400 B"]);
    expect(warned).toEqual([]);
    expect(holdBytes(within, { env: {} })).toEqual([]);
  });

  it("warns of a byte ceiling over on a pull request that is not a batch, and passes", () => {
    const warned: { name: string; over: unknown }[] = [];
    expect(holdBytes(over, { env: { GRAVIEW_BUDGET: "warn" }, warn: (one: { name: string; over: unknown }) => warned.push(one) })).toEqual([]);
    expect(warned).toMatchObject([{ name: "every face", over: { minified: 234, gzipped: 56 } }]);
  });

  it("fails what a bundle carries or defers that it must not, warned or not", () => {
    const warn = { env: { GRAVIEW_BUDGET: "warn" }, warn: () => {} };
    expect(budgetFailures(measured({ carries: ["@graview/studio"] }), warn)).toEqual(["every face carries @graview/studio, which it must not"]);
    expect(budgetFailures(measured({ defers: ["@graview/studio"] }), warn)).toEqual(["every face leaves @graview/studio in a chunk fetched later, which must load at once"]);
    expect(budgetFailures(measured(), warn)).toEqual([]);
    expect(budgetFailures(measured(), { env: {} })).toHaveLength(1);
  });
});

describe("the warning, said once", () => {
  it("keeps each over in the report file, one per entry however many shards measured it, as a table for the job's summary", () => {
    const dir = mkdtempSync(join(tmpdir(), "budget-report-"));
    try {
      const file = join(dir, "over.jsonl");
      const env = { GRAVIEW_BUDGET: "warn", GRAVIEW_BUDGET_REPORT: file };
      holdBytes(over, { env });
      holdBytes({ ...over, minified: 1_300 }, { env });
      holdBytes({ name: "a hosted page", minified: 2_000, gzipped: 700, budget: { minified: 1_900, gzipped: 800 } }, { env });
      const kept = keptOvers(readFileSync(file, "utf8")) as { name: string; over: { minified: number; gzipped: number } }[];
      expect(kept.map((one) => [one.name, one.over])).toEqual([
        ["a hosted page", { minified: 100, gzipped: 0 }],
        ["every face", { minified: 300, gzipped: 56 }],
      ]);
      const table = oversMarkdown(kept) as string;
      expect(table).toContain("| every face | 300 | 56 | 1,300 / 456 | 1,000 / 400 |");
      expect(oversMarkdown([])).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is an annotation on the step when no report file is named", () => {
    const writes: string[] = [];
    const write = process.stdout.write;
    process.stdout.write = ((text: string) => (writes.push(text), true)) as typeof process.stdout.write;
    try {
      reportOver({ ...over, over: bytesOver(over) }, {});
    } finally {
      process.stdout.write = write;
    }
    expect(writes.join("")).toMatch(/^::warning title=Over a byte budget: every face::every face is 234 B minified/);
  });
});

describe("where it is set", () => {
  const ci = readFileSync(resolve(repo, ".github/workflows/ci.yml"), "utf8");

  it("warns only on a pull request into main whose head is not a batch nor the Version packages branch", () => {
    const set = ci.match(/^\s+GRAVIEW_BUDGET: (.+)$/m)?.[1] ?? "";
    expect(set).toContain("github.event_name == 'pull_request'");
    expect(set).toContain("github.base_ref == 'main'");
    expect(set).toContain("!startsWith(github.head_ref, 'batch/')");
    expect(set).toContain("!startsWith(github.head_ref, 'changeset-release/')");
    expect(set).toMatch(/&& 'warn' \|\| 'fail'/);
  });

  it("is set nowhere else, so Nightly and the release fail a budget that is over", () => {
    for (const workflow of ["nightly.yml", "release.yml", "pages.yml"]) {
      expect(readFileSync(resolve(repo, ".github/workflows", workflow), "utf8")).not.toContain("GRAVIEW_BUDGET");
    }
  });

  it("is read where every byte ceiling is held, and the overs said after the tests and the tarballs", () => {
    for (const file of ["tests/the-embed-keeps-to-its-budget.test.ts", "tests/a-hosted-page-keeps-to-its-budget.test.ts", "tests/importing-the-framework-costs-little.test.ts", "scripts/inspect-pack.mjs"]) {
      expect(readFileSync(resolve(repo, file), "utf8"), file).toMatch(/holdBytes|budgetFailures/);
    }
    expect(ci.match(/node scripts\/budget-report\.mjs/g)).toHaveLength(2);
  });
});
