import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, PUBLISH, Store, type Principal, type Publishing } from "../../src/index.js";
import "../../src/publishing.js";

/**
 * A COMPACTION CARRIES WHAT READERS WERE SERVED PAST OLD PUBLISHES
 * (Roadmap f-publishing-lifecycle, FR-23). Undoing a publish takes readers
 * back to the one before it, which they are served as the app stood then.
 * That past was folded from the log, so a compaction was held at the
 * publish before the latest — and at the latest itself — and an app that
 * publishes rarely kept a log that only grew. Now the checkpoint keeps the
 * app as it stood at each published seq behind it that readers may still
 * be served, and the horizon moves past old publishes.
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
const reopened = (store: Store<typeof schema>) => new Store({ schema, mutations: [add], policy, publishing, log: store.log.all(), epochs: store.log.epochs() });

describe("a compaction carries what readers were served past old publishes", () => {
  it("advances past the publish before the latest, and undoing the latest still serves readers that publish", () => {
    const store = fresh();
    note_(store, "One");
    const first = publish(store);
    note_(store, "Two");
    note_(store, "Three");
    const latest = publish(store);
    note_(store, "Four");
    const p1 = first.ops[0]!.publishedThrough!;
    const p2 = latest.ops[0]!.publishedThrough!;

    // Past P1 and past the change after it — the publish an undo of P2 goes back to is behind the horizon.
    const checkpoint = store.checkpoint({ seq: p2 - 1 })!;
    expect(checkpoint.seq).toBe(p2 - 1);
    expect(checkpoint.seq).toBeGreaterThan(p1);
    store.compact(checkpoint);
    expect(store.log.horizon).toBeGreaterThan(p1);
    expect(readerSees(store)).toEqual(["One", "Three", "Two"]);

    expect(store.canUndo(latest.batch).ok).toBe(true);
    store.undo(latest.batch, { author: editor });
    expect(store.publishedSeq).toBe(p1);
    expect(readerSees(store)).toEqual(["One"]);
    // And as a store opened on the checkpoint and the tail is served it.
    expect(readerSees(reopened(store))).toEqual(["One"]);
  });

  it("is no longer held at an old publish in an app that publishes rarely", () => {
    const store = fresh();
    note_(store, "One");
    publish(store);
    for (const label of ["Two", "Three", "Four", "Five", "Six"]) note_(store, label);
    const checkpoint = store.checkpoint({ keepOps: 1, keepDays: 0 })!;
    expect(checkpoint.seq).toBe(store.log.length - 1);
    store.compact(checkpoint);
    expect(store.publishedSeq).toBe(2);
    expect(readerSees(store)).toEqual(["One"]);
    expect(readerSees(reopened(store))).toEqual(["One"]);

    // And again, carrying what readers are served from the checkpoint before it.
    note_(store, "Seven");
    note_(store, "Eight");
    const again = store.checkpoint({ keepOps: 1, keepDays: 0 })!;
    expect(again.seq).toBe(store.log.length - 1);
    store.compact(again);
    expect(readerSees(store)).toEqual(["One"]);
    expect(readerSees(reopened(store))).toEqual(["One"]);

    // A publish now serves readers everything, and undoing it takes them back to what stood published before.
    const next = publish(store);
    expect(readerSees(store)).toEqual(["Eight", "Five", "Four", "One", "Seven", "Six", "Three", "Two"]);
    store.undo(next.batch, { author: editor });
    expect(readerSees(store)).toEqual(["One"]);
  });

  it("never serves a seat the app as it stood at a published seq through the log's epochs", () => {
    const store = fresh();
    note_(store, "One");
    publish(store);
    note_(store, "Two");
    note_(store, "Three");
    store.compact(store.checkpoint({ keepOps: 1, keepDays: 0 })!);
    expect(store.log.horizonEpoch()?.published?.length).toBe(1);
    const seen = store.seenBy(editor).log;
    expect(seen.epochs().every((epoch) => epoch.published === undefined)).toBe(true);
    expect(seen.horizonEpoch()?.published).toBeUndefined();
  });
});
