import { describe, expect, it } from "vitest";
import { createSchema, defineNode, Store, TYPE_TEXT, UnknownMutationError, z, type AnySchema } from "../../src/index.js";
import { TYPING } from "../../src/text/typing-hook.js";

/**
 * A PAGE MERGES TYPING ONLY ONCE IT LOADS IT (Roadmap f-collab-text). An
 * app opens far more often than somebody types into a long field, so the
 * act and its merging — a keystroke carried over the log, a whole write as
 * a splice, an undo carried over others' typing — are
 * `@graview/core/typing`'s, which a host that serves seats loads and a face
 * loads once a field typed together is focused. Until then a store answers
 * to no `type-text`, writes a whole value as written, and a later splice
 * blocks an undo of typing as any later write does. A store made before it
 * loaded answers to `type-text` once it has.
 */
const note = defineNode("note", { fields: z.object({ title: z.string(), body: z.string().max(5000).optional() }) });
const store = () =>
  new Store<AnySchema>({ schema: createSchema([note]) as unknown as AnySchema, snapshot: { nodes: [{ id: "note:one", kind: "note", title: "One", body: "The quick fox" }], edges: [] } as never });
const splice = (at: number, removed: string, inserted: string) => ({ op: "splice-text" as const, id: "note:one", field: "body", at, removed, inserted });

describe("a page merges typing only once it loads it", () => {
  it("is not loaded by the main entry: no type-text, a whole value written as written", () => {
    expect(TYPING).toEqual({});
    const s = store();
    expect(() => s.apply({ name: TYPE_TEXT, args: { node: "note:one", field: "body", at: 0, remove: 0, insert: "x" } })).toThrow(UnknownMutationError);
    s.apply({ name: "edit-note", args: { id: "note:one", body: "A quick fox" } });
    expect(s.log.all().at(-1)!.primitives[0]).toMatchObject({ op: "patch-node", after: { body: "A quick fox" } });
    expect(s.collaborative("note:one", "body")).toBe(false);
  });

  it("lets a later splice block an undo of typing, as any later write does", () => {
    const s = store();
    const first = s.applyPrimitives([splice(13, "", "!")], { intent: "Type" }).batch;
    s.apply({ name: "edit-note", args: { id: "note:one", title: "Two" } });
    expect(s.canUndo(first).ok).toBe(false);
  });

  it("answers to type-text once loaded, on a store made before", async () => {
    const s = store();
    await import("../../src/typing.js");
    s.apply({ name: TYPE_TEXT, args: { node: "note:one", field: "body", at: 4, remove: 5, insert: "slow" } });
    expect((s.graph.getNode("note:one") as unknown as { body: string }).body).toBe("The slow fox");
  });
});
