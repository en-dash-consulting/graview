import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, nodeRef, UNSET } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  applySteps,
  contentOperation,
  openStore,
  primitivesFor,
  sayStep,
  seedSteps,
  stepsMigration,
  type GraphSnapshot,
  type MigrationStep,
} from "../../src/index.js";

/**
 * The seed is a bootstrap snapshot; the live store is the truth. When the
 * default content moves, the difference lands as content steps — one
 * logged, undoable operation — and what a person made in the meantime is
 * left exactly alone. `?fresh=1` stops being the redesign tool.
 */

const list = defineNode("list", { fields: z.object({ label: z.string().min(1) }), edges: { holds: { to: ["task"] } } });
const task = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean(), note: z.string().optional() }) });
const schema = createSchema([list, task]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename", {
  title: "Rename",
  description: "Call it something else.",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const app = defineApp({ name: "lists", schema, mutations: [rename], invariants: [], version: 1 });

const v1: GraphSnapshot = {
  nodes: [
    { id: "today", kind: "list", label: "Today" },
    { id: "t-milk", kind: "task", label: "Buy milk", done: false },
  ],
  edges: [{ kind: "holds", from: "today", to: "t-milk" }],
};
/** The next default: a list renamed, a task added, a task gone. */
const v2: GraphSnapshot = {
  nodes: [
    { id: "today", kind: "list", label: "Today, then" },
    { id: "t-van", kind: "task", label: "Book the van", done: false },
  ],
  edges: [{ kind: "holds", from: "today", to: "t-van" }],
};

describe("the content steps", () => {
  it("are idempotent against the stored graph and read as sentences", () => {
    const put: MigrationStep = { what: "put-node", node: { id: "t-milk", kind: "task", label: "Buy milk", done: false } };
    expect(primitivesFor(put, v1)).toEqual([]);
    expect(primitivesFor(put, { nodes: [], edges: [] })).toHaveLength(1);
    expect(sayStep(put)).toBe("task t-milk is put");

    const patch: MigrationStep = { what: "patch-node", id: "t-milk", fields: { done: true, label: "Buy milk" } };
    expect(primitivesFor(patch, v1)).toEqual([{ op: "patch-node", id: "t-milk", before: { done: false }, after: { done: true } }]);
    expect(primitivesFor({ what: "patch-node", id: "nobody", fields: { done: true } }, v1)).toEqual([]);
    expect(sayStep(patch)).toBe("t-milk is patched: done, label");

    const drop: MigrationStep = { what: "drop-node", id: "t-milk" };
    expect(primitivesFor(drop, v1).map((p) => p.op)).toEqual(["remove-edge", "remove-node"]);
    expect(primitivesFor(drop, v2)).toEqual([]);
    expect(sayStep(drop)).toBe("t-milk goes");

    const tie: MigrationStep = { what: "put-edge", edge: { kind: "holds", from: "today", to: "t-milk" } };
    expect(primitivesFor(tie, v1)).toEqual([]);
    expect(primitivesFor(tie, { ...v1, edges: [] })).toHaveLength(1);
    // Neither end there: nothing, rather than a dangling tie.
    expect(primitivesFor({ what: "put-edge", edge: { kind: "holds", from: "today", to: "t-van" } }, v1)).toEqual([]);
    expect(sayStep(tie)).toBe("today holds t-milk is tied");

    const cut: MigrationStep = { what: "drop-edge", edge: { kind: "holds", from: "today", to: "t-milk" } };
    expect(primitivesFor(cut, v1)).toHaveLength(1);
    expect(primitivesFor(cut, v2)).toEqual([]);
    expect(sayStep(cut)).toBe("today holds t-milk is cut");
  });

  it("sit in migrations[] like the schema steps, versioned with the app", () => {
    const migration = stepsMigration({
      from: 1,
      to: 2,
      steps: [{ what: "put-node", node: v2.nodes[1]! }, { what: "put-edge", edge: v2.edges[0]! }],
    });
    expect(migration.title).toBe("task t-van is put; today holds t-van is tied");
    expect(migration.apply(v1).map((p) => p.op)).toEqual(["add-node", "add-edge"]);
    // Against a graph that already has it, the same migration is silent.
    expect(migration.apply({ nodes: [...v1.nodes, v2.nodes[1]!], edges: [...v1.edges, v2.edges[0]!] })).toEqual([]);
  });
});

describe("the seed diffed against the live store", () => {
  it("puts what is missing, patches only the fields the seed sets, ties what is untied — and leaves the rest", () => {
    const live: GraphSnapshot = {
      nodes: [
        { id: "today", kind: "list", label: "Today" },
        // A person's own edit the seed knows nothing about: kept.
        { id: "t-milk", kind: "task", label: "Buy oat milk", done: true, note: "the blue carton" },
      ],
      edges: [{ kind: "holds", from: "today", to: "t-milk" }],
    };
    const steps = seedSteps(v2, live);
    expect(steps).toEqual([
      { what: "patch-node", id: "today", fields: { label: "Today, then" } },
      { what: "put-node", node: v2.nodes[1] },
      { what: "put-edge", edge: v2.edges[0] },
    ]);
    // With prune, the person's task and its tie go too — by name, never by default.
    expect(seedSteps(v2, live, { prune: true }).slice(3)).toEqual([
      { what: "drop-edge", edge: { kind: "holds", from: "today", to: "t-milk" } },
      { what: "drop-node", id: "t-milk" },
    ]);
    // A seed field the live record has set to something else is patched; one it never set is not invented.
    expect(seedSteps({ nodes: [{ id: "t-milk", kind: "task", label: "Buy oat milk", done: false }], edges: [] }, live)).toEqual([
      { what: "patch-node", id: "t-milk", fields: { done: false } },
    ]);
  });

  it("drops and puts again a record whose kind moved, because a patch cannot move a kind", () => {
    const live: GraphSnapshot = { nodes: [{ id: "x", kind: "task", label: "X", done: false }], edges: [] };
    expect(seedSteps({ nodes: [{ id: "x", kind: "list", label: "X" }], edges: [] }, live).map((s) => s.what)).toEqual(["drop-node", "put-node"]);
  });

  it("comes to one operation with an author, an intent and an inverse — or to nothing", () => {
    const op = contentOperation(seedSteps(v2, v1), v1, { now: () => "2026-09-28T00:00:00.000Z" });
    expect(op).not.toBeNull();
    expect(op!.author).toEqual({ kind: "system", id: "ship:sync-seed" });
    expect(op!.intent).toMatch(/^seed sync: today is patched: label; task t-van is put; today holds t-van is tied$/);
    expect(op!.inverse).toHaveLength(op!.primitives.length);
    expect([...op!.writes].sort()).toEqual(["t-van", "today"]);
    expect(contentOperation(seedSteps(v1, v1), v1)).toBeNull();
    // A patch that unsets says so in the log's own word for absence.
    const clearing = contentOperation([{ what: "patch-node", id: "t-milk", fields: { note: undefined } }], {
      nodes: [{ id: "t-milk", kind: "task", label: "Buy milk", done: false, note: "x" }],
      edges: [],
    });
    expect((clearing!.primitives[0] as { after: Record<string, unknown> }).after).toEqual({ note: UNSET });
  });
});

describe("the rehearsal: seed, edit, bump the seed, sync", () => {
  it("lands the new default without a wipe, keeps the person's edit, is undoable, and finds nothing to do the second time", async () => {
    const adapter = createMemoryAdapter();
    // First install: the seed IS the store.
    const first = await openStore({ app, adapter, scope: "lists", seed: v1 });
    expect(first.store.graph.allNodes()).toHaveLength(2);
    // A person works in it.
    first.store.apply({ name: "rename", args: { id: "t-milk", label: "Buy oat milk" } });
    await first.flush();
    first.close();

    // The default content moves; the store opens again — the seed is NOT re-read.
    const second = await openStore({ app, adapter, scope: "lists", seed: v2 });
    expect(second.store.graph.getNode("t-van")).toBeUndefined();
    const steps = seedSteps(v2, second.store.graph.snapshot() as GraphSnapshot);
    const landed = applySteps(second.store, steps);
    await second.flush();
    expect(landed).not.toBeNull();
    expect(second.store.graph.getNode("t-van")).toMatchObject({ label: "Book the van" });
    expect(second.store.graph.getNode("today")).toMatchObject({ label: "Today, then" });
    // The person's rename survives: prune was not asked for, and the seed never set that label.
    expect(second.store.graph.getNode("t-milk")).toMatchObject({ label: "Buy oat milk" });
    // Logged, attributed, and one undo away.
    expect(second.store.log.all().at(-1)?.author.id).toBe("ship:sync-seed");
    expect(second.store.canUndo(landed!.batch).ok).toBe(true);
    // A second sync has nothing to say.
    expect(applySteps(second.store, seedSteps(v2, second.store.graph.snapshot() as GraphSnapshot))).toBeNull();
    second.close();

    // And it persisted: a third open sees it, without the seed's help.
    const third = await openStore({ app, adapter, scope: "lists" });
    expect(third.store.graph.getNode("t-van")).toBeDefined();
    third.store.undo(landed!.batch);
    expect(third.store.graph.getNode("t-van")).toBeUndefined();
    expect(third.store.graph.getNode("today")).toMatchObject({ label: "Today" });
    third.close();
  });
});
