import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, Store, type Operation } from "../../src/index.js";

/*
 * FR-204, from Graview Cloud's fleet replay: three production apps' logs
 * named the same change twice. Cloud's wake opens a store on the log up to
 * its snapshot and takes the rest with `receive(tail)`; the constructor and
 * `adopt` counted past every id, `receive` did not, so the next change was
 * minted with an id the tail held. Every path that takes ops counts past
 * the ids it takes.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }) });
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const addNote = defineMutation("add-note", {
  input: z.object({ label: z.string() }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label), kind: "note", label: args.label });
  },
});

const open = (log: readonly Operation[] = []) => new Store({ schema, mutations: [addNote], log: [...log] });

/** A store with `count` changes of its own, each its own turn. */
function written(count: number): Store<typeof schema> {
  const store = open();
  for (let index = 0; index < count; index++) store.apply({ name: "add-note", args: { label: `n${index}` } });
  return store;
}

function distinct(store: Store<typeof schema>): void {
  const ops = store.log.all();
  expect(new Set(ops.map((op) => op.id)).size).toBe(ops.length);
  // A turn is its ops: no new turn is filed under a batch the log already held.
  const turns = new Map<string, number[]>();
  ops.forEach((op, at) => turns.set(op.batch, [...(turns.get(op.batch) ?? []), at]));
  for (const seqs of turns.values()) expect(seqs).toEqual(seqs.map((_, index) => seqs[0]! + index));
}

describe("a store never names a new change with an id its log holds (FR-204)", () => {
  it("counts past the ids it receives: opened on part of a log, it takes the rest and mints a fresh id", () => {
    const whole = written(5).log.all();
    const woken = open(whole.slice(0, 2));
    woken.receive(whole.slice(2));
    const made = woken.apply({ name: "add-note", args: { label: "after" } });
    expect(whole.map((op) => op.id)).not.toContain(made.ops[0]!.id);
    expect(whole.map((op) => op.batch)).not.toContain(made.batch);
    distinct(woken);
  });

  it("counts past the ids it receives when it already wrote some of its own", () => {
    const whole = written(6).log.all();
    const woken = open();
    woken.apply({ name: "add-note", args: { label: "mine" } });
    woken.receive(whole.slice(1));
    woken.apply({ name: "add-note", args: { label: "after" } });
    distinct(woken);
  });

  it("counts past the ids it receives as already applied", () => {
    const whole = written(4).log.all();
    const woken = open(whole.slice(0, 1));
    const rest = whole.slice(1);
    woken.receive(rest);
    const again = open(whole.slice(0, 1));
    again.graph.load(woken.graph.snapshot());
    again.receive(rest, { applied: true });
    again.apply({ name: "add-note", args: { label: "after" } });
    distinct(again);
  });

  it("counts past the server's ids a rebase lands, before it applies what is pending again", () => {
    const server = written(4);
    const client = open(server.log.all().slice(0, 1));
    const pending = client.apply({ name: "add-note", args: { label: "pending" } });
    // The server's op for it, and others' changes besides.
    const theirs = server.apply({ name: "add-note", args: { label: "theirs" } });
    client.rebase({ confirmed: server.log.all().slice(1), pending: [pending.batch] });
    distinct(client);
    client.apply({ name: "add-note", args: { label: "after" } });
    distinct(client);
    expect(client.log.all().filter((op) => op.id === theirs.ops[0]!.id)).toHaveLength(1);
  });

  it("counts past the ids an adopted log holds", () => {
    const server = written(5);
    const client = open();
    const pending = client.apply({ name: "add-note", args: { label: "pending" } });
    client.adopt({ log: server.log.all(), snapshot: server.graph.snapshot(), pending: [pending.batch] });
    client.apply({ name: "add-note", args: { label: "after" } });
    distinct(client);
  });

  it("counts past the ids of the log it is opened on", () => {
    const reopened = open(written(5).log.all());
    reopened.apply({ name: "add-note", args: { label: "after" } });
    distinct(reopened);
  });

  it("counts past the ids a host's own ops name", () => {
    const store = open();
    store.append([{ id: "op7", batch: "batch:host:9", author: { kind: "system", id: "host" }, intent: "Seed", primitives: [{ op: "add-node", node: { id: "note:seed", kind: "note", label: "Seed" } }] }]);
    for (let index = 0; index < 8; index++) store.apply({ name: "add-note", args: { label: `n${index}` } });
    distinct(store);
  });
});
