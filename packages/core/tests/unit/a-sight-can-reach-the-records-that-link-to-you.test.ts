import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checkApp, compileDocument } from "../../src/check.js";
import { describePlace } from "../../src/describe.js";
import { answerSeenBy, createSchema, defineApp, defineNode, logSeenBy, search, Store, type AnySchema, type GraviewApp, type Policy, type Principal } from "../../src/index.js";

/**
 * A SIGHT CAN REACH THE RECORDS THAT LINK TO YOU (the Roadmap's open
 * request "Visibility scoped by relation"). `sees` kept whole kinds, and
 * `own` showed a seat every record an edge joins to its own — so a Secret
 * Santa match, joined to its giver AND its receiver, was shown to the
 * receiver too. `via: "givenBy"` shows a seat a match only when that one
 * relation reaches the seat's own record of the people kind: each giver
 * sees their own match and nobody else's, on every path sight is honored.
 */
const santa = JSON.parse(readFileSync(new URL("../document/fixtures/secret-santa.gdd.json", import.meta.url), "utf8"));
const compiled = compileDocument(santa);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app;

const ann: Principal = { kind: "human", id: "p_ann", roles: ["participant"] };
const bo: Principal = { kind: "human", id: "p_bo", roles: ["participant"] };
const organizer: Principal = { kind: "human", id: "p_org", roles: ["organizer"] };

/** Ann gives to Bo, Bo to Cy, Cy to Ann — drawn by the organizer, so nobody made their own match. */
function drawn(over: GraviewApp = app) {
  const store = new Store<AnySchema>({
    schema: over.schema,
    mutations: over.mutations ?? [],
    ...(over.policy ? { policy: over.policy } : {}),
    snapshot: {
      nodes: [
        { id: "p_ann", kind: "participant", name: "Ann" },
        { id: "p_bo", kind: "participant", name: "Bo" },
        { id: "p_cy", kind: "participant", name: "Cy" },
      ] as never,
      edges: [],
    },
  });
  for (const [giver, receiver, note] of [["p_ann", "p_bo", "Ann for Bo"], ["p_bo", "p_cy", "Bo for Cy"], ["p_cy", "p_ann", "Cy for Ann"]] as const) {
    store.apply({ name: "draw", args: { note, giver, receiver } }, { author: organizer });
  }
  return store;
}
const notes = (store: Store<AnySchema>) => store.graph.allNodes().filter((node) => node.kind === "match").map((node) => (node as { note?: string }).note);

