import { bindSchema, createSchema, defineNode, PermissionDeniedError, Store, type Policy } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { deriveAffordances, defaultProviders } from "../../src/index.js";

/**
 * WHAT THE INTERFACE OFFERS IS WHAT THE STORE WOULD ACCEPT.
 *
 * The narrowing happens once, here — which is why this skipping the check
 * when no principal was passed was the whole permission contract failing
 * open. `store.permits` and `applyAll` both default to `{ kind: "human" }`
 * and fail CLOSED; this returned "ok" without asking. The scene never saw it
 * because the React provider defaults the principal to that same anonymous
 * human; the routed face, `recordFacts`, `kindFacts` and any app calling
 * this directly got a face full of acts that refused on press.
 *
 * Opt-in is what made it look harmless: with no policy the anonymous human
 * may do everything, so the shortcut agreed with the store in every app that
 * had not declared one yet.
 */
const item = defineNode("item", {
  description: "A thing.",
  fields: z.object({ label: z.string() }),
  plural: "Items",
  label: (node) => node.label,
});
const schema = createSchema([item]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-item", {
  title: "Add an item",
  creates: ["item"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "item"), kind: "item", label: args.label });
  },
});
const policy: Policy = {
  roles: ["keeper", "hand"],
  grants: [
    { roles: ["keeper"], mutations: "*" },
    { roles: ["hand"], mutations: [] as string[] },
  ],
};
const guarded = () => new Store({ schema, mutations: [add], invariants: [], policy });
const open = () => new Store({ schema, mutations: [add], invariants: [] });
const asked = (store: Store<typeof schema>, principal?: { kind: "human"; roles?: string[] }) =>
  deriveAffordances(store, [], {
    providers: defaultProviders(),
    kindSelection: ["item"],
    ...(principal ? { principal } : {}),
  });

describe("an act derived for nobody in particular", () => {
  it("is withheld when the store would refuse it, not offered", () => {
    const set = asked(guarded());
    expect(set.affordances).toEqual([]);
    expect(set.withheld.map((entry) => entry.mutation)).toEqual(["add-item"]);
    expect(set.withheld[0]!.refusal.message).toContain("keeper");
  });

  it("agrees with what the store actually does", () => {
    const store = guarded();
    expect(asked(store).affordances).toEqual([]);
    expect(() => store.apply({ name: "add-item", args: { label: "One" } })).toThrow(
      PermissionDeniedError,
    );
    expect(store.log.all()).toEqual([]);
  });

  it("is offered to a principal who may take it", () => {
    const set = asked(guarded(), { kind: "human", roles: ["keeper"] });
    expect(set.affordances.map((a) => a.mutation)).toEqual(["add-item"]);
    expect(set.withheld).toEqual([]);
  });

  it("is still offered to everyone where no policy was declared", () => {
    // Permission stays opt-in: an app that has not decided it has users pays
    // nothing for this.
    expect(asked(open()).affordances.map((a) => a.mutation)).toEqual(["add-item"]);
    expect(asked(open()).withheld).toEqual([]);
  });
});
