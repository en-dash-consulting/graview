import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blockContextFor, CARD_BUDGET, compileBlocks, PAGE_BUDGET, type ResolvedBlock } from "../../src/blocks.js";
import { compileDocument } from "../../src/check.js";
import { describePlace, resolveFor, type DescribedPart } from "../../src/describe.js";
import { Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * RESOLVEFOR(STORE, PRINCIPAL, NODE): ONE CALL RESOLVES A RECORD'S DECLARED
 * BLOCKS AS THE SCENE, THE PAGES FACE AND DESCRIBE_PLACE DO.
 *
 * n-dx's face built the context blocks are read in by hand — the seat's
 * graph, the schema, every kind's shape, the kind's fields, a budget, a
 * heading — with ten casts, and a record page was read under a card's
 * allowance, so a change with 98 tasks said "—" for every list on its page.
 */
const changes = JSON.parse(readFileSync(new URL("./fixtures/changes.gdd.json", import.meta.url), "utf8"));
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const outsider: Principal = { kind: "human", id: "u:outsider", roles: ["outsider"] };

/** A change of 98 tasks, 60 still open; and a small one. */
const seed = {
  nodes: [
    { id: "c1", kind: "change", label: "Move the blocks" },
    { id: "c2", kind: "change", label: "Tidy the docs" },
    ...Array.from({ length: 98 }, (_, i) => ({ id: `t${i + 1}`, kind: "task", label: `Task ${String(i + 1).padStart(2, "0")}`, status: i < 60 ? "open" : "done" })),
    { id: "t99", kind: "task", label: "Read it through", status: "open" },
  ],
  edges: [...Array.from({ length: 98 }, (_, i) => ({ id: `e${i + 1}`, kind: "has", from: "c1", to: `t${i + 1}` })), { id: "e99", kind: "has", from: "c2", to: "t99" }],
};

/** The document, and a seat that sees changes and no task. */
const document = structuredClone(changes);
document.roles = ["owner", "outsider"];
document.policy = { grants: [{ roles: ["owner"], mutations: "*" }], sees: [{ roles: ["owner"], kinds: ["change", "task"] }, { roles: ["outsider"], kinds: ["change"] }] };
const compiled = compileDocument(document, { today: () => "2026-10-10" });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app: GraviewApp = compiled.app;
const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
const change = store.graph.getNode("c1")!;

const byKey = (blocks: readonly ResolvedBlock[], key: string) => blocks.find((block) => block.key === key);
const listed = (block: ResolvedBlock | undefined) => (block?.t === "list" ? block.members.map((member) => member.id) : undefined);

describe("resolveFor", () => {
  it("resolves a record's page — its kind's declared page — over what the seat may see, each block under its key", () => {
    const page = resolveFor(store, owner, change, { app });
    expect(page.map((block) => block.key)).toEqual(["headline.1", "progress", "open-heading", "open", "title.2", "list.2"]);
    expect(byKey(page, "headline.1")).toMatchObject({ t: "headline", level: 2, text: "Move the blocks" });
    expect(byKey(page, "progress")).toMatchObject({ t: "text", text: "38 of 98 done" });
  });

  it("reads a page under a page's budget by default: a change with 98 tasks lists every one, where a card's allowance said '—'", () => {
    const page = resolveFor(store, owner, change, { app });
    expect(byKey(page, "open")).toMatchObject({ t: "list", failed: false });
    expect(listed(byKey(page, "open"))).toHaveLength(60);
    expect(listed(byKey(page, "list.2"))).toHaveLength(38);
    // The same page under a card's allowance: what a product drew before it raised the budget itself.
    const tight = resolveFor(store, owner, change, { app, budget: CARD_BUDGET });
    expect(byKey(tight, "open")).toMatchObject({ t: "list", failed: true });
  });

  it("keeps a card's allowance for a card and a row, and says each budget as an option", () => {
    expect(blockContextFor(store, owner, change, { slot: "page" }).budget).toBe(PAGE_BUDGET);
    expect(blockContextFor(store, owner, null).budget).toBe(PAGE_BUDGET);
    expect(blockContextFor(store, owner, change, { slot: "card" }).budget).toBe(CARD_BUDGET);
    expect(blockContextFor(store, owner, change, { slot: "row" }).budget).toBe(CARD_BUDGET);
    expect(blockContextFor(store, owner, change, { budget: 1234 }).budget).toBe(1234);
    expect(resolveFor(store, owner, change, { app, slot: "card" })).toEqual([
      { key: "title.1", t: "title", text: "Move the blocks" },
      { key: "count", t: "number", text: "98", label: "tasks" },
    ]);
  });

  it("says what describe_place says of the same page: the same headline, the same words, the same records in the same order", () => {
    const page = resolveFor(store, owner, change, { app, today: "2026-10-10" });
    const described = describePlace(store, owner, "c1", { app, today: "2026-10-10" });
    if (!described.ok) throw new Error(described.error);
    const parts = described.description.parts;
    expect(described.description.problems).toEqual([]);
    expect(parts[0]).toEqual({ t: "heading", level: 2, text: "Move the blocks" });
    expect(parts[1]).toEqual({ t: "text", text: "38 of 98 done" });
    const lists = parts.filter((part): part is Extract<DescribedPart, { t: "list" }> => part.t === "list");
    expect(lists.map((list) => list.groups.flatMap((group) => group.items.map((item) => item.id)))).toEqual([listed(byKey(page, "open")), listed(byKey(page, "list.2"))]);
  });

  it("lists only what the seat may see: an outsider is told of no task", () => {
    const page = resolveFor(store, outsider, store.seenBy(outsider).graph.getNode("c1")!, { app });
    expect(listed(byKey(page, "open"))).toEqual([]);
    expect(byKey(page, "progress")).toMatchObject({ text: "0 of 0 done" });
  });

  it("resolves the home about no record, its first headline the page's own heading", () => {
    const home = resolveFor(store, owner, null, { app });
    expect(home[0]).toMatchObject({ key: "headline.1", t: "headline", level: 1, text: "Changes" });
    expect(listed(byKey(home, "changes"))).toEqual(["c1", "c2"]);
  });

  it("resolves blocks of the caller's own alike, as declared or as compiled, and nothing where nothing is declared", () => {
    const blocks = [{ figure: "count(all('task') where status == 'open')", label: "open tasks", key: "open" }];
    const declared = resolveFor(store, owner, null, { blocks });
    expect(declared).toEqual([{ key: "open", t: "number", text: "61", label: "open tasks" }]);
    expect(resolveFor(store, owner, null, { blocks: compileBlocks(blocks) })).toEqual(declared);
    expect(resolveFor(store, owner, store.graph.getNode("t1")!, { app })).toEqual([]);
  });
});
