import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { PermissionDeniedError, Store, type AnySchema, type Principal } from "../../src/index.js";

/**
 * AN OWN-END GRANT HOLDS EVERY LINK THE ACT TOUCHES, NOT ONLY THE ONE IT
 * NAMES (the review before 0.1.27). `ownEnd` read the records a call names
 * at the far end of its link, and a connect on a relation of one replaces
 * the link that was there: "Lead it" with yourself named took the idea
 * from whoever led it, breaking their end of a link with no grant to. The
 * store now holds what the act would do — every link it makes or breaks
 * has the seat's own record at one end — and asks it before it is offered,
 * so the strip and the store agree.
 */
const board = JSON.parse(readFileSync(new URL("../document/fixtures/idea-board.gdd.json", import.meta.url), "utf8"));
board.kinds.idea.edges.ledBy = { to: ["member"], cardinality: "one", description: "who leads it", inverse: "what they lead" };
board.acts.lead = { title: "Lead it", fromTheOtherEnd: "Lead this idea", on: "idea", effects: [{ connect: "ledBy", from: "$subject", to: "$leader" }] };
board.acts["step-down"] = { title: "Step down", fromTheOtherEnd: "Step down from this idea", on: "idea", severs: "ledBy" };
board.policy.grants.push({ roles: "*", mutations: ["lead", "step-down"], ownEnd: true, describe: "Anyone may lead an idea nobody leads." });
const compiled = compileDocument(board);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((finding) => finding.severity === "error")));
const app = compiled.app;

const ann: Principal = { kind: "human", id: "p_ann", roles: ["member"] };
const bo: Principal = { kind: "human", id: "p_bo", roles: ["member"] };
const storeOf = () =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    policy: app.policy!,
    snapshot: { nodes: [{ id: "p_ann", kind: "member", name: "Ann" }, { id: "p_bo", kind: "member", name: "Bo" }, { id: "idea:picnic", kind: "idea", title: "A picnic" }] as never, edges: [] },
  });
const leader = (store: Store<AnySchema>) => store.graph.out("idea:picnic", "ledBy").map((node) => node.id);

describe("an own-end grant on a link of one", () => {
  it("lets a seat take up a link nobody holds, on its own end", () => {
    const store = storeOf();
    store.apply({ name: "lead", args: { id: "idea:picnic", leader: "p_bo" } }, { author: bo });
    expect(leader(store)).toEqual(["p_bo"]);
  });

  it("refuses the connect that would replace somebody else's link, before and when it is applied", () => {
    const store = storeOf();
    store.apply({ name: "lead", args: { id: "idea:picnic", leader: "p_bo" } }, { author: bo });
    const call = { name: "lead", args: { id: "idea:picnic", leader: "p_ann" } };
    const verdict = store.permits(call, ann);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.refusal.message).toContain("only on your own end of the link");
    expect(() => store.apply(call, { author: ann })).toThrow(PermissionDeniedError);
    expect(leader(store)).toEqual(["p_bo"]);
  });

  it("is not offered to a seat with no record of its own", () => {
    const store = storeOf();
    const nobody: Principal = { kind: "human", roles: ["member"] };
    expect(store.permittedMutations(nobody).map((mutation) => mutation.name)).not.toContain("step-down");
    expect(store.permittedMutations(ann).map((mutation) => mutation.name)).toContain("step-down");
  });
});
