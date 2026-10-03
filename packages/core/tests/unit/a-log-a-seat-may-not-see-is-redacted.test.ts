import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  checkUndo,
  createSchema,
  defineNode,
  isWithheld,
  nodeRef,
  OperationLog,
  Store,
  UndoBlockedError,
  WITHHELD_INTENT,
  type Policy,
  type Principal,
} from "../../src/index.js";

/**
 * A LOG A SEAT MAY NOT FULLY SEE IS REDACTED, NOT GAPPED (FR-16). A store
 * that keeps a customer from a stranger kept the ops that touched them out
 * of the stranger's log — and a log with a hole in its seq is a log that
 * `OperationLog.from` refuses, so a served store had nothing it could send.
 * The op stays, withheld: its place, and nothing that says what it was.
 */
const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars" });
const shopper = defineNode("shopper", { fields: z.object({ label: z.string() }), plural: "Shoppers" });
const enquiry = defineNode("enquiry", {
  fields: z.object({ label: z.string(), note: z.string().optional() }),
  plural: "Enquiries",
  edges: { from: { to: ["shopper"], cardinality: "one", description: "who asked", inverse: "their enquiries" } },
});
const schema = createSchema([car, shopper, enquiry]);
const { defineMutation } = bindSchema(schema);
const ask = defineMutation("ask", {
  title: "Ask",
  subject: { kinds: ["shopper"], arg: "shopperId" },
  creates: ["enquiry"],
  input: z.object({ shopperId: nodeRef(["shopper"]), label: z.string() }),
  describe: (args) => `Ask “${args.label}”`,
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "enquiry");
    ctx.addNode({ id, kind: "enquiry", label: args.label });
    ctx.addEdge({ kind: "from", from: id, to: args.shopperId });
  },
});
const compare = defineMutation("compare", {
  title: "Compare",
  subject: { kinds: ["enquiry"], arg: "id" },
  writes: ["note"],
  input: z.object({ id: nodeRef(["enquiry"]), other: nodeRef(["shopper"]) }),
  describe: (args, graph) => `Compare with ${(graph.getNode(args.other) as { label?: string } | undefined)?.label ?? args.other}`,
  apply(ctx, args) {
    const other = ctx.graph.getNode(args.other) as { label: string };
    ctx.patchNode(args.id, { note: `like ${other.label}` });
  },
});
const rename = defineMutation("rename-car", {
  title: "Rename the car",
  subject: { kinds: ["car"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["car"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const policy: Policy = {
  grants: [{ roles: ["shopper"], mutations: ["ask"], self: true }, { roles: ["staff"], mutations: "*" }],
  sees: [
    { roles: "*", kinds: ["car"] },
    { roles: ["staff"], kinds: ["shopper", "enquiry"] },
    { roles: ["shopper"], kinds: ["shopper", "enquiry"], own: true },
  ],
};
const bethan: Principal = { kind: "human", id: "shopper:bethan", roles: ["shopper"] };
const staff: Principal = { kind: "human", id: "staff:rhian", roles: ["staff"] };

/** Freya asks first, Bethan asks, staff rename the car and compare Bethan's enquiry with Freya. */
function showroom() {
  const store = new Store({
    schema,
    mutations: [ask, compare, rename],
    policy,
    snapshot: {
      nodes: [
        { id: "car:golf", kind: "car", label: "Golf" },
        { id: "shopper:bethan", kind: "shopper", label: "Bethan Okonkwo" },
        { id: "shopper:freya", kind: "shopper", label: "Freya Davies" },
      ] as never,
      edges: [],
    },
  });
  const freya: Principal = { kind: "human", id: "shopper:freya", roles: ["shopper"] };
  const theirs = store.apply({ name: "ask", args: { shopperId: "shopper:freya", label: "Finance on the Golf" } }, { author: freya });
  const mine = store.apply({ name: "ask", args: { shopperId: "shopper:bethan", label: "Is it still there" } }, { author: bethan });
  const renamed = store.apply({ name: "rename-car", args: { id: "car:golf", label: "Golf GTI" } }, { author: staff });
  const compared = store.apply({ name: "compare", args: { id: "enquiry:is-it-still-there", other: "shopper:freya" } }, { author: staff });
  return { store, theirs, mine, renamed, compared };
}

describe("a log a seat may not fully see", () => {
  it("keeps every op in its place and withholds the ones that touched what the seat may not see", () => {
    const { store } = showroom();
    const ops = store.seenBy(bethan).log.all();
    expect(ops.map((op) => op.seq)).toEqual([0, 1, 2, 3]);
    expect(ops.map((op) => isWithheld(op))).toEqual([true, false, false, true]);
    expect(() => OperationLog.from(ops)).not.toThrow();
  });

  it("says nothing of a withheld op: not who, not what, not what it touched that the seat may not see", () => {
    const { store } = showroom();
    const said = JSON.stringify(store.seenBy(bethan).log.all().filter(isWithheld));
    // What it wrote into a record the seat sees is the seat's to see; its sentence, author and call are not.
    for (const secret of ["shopper:freya", "Finance", "enquiry:finance-on-the-golf", "Compare", "staff:rhian"]) expect(said).not.toContain(secret);
    expect(store.seenBy(bethan).batches().filter((batch) => batch.ops.every(isWithheld)).map((batch) => batch.intent)).toEqual([WITHHELD_INTENT, WITHHELD_INTENT]);
  });

  it("loads, folds and undoes around the withheld ops", () => {
    const { store, renamed } = showroom();
    const seen = store.seenBy(bethan);
    const held = new Store({ schema, mutations: [ask, compare, rename], policy, snapshot: seen.snapshot(), log: [...seen.log.all()] });
    expect(held.log.length).toBe(4);
    expect(held.graph.getNode("car:golf")).toMatchObject({ label: "Golf GTI" });
    // A visible batch after a withheld one comes out on its own.
    expect(held.canUndo(renamed.batch).ok).toBe(true);
    held.undo(renamed.batch, { author: { kind: "system" } });
    expect(held.graph.getNode("car:golf")).toMatchObject({ label: "Golf" });
  });

  it("refuses to undo a change the seat cannot see, saying only that", () => {
    const { store, theirs } = showroom();
    const check = store.seenBy(bethan).canUndo(theirs.batch);
    expect(check.ok).toBe(false);
    expect(!check.ok && check.message).toBe("Cannot undo a change you cannot see: only somebody who can see it can take it back.");
    expect(() => store.undo(theirs.batch, { author: bethan })).toThrow(/a change you cannot see/);
  });
});

describe("checkUndo, blocked by a change the seat cannot see", () => {
  it("never names a withheld op's contents in its sentence", () => {
    const { store, mine, compared } = showroom();
    const check = checkUndo(store.seenBy(bethan).log, [mine.batch]);
    expect(check.ok).toBe(false);
    const message = !check.ok ? check.message : "";
    expect(message).toContain("a later change you cannot see depends on it");
    for (const secret of ["Freya", "Compare", compared.ops[0]!.id, "shopper:freya"]) expect(message).not.toContain(secret);
    expect(!check.ok && check.includeBatches).toEqual([]);

    // The store, asked by the seat itself, refuses in the same words.
    let refused: unknown;
    try {
      store.undo(mine.batch, { author: bethan });
    } catch (error) {
      refused = error;
    }
    expect(refused).toBeInstanceOf(UndoBlockedError);
    for (const secret of ["Freya", "Compare", "shopper:freya"]) expect((refused as Error).message).not.toContain(secret);

    // Staff, who can see it, are told what it was.
    expect(store.seenBy(staff).canUndo(mine.batch)).toMatchObject({ ok: false, message: expect.stringContaining("Compare with Freya Davies") });
  });
});
