import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, Store, z, type Policy } from "../../src/index.js";

/**
 * A DOOR FOR EVERYBODY IS NOT A KEY TO EVERY RECORD — AND A KEY IS STILL A
 * KEY (the ninth walk, W-201, and its scope).
 *
 * Riding only an everybody grant that names the act which makes a kind
 * ("Anybody may join"), a derived edit, remove, archive or merge reaches the
 * records the seat made. A grant of everything to everybody —
 * `{ roles: "*", mutations: "*" }`, which `add-sight` writes on an app with
 * no policy (FR-170) and every Graview Cloud app holds — names every act
 * outright, and reaches every record a seat may see, as before.
 */
const member = defineNode("member", { fields: z.object({ label: z.string().min(1) }), label: (node) => node.label, people: true });
const schema = createSchema([member]);
const { defineMutation } = bindSchema(schema);
const join = defineMutation("join", {
  title: "Join",
  creates: ["member"],
  input: z.object({ label: z.string().min(1) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "member"), kind: "member", label: args.label }),
});
const snapshot = { nodes: [{ id: "member:mentor", kind: "member", label: "Mentor" }] as never, edges: [] };
const novice = { kind: "human" as const, id: "member:novice", roles: ["member"] };
const store = (policy: Policy) => new Store({ schema, mutations: [join], policy, snapshot: structuredClone(snapshot) });
const acts = [
  { name: "edit-member", args: { id: "member:mentor", label: "Renamed" } },
  { name: "remove-member", args: { id: "member:mentor" } },
  { name: "archive-member", args: { id: "member:mentor" } },
];

describe("a grant to everybody", () => {
  it("of everything (`roles: \"*\", mutations: \"*\"`, as add-sight writes it) still reaches every record a seat may see", () => {
    for (const call of acts) {
      const kept = store({ grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: "*", kinds: ["member"] }] });
      expect(kept.permits(call, novice).ok, call.name).toBe(true);
      kept.apply(call, { author: novice });
    }
  });

  it("that names the act making a kind (\"Anybody may join\") reaches only the records the seat made", () => {
    for (const call of acts) {
      const kept = store({ roles: ["member", "coordinator"], grants: [{ roles: "*", mutations: ["join"] }, { roles: ["coordinator"], mutations: "*" }] });
      const verdict = kept.permits(call, novice);
      expect(verdict.ok, call.name).toBe(false);
      if (!verdict.ok) expect(verdict.refusal.message).toMatch(/only on what you made; a coordinator can/);
    }
    const kept = store({ grants: [{ roles: "*", mutations: ["join"] }] });
    kept.apply({ name: "join", args: { label: "Novice" } }, { author: novice });
    const mine = kept.graph.nodesOfKind("member").find((one) => one.label === "Novice")!;
    expect(kept.permits({ name: "edit-member", args: { id: mine.id, label: "Me" } }, novice).ok).toBe(true);
    expect(kept.permits({ name: "remove-member", args: { id: mine.id } }, novice).ok).toBe(true);
  });

  it("leaves a role's own grant to make a kind reaching every record of it, as before", () => {
    const kept = store({ grants: [{ roles: ["member"], mutations: ["join"] }] });
    for (const call of acts) expect(kept.permits(call, novice).ok, call.name).toBe(true);
  });
});
