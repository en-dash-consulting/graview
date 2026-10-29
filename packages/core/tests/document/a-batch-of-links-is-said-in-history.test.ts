import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { historyInWords, ticksOf } from "../../src/history.js";
import { Store, type AnySchema, type Principal } from "../../src/index.js";

/**
 * A BATCH OF LINKS IS IN HISTORY (Roadmap f-lifelogics-findings, request
 * bug-link-changes-made-through-act-batch-are-missing-from-history). On
 * LifeLogics Estimates one `act_batch` linked twelve records, and Graview
 * Cloud's `history` and each record's changes said nothing of it. The
 * framework's history has the gesture, and each record it linked is in its
 * ops — what is missing there is Cloud's reading of them — but it said the
 * batch by its first link alone, so twelve links read as one. Now a batch
 * of several acts is said by each act's sentence, or the first two and how
 * many more.
 */
const doc = JSON.parse(readFileSync(new URL("./fixtures/lifelogics.gdd.json", import.meta.url), "utf8"));
const seed = JSON.parse(readFileSync(new URL("./fixtures/lifelogics.seed.json", import.meta.url), "utf8"));
const ada: Principal = { kind: "human", id: "u:ada", name: "Ada", roles: ["owner"] };

function store() {
  const result = compileDocument(doc, { today: () => "2026-10-28" });
  if (!result.ok) throw new Error(JSON.stringify(result.findings));
  const app = result.app;
  return new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, ...(app.policy ? { policy: app.policy } : {}), snapshot: structuredClone(seed) as never });
}

describe("links made in one batch", () => {
  it("are one change in history, said in words, touching every record linked", () => {
    const s = store();
    const before = historyInWords(s).length;
    const links = [
      ["pkg-later", "offer-workshop"],
      ["pkg-later", "offer-analysis"],
      ["pkg-later", "offer-suite"],
      ["pkg-start", "offer-suite"],
    ] as const;
    const applied = s.applyAll(links.map(([id, to]) => ({ name: "connect-package-includes", args: { id, to } })), { author: ada });
    expect(applied.ops.length).toBe(links.length);
    const said = historyInWords(s);
    expect(said.length).toBe(before + 1);
    const newest = said[0]!;
    expect(newest.by).toBe("Ada");
    // Every link said, where it said the first alone: four links read as one.
    expect(newest.said).toMatch(/^Link .+; Link .+; and 2 more$/);
    expect(newest.sentence).toMatch(/^Ada: /);
    // Each record it linked is in the gesture's ops, for a record's own changes to find.
    const ops = s.batches().find((batch) => batch.id === newest.batches[0])!.ops;
    const touched = new Set(ops.flatMap((op) => op.primitives.flatMap((p) => ("edge" in p ? [(p.edge as { from: string }).from, (p.edge as { to: string }).to] : []))));
    for (const [id, to] of links) {
      expect(touched).toContain(id);
      expect(touched).toContain(to);
    }
    expect(ticksOf(s).at(-1)!.batch).toBe(newest.batches[0]);
  });
});
