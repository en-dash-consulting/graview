import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  createSchema,
  defineNode,
  FORMATS,
  invert,
  inverseOf,
  nodeRef,
  snapshotHash,
  Store,
  upgradeOp,
  withInverse,
  type Operation,
  type Primitive,
} from "../../src/index.js";
import { verifyFold } from "../../src/integrity.js";
import { pastOf } from "../../src/past.js";

/**
 * AN OP CARRIES ITS VALUE ONCE (Roadmap f-ops-without-inverse-on-the-wire).
 *
 * A patch carried the value it wrote in the call's arguments, in its
 * primitive's `after`, and again in an `inverse` that was nothing but the
 * primitives turned round — so a 19 KB image was most of a 95 KB op. Op
 * format 2 keeps no inverse: it is derived from the primitives wherever it
 * is read. A format-1 log, inverse and all, still opens and goes on.
 */
const note = defineNode("note", {
  fields: z.object({ label: z.string(), image: z.string().optional(), pinned: z.string().optional() }),
  edges: { "next-to": { to: ["note"] } },
});
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-note", {
  input: z.object({ id: z.string(), label: z.string(), image: z.string().optional() }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "note", label: args.label, ...(args.image ? { image: args.image } : {}) });
  },
});
const picture = defineMutation("set-image", {
  input: z.object({ id: nodeRef(["note"]), image: z.string().optional() }),
  subject: { kinds: ["note"], arg: "id" },
  describe: () => "Change the picture",
  apply(ctx, args) {
    ctx.patchNode(args.id, { image: args.image });
  },
});
const link = defineMutation("link", {
  input: z.object({ from: nodeRef(["note"]), to: nodeRef(["note"]) }),
  describe: () => "Put them side by side",
  apply(ctx, args) {
    ctx.addEdge({ kind: "next-to", from: args.from, to: args.to });
  },
});
const remove = defineMutation("remove-note", {
  input: z.object({ id: nodeRef(["note"]) }),
  describe: () => "Remove it",
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});
const mutations = [add, picture, link, remove];
const IMAGE = `data:image/png;base64,${"iVBORw0KGgo".repeat(1800)}`;
const OTHER = `data:image/png;base64,${"R0lGODlh".repeat(2400)}`;

const fresh = () => new Store({ schema, mutations, invariants: [] });

/** A store's history: records made, a picture set and changed and cleared, a link, a removal, and an undo. */
function history(): Store<typeof schema> {
  const store = fresh();
  store.apply({ name: "add-note", args: { id: "a", label: "Alpha", image: IMAGE } });
  store.apply({ name: "add-note", args: { id: "b", label: "Beta" } });
  store.apply({ name: "set-image", args: { id: "b", image: OTHER } });
  store.apply({ name: "set-image", args: { id: "a", image: OTHER } });
  store.apply({ name: "link", args: { from: "a", to: "b" } });
  store.apply({ name: "set-image", args: { id: "b" } });
  store.apply({ name: "add-note", args: { id: "c", label: "Gamma" } });
  store.apply({ name: "remove-note", args: { id: "c" } });
  store.undo(store.batches().at(-1)!.id);
  store.applyPrimitives([{ op: "patch-node", id: "a", before: { label: "Alpha" }, after: { label: "Alef" } }], { intent: "Rename by hand" });
  store.append([{ intent: "Seed a note", author: { kind: "system", id: "seed" }, primitives: [{ op: "add-node", node: { id: "d", kind: "note", label: "Delta" } as never }] }]);
  return store;
}

/** The log as it is written: JSON, as every adapter, export and wire keeps it. */
const written = (ops: readonly Operation[]): Operation[] => JSON.parse(JSON.stringify(ops)) as Operation[];
/** The same log as format 1 wrote it: every op with its inverse beside it. */
const asFormat1 = (ops: readonly Operation[]): Operation[] => written(ops.map(withInverse));
const reopened = (log: readonly Operation[], snapshot = history().snapshot()) => new Store({ schema, mutations, invariants: [], snapshot: snapshot as never, log });
const hashOf = (store: Store<typeof schema>) => snapshotHash(store.snapshot());
/** A batch with whatever has to come along for its undo to be legal. */
const withWhatDepends = (store: Store<typeof schema>, batch: string): string[] => {
  const check = store.canUndo(batch);
  return check.ok ? [batch] : [batch, ...check.includeBatches];
};