describe("a sight via a relation", () => {
  it("shows each giver their own match and nobody else's — not the match they receive in", () => {
    const store = drawn();
    expect(notes(store.seenBy(ann))).toEqual(["Ann for Bo"]);
    expect(notes(store.seenBy(bo))).toEqual(["Bo for Cy"]);
    expect(notes(store.seenBy(organizer))).toHaveLength(3);
    expect(store.seenBy(ann).graph.count("match")).toBe(1);
    const mine = store.graph.in("p_ann", "givenBy")[0]!.id;
    const theirs = store.graph.in("p_ann", "givesTo")[0]!.id;
    expect([store.sees(ann, mine), store.sees(ann, theirs)]).toEqual([true, false]);
    expect(store.seenBy(ann).graph.getNode(theirs)).toBeUndefined();
  });

  it("follows the link as it moves: a match handed to another giver leaves the first", () => {
    const store = drawn();
    const mine = store.graph.in("p_ann", "givenBy")[0]!.id;
    const moved = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: { nodes: store.graph.allNodes() as never, edges: store.graph.allEdges().map((edge) => (edge.kind === "givenBy" && edge.from === mine ? { ...edge, to: "p_cy" } : edge)) } });
    expect(moved.sees(ann, mine)).toBe(false);
    expect(moved.sees({ kind: "human", id: "p_cy", roles: ["participant"] }, mine)).toBe(true);
  });

  it("holds on names, search and what a place says", () => {
    const store = drawn();
    const theirs = store.graph.in("p_ann", "givesTo")[0]!.id;
    expect(store.resolveRef({ name: "match", kinds: ["match"] }, theirs, ann).ok).toBe(false);
    expect(store.resolveRef({ name: "match", kinds: ["match"] }, "Cy for Ann", ann).ok).toBe(false);
    expect(store.resolveRef({ name: "match", kinds: ["match"] }, "Ann for Bo", ann).ok).toBe(true);
    expect(search(store, "for", { principal: ann }).hits.flatMap((hit) => ("label" in hit ? [hit.label] : []))).toEqual(["Ann for Bo"]);
    const described = describePlace(store, ann, "matches", { app });
    expect(described.ok).toBe(true);
    if (described.ok) {
      expect(described.description.text).toContain("Ann for Bo");
      expect(described.description.text).not.toContain("Cy for Ann");
      expect(described.description.text).not.toContain("Bo for Cy");
    }
  });

  it("holds on the log a seat is served and on an answer to it", () => {
    const store = drawn();
    const served = JSON.stringify(logSeenBy(store, ann));
    expect(served).toContain("Ann for Bo");
    expect(served).not.toContain("Cy for Ann");
    expect(served).not.toContain("Bo for Cy");
    // A change made where Ann may not see — Bo's second match, which she receives in — answered to her: its ops and its diff.
    const made = store.apply({ name: "draw", args: { note: "Bo again", giver: "p_bo", receiver: "p_ann" } }, { author: organizer });
    const answered = (seat: Principal) => answerSeenBy(store, seat, made);
    expect(JSON.stringify([answered(ann).ops, answered(ann).diff])).not.toContain("Bo again");
    expect(JSON.stringify([answered(bo).ops, answered(bo).diff])).toContain("Bo again");
  });

  it("is a sight a TypeScript app declares, and graview check holds it to a relation that reaches the people", () => {
    const participant = defineNode("participant", { fields: z.object({ label: z.string() }), people: true });
    const gift = defineNode("gift", { fields: z.object({ label: z.string() }) });
    const match = defineNode("match", {
      fields: z.object({ label: z.string() }),
      edges: { givenBy: { to: ["participant"], cardinality: "one", description: "who gives" }, wraps: { to: ["gift"], description: "the gift" } },
    });
    const schema = createSchema([participant, gift, match]);
    const policy = (via: string): Policy => ({ grants: [{ roles: ["organizer"], mutations: "*" }], sees: [{ roles: "*", kinds: ["participant", "gift"] }, { roles: ["participant"], kinds: ["match"], via }] });
    const codes = (via: string) => checkApp(defineApp({ name: "Santa", schema, policy: policy(via) })).findings.map((finding) => finding.code);
    expect(codes("givenBy")).not.toContain("sight-via-misses-people");
    expect(codes("givenBy")).not.toContain("sight-via-unknown-edge");
    expect(codes("wraps")).toContain("sight-via-misses-people");
    expect(codes("hands")).toContain("sight-via-unknown-edge");
    const store = new Store({ schema, policy: policy("givenBy"), snapshot: { nodes: [{ id: "p_ann", kind: "participant", label: "Ann" }, { id: "m1", kind: "match", label: "Hers" }, { id: "m2", kind: "match", label: "Not hers" }] as never, edges: [{ kind: "givenBy", from: "m1", to: "p_ann" }] } });
    expect(store.seenBy(ann).graph.allNodes().map((node) => node.id).sort()).toEqual(["m1", "p_ann"]);
  });

  it("is refused by graview check in a document whose relation does not reach the people kind", () => {
    const wrong = { ...santa, kinds: { ...santa.kinds, match: { ...santa.kinds.match, edges: { ...santa.kinds.match.edges, wraps: { to: ["match"] } } } }, policy: { ...santa.policy, sees: [...santa.policy.sees.slice(0, 2), { roles: ["participant"], kinds: ["match"], via: "wraps" }] } };
    const result = compileDocument(wrong);
    expect(result.ok).toBe(false);
    expect(result.findings.map((finding) => finding.code)).toContain("check:sight-via-misses-people");
  });
});
