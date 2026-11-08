import { describe, expect, it } from "vitest";
import { z } from "zod";
import { suggest } from "../../src/tidying.js";
import { bindSchema, createSchema, defineNode, nodeRef, PermissionDeniedError, Store, type AnySchema, type Author, type Policy, type Principal } from "../../src/index.js";

/**
 * AN UNDO A SEAT MAY NOT MAKE IS REFUSED IN ONE SHORT SENTENCE (Roadmap
 * f-view-authoring-friction-2026-11). Taking back somebody else's suggestion
 * was answered `Not permitted to undo "Merge X (vendor:x-2) into X
 * (vendor:x)": Not permitted: …` — "not permitted" twice, and the records'
 * ids. It now says who decides it and what the seat may do instead, in the
 * app's own roles.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }) });
const schema = createSchema([vendor]);
const { defineMutation } = bindSchema(schema);
const merge = defineMutation("merge-vendors", {
  title: "Merge two vendors",
  subject: { kinds: ["vendor"], arg: "id" },
  input: z.object({ id: nodeRef(["vendor"]), into: nodeRef(["vendor"]) }),
  describe: (args) => `Merge X (${args.id}) into X (${args.into})`,
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const ria: Principal = { kind: "human", id: "ria", name: "Ria", roles: ["reader"] };
const storeOf = (policy: Policy) =>
  new Store<AnySchema>({
    schema,
    mutations: [merge] as never,
    policy,
    snapshot: { nodes: [{ id: "vendor:x", kind: "vendor", label: "X" }, { id: "vendor:x-2", kind: "vendor", label: "X" }] as never, edges: [] },
  });
const suggested = (store: Store<AnySchema>) => suggest(store, [{ name: "merge-vendors", args: { id: "vendor:x-2", into: "vendor:x" } }], { author: actor, lineage: { basis: "Two vendors share a name" } })!;

describe("taking back a suggestion a seat may not decide", () => {
  it("says who decides it and that the seat may vote, with no ids and no second refusal", () => {
    const store = storeOf({ roles: ["owner", "planner", "reader"], grants: [{ roles: ["owner", "planner"], mutations: "*" }] });
    const op = suggested(store);
    const said = store.mayUndo(op.batch, ria);
    const message = "That suggestion waits for an owner or a planner to decide. You can vote on it, but not take it back.";
    expect(said).toMatchObject({ ok: false, refusal: { message } });
    try {
      store.undo(op.batch, { author: ria });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionDeniedError);
      expect((error as PermissionDeniedError).refusal.message).toBe(message);
    }
  });

  it("names the one role that decides it", () => {
    const store = storeOf({ roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }] });
    const op = suggested(store);
    const said = store.mayUndo(op.batch, ria);
    expect(said.ok ? "" : said.refusal?.message).toBe("That suggestion waits for a keeper to decide. You can vote on it, but not take it back.");
  });
});