describe("an op carries its value once", () => {
  it("is op format 2", () => {
    expect(FORMATS.op).toBe(2);
  });

  it("an op a store writes carries no inverse, whichever way it was made", () => {
    const store = history();
    for (const op of store.log.all()) {
      expect(op).not.toHaveProperty("inverse");
      expect(JSON.stringify(op)).not.toContain('"inverse"');
    }
  });

  it("an op's inverse is its primitives inverted, newest first", () => {
    for (const op of history().log.all()) expect(inverseOf(op)).toEqual([...op.primitives].reverse().map(invert));
  });

  it("an image is written once less: twice in the op that sets it, not three times", () => {
    const store = history();
    const setting = store.log.all()[3]!;
    const count = (text: string, needle: string) => text.split(needle).length - 1;
    // In the call and in the patch's after; once more in the before for the image it replaced.
    expect(count(JSON.stringify(setting), OTHER)).toBe(2);
    expect(count(JSON.stringify(setting), IMAGE)).toBe(1);
    expect(count(JSON.stringify(withInverse(setting)), OTHER)).toBe(3);
    expect(count(JSON.stringify(withInverse(setting)), IMAGE)).toBe(2);
  });

  it("a format-1 op comes up to format 2 with its inverse dropped, when the inverse is its primitives' own", () => {
    for (const op of asFormat1(history().log.all())) {
      expect(op.inverse).toBeDefined();
      const up = upgradeOp(op, 1);
      expect(up).not.toHaveProperty("inverse");
      expect(inverseOf(up)).toEqual(op.inverse);
    }
  });

  it("a format-1 op whose inverse is not its primitives' own keeps it, and it is what undo puts back", () => {
    const primitives: Primitive[] = [{ op: "patch-node", id: "a", before: { label: "Alpha" }, after: { label: "Alef" } }];
    const own: Primitive[] = [{ op: "patch-node", id: "a", before: { label: "Alef" }, after: { label: "Aleph" } }];
    const op = { id: "x", seq: 0, batch: "batch:x:1", author: { kind: "system" }, intent: "Odd", mutation: null, primitives, inverse: own, reads: [], writes: ["a"], at: "2026-10-21T00:00:00.000Z" } as Operation;
    expect(upgradeOp(op, 1).inverse).toEqual(own);
    expect(inverseOf(op)).toEqual(own);
    const store = new Store({ schema, mutations, invariants: [], snapshot: { nodes: [{ id: "a", kind: "note", label: "Alef" }], edges: [] } as never, log: [op] });
    store.undo("batch:x:1");
    expect((store.graph.getNode("a") as { label: string }).label).toBe("Aleph");
  });

  it("a store reopened on a format-1 log holds it as format 2", () => {
    const store = reopened(asFormat1(history().log.all()));
    for (const op of store.log.all()) expect(op).not.toHaveProperty("inverse");
  });

  describe("format-1 and format-2 logs give the same graphs", () => {
    const both = () => {
      const made = history();
      return { v1: reopened(asFormat1(made.log.all())), v2: reopened(written(made.log.all())) };
    };

    it("undo, one batch at a time, newest first", () => {
      const { v1, v2 } = both();
      for (const batch of [...v2.batches()].reverse().filter((one) => !one.undone)) {
        const a = v1.previewUndo(batch.id);
        if (!a.ok) continue;
        v1.undo(batch.id);
        v2.undo(batch.id);
        expect(hashOf(v1)).toBe(hashOf(v2));
      }
      expect(v2.graph.getNode("a")).toBeUndefined();
    });

    it("a selective undo of an early batch, and its redo", () => {
      const { v1, v2 } = both();
      // The picture on b: set, then cleared later, so the early one is taken back with what depends on it.
      const early = v2.batches().find((one) => one.intent === "Change the picture")!.id;
      const batches = withWhatDepends(v2, early);
      v1.undo(batches);
      v2.undo(batches);
      expect(hashOf(v1)).toBe(hashOf(v2));
      // Redo is the undo of the undo, each store's own.
      v1.undo(v1.batches().at(-1)!.id);
      v2.undo(v2.batches().at(-1)!.id);
      expect(hashOf(v1)).toBe(hashOf(v2));
      expect(hashOf(v2)).toBe(hashOf(history()));
    });

    it("playback at every seq", () => {
      const { v1, v2 } = both();
      for (let seq = 0; seq <= v2.log.length; seq++) expect(hashOf(pastOf(v1, seq))).toBe(hashOf(pastOf(v2, seq)));
    });

    it("verifying the fold, and finding where it parts", () => {
      const made = history();
      const v1 = asFormat1(made.log.all());
      const v2 = written(made.log.all());
      expect(verifyFold(schema, v1, made.snapshot())).toEqual(verifyFold(schema, v2, made.snapshot()));
      const drifted = { ...made.snapshot(), nodes: made.snapshot().nodes.map((one) => (one.id === "b" ? { ...one, label: "Drift" } : one)) };
      expect(verifyFold(schema, v1, drifted as never)).toEqual(verifyFold(schema, v2, drifted as never));
    });

    it("a rebase that rolls pending batches back and plays them again", () => {
      const server = history();
      const confirmed = written(server.log.all());
      for (const log of [asFormat1(confirmed), confirmed]) {
        const client = fresh();
        client.apply({ name: "add-note", args: { id: "z", label: "Pending", image: IMAGE } });
        client.apply({ name: "set-image", args: { id: "z", image: OTHER } });
        const pending = [...new Set(client.log.all().map((op) => op.batch))];
        client.rebase({ confirmed: log, pending });
        expect(client.log.all().slice(0, confirmed.length).every((op) => !("inverse" in op))).toBe(true);
        const base = server.snapshot();
        expect(client.snapshot().nodes.length).toBe(base.nodes.length + 1);
        expect((client.graph.getNode("z") as { image: string }).image).toBe(OTHER);
      }
    });

    it("ops received from a format-1 sender land as format 2 and undo the same", () => {
      const sender = history();
      const v1 = fresh();
      const v2 = fresh();
      v1.receive(asFormat1(sender.log.all()));
      v2.receive(written(sender.log.all()));
      expect(hashOf(v1)).toBe(hashOf(v2));
      for (const op of v1.log.all()) expect(op).not.toHaveProperty("inverse");
      const last = sender.batches().find((one) => one.intent === "Put them side by side")!.id;
      v1.undo(withWhatDepends(v1, last));
      v2.undo(withWhatDepends(v2, last));
      expect(hashOf(v1)).toBe(hashOf(v2));
    });
  });

  it("the format-1 fixture 0.1.0 wrote opens, undoes and goes on", () => {
    const fixture = JSON.parse(readFileSync(new URL("../fixtures/formats/format-1.json", import.meta.url), "utf8")) as { snapshot: never; ops: Operation[] };
    const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean(), due: z.string().optional() }), edges: { on: { to: ["list"] } } });
    const list = defineNode("list", { fields: z.object({ label: z.string() }) });
    const small = createSchema([task, list]);
    const rename = bindSchema(small).defineMutation("rename", {
      input: z.object({ id: z.string(), label: z.string() }),
      apply(ctx, args) {
        ctx.patchNode(args.id, { label: args.label });
      },
    });
    const store = new Store({ schema: small, mutations: [rename], invariants: [], snapshot: fixture.snapshot, log: fixture.ops });
    expect(store.graph.getNode("task-1")).toBeDefined();
    store.apply({ name: "rename", args: { id: "list-1", label: "Tomorrow" } });
    expect(store.log.all().at(-1)).not.toHaveProperty("inverse");
    store.undo("batch:1");
    expect(store.graph.getNode("task-1")).toBeUndefined();
    expect((store.graph.getNode("list-1") as { label: string }).label).toBe("Tomorrow");
  });
});
