import { assertReadable, bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, FORMATS, NewerFormatError, PUBLISH, type CompactOptions, type Principal } from "@graview/core";
import "@graview/core/publishing";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { exportBundle, openStore } from "../../src/index.js";

/**
 * A COMPACTION ASKED FOR FORMAT 1 STAYS READABLE BY AN OLDER BUILD
 * (FR-31, Roadmap f-publishing-lifecycle). A checkpoint past what stood
 * published at its seq is snapshot format 2, which a build before it
 * refuses. `pins: [store.publishedSeq]` was said to keep a store at
 * format 1, and it does only when the horizon lands at that publish: an
 * app that published twice, whose days or ops put the horizon between the
 * two, keeps the earlier publish as `published` and is stamped 2, pin or
 * no pin (Graview Cloud found it taking 0.1.60). `format: 1` asks the
 * store for the arithmetic: the horizon is held at what stood published
 * there, wherever that is, and the checkpoint says where it stopped.
 * `BEFORE` is what 0.1.59 reads.
 */
const BEFORE = { snapshot: 1, op: 3 } as const;

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
const policy = { grants: [{ roles: ["editor"], mutations: "*" as const }], sees: [{ roles: "*" as const, kinds: ["note"] }] };
const publishing = { mode: "on-publish" as const, working: ["editor"], publishers: ["editor"] };
const app = defineApp({ name: "notes", schema, mutations: [add], policy, publishing, version: 1 });
const editor: Principal = { kind: "human", id: "pat", name: "Pat", roles: ["editor"] };
const reader: Principal = { kind: "human", id: "rae", name: "Rae", roles: ["reader"] };

/** The memory adapter, keeping a meta as the file and SQL adapters do. */
function adapterWithMeta() {
  const meta = new Map<string, unknown>();
  const adapter = { ...createMemoryAdapter(), loadMeta: (scope: string) => (meta.get(scope) ?? null) as never, saveMeta: (scope: string, value: unknown) => void meta.set(scope, value) };
  return { adapter, meta: () => [...meta.values()].at(-1) as { formats: Record<string, number> } };
}

/** A store that published twice, with changes after each, compacted so the horizon would fall between the two publishes. */
async function publishedTwice(options: CompactOptions | ((store: { publishedSeq: number | undefined }) => CompactOptions)) {
  const { adapter, meta } = adapterWithMeta();
  const opened = await openStore({ app, adapter, seed: { nodes: [], edges: [] } as never });
  opened.store.apply({ name: "add-note", args: { label: "One" } }, { author: editor });
  const first = opened.store.apply({ name: PUBLISH, args: {} }, { author: editor });
  opened.store.apply({ name: "add-note", args: { label: "Two" } }, { author: editor });
  opened.store.apply({ name: "add-note", args: { label: "Three" } }, { author: editor });
  const latest = opened.store.apply({ name: PUBLISH, args: {} }, { author: editor });
  opened.store.apply({ name: "add-note", args: { label: "Four" } }, { author: editor });
  opened.store.apply({ name: "add-note", args: { label: "Five" } }, { author: editor });
  await opened.flush();
  const p1 = first.ops[0]!.publishedThrough!;
  const p2 = latest.ops[0]!.publishedThrough!;
  // Keep the last three ops: the horizon lands after P1, before P2, pinned at P2 or not.
  const compaction = await opened.compact({ keepOps: 3, keepDays: 0, ...(typeof options === "function" ? options(opened.store) : options) });
  return { adapter, meta, opened, compaction, p1, p2 };
}
const readersSee = (store: { seenBy(principal: Principal): { graph: { allNodes(): { label?: string }[] } } }) =>
  store.seenBy(reader).graph.allNodes().map((node) => node.label).sort();

describe("a compaction asked for format 1 stays readable by an older build", () => {
  it("holds the horizon at what stood published there, stamps the store 1, and 0.1.59's formats read it", async () => {
    const { adapter, meta, opened, compaction, p1, p2 } = await publishedTwice({ format: 1 });
    expect(compaction.checkpoint!.seq).toBe(p1);
    expect(compaction.horizon).toBe(p1);
    expect(compaction.archived).toBeGreaterThan(0);
    expect(compaction.checkpoint!.published).toBeUndefined();
    expect(meta().formats.snapshot).toBe(1);
    expect(() => assertReadable(meta(), BEFORE)).not.toThrow();
    const bundle = exportBundle(app, opened.store);
    expect(bundle.formats?.snapshot).toBe(1);
    expect(() => assertReadable(bundle, BEFORE)).not.toThrow();
    expect(opened.store.publishedSeq).toBe(p2);
    expect(readersSee(opened.store)).toEqual(["One", "Three", "Two"]);
    opened.close();

    // Reopened, readers are served the latest publish, which the log still folds.
    const reopened = await openStore({ app, adapter });
    expect(reopened.store.log.horizon).toBe(p1);
    expect(readersSee(reopened.store)).toEqual(["One", "Three", "Two"]);
    expect(meta().formats.snapshot).toBe(1);
    reopened.close();
  });

  it("stamps the same store 2 when compacted without it, the pin at its published seq notwithstanding", async () => {
    const { meta, opened, compaction, p1, p2 } = await publishedTwice((store) => ({ pins: [store.publishedSeq!] }));
    expect(compaction.checkpoint!.seq).toBeGreaterThan(p1);
    expect(compaction.checkpoint!.seq).toBeLessThan(p2);
    expect(compaction.checkpoint!.published?.map((kept) => kept.seq)).toEqual([p1]);
    expect(meta().formats.snapshot).toBe(2);
    expect(FORMATS.snapshot).toBe(2);
    expect(() => assertReadable(meta(), BEFORE)).toThrow(NewerFormatError);
    expect(exportBundle(app, opened.store).formats?.snapshot).toBe(2);
    expect(readersSee(opened.store)).toEqual(["One", "Three", "Two"]);
    opened.close();
  });
});
