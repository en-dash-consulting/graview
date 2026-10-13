import { bindSchema, createSchema, defineNode, isoDate, nodeRef, Store, z, type Policy } from "@graview/core";
import { describe, expect, it } from "vitest";
import { deriveAffordances } from "../../src/index.js";

/**
 * AN ACT KEPT FROM A SEAT SAYS SO, EVEN WHEN IT COULD NOT BE ASKED (the
 * ninth walk, W-192).
 *
 * The co-op's "Add a yard" names who minds the yard, a beekeeper. Somebody
 * browsing sees no beekeepers, so the derivation — reading the seat's own
 * graph — found no candidate, called the act unaskable and dropped it before
 * the policy was asked: the list page drew nothing where a member's said
 * "Add a yard — a coordinator can", and the district said the act "cannot
 * begin until there is a beekeeper", of a co-op with sixty-four. An act the
 * seat may not take is withheld with the policy's sentence whatever its
 * pickers would hold; only an act the seat may take waits for a candidate.
 */
const beekeeper = defineNode("beekeeper", { fields: z.object({ label: z.string() }), label: (node) => node.label, people: true });
const apiary = defineNode("apiary", {
  fields: z.object({ label: z.string() }),
  edges: { "minded-by": { to: ["beekeeper"], cardinality: "one", description: "who minds it", inverse: "the yards they mind" } },
  label: (node) => node.label,
});
const hive = defineNode("hive", {
  fields: z.object({ label: z.string(), installed: isoDate }),
  edges: { "kept-by": { to: ["beekeeper"], cardinality: "one", description: "who keeps it", inverse: "their hives" } },
  label: (node) => node.label,
});
const schema = createSchema([beekeeper, apiary, hive]);
const { defineMutation } = bindSchema(schema);
const addYard = defineMutation("add-apiary", {
  title: "Add a yard",
  creates: ["apiary"],
  input: z.object({ label: z.string().min(1), beekeeperId: nodeRef(["beekeeper"]) }),
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "apiary");
    ctx.addNode({ id, kind: "apiary", label: args.label });
    ctx.addEdge({ kind: "minded-by", from: id, to: args.beekeeperId });
  },
});
const handHive = defineMutation("hand-hive", {
  title: "Give it another keeper",
  subject: { kinds: ["hive"], arg: "hiveId" },
  connects: ["kept-by"],
  input: z.object({ hiveId: nodeRef(["hive"]), beekeeperId: nodeRef(["beekeeper"]) }),
  apply(ctx, args) {
    for (const was of ctx.graph.out(args.hiveId, "kept-by")) ctx.removeEdge({ kind: "kept-by", from: args.hiveId, to: was.id });
    ctx.addEdge({ kind: "kept-by", from: args.hiveId, to: args.beekeeperId });
  },
});
const policy: Policy = {
  roles: ["member", "coordinator"],
  sees: [
    { roles: "*", kinds: ["apiary", "hive"] },
    { roles: ["coordinator", "member"], kinds: ["beekeeper"] },
  ],
  grants: [{ roles: ["coordinator"], mutations: "*", describe: "The coordinator runs the co-op." }],
};
const store = new Store({
  schema,
  mutations: [addYard, handHive],
  policy,
  snapshot: {
    nodes: [
      { id: "beekeeper:june", kind: "beekeeper", label: "June" },
      { id: "hive:meadow-01", kind: "hive", label: "Meadow 01", installed: "2026-05-01" },
    ],
    edges: [{ kind: "kept-by", from: "hive:meadow-01", to: "beekeeper:june" }],
  } as never,
});
const browsing = { kind: "human" as const, id: "browsing", roles: [] };
const member = { kind: "human" as const, id: "member", roles: ["member"] };

describe("an act kept from a seat says so, even when it could not be asked", () => {
  it("withholds a beginning with the policy's sentence from a seat that sees nobody to name in it", () => {
    const seen = store.seenBy(browsing);
    const set = deriveAffordances(seen, [], { kindSelection: ["apiary"], principal: browsing });
    expect(set.affordances.map((one) => one.mutation)).not.toContain("add-apiary");
    expect(set.withheld.map((one) => [one.mutation, one.refusal.message])).toEqual([["add-apiary", expect.stringContaining("coordinator")]]);
    expect(set.observations.map((one) => one.text).join(" ")).not.toMatch(/cannot begin until there is a beekeeper/);
  });

  it("withholds an act on a record the same way", () => {
    const seen = store.seenBy(browsing);
    const set = deriveAffordances(seen, ["hive:meadow-01"], { principal: browsing });
    expect(set.withheld.map((one) => one.mutation)).toContain("hand-hive");
  });

  it("is withheld from a seat that sees whom to name, as before", () => {
    const seen = store.seenBy(member);
    expect(deriveAffordances(seen, [], { kindSelection: ["apiary"], principal: member }).withheld.map((one) => one.mutation)).toEqual(["add-apiary"]);
  });
});
