import { describe, expect, it } from "vitest";
import { z } from "zod";
import { declined, declineSuggestion, meaningKey, suggest, suggestionKey } from "../../src/tidying.js";
import { bindSchema, createSchema, defineNode, nodeRef, PermissionDeniedError, Store, type AnySchema, type Author, type MutationCall } from "../../src/index.js";

/**
 * A DECLINE CATCHES THE SAME CHANGE, HOWEVER IT IS ASKED. A person who said
 * no to "Quill supplies the gala" said no to that link, not to one
 * spelling of it: the same link asked by another act that makes the
 * relation, a record the actor would make again under a newly minted id, a
 * merge of the same pair the other way round, and a record archived by
 * another spelling of the act are all refused (`meaningKey`). A different
 * link, record or pair is not.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }), edges: { supplies: { to: ["event"], description: "the events it supplies" } } });
const event = defineNode("event", { fields: z.object({ label: z.string() }) });
const note = defineNode("note", { fields: z.object({ label: z.string(), about: z.string() }) });
const schema = createSchema([vendor, event, note]);
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
const hire = defineMutation("hire-for", {
  title: "Hire a vendor for an event",
  subject: { kinds: ["vendor"], arg: "vendor" },
  connects: ["supplies"],
  input: z.object({ vendor: nodeRef(["vendor"]), gig: nodeRef(["event"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "supplies", from: args.vendor, to: args.gig });
  },
});
const jot = defineMutation("add-note", {
  title: "Add a note",
  creates: ["note"],
  input: z.object({ id: z.string(), label: z.string(), about: nodeRef(["vendor"]) }),
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "note", label: args.label, about: args.about } as never);
  },
});
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const nick: Author = { kind: "human", id: "nick", name: "Nick" };
const lineage = { basis: "Looks so", confidence: 0.5 };

const storeOf = () =>
  new Store<AnySchema>({
    schema,
    mutations: [supply, hire, jot] as never,
    now: () => "2026-10-22T09:00:00.000Z",
    snapshot: {
      nodes: [
        { id: "vendor:quill", kind: "vendor", label: "Quill Stationers" },
        { id: "vendor:quill-2", kind: "vendor", label: "Quill Stationers Ltd" },
        { id: "vendor:moss", kind: "vendor", label: "Moss & Fern" },
        { id: "event:gala", kind: "event", label: "Spring gala" },
      ] as never,
      edges: [],
    },
  });

/** A suggestion the actor made, declined by Nick. */
function saidNo(store: Store<AnySchema>, calls: readonly MutationCall[]) {
  const op = suggest(store, calls, { author: actor, lineage })!;
  return declineSuggestion(store, op.id, { author: nick }).ops[0]!;
}
const refused = (store: Store<AnySchema>, calls: readonly MutationCall[]) => () => suggest(store, calls, { author: actor, lineage });

describe("a decline, by what it means", () => {
  it("catches the same link asked by another act that makes the relation", () => {
    const store = storeOf();
    const no = saidNo(store, [{ name: "supply", args: { id: "vendor:quill", event: "event:gala" } }]);
    expect(declined(store, [{ name: "hire-for", args: { vendor: "vendor:quill", gig: "event:gala" } }])?.id).toBe(no.id);
    expect(refused(store, [{ name: "hire_for", args: { gig: "event:gala", vendor: "vendor:quill" } }])).toThrow(PermissionDeniedError);
    expect(declined(store, [{ name: "hire-for", args: { vendor: "vendor:moss", gig: "event:gala" } }])).toBeUndefined();
  });

  it("catches a record the actor would make again under a newly minted id", () => {
    const store = storeOf();
    const no = saidNo(store, [{ name: "add-note", args: { id: "note:7f3a", label: "Check the April invoice", about: "vendor:quill" } }]);
    // Exactly as asked, the minted id differs; by what it means, it is the same note.
    const again = [{ name: "add-note", args: { id: "note:91c2", label: "Check the April invoice", about: "vendor:quill" } }];
    expect(suggestionKey(again)).not.toBe(suggestionKey([{ name: "add-note", args: { id: "note:7f3a", label: "Check the April invoice", about: "vendor:quill" } }]));
    expect(declined(store, again)?.id).toBe(no.id);
    expect(refused(store, again)).toThrow(/declined/);
    expect(declined(store, [{ name: "add-note", args: { id: "note:91c2", label: "Call Moss", about: "vendor:moss" } }])).toBeUndefined();
  });

  it("catches a merge of the same pair the other way round", () => {
    const store = storeOf();
    const no = saidNo(store, [{ name: "merge-vendor", args: { id: "vendor:quill-2", into: "vendor:quill" } }]);
    expect(declined(store, [{ name: "merge-vendor", args: { id: "vendor:quill", into: "vendor:quill-2" } }])?.id).toBe(no.id);
    expect(declined(store, [{ name: "merge-vendor", args: { id: "vendor:moss", into: "vendor:quill" } }])).toBeUndefined();
  });

  it("catches a record archived by another spelling of the act", () => {
    const store = storeOf();
    const no = saidNo(store, [{ name: "archive-vendor", args: { id: "vendor:moss" } }]);
    expect(declined(store, [{ name: "archive_vendor", args: { id: "vendor:moss" } }])?.id).toBe(no.id);
    expect(declined(store, [{ name: "archive-vendor", args: { id: "vendor:quill" } }])).toBeUndefined();
  });

  it("is worked out from the calls alone, so a log holds nothing new for it", () => {
    expect(meaningKey([{ name: "merge-vendor", args: { id: "b", into: "a" } }])).toBe(meaningKey([{ name: "merge_vendor", args: { id: "a", into: "b" } }]));
    expect(meaningKey([{ name: "archive-vendor", args: { id: "a" } }])).not.toBe(meaningKey([{ name: "archive-vendor", args: { id: "b" } }]));
  });
});
