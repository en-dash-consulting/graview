import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, PUBLISH, Store, type Principal, type Publishing } from "../../src/index.js";
import "../../src/publishing.js";

/**
 * A PUBLISH UNDONE PAST A COMPACTION TAKES READERS BACK (Roadmap
 * f-publishing-lifecycle, FR-23). How far readers are served was read only
 * from the publish ops in the log's tail, and a compaction was held back
 * only by the latest one: it could archive the publish before it, and
 * undoing the latest then served readers the horizon — the very changes
 * the publisher meant to withdraw. And once the last publish op was
 * archived the store knew of no publish at all, so it never compacted
 * again. Now the checkpoint keeps what stood published at its seq, a
 * compaction stops at the publish an undo would go back to, and an undo
 * that would take readers behind the horizon is refused rather than
 * serving them the horizon.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-note", {
  title: "Add a note",
  creates: ["note"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "n"), kind: "note", label: args.label } as never);
  },
});
const editor: Principal = { kind: "human", id: "pat", name: "Pat", roles: ["editor"] };
const reader: Principal = { kind: "human", id: "rae", name: "Rae", roles: ["reader"] };
const publishing: Publishing = { mode: "on-publish", working: ["editor"], publishers: ["editor"] };
const policy = { grants: [{ roles: ["editor"], mutations: "*" as const }], sees: [{ roles: "*" as const, kinds: ["note"] }] };

const fresh = () => new Store({ schema, mutations: [add], policy, publishing, snapshot: { nodes: [], edges: [] } as never });
const note_ = (store: Store<typeof schema>, label: string) => store.apply({ name: "add-note", args: { label } }, { author: editor });
const publish = (store: Store<typeof schema>) => store.apply({ name: PUBLISH, args: {} }, { author: editor });
const readerSees = (store: Store<typeof schema>) => store.seenBy(reader).graph.allNodes().map((node) => node.label).sort();

function twoPublishes(compact: boolean) {
  const store = fresh();
  note_(store, "One");
  publish(store);
  note_(store, "Two");
  const latest = publish(store);
  if (compact) {
    const checkpoint = store.checkpoint({ keepOps: 1, keepDays: 0 });
    if (checkpoint) store.compact(checkpoint);
  }
  return { store, latest };
}

describe("a publish undone past a compaction takes readers back", () => {
  it("serves readers what the publish before it served, as a store never compacted does", () => {
    const plain = twoPublishes(false);
    plain.store.undo(plain.latest.batch, { author: editor });
    const compacted = twoPublishes(true);
    compacted.store.undo(compacted.latest.batch, { author: editor });
    expect(readerSees(plain.store)).toEqual(["One"]);
    expect(readerSees(compacted.store)).toEqual(["One"]);
    expect(compacted.store.publishedSeq).toBe(plain.store.publishedSeq);
  });

  it("keeps what stood published in the checkpoint, so a store whose publish op was archived still knows it and compacts again", () => {
    const store = fresh();
    note_(store, "One");
    publish(store);
    note_(store, "Two");
    note_(store, "Three");
    const first = store.checkpoint({ keepOps: 1, keepDays: 0 })!;
    expect(first.seq).toBe(3);
    expect(first.publishedThrough).toBe(2);
    store.compact(first);
    expect(store.log.all().some((op) => op.publishedThrough !== undefined)).toBe(false);
    expect(store.publishedSeq).toBe(2);

    const opened = new Store({ schema, mutations: [add], policy, publishing, log: store.log.all(), epochs: store.log.epochs() });
    expect(opened.publishedSeq).toBe(2);
    expect(readerSees(opened)).toEqual(["One"]);

    // The publish an undo would go back to no longer holds the horizon: the checkpoint keeps the app as it stood there (`published`).
    publish(store);
    note_(store, "Four");
    const second = store.checkpoint({ keepOps: 1, keepDays: 0 });
    expect(second?.seq).toBe(store.log.length - 1);
    expect(second?.publishedThrough).toBe(second?.seq);
  });

  it("refuses an undo that would take readers behind the horizon, rather than serving them the horizon", () => {
    const store = fresh();
    note_(store, "One");
    publish(store);
    note_(store, "Two");
    publish(store);
    note_(store, "Three");
    // A checkpoint written before it kept what stood published, past both publishes, as a host's older compaction left it.
    store.compact(store.log.checkpointAt(schema, store.log.length));
    note_(store, "Four");
    const latest = publish(store);
    expect(readerSees(store)).toEqual(["Four", "One", "Three", "Two"]);
    expect(store.canUndo(latest.batch).ok).toBe(false);
    expect(() => store.undo(latest.batch, { author: editor })).toThrow(/behind the undo horizon/);
    expect(readerSees(store)).toEqual(["Four", "One", "Three", "Two"]);
  });

  it("still undoes a publish whose predecessor the log holds", () => {
    const store = fresh();
    note_(store, "One");
    publish(store);
    note_(store, "Two");
    publish(store);
    store.compact(store.log.checkpointAt(schema, store.log.length));
    note_(store, "Three");
    publish(store);
    note_(store, "Four");
    const latest = publish(store);
    store.undo(latest.batch, { author: editor });
    expect(readerSees(store)).toEqual(["One", "Three", "Two"]);
  });

  it("opens a checkpoint written before it kept what stood published, knowing only the publishes in its tail", () => {
    const store = fresh();
    note_(store, "One");
    publish(store);
    note_(store, "Two");
    note_(store, "Three");
    // Where an older build stopped: at what stood published.
    store.compact(store.checkpoint({ seq: 2 })!);
    const { publishedThrough: _kept, published: _published, ...older } = store.log.epochs()[0]!;
    const opened = new Store({ schema, mutations: [add], policy, publishing, log: store.log.all(), epochs: [older] });
    expect(opened.publishedSeq).toBeUndefined();
    expect(readerSees(opened)).toEqual(["One"]);
  });
});
