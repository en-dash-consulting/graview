import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Store, type AnyGraphNode, type AnySchema, type GraphReader } from "../../src/index.js";
import { compileBlocks, fieldSpecsOf, resolveBlocks, whatBlocksSay } from "../../src/blocks.js";
import { compileDocument } from "../../src/check.js";

/**
 * FR-141. A kind's declared page heads its record, and the record drawn
 * around it said it all again: Graview Cloud's workshop part showed its goal
 * twice and its four topics three times. What the page's blocks say — the
 * fields they read, the records they list, the title they open with — is
 * read once, from the blocks as resolved, so the record around them leaves
 * it out. Only what is shown counts.
 */
const fixtures = new URL("../../../../scripts/fixtures/drawn-once/", import.meta.url);
const workshop = JSON.parse(readFileSync(new URL("workshop.gdd.json", fixtures), "utf8"));
const seed = JSON.parse(readFileSync(new URL("workshop.seed.json", fixtures), "utf8"));

function said(blocks: readonly unknown[]) {
  const result = compileDocument(workshop, { today: () => "2026-10-08" });
  if (!result.ok) throw new Error("the workshop compiles");
  const store = new Store<AnySchema>({ schema: result.app.schema as AnySchema, mutations: [], snapshot: seed as never });
  const graph = store.graph as unknown as GraphReader;
  const node = graph.getNode("segment:ongoing-support") as AnyGraphNode;
  const compiled = compileBlocks(blocks);
  const ctx = { node, graph, schema: result.app.schema as AnySchema, kinds: result.kinds, fields: fieldSpecsOf(result.app.schema as AnySchema, "segment"), today: "2026-10-08" };
  return whatBlocksSay(compiled, resolveBlocks(compiled, ctx));
}

describe("what a page already says", () => {
  it("names the title, the fields its words read and the records its list lists", () => {
    const page = said(workshop.views.segment.page);
    expect(page.title).toBe("Ongoing support");
    expect([...page.fields].sort()).toEqual(["goal", "summary", "title"]);
    expect([...page.records].sort()).toEqual(["topic:apply-the-actions", "topic:fund-products", "topic:prioritize-within", "topic:watch-for-old-habits"]);
  });

  it("counts a field block by its field, and nothing a condition that does not hold would show", () => {
    const page = said([{ field: "order" }, { when: "phase == 'during'", show: [{ text: "{summary}" }] }, { group: [{ badge: "{phase}" }] }]);
    expect(page.title).toBeUndefined();
    expect([...page.fields].sort()).toEqual(["order", "phase"]);
    expect(page.records.size).toBe(0);
  });
});
