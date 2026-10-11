import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileBlocks, resolveBlocks, type ResolvedBlock } from "../../src/blocks.js";
import { resolveFor } from "../../src/describe.js";
import { checkApp, compileDocument } from "../../src/check.js";
import { createSchema, defineApp, defineNode, Store, z } from "../../src/index.js";

/**
 * A DECLARED BLOCK HAS A STABLE KEY, AND A FACE CLAIMS IT BY THAT KEY.
 *
 * n-dx's face drew a change's rewrites and the tasks it works on its own way
 * and let the declared blocks draw the rest — choosing which by a title's
 * words (`title === "Rewrites"`). Said differently, the title dropped a
 * section without a word. Every block now has a key: the declaration's, or
 * one derived from its sort and its place among its siblings of that sort,
 * never from what it says.
 */
const changes = JSON.parse(readFileSync(new URL("./fixtures/changes.gdd.json", import.meta.url), "utf8"));

/** Every key, nested ones too, in order. */
const keysOf = (blocks: readonly { key: string; t: string; blocks?: readonly unknown[]; show?: readonly unknown[] }[]): string[] =>
  blocks.flatMap((block) => [block.key, ...keysOf((block.blocks ?? block.show ?? []) as never)]);

describe("a block's key", () => {
  const blocks = [
    { headline: "{label}" },
    { title: "Rewrites" },
    { list: "out('has')" },
    { title: "Works on" },
    { list: "out('has')", key: "works-on" },
    { group: [{ text: "one" }, { badge: "two" }, { text: "three" }] },
    { when: "true", show: [{ text: "shown", key: "said" }] },
  ];

  it("is the declaration's where it gives one, else its sort and its place among its siblings of that sort, a nested one after its parent's", () => {
    expect(keysOf(compileBlocks(blocks) as never)).toEqual(["headline.1", "title.1", "list.1", "title.2", "works-on", "group.1", "group.1.text.1", "group.1.badge.1", "group.1.text.2", "when.1", "said"]);
  });

  it("is not read from a block's words: a title said differently keeps every key", () => {
    const renamed = blocks.map((block) => ("title" in block ? { title: `${block.title}, renamed` } : block));
    expect(keysOf(compileBlocks(renamed) as never)).toEqual(keysOf(compileBlocks(blocks) as never));
  });

  it("does not move when a sibling names its own: a key given to one block leaves the others' as they were", () => {
    const named = blocks.map((block, i) => (i === 2 ? { ...block, key: "rewrites" } : block));
    const before = keysOf(compileBlocks(blocks) as never);
    const after = keysOf(compileBlocks(named) as never);
    expect(after.filter((key, i) => key !== before[i])).toEqual(["rewrites"]);
  });

  it("is carried through resolveBlocks, into a group and a condition that holds", () => {
    const resolved = resolveBlocks(compileBlocks(blocks), { node: null, kinds: new Map(), fields: {}, today: "2026-10-10" });
    expect(keysOf(resolved as never)).toEqual(["headline.1", "title.1", "list.1", "title.2", "works-on", "group.1", "group.1.text.1", "group.1.badge.1", "group.1.text.2", "when.1", "said"]);
  });
});

describe("graview check holds a block's key to its view", () => {
  const withPage = (page: unknown[]) => {
    const doc = structuredClone(changes);
    doc.views.change.page = page;
    return doc;
  };

  it("takes a key on any block, without a word", () => {
    const compiled = compileDocument(changes, { today: () => "2026-10-10" });
    expect(compiled.ok, JSON.stringify(compiled.findings)).toBe(true);
    expect(compiled.findings.filter((f) => f.code === "unknown-key" || f.code === "view-key")).toEqual([]);
  });

  it("refuses two blocks of one view under one key, nested or not, and says where the first is", () => {
    const refused = compileDocument(withPage([{ title: "Open", key: "open" }, { group: [{ list: "out('has')", key: "open" }] }]), { today: () => "2026-10-10" });
    expect(refused.ok).toBe(false);
    expect(refused.findings.filter((f) => f.code === "view-key").map((f) => [f.path, f.message])).toEqual([
      ["views.change.page.1.group.0.key", '"open" is the key of views.change.page.0 too: a face claims a block by its key, so each in a view has its own'],
    ]);
  });

  it("lets two views use one key: a card's and a page's are claimed apart", () => {
    const doc = withPage([{ headline: "{label}", key: "count" }]);
    expect(compileDocument(doc, { today: () => "2026-10-10" }).findings.filter((f) => f.code === "view-key")).toEqual([]);
  });

  it("refuses a key that is not a word or a few joined by hyphens: a dot is a derived key's", () => {
    const refused = compileDocument(withPage([{ title: "Open", key: "list.2" }, { text: "x", key: "" }]), { today: () => "2026-10-10" });
    expect(refused.findings.filter((f) => f.code === "view-key").map((f) => f.path)).toEqual(["views.change.page.0.key", "views.change.page.1.key"]);
  });

  it("refuses the same of a declaration written in TypeScript, at viewSpecs.<kind>.<slot>", () => {
    const schema = createSchema([defineNode("note", { fields: z.object({ label: z.string() }) })]);
    const app = defineApp({
      name: "Notes",
      schema,
      viewSpecs: { note: { card: [{ title: "{label}", key: "name" }, { text: "{label}", key: "name" }] } },
      home: [{ headline: "Notes", key: "top" }, { text: "All of them", key: "top" }],
    });
    const found = checkApp(app).findings.filter((f) => f.code === "view-key");
    expect(found.map((f) => [f.severity, f.where])).toEqual([
      ["error", "viewSpecs.note.card.1.key"],
      ["error", "home.1.key"],
    ]);
  });
});

describe("a face's own drawing, claimed by key", () => {
  it("draws the blocks it did not claim and finds the ones it did by key, whatever their titles say", () => {
    const compiled = compileDocument(changes, { today: () => "2026-10-10" });
    if (!compiled.ok) throw new Error("did not compile");
    const store = new Store({ schema: compiled.app.schema, mutations: compiled.app.mutations ?? [], snapshot: { nodes: [{ id: "c1", kind: "change", label: "Tidy" }], edges: [] } as never });
    const page = resolveFor(store, null, store.graph.getNode("c1")!, { app: compiled.app });
    const claimed = new Set(["open-heading", "open"]);
    const drawn = (blocks: readonly ResolvedBlock[]) => blocks.filter((block) => !claimed.has(block.key)).map((block) => block.key);
    expect(drawn(page)).toEqual(["headline.1", "progress", "title.2", "list.2"]);
  });
});
