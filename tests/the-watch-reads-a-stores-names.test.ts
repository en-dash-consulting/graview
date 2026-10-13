import { bindSchema, createSchema, defineNode, nodeRef, Store, z } from "@graview/core";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, without types.
import { authorsOf, namesOf, unseenOf } from "../scripts/lib/watch.mjs";

/**
 * THE WATCH READS A STORE'S NAMES (scripts/lib/watch.mjs). A store hands
 * itself to a watching harness, and the watch works out what `@graview/core`
 * used to tell it: which strings are the declaration's own names, so a
 * screen showing `close-deal` to a person is caught exactly; the keys spoken
 * where the declaration says them otherwise; what a seat may not see; and
 * who has signed what. Moved out of core so a hosted page's every reader no
 * longer downloads it (the ninth walk, for the room its fixes needed).
 */
const deal = defineNode("deal", {
  fields: z.object({ label: z.string(), stage: z.enum(["open", "closed"]), closedAt: z.string().optional() }),
  edges: { "sold-by": { to: ["deal"], description: "who sold it" } },
  plural: "Deals",
});
const schema = createSchema([deal]);
const { defineMutation } = bindSchema(schema);
const close = defineMutation("close-deal", {
  title: "Close the deal",
  subject: { kinds: ["deal"], arg: "id" },
  writes: ["stage"],
  input: z.object({ id: nodeRef(["deal"]) }),
  apply: (ctx, args) => void ctx.patchNode(args.id, { stage: "closed" }),
});
const policy = {
  roles: ["sales-manager", "salesperson"],
  grants: [{ roles: ["sales-manager"], mutations: ["close-deal"] }],
  sees: [{ roles: ["sales-manager"], kinds: ["deal"] }],
};
const snapshot = { nodes: [{ id: "d1", kind: "deal", label: "Chloé · Highlander", stage: "open" }] as never, edges: [] };

describe("the watch, handed a store", () => {
  it("reads its kinds, field keys, edges, acts and roles, and the words it has for them", () => {
    const names = namesOf(new Store({ schema, mutations: [close], policy, snapshot }));
    for (const id of ["deal", "label", "stage", "closedAt", "sold-by", "close-deal", "sales-manager", "salesperson"]) expect(names.ids).toContain(id);
    expect(names.words).toContain("Close the deal");
    expect(names.words).toContain("who sold it");
  });

  it("does not count a yes the kind words itself as its key spoken, where the two agree (W-193)", () => {
    const inspection = defineNode("inspection", {
      fields: z.object({ label: z.string(), queenSeen: z.boolean(), marked: z.boolean().optional(), broodFrames: z.number() }),
      display: {
        labels: { queenSeen: "Queen", marked: "Mark", broodFrames: "Brood" },
        format: { queenSeen: (value) => (value ? "Queen seen" : "Queen not seen"), marked: (value) => (value ? "Marked" : "Not marked") },
      },
    });
    const { unsaid } = namesOf(new Store({ schema: createSchema([inspection]) }));
    // "Queen seen" is what the declaration says of a hive whose queen was seen; "Brood frames" is only the key spoken.
    expect(unsaid).not.toContain("Queen seen");
    expect(unsaid).not.toContain("Marked");
    expect(unsaid).toContain("Brood frames");
  });

  it("reads what a seat may not see, and who has signed what", () => {
    const store = new Store({ schema, mutations: [close], policy, snapshot });
    expect(unseenOf(store, { kind: "human", id: "sam", roles: ["salesperson"] })).toEqual(["Chloé · Highlander"]);
    expect(unseenOf(store, { kind: "human", id: "mona", roles: ["sales-manager"] })).toEqual([]);
    store.apply({ name: "close-deal", args: { id: "d1" } }, { author: { kind: "human", id: "user-mona", roles: ["sales-manager"] } });
    expect(authorsOf(store)).toEqual(["user-mona"]);
  });
});
