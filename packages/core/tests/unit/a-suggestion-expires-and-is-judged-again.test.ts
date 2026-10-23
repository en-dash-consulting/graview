import { describe, expect, it } from "vitest";
import { z } from "zod";
import { acceptSuggestion, declineSuggestion, suggest, suggestions } from "../../src/tidying.js";
import { bindSchema, createSchema, defineNode, GraphError, nodeRef, OperationLog, Store, type AnySchema, type Author } from "../../src/index.js";

/**
 * A SUGGESTION EXPIRES, AND IS JUDGED AGAIN. An actor may say when its
 * suggestion stops waiting (`expiresAt`): from then on it is not in the
 * tray, cannot be accepted or declined, and nothing is undone — it changed
 * nothing. Suggested again, it is a new suggestion that waits. A night's
 * work carries one run (`lineage.run`), so it reads as one unit.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }), edges: { supplies: { to: ["event"], description: "the events it supplies" } } });
const event = defineNode("event", { fields: z.object({ label: z.string() }) });
const schema = createSchema([vendor, event]);
const { defineMutation } = bindSchema(schema);
const supply = defineMutation("supply", {
  title: "Say a vendor supplies an event",
  subject: { kinds: ["vendor"], arg: "id" },
  connects: ["supplies"],
  input: z.object({ id: nodeRef(["vendor"]), event: nodeRef(["event"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "supplies", from: args.id, to: args.event });
  },
});
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const nick: Author = { kind: "human", id: "nick", name: "Nick" };
const quill = { name: "supply", args: { id: "vendor:quill", event: "event:gala" } };

function storeAt() {
  const clock = { now: "2026-10-22T01:00:00.000Z" };
  const store = new Store<AnySchema>({
    schema,
    mutations: [supply] as never,
    now: () => clock.now,
    snapshot: {
      nodes: [
        { id: "vendor:quill", kind: "vendor", label: "Quill Stationers" },
        { id: "event:gala", kind: "event", label: "Spring gala" },
      ] as never,
      edges: [],
    },
  });
  return { store, clock };
}
const tonight = { basis: "Quill printed something in April", confidence: 0.4, run: "run:2026-10-22", actor: "links by invoice" };

describe("a suggestion that expires", () => {
  it("keeps when it expires on its op, and its run on its lineage, in the log as written", () => {
    const { store } = storeAt();
    const op = suggest(store, [quill], { author: actor, lineage: tonight, expiresAt: "2026-10-23T06:00:00.000Z" })!;
    expect(op).toMatchObject({ expiresAt: "2026-10-23T06:00:00.000Z", lineage: tonight, primitives: [] });
    const kept = OperationLog.from(JSON.parse(JSON.stringify(store.log.toJSON()))).all()[0]!;
    expect(kept.expiresAt).toBe("2026-10-23T06:00:00.000Z");
    expect(suggestions(store).map((one) => [one.id, one.expiresAt, one.lineage?.run])).toEqual([[op.id, "2026-10-23T06:00:00.000Z", "run:2026-10-22"]]);
  });

  it("leaves the tray when it expires, and is then neither accepted nor declined", () => {
    const { store, clock } = storeAt();
    const op = suggest(store, [quill], { author: actor, lineage: tonight, expiresAt: "2026-10-23T06:00:00.000Z" })!;
    clock.now = "2026-10-23T06:00:00.000Z";
    expect(suggestions(store)).toEqual([]);
    expect(() => acceptSuggestion(store, op.id, { author: nick })).toThrow("That suggestion expired on 2026-10-23");
    expect(() => declineSuggestion(store, op.id, { author: nick })).toThrow(/expired/);
    expect(store.graph.allEdges()).toEqual([]);
    expect(store.log.length).toBe(1);
  });

  it("is judged again: suggested anew once it expired, as a new suggestion that waits", () => {
    const { store, clock } = storeAt();
    const first = suggest(store, [quill], { author: actor, lineage: tonight, expiresAt: "2026-10-23T06:00:00.000Z" })!;
    // Still waiting, the same suggestion is the one asked again.
    expect(suggest(store, [quill], { author: actor, lineage: tonight })!.id).toBe(first.id);
    clock.now = "2026-10-23T07:00:00.000Z";
    const next = suggest(store, [quill], { author: actor, lineage: { ...tonight, run: "run:2026-10-23" }, expiresAt: "2026-10-24T06:00:00.000Z" })!;
    expect(next.id).not.toBe(first.id);
    expect(suggestions(store).map((one) => one.id)).toEqual([next.id]);
    acceptSuggestion(store, next.id, { author: nick });
    expect(store.graph.allEdges()).toHaveLength(1);
  });

  it("is refused a time that is not one", () => {
    const { store } = storeAt();
    expect(() => suggest(store, [quill], { author: actor, lineage: tonight, expiresAt: "tomorrow" })).toThrow(GraphError);
    expect(store.log.length).toBe(0);
  });

  it("without an expiry waits as before, whatever the clock says", () => {
    const { store, clock } = storeAt();
    const op = suggest(store, [quill], { author: actor, lineage: { basis: "Quill printed something" } })!;
    expect(op.expiresAt).toBeUndefined();
    clock.now = "2036-01-01T00:00:00.000Z";
    expect(suggestions(store).map((one) => one.id)).toEqual([op.id]);
  });
});
