import { describe, expect, it } from "vitest";
import { createSchema, defineMutation, defineNode, PermissionDeniedError, Store, z, type Policy, type Principal } from "../../src/index.js";

/**
 * AN UNDO IS JUDGED AS THE CHANGE IT MAKES.
 *
 * Undoing an act is judged as the act, asked again for whoever undoes it.
 * An op no act made was let through unasked: every undo is one (so redo,
 * the undo of an undo, put back an act its seat was refused), and every
 * change a host applied as primitives — an import, a sync, a connection, a
 * repair — was anybody's to take back. Now an undo of an undo is judged as
 * the act it puts back, and a change no act made is taken back only by the
 * system, by whoever made it, or by a seat granted every act.
 */
const note = defineNode("note", { fields: z.object({ label: z.string().min(1) }) });
const publish = defineMutation("publish", {
  title: "Publish a note",
  creates: ["note"],
  input: z.object({ id: z.string(), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "note", label: args.label });
  },
});
const schema = createSchema([note]);
const admin: Principal = { kind: "human", id: "ada", roles: ["admin"] };
const guest: Principal = { kind: "human", id: "gus", roles: ["guest"] };
const policy: Policy = { roles: ["admin", "guest"], grants: [{ roles: ["admin"], mutations: ["publish"] }] };
const storeOf = (given: Policy = policy) => new Store({ schema, mutations: [publish], policy: given, snapshot: { nodes: [], edges: [] } as never });
const imported = (store: ReturnType<typeof storeOf>, author: Principal = { kind: "system", id: "sync" }) =>
  store.applyPrimitives([{ op: "add-node", node: { id: "note:synced", kind: "note", label: "Synced" } as never }], { author });

describe("an undo of an undo", () => {
  it("is judged as the act it puts back: a seat refused the act may not redo it", () => {
    const store = storeOf();
    const published = store.apply({ name: "publish", args: { id: "n1", label: "Draft" } }, { author: admin });
    const undone = store.undo(published.batch, { author: admin });
    expect(() => store.redo(undone.batch, { author: guest })).toThrow(PermissionDeniedError);
    expect(() => store.undo(undone.batch, { author: guest })).toThrow(/Not permitted to undo/);
    expect(store.graph.getNode("n1")).toBeUndefined();
    // The seat the act is granted to redoes it, as before; and undoes that again.
    const redone = store.redo(undone.batch, { author: admin });
    expect(store.graph.getNode("n1")).toBeDefined();
    expect(() => store.undo(redone.batch, { author: guest })).toThrow(PermissionDeniedError);
    store.undo(redone.batch, { author: admin });
    expect(store.graph.getNode("n1")).toBeUndefined();
  });
});

describe("a change no act made", () => {
  it("is not taken back by a seat with no grant", () => {
    const store = storeOf();
    const sync = imported(store);
    expect(() => store.undo(sync.batch, { author: guest })).toThrow(PermissionDeniedError);
    expect(store.graph.getNode("note:synced")).toBeDefined();
  });

  it("is taken back by the system, by whoever made it, and by a seat granted every act", () => {
    const bySystem = storeOf();
    bySystem.undo(imported(bySystem).batch, { author: { kind: "system", id: "host" } });
    expect(bySystem.graph.getNode("note:synced")).toBeUndefined();

    const byItsAuthor = storeOf();
    byItsAuthor.undo(imported(byItsAuthor, guest).batch, { author: guest });
    expect(byItsAuthor.graph.getNode("note:synced")).toBeUndefined();

    const byEveryAct = storeOf({ grants: [{ roles: "*", mutations: "*" }] });
    byEveryAct.undo(imported(byEveryAct).batch, { author: guest });
    expect(byEveryAct.graph.getNode("note:synced")).toBeUndefined();
  });

  it("is anybody's to take back where the app has no policy", () => {
    const store = new Store({ schema, mutations: [publish], snapshot: { nodes: [], edges: [] } as never });
    store.undo(imported(store as never).batch, { author: guest });
    expect(store.graph.getNode("note:synced")).toBeUndefined();
  });
});

describe("what a page offers to take back", () => {
  it("is what the store would take back: mayUndo answers as undo judges, so nothing offered is then refused", () => {
    const store = storeOf();
    const sync = imported(store);
    const published = store.apply({ name: "publish", args: { id: "n2", label: "Draft" } }, { author: admin });
    // A change no act made: refused to the guest, offered to the system.
    expect(store.mayUndo(sync.batch, guest).ok).toBe(false);
    expect(store.mayUndo(sync.batch, { kind: "system", id: "host" }).ok).toBe(true);
    // An act: offered to whoever may do it, and to nobody else.
    expect(store.mayUndo(published.batch, admin).ok).toBe(true);
    expect(store.mayUndo(published.batch, guest).ok).toBe(false);
    // Every answer agrees with what undo then does: the refused ones throw, the offered one takes it back.
    expect(() => store.undo(sync.batch, { author: guest })).toThrow(PermissionDeniedError);
    expect(() => store.undo(published.batch, { author: guest })).toThrow(PermissionDeniedError);
    store.undo(published.batch, { author: admin });
    expect(store.graph.getNode("n2")).toBeUndefined();
  });
});
