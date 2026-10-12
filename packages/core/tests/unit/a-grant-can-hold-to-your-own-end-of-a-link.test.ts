import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checkApp, compileDocument } from "../../src/check.js";
import { bindSchema, createSchema, defineApp, defineNode, nodeRef, PermissionDeniedError, Store, type AnySchema, type GraviewApp, type Policy, type Principal } from "../../src/index.js";

/**
 * A GRANT CAN HOLD TO YOUR OWN END OF A LINK (Roadmap f-own-end-grants).
 * `self` holds a grant to the act's subject being the principal's own
 * record; a vote is a link from an idea to a member, and the act that takes
 * one back is ON the idea, so `self` could not say "only your own vote" and
 * a voter could take back anyone's. `ownEnd: true` holds a grant on a
 * connect or sever to the record at the link's other end being theirs.
 */
const board = JSON.parse(readFileSync(new URL("../document/fixtures/idea-board.gdd.json", import.meta.url), "utf8"));
const compiled = compileDocument(board);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));

const ann: Principal = { kind: "human", id: "p_ann", roles: ["member"] };
const bo: Principal = { kind: "human", id: "p_bo", roles: ["member"] };
const storeOf = (app: GraviewApp) =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    snapshot: {
      nodes: [
        { id: "p_ann", kind: "member", name: "Ann" },
        { id: "p_bo", kind: "member", name: "Bo" },
        { id: "idea:picnic", kind: "idea", title: "A picnic" },
      ] as never,
      edges: [
        { kind: "votedBy", from: "idea:picnic", to: "p_ann" },
        { kind: "votedBy", from: "idea:picnic", to: "p_bo" },
      ],
    },
  });

describe("an own-end grant in a document", () => {
  it("lets a voter take back their own vote", () => {
    const store = storeOf(compiled.app);
    expect(store.permits({ name: "take-back", args: { id: "idea:picnic", to: "p_ann" } }, ann).ok).toBe(true);
    store.apply({ name: "take-back", args: { id: "idea:picnic", to: "p_ann" } }, { author: ann });
    expect(store.graph.out("idea:picnic", "votedBy").map((node) => node.id)).toEqual(["p_bo"]);
  });

  it("refuses, with a sentence, a voter taking back somebody else's", () => {
    const store = storeOf(compiled.app);
    const verdict = store.permits({ name: "take-back", args: { id: "idea:picnic", to: "p_bo" } }, ann);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.refusal.message).toBe("Not permitted: “Take back a vote” on an idea — only on your own end of the link. A vote is taken back only by whoever cast it.");
    expect(() => store.apply({ name: "take-back", args: { id: "idea:picnic", to: "p_bo" } }, { author: ann })).toThrow(PermissionDeniedError);
    expect(store.graph.out("idea:picnic", "votedBy")).toHaveLength(2);
  });

  it("is the person an agent acts for", () => {
    const store = storeOf(compiled.app);
    const helper: Principal = { kind: "agent", id: "helper", onBehalfOf: bo };
    expect(store.permits({ name: "take-back", args: { id: "idea:picnic", to: "p_bo" } }, helper).ok).toBe(true);
    expect(store.permits({ name: "take-back", args: { id: "idea:picnic", to: "p_ann" } }, helper).ok).toBe(false);
  });

  it("still offers the act to the seat's tools, as an act it has on its own end", () => {
    const store = storeOf(compiled.app);
    expect(store.permittedMutations(ann).map((mutation) => mutation.name)).toContain("take-back");
  });
});

const member = defineNode("member", { fields: z.object({ label: z.string() }), people: true });
const idea = defineNode("idea", { fields: z.object({ label: z.string() }), edges: { votedBy: { to: ["member"], description: "who voted", inverse: "their votes" } } });
const schema = createSchema([member, idea]);
const { defineMutation } = bindSchema(schema);
const unvote = defineMutation("unvote", {
  title: "Take back a vote",
  subject: { kinds: ["idea"], arg: "id" },
  severs: ["votedBy"],
  input: z.object({ id: nodeRef(["idea"]), voter: nodeRef(["member"]) }),
  apply(ctx, args) {
    ctx.removeEdge({ kind: "votedBy", from: args.id, to: args.voter });
  },
});
const rename = defineMutation("rename", {
  title: "Rename",
  subject: { kinds: ["idea"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["idea"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});

describe("an own-end grant in TypeScript", () => {
  const policy: Policy = { grants: [{ roles: "*", mutations: ["unvote"], ownEnd: true }, { roles: ["chair"], mutations: "*" }] };

  it("holds the far end of what the act severs to the principal, and a role granted without it is not held", () => {
    const store = new Store({ schema, mutations: [unvote, rename], policy, snapshot: { nodes: [{ id: "p_ann", kind: "member", label: "Ann" }, { id: "p_bo", kind: "member", label: "Bo" }, { id: "idea:1", kind: "idea", label: "One" }] as never, edges: [{ kind: "votedBy", from: "idea:1", to: "p_bo" }] } });
    expect(store.permits({ name: "unvote", args: { id: "idea:1", voter: "p_bo" } }, ann).ok).toBe(false);
    expect(store.permits({ name: "unvote", args: { id: "idea:1", voter: "p_bo" } }, bo).ok).toBe(true);
    expect(store.permits({ name: "unvote", args: { id: "idea:1", voter: "p_bo" } }, { kind: "human", id: "p_cy", roles: ["chair"] }).ok).toBe(true);
  });

  it("is refused by graview check on an act that makes or breaks no link", () => {
    const app = defineApp({ name: "Ideas", schema, mutations: [unvote, rename], policy: { grants: [{ roles: "*", mutations: ["unvote", "rename"], ownEnd: true }] } });
    const finding = checkApp(app).findings.find((one) => one.code === "grant-own-end-without-link");
    expect(finding).toMatchObject({ severity: "error" });
    expect(finding?.message).toMatch(/"rename" connects and severs nothing/);
    expect(checkApp(defineApp({ name: "Ideas", schema, mutations: [unvote, rename], policy })).findings.map((one) => one.code)).not.toContain("grant-own-end-without-link");
  });

  it("is refused by graview check in a document too, on an act with no link", () => {
    const wrong = { ...board, policy: { grants: [...board.policy.grants, { roles: "*", mutations: ["add-idea"], ownEnd: true }] } };
    const result = compileDocument(wrong);
    expect(result.ok).toBe(false);
    expect(result.findings.map((one) => one.code)).toContain("check:grant-own-end-without-link");
  });
});
