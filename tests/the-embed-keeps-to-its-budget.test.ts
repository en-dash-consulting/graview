import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, without types.
import { BASES, BUDGETS, measureBudgets, readRaises, withRaises } from "../scripts/lib/bundle-budget.mjs";

/**
 * THE EMBED KEEPS TO ITS BUDGET (FR-19). A chat's widget that shows only
 * the pages bundled every face, the studio and the lenses: over a megabyte
 * minified. `@graview/embed/pages` is the routed face alone, and CI holds
 * each entry to a size (`node scripts/inspect-pack.mjs` fails over it).
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
type Measured = { name: string; minified: number; gzipped: number; budget: { minified: number; gzipped: number }; carries: string[]; over: boolean };

describe("the embed's bundle budget", () => {
  it("holds the pages face alone under its budget, and well under every face", async () => {
    const measured = (await measureBudgets(repo)) as Measured[];
    for (const one of measured) expect(one.over, `${one.name}: ${one.minified} B minified, ${one.gzipped} B gzipped`).toBe(false);
    const pages = measured.find((one) => one.name === "the pages face alone")!;
    const every = measured.find((one) => one.name === "every face")!;
    // No scene, no studio, no lenses: a quarter of the whole, at least.
    expect(pages.minified).toBeLessThan(every.minified * 0.75);
  }, 60_000);

  /*
   * A PAGE THAT DOES NOT TURN THE STUDIO ON DOES NOT LOAD IT. The embed
   * imported the studio outright, so `studio: false` still carried about
   * 104 kB of it; it is now imported when the studio is turned on.
   */
  it("keeps the studio out of what a page first loads, and the studio is most of the difference", async () => {
    const measured = (await measureBudgets(repo)) as Measured[];
    const without = measured.find((one) => one.name === "embed without the studio")!;
    const every = measured.find((one) => one.name === "every face")!;
    expect(without.carries).toEqual([]);
    expect(every.minified - without.minified).toBeGreaterThan(80_000);
  }, 60_000);

  /*
   * FR-63: A HOST WHOSE PAGE IS THE STUDIO HANDS IT IN, AND WAITS FOR NO
   * CHUNK. The embed's own studio is a lazy chunk, so Graview Cloud's
   * builder paid a round trip of about 109 kB before the studio drew.
   * `studio: { onApply, place: StudioPlace }` puts it in what the page
   * loads first, read off esbuild's metafile: no `@graview/studio` module
   * is in a chunk the entry does not import outright.
   */
  it("puts no @graview/studio module in a lazy chunk when the host hands the studio in", async () => {
    const measured = (await measureBudgets(repo)) as (Measured & { lazy: string[]; defers: string[]; packages?: string[] })[];
    const handed = measured.find((one) => one.name === "embed with the studio handed in")!;
    const every = measured.find((one) => one.name === "every face")!;
    expect(handed.over, `${handed.minified} B minified, ${handed.gzipped} B gzipped, deferring ${handed.defers.join(", ")}`).toBe(false);
    expect(handed.lazy).not.toContain("@graview/studio");
    // The measure can tell: the embed's own studio is a lazy chunk.
    expect(every.lazy).toContain("@graview/studio");
  }, 60_000);

  it("fails a bundle that leaves a package it must load at once in a lazy chunk", async () => {
    const waiting = (BUDGETS as { name: string; entry: string }[])
      .filter((budget) => budget.name === "every face")
      .map((budget) => ({ ...budget, minified: 10_000_000, gzipped: 10_000_000, lazyLacks: ["@graview/studio"] }));
    const measured = (await measureBudgets(repo, waiting)) as (Measured & { defers: string[] })[];
    expect(measured.map((one) => [one.over, one.defers])).toEqual([[true, ["@graview/studio"]]]);
  }, 60_000);

  it("fails a bundle that carries a package it must not", async () => {
    const carrying = (BUDGETS as { name: string; entry: string; lacks?: string[] }[]).filter((budget) => budget.entry.includes("@graview/embed")).map((budget) => ({ ...budget, minified: 10_000_000, gzipped: 10_000_000, lacks: ["@graview/core"] }));
    const measured = (await measureBudgets(repo, carrying)) as Measured[];
    expect(measured.every((one) => one.over && one.carries.includes("@graview/core"))).toBe(true);
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

/*
 * A RAISE IS A FILE OF ITS OWN, so two pull requests raising one entry
 * never conflict — and it is still a decision somebody explained: one that
 * names no budget, or says nothing, fails every measure.
 */
describe("a budget's raises", () => {
  type Base = { name: string; minified: number; gzipped: number };
  const raisesOf = (files: Record<string, unknown>) => {
    const dir = mkdtempSync(join(tmpdir(), "budget-raises-"));
    try {
      for (const [file, raise] of Object.entries(files)) writeFileSync(join(dir, file), JSON.stringify(raise));
      return readRaises(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const note = "Raised when a test came to raise it twice, 100 / 10 more. Measured at nothing.";

  it("holds an entry to its base plus the sum of its raises", () => {
    const base = (BASES as Base[]).find((one) => one.name === "every face")!;
    const raises = raisesOf({
      "one.json": { budget: "every face", minified: 100, gzipped: 10, note },
      "two.json": { budget: "every face", minified: 250, gzipped: -4, note },
    });
    const raised = (withRaises(BASES, raises) as (Base & { raises: string[] })[]).find((one) => one.name === "every face")!;
    expect([raised.minified, raised.gzipped]).toEqual([base.minified + 350, base.gzipped + 6]);
    expect(raised.raises).toEqual(["one.json", "two.json"]);
  });

  it("fails a raise that names an entry there is no budget for", () => {
    const raises = raisesOf({ "typo.json": { budget: "every faces", minified: 100, gzipped: 10, note } });
    expect(() => withRaises(BASES, raises)).toThrow(/typo\.json raises "every faces", which is not a budget/);
  });

  it("fails a raise that carries no note", () => {
    expect(() => withRaises(BASES, raisesOf({ "quiet.json": { budget: "every face", minified: 100, gzipped: 10 } }))).toThrow(/quiet\.json carries no note/);
    expect(() => withRaises(BASES, raisesOf({ "terse.json": { budget: "every face", minified: 100, gzipped: 10, note: "  " } }))).toThrow(/terse\.json carries no note/);
  });

  it("fails a raise that does not say its bytes as whole numbers", () => {
    expect(() => withRaises(BASES, raisesOf({ "vague.json": { budget: "every face", minified: "a little", gzipped: 10, note } }))).toThrow(/vague\.json must say how many bytes minified/);
  });

  it("reads every raise in the tree, and every one of them holds", () => {
    expect(() => withRaises(BASES, readRaises())).not.toThrow();
    expect((BUDGETS as Base[]).map((one) => one.name)).toEqual((BASES as Base[]).map((one) => one.name));
  });
});
