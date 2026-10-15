import { describe, expect, it } from "vitest";
import { z } from "zod";
import { acceptSuggestion, declined, declineSuggestion, digestWords, foldDigests, suggest, suggestions, tidyingRefusal } from "../../src/tidying.js";
import { bindSchema, createSchema, defineNode, isAutomated, isLeftAlone, nodeRef, PermissionDeniedError, Store, type AnySchema, type Author, type Policy } from "../../src/index.js";

/**
 * THE APP'S OWN ACTOR IS HELD TO WHAT PEOPLE SAID. A background actor
 * ("Graview, tidying", an author marked `automated`) applies the links it
 * is sure of with lineage, and suggests the one it is not: the suggestion
 * waits in the log and changes nothing until a person accepts or declines
 * it. A declined suggestion is refused next time. A record a person said
 * to leave alone is never changed by it, and a kind or a relation the
 * declaration says is never tidied is not tidied on its own.
 */
const vendor = defineNode("vendor", {
  fields: z.object({ label: z.string() }),
  edges: { supplies: { to: ["event"], description: "the events it supplies" }, books: { to: ["event"], tidying: "never" } },
});
const event = defineNode("event", { fields: z.object({ label: z.string() }) });
const schema = createSchema([vendor, event]);
const { defineMutation } = bindSchema(schema);
const supply = defineMutation("supply", {
  title: "Say a vendor supplies an event",
  subject: { kinds: ["vendor"], arg: "id" },
  connects: ["supplies"],
  input: z.object({ id: nodeRef(["vendor"]), event: nodeRef(["event"]) }),
  describe: (args, graph) => `Link ${(graph.getNode(args.id) as { label?: string } | undefined)?.label} to ${(graph.getNode(args.event) as { label?: string } | undefined)?.label}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "supplies", from: args.id, to: args.event });
  },
});
const book = defineMutation("book", {
  title: "Book a vendor for an event",
  subject: { kinds: ["vendor"], arg: "id" },
  connects: ["books"],
  input: z.object({ id: nodeRef(["vendor"]), event: nodeRef(["event"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "books", from: args.id, to: args.event });
  },
});
const rename = defineMutation("rename-vendor", {
  title: "Rename a vendor",
  subject: { kinds: ["vendor"], arg: "id" },
  input: z.object({ id: nodeRef(["vendor"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});

const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const chat: Author = { kind: "agent", id: "claude", name: "Claude" };
const nick: Author = { kind: "human", id: "nick", name: "Nick" };
const link = (id: string, event: string) => ({ name: "supply", args: { id, event } });

const storeOf = (policy?: Policy) =>
  new Store<AnySchema>({
    schema,
    mutations: [supply, book, rename] as never,
    ...(policy ? { policy } : {}),
    now: () => "2026-10-14T09:00:00.000Z",
    snapshot: {
      nodes: [
        { id: "vendor:bloom", kind: "vendor", label: "Bloom Florals" },
        { id: "vendor:harbor", kind: "vendor", label: "Harbor Catering" },
        { id: "vendor:quill", kind: "vendor", label: "Quill Stationers" },
        { id: "event:gala", kind: "event", label: "Spring gala" },
      ] as never,
      edges: [],
    },
  });

/** The test actor's pass: two links it is sure of, applied; one it is not, suggested. */
function tidy(store: Store<AnySchema>) {
  const first = store.apply(link("vendor:bloom", "event:gala"), { author: actor, lineage: { basis: "The gala's invoice names Bloom", confidence: 0.95 } });
  const second = store.apply(link("vendor:harbor", "event:gala"), { author: actor, lineage: { basis: "Harbor's quote is for the gala", confidence: 0.92 } });
  const waiting = suggest(store, [link("vendor:quill", "event:gala")], { author: actor, lineage: { basis: "Quill printed something in April", confidence: 0.4 } });
  return { first, second, waiting: waiting! };
}

describe("a suggestion that waits", () => {
  it("is held in the log and changes nothing, while the two links the actor is sure of apply with their lineage", () => {
    const store = storeOf();
    const { first, second, waiting } = tidy(store);
    expect(first.ops[0]!.lineage).toEqual({ basis: "The gala's invoice names Bloom", confidence: 0.95 });
    expect(second.ops[0]!.lineage?.basis).toBe("Harbor's quote is for the gala");
    expect(store.graph.allEdges().map((edge) => edge.from).sort()).toEqual(["vendor:bloom", "vendor:harbor"]);
    expect(waiting.suggests).toEqual([link("vendor:quill", "event:gala")]);
    expect(waiting.primitives).toEqual([]);
    expect(suggestions(store).map((one) => [one.id, one.intent, one.lineage?.confidence, one.about])).toEqual([[waiting.id, "Link Quill Stationers to Spring gala", 0.4, ["vendor:quill", "event:gala"]]]);
    // Asked again, the same suggestion is the one that waits: none is added.
    expect(suggest(store, [link("vendor:quill", "event:gala")], { author: actor, lineage: { basis: "Again" } })!.id).toBe(waiting.id);
    expect(suggestions(store)).toHaveLength(1);
  });

  it("is accepted as the person, carrying its lineage, which names it, and then waits no longer", () => {
    const store = storeOf();
    const { waiting } = tidy(store);
    const accepted = acceptSuggestion(store, waiting.id, { author: nick });
    expect(accepted.ops[0]!.author).toEqual(nick);
    expect(accepted.ops[0]!.lineage).toEqual({ basis: "Quill printed something in April", confidence: 0.4, suggestion: waiting.id });
    expect(store.graph.allEdges().some((edge) => edge.from === "vendor:quill")).toBe(true);
    expect(suggestions(store)).toEqual([]);
    expect(() => acceptSuggestion(store, waiting.id, { author: nick })).toThrow(/no longer waiting/);
  });

  it("is declined into the log, and the same proposal is refused next time, in a sentence", () => {
    const store = storeOf();
    const { waiting } = tidy(store);
    const decline = declineSuggestion(store, waiting.id, { author: nick });
    expect(decline.ops[0]).toMatchObject({ undoes: waiting.id, undoneLineage: { basis: "Quill printed something in April", confidence: 0.4 }, author: nick });
    expect(suggestions(store)).toEqual([]);
    expect(declined(store, [link("vendor:quill", "event:gala")])?.id).toBe(decline.ops[0]!.id);
    expect(() => suggest(store, [link("vendor:quill", "event:gala")], { author: actor, lineage: { basis: "Still think so" } })).toThrow(PermissionDeniedError);
    expect(() => suggest(store, [link("vendor:quill", "event:gala")], { author: actor, lineage: { basis: "Still think so" } })).toThrow("Graview, tidying may not make this again: a person declined it on 2026-10-14.");
    // Nor made on its own.
    expect(() => store.apply(link("vendor:quill", "event:gala"), { author: actor, lineage: { basis: "Sure now", confidence: 1 } })).toThrow(/declined/);
    // A person still may, and a decline taken back lets the suggestion wait again.
    store.undo(decline.batch, { author: nick });
    expect(suggestions(store).map((one) => one.id)).toEqual([waiting.id]);
  });

  it("an actor's confident change a person takes back is declined too", () => {
    const store = storeOf();
    const { second } = tidy(store);
    store.undo(second.batch, { author: nick });
    expect(declined(store, [link("vendor:harbor", "event:gala")])).toBeDefined();
    expect(declined(store, [link("vendor:bloom", "event:gala")])).toBeUndefined();
    expect(() => store.apply(link("vendor:harbor", "event:gala"), { author: actor, lineage: { basis: "Again" } })).toThrow(/declined/);
  });

  it("is read under sight: a seat sees only suggestions about what it may see", () => {
    const policy: Policy = {
      grants: [{ roles: "*", mutations: "*" }],
      sees: [
        { roles: ["planner"], kinds: ["vendor", "event"] },
        { roles: ["guest"], kinds: ["event"] },
      ],
    };
    const store = storeOf(policy);
    const { waiting } = tidy(store);
    expect(suggestions(store, { kind: "human", id: "pat", roles: ["planner"] }).map((one) => one.id)).toEqual([waiting.id]);
    expect(suggestions(store, { kind: "human", id: "gus", roles: ["guest"] })).toEqual([]);
    expect(suggestions(store.seenBy({ kind: "human", id: "gus", roles: ["guest"] }))).toEqual([]);
    expect(() => declineSuggestion(store, waiting.id, { author: { kind: "human", id: "gus", roles: ["guest"] } })).toThrow(/no longer waiting/);
  });
});

describe("leave this one alone", () => {
  it("is a mark a person sets and clears with ordinary, undoable acts, which isLeftAlone reads", () => {
    const store = storeOf();
    expect(store.allMutations().map((one) => one.name)).toEqual(expect.arrayContaining(["leave-alone-vendor", "allow-tidying-vendor", "leave-alone-event"]));
    const left = store.apply({ name: "leave-alone-vendor", args: { id: "vendor:quill" } }, { author: nick });
    expect(left.ops[0]!.intent).toBe("Leave alone Quill Stationers");
    expect(isLeftAlone(store, "vendor:quill")).toBe(true);
    expect(store.wouldChange({ name: "leave-alone-vendor", args: { id: "vendor:quill" } })).toBe(false);
    store.undo(left.batch, { author: nick });
    expect(isLeftAlone(store, "vendor:quill")).toBe(false);
  });

  it("refuses the actor's change to a record left alone, and a suggestion about it, in a sentence; a person and a chat seat still may", () => {
    const store = storeOf();
    store.apply({ name: "leave-alone-vendor", args: { id: "vendor:quill" } }, { author: nick });
    const before = store.log.length;
    expect(() => store.apply(link("vendor:quill", "event:gala"), { author: actor, lineage: { basis: "Sure", confidence: 0.99 } })).toThrow("Graview, tidying may not change “Quill Stationers”: a person said to leave it alone.");
    expect(() => store.apply({ name: "rename-vendor", args: { id: "vendor:quill", label: "Quill" } }, { author: actor })).toThrow(PermissionDeniedError);
    expect(() => suggest(store, [link("vendor:quill", "event:gala")], { author: actor, lineage: { basis: "Maybe" } })).toThrow(/leave it alone/);
    expect(store.log.length).toBe(before);
    expect(store.graph.allEdges()).toEqual([]);
    store.apply(link("vendor:quill", "event:gala"), { author: chat });
    store.apply({ name: "rename-vendor", args: { id: "vendor:quill", label: "Quill & Co" } }, { author: nick });
    store.apply({ name: "allow-tidying-vendor", args: { id: "vendor:quill" } }, { author: nick });
    expect(store.apply({ name: "rename-vendor", args: { id: "vendor:quill", label: "Quill Stationers" } }, { author: actor }).ops).toHaveLength(1);
  });

  it("is kept with the record wherever it goes: through a snapshot and a fold of the log", () => {
    const store = storeOf();
    store.apply({ name: "leave-alone-vendor", args: { id: "vendor:quill" } }, { author: nick });
    const again = new Store<AnySchema>({ schema, mutations: [supply, book, rename] as never, snapshot: JSON.parse(JSON.stringify(store.snapshot())) });
    expect(isLeftAlone(again, "vendor:quill")).toBe(true);
    expect(store.verify().ok).toBe(true);
  });
});

describe("what the declaration says is never tidied", () => {
  it("is refused to the actor on its own, while it may still suggest it for a person to decide", () => {
    const store = storeOf();
    expect(() => store.apply({ name: "book", args: { id: "vendor:bloom", event: "event:gala" } }, { author: actor })).toThrow("Graview, tidying may not make a “books” link on its own: the app says that relation is never tidied.");
    const waiting = suggest(store, [{ name: "book", args: { id: "vendor:bloom", event: "event:gala" } }], { author: actor, lineage: { basis: "Bloom's contract" } });
    expect(waiting?.suggests).toHaveLength(1);
    expect(acceptSuggestion(store, waiting!.id, { author: nick }).ops).toHaveLength(1);
  });

  it("says a kind never linked automatically, or never tidied at all, in a sentence", () => {
    const quiet = createSchema([defineNode("vendor", { fields: z.object({ label: z.string() }), tidying: "no-links", edges: { supplies: { to: ["event"] } } }), defineNode("event", { fields: z.object({ label: z.string() }), tidying: "never" })]);
    const graph = { getNode: (id: string) => ({ "vendor:bloom": { id, kind: "vendor", label: "Bloom" }, "event:gala": { id, kind: "event", label: "Gala" } })[id] };
    expect(tidyingRefusal(quiet, graph, [{ op: "patch-node", id: "event:gala", before: {}, after: { label: "Ball" } }], "Tidying")).toBe("Tidying may not change events on its own: the app says they are never tidied.");
    expect(tidyingRefusal(quiet, graph, [{ op: "add-edge", edge: { kind: "supplies", from: "vendor:bloom", to: "vendor:bloom" } }], "Tidying")).toBe("Tidying may not link or unlink vendors on its own: the app says they are never linked automatically.");
    expect(tidyingRefusal(quiet, graph, [{ op: "patch-node", id: "vendor:bloom", before: {}, after: { label: "B" } }], "Tidying")).toBeUndefined();
    // A kind never tidied is given no leave-alone acts: all of it is left alone.
    const names = new Store<AnySchema>({ schema: quiet }).allMutations().map((one) => one.name);
    expect(names).toContain("leave-alone-vendor");
    expect(names).not.toContain("leave-alone-event");
  });
});

describe("a digest in Activity", () => {
  it("folds consecutive batches by one automated author into one row, and never a person's or a chat seat's", () => {
    const store = storeOf();
    store.apply(link("vendor:bloom", "event:gala"), { author: nick });
    tidy(store);
    store.apply({ name: "rename-vendor", args: { id: "vendor:quill", label: "Quill" } }, { author: actor });
    store.apply({ name: "rename-vendor", args: { id: "vendor:quill", label: "Quill Co" } }, { author: chat });
    store.apply({ name: "rename-vendor", args: { id: "vendor:quill", label: "Quill & Co" } }, { author: chat });
    const rows = foldDigests(store.batches(), (id) => store.log.get(id));
    expect(rows.map((row) => ("digest" in row ? `digest:${row.digest.batches.length}:${row.digest.things}` : row.batch.author.id))).toEqual(["nick", "digest:3:3", "claude", "claude"]);
    const digest = rows[1] as Extract<(typeof rows)[number], { digest: unknown }>;
    expect(digestWords(digest.digest, "2026-10-14")).toBe("Tidied 3 things today");
    expect(digestWords({ things: 1, at: "2026-10-12T10:00:00Z" }, "2026-10-14")).toBe("Tidied one thing on Oct 12");
    expect(digest.digest.batches.map((batch) => batch.lineage?.basis)).toEqual(["The gala's invoice names Bloom", "Harbor's quote is for the gala", undefined]);
    expect(isAutomated(actor)).toBe(true);
    expect(isAutomated(chat)).toBe(false);
    expect(isAutomated({ kind: "human", automated: true })).toBe(false);
  });
});
