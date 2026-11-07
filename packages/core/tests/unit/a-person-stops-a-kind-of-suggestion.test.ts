import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, nodeRef, Store, z, type Author, type Principal } from "../../src/index.js";
import { acceptSuggestion, foldDigests, stoppedKind, propose, stoppedSuggestions, stopSuggesting, suggest, suggestions } from "../../src/tidying.js";

/**
 * "DON'T SUGGEST THIS KIND OF THING" (Roadmap f-inbox-needs-you-first). A
 * person who keeps saying No had no way out: the actor found the next note
 * to put in the next chapter. Stopping a kind answers every change of that
 * act, in the log, for everyone, and one undo takes it back.
 */
const chapter = defineNode("chapter", { fields: z.object({ label: z.string() }), plural: "Chapters" });
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes", edges: { "in-chapter": { to: ["chapter"], cardinality: "one" } } });
const schema = createSchema([chapter, note]);
const { defineMutation } = bindSchema(schema);
const pin = defineMutation("pin-note", {
  title: "Pin it",
  subject: { kinds: ["note"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["note"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: "Pinned" });
  },
});
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const nora: Principal = { kind: "human", id: "nora", name: "Nora" };
const lineage = { basis: "Both are about direction", confidence: 0.8 };
const inChapter = (id: string, to = "ch") => ({ name: "connect-note-in-chapter", args: { id, to } });
const SNAPSHOT = {
  nodes: [
    { id: "ch", kind: "chapter", label: "One" },
    { id: "ch2", kind: "chapter", label: "Two" },
    { id: "a", kind: "note", label: "A" },
    { id: "b", kind: "note", label: "B" },
    { id: "c", kind: "note", label: "C" },
  ],
  edges: [],
};
const storeOf = () => new Store({ schema, mutations: [pin], snapshot: SNAPSHOT as never });

describe("stopping a kind of suggestion", () => {
  it("takes what else waits of that kind out of the tray, and leaves the other kinds", () => {
    const store = storeOf();
    const first = suggest(store, [inChapter("a")], { author: actor, lineage })!;
    suggest(store, [inChapter("b")], { author: actor, lineage });
    suggest(store, [{ name: "archive-note", args: { id: "c" } }], { author: actor, lineage });
    stopSuggesting(store, first.id, { author: nora });
    expect(suggestions(store).map((one) => one.calls[0]!.name)).toEqual(["archive-note"]);
  });

  it("holds the app's own actor to it, for a record and a place it has not suggested before", () => {
    const store = storeOf();
    stopSuggesting(store, suggest(store, [inChapter("a")], { author: actor, lineage })!.id, { author: nora });
    expect(stoppedKind(store, [inChapter("c", "ch2")])).toBeDefined();
    expect(() => suggest(store, [inChapter("c", "ch2")], { author: actor, lineage })).toThrow(/may not suggest this kind of thing/);
    // Asked for under another spelling, it is the same kind of thing.
    expect(() => suggest(store, [{ name: "connect_note_in_chapter", args: { id: "c", to: "ch" } }], { author: actor, lineage })).toThrow(/may not suggest this kind of thing/);
    // Another kind of thing is still the actor's to suggest.
    expect(suggest(store, [{ name: "archive-note", args: { id: "c" } }], { author: actor, lineage })).toBeDefined();
  });

  it("is undone by one undo: what it took out waits again, and the actor may suggest that kind", () => {
    const store = storeOf();
    const first = suggest(store, [inChapter("a")], { author: actor, lineage })!;
    suggest(store, [inChapter("b")], { author: actor, lineage });
    const stopped = stopSuggesting(store, first.id, { author: nora });
    expect(stoppedSuggestions(store).map((one) => one.batch)).toEqual([stopped.batch]);
    expect(stoppedSuggestions(store)[0]!.words).toBe("Stopped suggesting “in chapter” links");
    store.undo(stopped.batch, { author: nora });
    expect(suggestions(store)).toHaveLength(2);
    expect(stoppedSuggestions(store)).toEqual([]);
    expect(stoppedKind(store, [inChapter("c", "ch2")])).toBeUndefined();
    expect(suggest(store, [inChapter("c", "ch2")], { author: actor, lineage })).toBeDefined();
  });

  it("is remembered: a store opened from the log holds to it", () => {
    const store = storeOf();
    stopSuggesting(store, suggest(store, [inChapter("a")], { author: actor, lineage })!.id, { author: nora });
    const again = new Store({ schema, mutations: [pin], snapshot: SNAPSHOT as never, ops: store.log.all() } as never);
    for (const op of store.log.all()) if (!again.log.get(op.id)) again.log.append(op);
    expect(() => suggest(again, [inChapter("b")], { author: actor, lineage })).toThrow(/may not suggest this kind of thing/);
  });

  it("is a row of what has happened, where an ordinary decline is not", () => {
    const store = storeOf();
    const stopped = stopSuggesting(store, suggest(store, [inChapter("a")], { author: actor, lineage })!.id, { author: nora });
    const rows = foldDigests(store.batches(), (id) => store.log.get(id));
    expect(rows.map((row) => ("batch" in row ? row.batch.id : ""))).toEqual([stopped.batch]);
  });

  it("does not silence a person: a proposal of that kind still waits, and a proposal cannot be stopped", () => {
    const store = storeOf();
    const stopped = suggest(store, [inChapter("a")], { author: actor, lineage })!;
    const proposed = propose(store, nora, [inChapter("b")], "Put B in One")!;
    stopSuggesting(store, stopped.id, { author: nora });
    expect(suggestions(store).map((one) => one.id)).toEqual([proposed.id]);
    expect(() => stopSuggesting(store, proposed.id, { author: nora })).toThrow(/A person proposed this/);
    expect(acceptSuggestion(store, proposed.id, { author: nora }).ops.length).toBeGreaterThan(0);
  });
});
