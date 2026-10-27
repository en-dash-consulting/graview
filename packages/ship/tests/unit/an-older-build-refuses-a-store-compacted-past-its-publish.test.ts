import { assertReadable, bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, FORMATS, NewerFormatError, PUBLISH, type Principal } from "@graview/core";
import "@graview/core/publishing";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { exportBundle, openStore } from "../../src/index.js";

/**
 * AN OLDER BUILD REFUSES A STORE COMPACTED PAST ITS PUBLISH (FR-31,
 * Roadmap f-publishing-lifecycle). A checkpoint past what stood published
 * keeps the app as readers are served there (`Epoch.published`), which a
 * build before it ignores — and serves those readers the horizon, changes
 * never published. So such a store's meta and bundles are stamped snapshot
 * format 2, which that build refuses with `NewerFormatError` as it opens
 * them, and every other store is stamped 1, as it was. `formats` below is
 * what 0.1.59 reads: it checks a stamp as `assertReadable` does, against
 * its own formats.
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
const live = defineApp({ name: "notes", schema, mutations: [add], policy, version: 1 });
const editor: Principal = { kind: "human", id: "pat", name: "Pat", roles: ["editor"] };
const reader: Principal = { kind: "human", id: "rae", name: "Rae", roles: ["reader"] };

/** The memory adapter, keeping a meta as the file and SQL adapters do. */
function adapterWithMeta() {
  const meta = new Map<string, unknown>();
  const adapter = { ...createMemoryAdapter(), loadMeta: (scope: string) => (meta.get(scope) ?? null) as never, saveMeta: (scope: string, value: unknown) => void meta.set(scope, value) };
  return { adapter, meta: () => [...meta.values()].at(-1) as { formats: Record<string, number> } };
}

async function compacted(options: { pin?: boolean; publish?: boolean; declared?: typeof app } = {}) {
  const { adapter, meta } = adapterWithMeta();
  const opened = await openStore({ app: options.declared ?? app, adapter, seed: { nodes: [], edges: [] } as never });
  opened.store.apply({ name: "add-note", args: { label: "One" } }, { author: editor });
  if (options.publish !== false && options.declared !== live) opened.store.apply({ name: PUBLISH, args: {} }, { author: editor });
  for (const label of ["Two", "Three", "Four"]) opened.store.apply({ name: "add-note", args: { label } }, { author: editor });
  await opened.flush();
  const compaction = await opened.compact({ keepOps: 1, keepDays: 0, ...(options.pin ? { pins: [opened.store.publishedSeq!] } : {}) });
  return { adapter, meta, opened, compaction };
}
const readersSee = (store: { seenBy(principal: Principal): { graph: { allNodes(): { label?: string }[] } } }) =>
  store.seenBy(reader).graph.allNodes().map((node) => node.label).sort();

describe("an older build refuses a store compacted past its publish", () => {
  it("stamps a store whose checkpoint lies past what stood published snapshot format 2, which the build before refuses rather than serve the horizon", async () => {
    const { adapter, meta, opened, compaction } = await compacted();
    expect(compaction.checkpoint!.seq).toBeGreaterThan(opened.store.publishedSeq!);
    expect(meta().formats.snapshot).toBe(2);
    expect(() => assertReadable(meta(), BEFORE)).toThrow(NewerFormatError);
    expect(() => assertReadable(meta(), BEFORE)).toThrow(/newer format \(2/);
    const bundle = exportBundle(app, opened.store);
    expect(bundle.formats?.snapshot).toBe(2);
    expect(() => assertReadable(bundle, BEFORE)).toThrow(NewerFormatError);
    opened.close();

    // This build reads it, and reopened stamps it so again, serving readers what was published.
    expect(FORMATS.snapshot).toBe(2);
    const reopened = await openStore({ app, adapter });
    expect(readersSee(reopened.store)).toEqual(["One"]);
    await reopened.flush();
    expect(meta().formats.snapshot).toBe(2);
    reopened.close();
  });

  it("stamps format 1, as before, a store whose compaction a host pinned at the publish, a live app's and one never compacted", async () => {
    const pinned = await compacted({ pin: true });
    expect(pinned.compaction.checkpoint!.seq).toBeLessThanOrEqual(pinned.opened.store.publishedSeq!);
    expect(pinned.meta().formats.snapshot).toBe(1);
    expect(() => assertReadable(pinned.meta(), BEFORE)).not.toThrow();
    expect(exportBundle(app, pinned.opened.store).formats?.snapshot).toBe(1);
    pinned.opened.close();

    const liveApp = await compacted({ declared: live });
    expect(liveApp.compaction.archived).toBeGreaterThan(0);
    expect(liveApp.meta().formats.snapshot).toBe(1);
    liveApp.opened.close();

    const { adapter, meta } = adapterWithMeta();
    const never = await openStore({ app, adapter, seed: { nodes: [], edges: [] } as never });
    never.store.apply({ name: "add-note", args: { label: "One" } }, { author: editor });
    never.store.apply({ name: PUBLISH, args: {} }, { author: editor });
    await never.flush();
    expect(meta().formats.snapshot).toBe(1);
    expect(exportBundle(app, never.store).formats?.snapshot).toBe(1);
    never.close();
  });
});
