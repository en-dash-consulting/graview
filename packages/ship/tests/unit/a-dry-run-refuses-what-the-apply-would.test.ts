import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncSeed } from "../../src/cli.js";

/**
 * A DRY RUN REFUSES WHAT THE APPLY WOULD REFUSE.
 *
 * A product's seed had one chapter at `step: 5` where the declaration says
 * `step` is an integer of at most 4. `graview sync-seed` printed its clean
 * steps and exited 0; `--apply` then refused the whole batch with "… does
 * not match what chapter declares / Step: Too big: expected number to be
 * <=4". The dry run now judges every put and patch as the apply would, and
 * names each record, field and the declaration's words up front.
 */
const DOCUMENT = {
  format: "graview-document",
  formatVersion: 1,
  name: "Course",
  kinds: {
    chapter: {
      noun: "chapter",
      plural: "Chapters",
      fields: {
        title: { type: "string", required: true },
        step: { type: "integer", max: 4 },
      },
    },
  },
};

const chapter = (id: string, title: string, step: number) => ({ id, kind: "chapter", title, step });

let folder: string;
let out: string[];
let err: string[];
beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "graview-sync-seed-judged-"));
  writeFileSync(join(folder, "app.json"), JSON.stringify(DOCUMENT));
  out = [];
  err = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => (out.push(String(chunk)), true));
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => (err.push(String(chunk)), true));
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(folder, { recursive: true, force: true });
});

const run = (seed: unknown, ...more: string[]) => {
  writeFileSync(join(folder, "seed.json"), JSON.stringify(seed));
  return syncSeed([join(folder, "app.json"), "--seed", join(folder, "seed.json"), "--data", join(folder, "data"), ...more]);
};

describe("graview sync-seed's dry run", () => {
  it("names every record the apply would refuse, by field and in the declaration's words, and exits non-zero", async () => {
    // The store begins from a seed that fits.
    expect(await run({ nodes: [chapter("c1", "Begin", 1)], edges: [] }, "--apply")).toBe(0);

    const next = { nodes: [chapter("c1", "Begin", 9), chapter("c2", "Middle", 2), chapter("c3", "End", 5)], edges: [] };
    out = [];
    err = [];
    const code = await run(next);
    const said = [...out, ...err].join("");
    expect(code, said).toBe(1);
    expect(said).toMatch(/2 of 3 steps would be refused/);
    expect(said).toMatch(/c1 is patched: step.*\n.*Begin does not match what chapter declares.*\n.*Step: Too big: expected number to be <=4/);
    expect(said).toMatch(/chapter c3 is put.*\n.*End does not match what chapter declares.*\n.*Step: Too big: expected number to be <=4/);
    expect(said).not.toMatch(/c2[^\n]*\n[^\n]*does not match/);
    expect(said).toContain("Nothing was written");
  });

  it("is what the apply goes by: the apply refuses the same records, writes nothing, and a seed that fits lands", async () => {
    expect(await run({ nodes: [chapter("c1", "Begin", 1)], edges: [] }, "--apply")).toBe(0);
    const before = readdirSync(join(folder, "data"), { recursive: true }).length;

    out = [];
    err = [];
    expect(await run({ nodes: [chapter("c1", "Begin", 1), chapter("c3", "End", 5)], edges: [] }, "--apply")).toBe(1);
    expect([...out, ...err].join("")).toMatch(/chapter c3 is put.*\n.*End does not match what chapter declares/);
    expect(readdirSync(join(folder, "data"), { recursive: true }).length).toBe(before);

    out = [];
    err = [];
    expect(await run({ nodes: [chapter("c1", "Begin", 1), chapter("c3", "End", 4)], edges: [] })).toBe(0);
    expect(await run({ nodes: [chapter("c1", "Begin", 1), chapter("c3", "End", 4)], edges: [] }, "--apply")).toBe(0);
    expect(out.join("")).toMatch(/landed 1 change/);
  });

  it("says the refusals in --json too", async () => {
    expect(await run({ nodes: [chapter("c1", "Begin", 1)], edges: [] }, "--apply")).toBe(0);
    out = [];
    expect(await run({ nodes: [chapter("c1", "Begin", 1), chapter("c3", "End", 5)], edges: [] }, "--json")).toBe(1);
    const said = JSON.parse(out.join("")) as { refused: { record: string; fields: string[]; said: string }[]; applied: null };
    expect(said.applied).toBeNull();
    expect(said.refused).toEqual([expect.objectContaining({ record: "c3", fields: ["step"], said: expect.stringContaining("Step: Too big") })]);
  });
});
