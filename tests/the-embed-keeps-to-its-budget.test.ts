import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, without types.
import { BUDGETS, measureBudgets } from "../scripts/lib/bundle-budget.mjs";

/**
 * THE EMBED KEEPS TO ITS BUDGET (FR-19). A chat's widget that shows only
 * the pages bundled every face, the studio and the lenses: over a megabyte
 * minified. `@graview/embed/pages` is the routed face alone, and CI holds
 * each entry to a size (`node scripts/inspect-pack.mjs` fails over it).
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
type Measured = { name: string; minified: number; gzipped: number; budget: { minified: number; gzipped: number }; over: boolean };

describe("the embed's bundle budget", () => {
  it("holds the pages face alone under its budget, and well under every face", async () => {
    const measured = (await measureBudgets(repo)) as Measured[];
    for (const one of measured) expect(one.over, `${one.name}: ${one.minified} B minified, ${one.gzipped} B gzipped`).toBe(false);
    const pages = measured.find((one) => one.name === "the pages face alone")!;
    const every = measured.find((one) => one.name === "every face")!;
    // No scene, no studio, no lenses: a quarter of the whole, at least.
    expect(pages.minified).toBeLessThan(every.minified * 0.75);
  }, 60_000);

  it("fails a bundle that is over its budget", async () => {
    const tight = (BUDGETS as { name: string; entry: string }[]).map((budget) => ({ ...budget, minified: 1000, gzipped: 1000 }));
    const measured = (await measureBudgets(repo, tight)) as Measured[];
    expect(measured.every((one) => one.over)).toBe(true);
  }, 60_000);

  it("is checked where CI checks the tarballs", () => {
    const inspect = readFileSync(resolve(repo, "scripts/inspect-pack.mjs"), "utf8");
    expect(inspect).toContain("measureBudgets");
  });
});
