import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, OperationLog, recordsOf, seesId, Store, type Operation, type Policy, type Principal } from "../../src/index.js";

/**
 * FR-51. A record a seat made is its own, and the judgement of what it sees
 * knows so as the log moves: one taken before a commit knows, after it, the
 * record just made is its maker's (a room filters an act's own ack with the
 * judgement it took before the act). And who made each record is kept as
 * the log goes, not read again from the whole log after every commit, so a
 * sighted room's cost per commit is the commit's, not the log's.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const jot = defineMutation("jot", {
  title: "Jot",
  creates: ["note"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "note"), kind: "note", label: args.label });
  },
});
// A note is its maker's alone: no edge joins it to anybody, so only the log says whose it is.
const policy: Policy = { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["writer"], kinds: ["note"], own: true }, { roles: ["planner"], kinds: ["note"] }] };
const ada: Principal = { kind: "human", id: "person:ada", roles: ["writer"] };
const bo: Principal = { kind: "human", id: "person:bo", roles: ["writer"] };
const cy: Principal = { kind: "human", id: "person:cy", roles: ["planner"] };
const make = () => new Store({ schema, mutations: [jot], policy });

let n = 0;
const op = (seq: number, primitives: Operation["primitives"], author: Principal = ada, extra: Partial<Operation> = {}): Operation => ({
  id: `op-${++n}`,
  seq,
  batch: `b-${n}`,
  author: author as never,
  intent: "test",
  mutation: null,
  primitives,
  inverse: [],
  reads: [],
  writes: [],
  at: "2026-10-03T00:00:00.000Z",
  ...extra,
});
const adds = (id: string) => [{ op: "add-node" as const, node: { id, kind: "note", label: id } as never }];

describe("a judgement of what a seat sees follows the log (FR-51 a)", () => {
  it("knows a record made after the judgement was taken is its maker's own", () => {
    const store = make();
    const adaSees = seesId(store, ada);
    const boSees = seesId(store, bo);
    const made = store.apply({ name: "jot", args: { label: "Call the florist" } }, { author: ada });
    const id = made.ops[0]!.primitives[0]!.op === "add-node" ? (made.ops[0]!.primitives[0] as { node: { id: string } }).node.id : "";
    expect(adaSees(id)).toBe(true);
    expect(boSees(id)).toBe(false);
  });
});

describe("who made each record is kept as the log goes (FR-51 b)", () => {
  it("names the first maker, not the undo that put a record back, and forgets an op the log cut back", () => {
    const store = make();
    const made = store.apply({ name: "jot", args: { label: "Venue" } }, { author: ada });
    const id = "note:venue";
    expect(recordsOf(store.log).creatorOf(id)).toBe("person:ada");
    // Undone, then put back by cy undoing the undo: still ada's.
    const undo = store.undo(made.ops[0]!.batch, { author: ada });
    expect(store.graph.has(id)).toBe(false);
    expect(recordsOf(store.log).kindOf(id)).toBe("note");
    store.undo(undo.ops[0]!.batch, { author: cy });
    expect(store.graph.has(id)).toBe(true);
    expect(recordsOf(store.log).creatorOf(id)).toBe("person:ada");

    // A log cut back and written again by somebody else: the new maker.
    const log = new OperationLog();
    log.append(op(0, adds("note:a"), ada));
    log.append(op(1, adds("note:b"), ada));
    expect(recordsOf(log).creatorOf("note:b")).toBe("person:ada");
    log.truncate(1);
    expect(recordsOf(log).creatorOf("note:b")).toBeUndefined();
    expect(recordsOf(log).kindOf("note:b")).toBeUndefined();
    log.append(op(1, adds("note:b"), bo));
    expect(recordsOf(log).creatorOf("note:b")).toBe("person:bo");
    expect(recordsOf(log).creatorOf("note:a")).toBe("person:ada");
  });

  it("still knows who made a record once the ops that made it were compacted behind the horizon", () => {
    const store = make();
    store.apply({ name: "jot", args: { label: "Cake" } }, { author: ada });
    store.apply({ name: "jot", args: { label: "Band" } }, { author: bo });
    const adaSees = seesId(store, ada);
    expect(adaSees("note:cake")).toBe(true);
    store.compact(store.log.checkpointAt(schema, store.log.length));
    expect(store.log.all()).toHaveLength(0);
    store.apply({ name: "jot", args: { label: "Flowers" } }, { author: ada });
    expect(adaSees("note:cake")).toBe(true);
    expect(adaSees("note:band")).toBe(false);
    expect(adaSees("note:flowers")).toBe(true);
  });

  it("reads only the commit's ops after a commit, however long the log is", () => {
    const log = new OperationLog();
    for (let seq = 0; seq < 10_000; seq++) log.append(op(seq, adds(`note:${seq}`), seq % 2 ? ada : bo));
    // The log as recordsOf reads it, counting every op it looks at.
    let read = 0;
    const counted = (ops: readonly Operation[]) =>
      new Proxy(ops as Operation[], {
        get(target, prop, receiver) {
          if (typeof prop === "string" && /^\d+$/.test(prop)) read++;
          return Reflect.get(target, prop, receiver);
        },
      });
    const reading = { all: () => counted(log.all()), get length() { return log.length; }, get horizon() { return log.horizon; } };
    expect(recordsOf(reading).creatorOf("note:9999")).toBe("person:ada");
    read = 0;
    log.append(op(10_000, adds("note:new"), bo));
    expect(recordsOf(reading).creatorOf("note:new")).toBe("person:bo");
    expect(read).toBeLessThan(10);
    read = 0;
    expect(recordsOf(reading).creatorOf("note:0")).toBe("person:bo");
    expect(read).toBeLessThan(10);
  });
});
