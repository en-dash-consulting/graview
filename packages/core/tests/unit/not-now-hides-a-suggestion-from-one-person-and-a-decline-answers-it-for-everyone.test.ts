import { describe, expect, it } from "vitest";
import { z } from "zod";
import { declined, declineSuggestion, isDismissed, suggest, suggestions, suggestionsIn, type Dismissal } from "../../src/tidying.js";
import { bindSchema, createSchema, defineNode, nodeRef, Store, type AnySchema, type Author } from "../../src/index.js";

/**
 * "NOT NOW" HIDES A SUGGESTION FROM ONE PERSON; A DECLINE ANSWERS IT FOR
 * EVERYONE. A dismissal is the person's own state, kept by the host where
 * it keeps what they chose, and handed to `suggestions`: the suggestion is
 * out of their sight — until its `until`, when they gave one — while it
 * still waits for everyone else, nothing is written to the log, and the
 * app's own actor is held to nothing. A decline is an undo in the log: it
 * leaves everyone's tray, and the actor never makes it again.
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
const NOW = "2026-10-22T09:00:00.000Z";

const storeOf = () =>
  new Store<AnySchema>({
    schema,
    mutations: [supply] as never,
    now: () => NOW,
    snapshot: {
      nodes: [
        { id: "vendor:quill", kind: "vendor", label: "Quill Stationers" },
        { id: "event:gala", kind: "event", label: "Spring gala" },
      ] as never,
      edges: [],
    },
  });

describe("not now, and no", () => {
  it("not now hides it from the person who said it, while it waits for everyone else, and writes nothing", () => {
    const store = storeOf();
    const op = suggest(store, [quill], { author: actor, lineage: { basis: "Quill printed something", confidence: 0.4 } })!;
    const length = store.log.length;
    const nicks: Dismissal[] = [{ suggestion: op.id, at: NOW }];
    expect(suggestions(store, undefined, { dismissed: nicks })).toEqual([]);
    expect(suggestions(store).map((one) => one.id)).toEqual([op.id]);
    expect(store.log.length).toBe(length);
    // The actor is held to nothing: asked again, the same suggestion still waits, and nothing is declined.
    expect(declined(store, [quill])).toBeUndefined();
    expect(suggest(store, [quill], { author: actor, lineage: { basis: "Again" } })!.id).toBe(op.id);
  });

  it("not now until a time shows it again then, if it still waits", () => {
    const store = storeOf();
    const op = suggest(store, [quill], { author: actor, lineage: { basis: "Quill printed something" } })!;
    const later: Dismissal[] = [{ suggestion: op.id, at: NOW, until: "2026-10-29T09:00:00.000Z" }];
    expect(isDismissed(later, op.id, NOW)).toBe(true);
    expect(isDismissed(later, op.id, "2026-10-29T09:00:00.000Z")).toBe(false);
    expect(suggestionsIn(store.log.all(), () => true, { now: "2026-10-30T00:00:00.000Z", dismissed: later }).map((one) => one.id)).toEqual([op.id]);
  });

  it("a decline answers it for everyone, in the log, and the actor never makes it again", () => {
    const store = storeOf();
    const op = suggest(store, [quill], { author: actor, lineage: { basis: "Quill printed something" } })!;
    const decline = declineSuggestion(store, op.id, { author: nick });
    expect(decline.ops[0]).toMatchObject({ undoes: op.id, author: nick });
    expect(suggestions(store)).toEqual([]);
    expect(declined(store, [quill])?.id).toBe(decline.ops[0]!.id);
    expect(() => suggest(store, [quill], { author: actor, lineage: { basis: "Again" } })).toThrow(/declined/);
  });
});
