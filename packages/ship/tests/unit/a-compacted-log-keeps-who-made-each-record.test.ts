import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, recordsOf, seesId, type PersistenceAdapter, type Policy, type Principal } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createFileAdapter, openStore } from "../../src/index.js";

/**
 * A record a seat made is its own (FR-51), and an `own` sight with nothing
 * but the log to say whose a record is must still say so after a restart on
 * a log compacted behind its undo horizon (FR-23). The checkpoint epoch
 * keeps who made each record behind it (`creators`), so a store opened on
 * the tail and the checkpoint knows them without reading the archive.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const jot = defineMutation("jot", {
  title: "Jot",
  description: "Write a note down.",
  creates: ["note"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "note"), kind: "note", label: args.label });
  },
});
// No edge joins a note to anybody: only the log says whose it is.
const policy: Policy = { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["writer"], kinds: ["note"], own: true }] };
const app = defineApp({ name: "notes", schema, mutations: [jot], invariants: [], policy });
const ada: Principal = { kind: "human", id: "person:ada", roles: ["writer"] };
const bo: Principal = { kind: "human", id: "person:bo", roles: ["writer"] };

const scratches: string[] = [];
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), "graview-creators-"));
  scratches.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of scratches.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const adapters: [string, () => { adapter: PersistenceAdapter<string>; root?: string }][] = [
  ["memory", () => ({ adapter: createMemoryAdapter() })],
  [
    "file",
    () => {
      const root = scratch();
      return { adapter: createFileAdapter(root), root };
    },
  ],
];

describe.each(adapters)("a log compacted behind its horizon, reopened on the %s adapter", (_name, make) => {
  it("still knows who made a record made behind the horizon, so an own sight sees the same records", async () => {
    const { adapter } = make();
    const first = await openStore({ app, adapter });
    first.store.apply({ name: "jot", args: { label: "Cake" } }, { author: ada });
    first.store.apply({ name: "jot", args: { label: "Band" } }, { author: bo });
    first.store.apply({ name: "jot", args: { label: "Flowers" } }, { author: ada });
    await first.flush();
    const before = { ada: seesId(first.store, ada), bo: seesId(first.store, bo) };
    expect([before.ada("note:cake"), before.ada("note:band"), before.bo("note:band")]).toEqual([true, false, true]);
    const compaction = await first.compact({ keepOps: 1, keepDays: 0 });
    expect(compaction.horizon).toBe(2);
    expect(compaction.checkpoint?.creators).toEqual({ "note:cake": "person:ada", "note:band": "person:bo" });
    first.close();

    const reopened = await openStore({ app, adapter });
    expect(reopened.store.log.horizon).toBe(2);
    expect(recordsOf(reopened.store.log).creatorOf("note:cake")).toBe("person:ada");
    const after = { ada: seesId(reopened.store, ada), bo: seesId(reopened.store, bo) };
    for (const id of ["note:cake", "note:band", "note:flowers"]) {
      expect(after.ada(id)).toBe(before.ada(id));
      expect(after.bo(id)).toBe(before.bo(id));
    }
    expect(reopened.store.seenBy(ada).graph.allNodes().map((node) => node.id).sort()).toEqual(["note:cake", "note:flowers"]);

    // Compacted again past the first horizon: the makers behind the first are carried into the second.
    reopened.store.apply({ name: "jot", args: { label: "Dress" } }, { author: bo });
    await reopened.flush();
    const again = await reopened.compact({ keepOps: 0, keepDays: 0 });
    expect(again.checkpoint?.creators).toEqual({ "note:cake": "person:ada", "note:band": "person:bo", "note:flowers": "person:ada", "note:dress": "person:bo" });
    reopened.close();
    const third = await openStore({ app, adapter });
    expect(third.store.log.all()).toHaveLength(0);
    expect(seesId(third.store, ada)("note:cake")).toBe(true);
    expect(seesId(third.store, bo)("note:dress")).toBe(true);
    expect(seesId(third.store, ada)("note:dress")).toBe(false);
  });
});

describe("a checkpoint written before it kept its makers", () => {
  it("opens as it did: makers are known from the horizon on, and nothing is misread", async () => {
    const root = scratch();
    const adapter = createFileAdapter(root);
    const first = await openStore({ app, adapter });
    first.store.apply({ name: "jot", args: { label: "Cake" } }, { author: ada });
    first.store.apply({ name: "jot", args: { label: "Flowers" } }, { author: ada });
    await first.flush();
    await first.compact({ keepOps: 1, keepDays: 0 });
    first.close();
    // What a build before `creators` wrote: the same checkpoint without it.
    const path = join(root, "notes", "epochs.json");
    const epochs = JSON.parse(readFileSync(path, "utf8")) as { creators?: unknown }[];
    expect(epochs[0]!.creators).toBeDefined();
    writeFileSync(path, JSON.stringify(epochs.map(({ creators: _creators, ...epoch }) => epoch)));

    const reopened = await openStore({ app, adapter });
    expect(reopened.verified?.ok ?? true).toBe(true);
    expect(recordsOf(reopened.store.log).creatorOf("note:cake")).toBeUndefined();
    expect(recordsOf(reopened.store.log).creatorOf("note:flowers")).toBe("person:ada");
  });
});
