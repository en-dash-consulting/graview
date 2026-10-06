import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { compileDocument } from "@graview/core/check";
import { createFileAdapter, openStore } from "@graview/ship";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apply } from "../../src/cli.js";

/**
 * FR-08. `graview apply --template` instantiates a template into a live
 * store: its setup questions answered, its acts run through the same plan
 * machinery as `--plan` — judged first, applied as ONE batch, attributed to
 * the template — so the activity shows one entry and one undo takes it back.
 */
const fixture = resolve(import.meta.dirname, "../../../core/tests/document/fixtures/vendor-shortlist.template.json");
const template = JSON.parse(readFileSync(fixture, "utf8")) as { document: unknown };

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "graview-apply-template-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

async function run(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const o = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => (out.push(String(chunk)), true));
  const e = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => (err.push(String(chunk)), true));
  try {
    return { code: await apply(argv), out: out.join(""), err: err.join("") };
  } finally {
    o.mockRestore();
    e.mockRestore();
  }
}

async function stored() {
  const compiled = compileDocument(template.document);
  if (!compiled.ok) throw new Error("the fixture compiles");
  const opened = await openStore({ app: compiled.app, adapter: createFileAdapter(join(root, "data")), scope: compiled.app.name });
  const store = opened.store;
  opened.close();
  return store;
}

describe("graview apply --template", () => {
  it("runs the setup acts as one attributed batch, with the answers given", async () => {
    const data = join(root, "data");
    const done = await run(["--template", fixture, "--answers", JSON.stringify({ categories: ["Venue", "DJ"], budget: 900 }), "--data", data]);
    expect(done.err).toBe("");
    expect(done.code).toBe(0);
    const said = JSON.parse(done.out) as { batch: string; ops: { intent: string }[] };
    expect(said.batch).toMatch(/^template:vendor-shortlist:/);

    const store = await stored();
    expect(store.graph.nodesOfKind("category").map((n) => [n["name"], n["budget"]])).toEqual([
      ["Venue", 900],
      ["DJ", 900],
    ]);
    const ops = store.log.all();
    expect(ops).toHaveLength(2);
    expect(new Set(ops.map((op) => op.batch))).toEqual(new Set([said.batch]));
    for (const op of ops) {
      expect(op.author).toMatchObject({ kind: "system", id: "template:vendor-shortlist" });
      expect(op.batchIntent ?? op.intent).toBe("Set up from Vendor shortlist");
    }
  });

  it("is taken back by one undo of the batch it printed", async () => {
    const data = join(root, "data");
    const done = await run(["--template", fixture, "--data", data]);
    const { batch } = JSON.parse(done.out) as { batch: string };
    const document = join(root, "app.json");
    writeFileSync(document, JSON.stringify(template.document));
    const undone = await run([document, "--undo", batch, "--roles", "owner", "--data", data]);
    expect(undone.err).toBe("");
    expect(undone.code).toBe(0);
    expect((await stored()).graph.nodesOfKind("category")).toEqual([]);
  });

  it("brings the example content as a batch of its own when asked, so the examples go in one undo too", async () => {
    const data = join(root, "data");
    const done = await run(["--template", fixture, "--examples", "--data", data]);
    expect(done.code).toBe(0);
    const said = JSON.parse(done.out) as { batch: string; examples: string };
    expect(said.examples).toMatch(/^examples:vendor-shortlist:/);
    const store = await stored();
    expect(store.graph.nodesOfKind("vendor")).toHaveLength(4);
    expect(new Set(store.log.all().map((op) => op.batch))).toEqual(new Set([said.batch, said.examples]));
  });

  it("refuses answers the template cannot take, before anything is written", async () => {
    const data = join(root, "data");
    const refused = await run(["--template", fixture, "--answers", JSON.stringify({ budget: "lots" }), "--data", data]);
    expect(refused.code).toBe(1);
    expect(refused.err).toContain("answers.budget");
    expect((await stored()).log.all()).toEqual([]);
  });
});
