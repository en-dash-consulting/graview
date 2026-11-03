import { describe, expect, it } from "vitest";
import { z } from "zod";
import { declined, declinesIn } from "../../src/tidying.js";
import { createSchema, defineNode, Store, type AnySchema, type Author } from "../../src/index.js";

/**
 * A CHANGE A PERSON TOOK BACK IS NEVER MADE AGAIN BY THE APP'S OWN ACTOR.
 * Seen on Threat Watch: a link the owner undid was made again three nights
 * later. A decline was only an undo of a suggestion or of a change carrying
 * lineage; now a person's live undo of any change, whoever made it, is
 * one, so is a person breaking a link (the matching connect is declined),
 * and the checkpoint keeps them (`Epoch.declines`), so a compaction that
 * archives the undo with the change it took back does not forget it.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }), edges: { supplies: { to: ["event"] } } });
const event = defineNode("event", { fields: z.object({ label: z.string() }) });
const schema = createSchema([vendor, event]);

const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const chat: Author = { kind: "agent", id: "claude", name: "Claude" };
const nick: Author = { kind: "human", id: "nick", name: "Nick" };
const ada: Author = { kind: "human", id: "ada", name: "Ada" };
const connect = (id: string, to: string) => ({ name: "connect-vendor-supplies", args: { id, to } });
const disconnect = (id: string, to: string) => ({ name: "disconnect-vendor-supplies", args: { id, to } });
const rename = (label: string) => ({ name: "edit-vendor", args: { id: "vendor:bloom", label } });

const seed = {
  nodes: [
    { id: "vendor:quill", kind: "vendor", label: "Quill Stationers" },
    { id: "vendor:bloom", kind: "vendor", label: "Bloom Florals" },
    { id: "event:gala", kind: "event", label: "Spring gala" },
  ],
  edges: [],
};
const storeOf = () => new Store<AnySchema>({ schema, now: () => "2026-10-14T09:00:00.000Z", snapshot: seed as never });
const refusalOf = (run: () => unknown): string | undefined => {
  try {
    run();
    return undefined;
  } catch (error) {
    return (error as Error).message;
  }
};
const sure = { basis: "Both name the gala", confidence: 0.99 };

describe("a change a person took back is never made again", () => {
  it("counts a person's undo of a link an agent made without lineage as a decline", () => {
    const store = storeOf();
    const made = store.apply(connect("vendor:quill", "event:gala"), { author: chat });
    store.undo(made.batch, { author: nick });
    expect(declined(store, [connect("vendor:quill", "event:gala")])?.author).toMatchObject(nick);
    expect(refusalOf(() => store.apply(connect("vendor:quill", "event:gala"), { author: actor, lineage: sure }))).toMatch(/declined/);
  });

  it("counts a person's undo of a link another person made as a decline", () => {
    const store = storeOf();
    const made = store.apply(connect("vendor:quill", "event:gala"), { author: ada });
    store.undo(made.batch, { author: nick });
    expect(declined(store, [connect("vendor:quill", "event:gala")])).toBeDefined();
  });

  it("does not count an agent's undo, or an undo a person took back in turn", () => {
    const store = storeOf();
    const made = store.apply(connect("vendor:quill", "event:gala"), { author: chat });
    store.undo(made.batch, { author: chat });
    expect(declined(store, [connect("vendor:quill", "event:gala")])).toBeUndefined();
    const again = store.apply(connect("vendor:bloom", "event:gala"), { author: chat });
    const back = store.undo(again.batch, { author: nick });
    store.undo(back.batch, { author: nick });
    expect(declined(store, [connect("vendor:bloom", "event:gala")])).toBeUndefined();
  });

  it("counts a person unlinking a link as declining that link, and a person linking it again lifts it", () => {
    const store = storeOf();
    store.apply(connect("vendor:quill", "event:gala"), { author: actor, lineage: { basis: "Both name the gala", confidence: 0.95 } });
    store.apply(disconnect("vendor:quill", "event:gala"), { author: nick });
    expect(declined(store, [connect("vendor:quill", "event:gala")])?.author).toMatchObject(nick);
    expect(refusalOf(() => store.apply(connect("vendor:quill", "event:gala"), { author: actor, lineage: sure }))).toMatch(/declined/);
    expect(declined(store, [connect("vendor:bloom", "event:gala")])).toBeUndefined();
    store.apply(connect("vendor:quill", "event:gala"), { author: nick });
    expect(declined(store, [connect("vendor:quill", "event:gala")])).toBeUndefined();
  });

  it("does not count an unlink a person took back", () => {
    const store = storeOf();
    store.apply(connect("vendor:quill", "event:gala"), { author: chat });
    const cut = store.apply(disconnect("vendor:quill", "event:gala"), { author: nick });
    store.undo(cut.batch, { author: nick });
    expect(declined(store, [connect("vendor:quill", "event:gala")])).toBeUndefined();
  });

  it("keeps a decline in the checkpoint, so the next night does not make it again once the undo is archived", () => {
    const store = storeOf();
    const made = store.apply(connect("vendor:quill", "event:gala"), { author: actor, lineage: { basis: "Both name the gala", confidence: 0.95 } });
    store.undo(made.batch, { author: nick });
    for (const label of ["A", "B", "C"]) store.apply(rename(label), { author: nick });
    const checkpoint = store.checkpoint({ keepOps: 1, keepDays: 0 })!;
    expect(Object.keys(checkpoint.declines ?? {}).length).toBeGreaterThan(0);
    store.compact(checkpoint);
    expect(store.log.all().some((op) => op.undoes !== undefined)).toBe(false);
    expect(refusalOf(() => store.apply(connect("vendor:quill", "event:gala"), { author: actor, lineage: sure }))).toBe("Graview, tidying may not make this again: a person declined it on 2026-10-14.");
    // A store opened on the checkpoint and its tail knows it too, and a second compaction carries it.
    const opened = new Store<AnySchema>({ schema, log: store.log.all(), epochs: store.log.epochs(), now: () => "2026-10-20T09:00:00.000Z" });
    expect(declined(opened, [connect("vendor:quill", "event:gala")])?.at).toBe("2026-10-14T09:00:00.000Z");
    for (const label of ["D", "E"]) opened.apply(rename(label), { author: nick });
    opened.compact(opened.checkpoint({ keepOps: 1, keepDays: 0 })!);
    expect(refusalOf(() => opened.apply(connect("vendor:quill", "event:gala"), { author: actor, lineage: sure }))).toMatch(/declined/);
  });

  it("keeps a decline whose undo is in the tail when the change it took back is archived", () => {
    const store = storeOf();
    const made = store.apply(connect("vendor:quill", "event:gala"), { author: chat });
    for (const label of ["A", "B"]) store.apply(rename(label), { author: nick });
    store.undo(made.batch, { author: nick });
    const checkpoint = store.checkpoint({ seq: 2 })!;
    store.compact(checkpoint);
    expect(store.log.all().some((op) => op.undoes !== undefined)).toBe(true);
    expect(declined(store, [connect("vendor:quill", "event:gala")])).toBeDefined();
  });

  it("opens a checkpoint written before it kept declines as it did", () => {
    const store = storeOf();
    for (const label of ["A", "B", "C"]) store.apply(rename(label), { author: nick });
    const { declines: _declines, ...older } = store.checkpoint({ keepOps: 1, keepDays: 0 })!;
    store.compact(older);
    const opened = new Store<AnySchema>({ schema, log: store.log.all(), epochs: store.log.epochs() });
    expect(declinesIn(opened.log.all(), undefined, opened.log.horizonEpoch()?.declines).size).toBe(0);
    expect(opened.apply(connect("vendor:quill", "event:gala"), { author: actor, lineage: { basis: "Both name the gala" } }).ops).toHaveLength(1);
  });
});
