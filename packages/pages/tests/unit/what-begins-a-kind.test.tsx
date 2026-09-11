import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { deriveAffordances, defaultProviders } from "@graview/tools";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, kindFacts } from "../../src/index.js";

/**
 * A LIST PAGE OFFERS WHAT CAN ACT, LIKE EVERY OTHER SURFACE.
 *
 * `graview-pages` tells an app's own page to take the act list from the
 * derivation and not from a scan of the mutations, "because filtering
 * `store.allMutations()` yourself looks equivalent and is not". The
 * framework's own list page did exactly that scan: `creates` plus
 * `store.permits`, which answers the permission question and not the
 * askability one. A creating act needing a node reference with no candidates
 * — "add an item for someone", with nobody yet — is withheld in the scene
 * and was offered here as a live form whose picker was empty and whose
 * submit could only refuse.
 *
 * `kindFacts` is the sibling of `recordFacts` for a surface that is about a
 * kind rather than a node, so the framework's page and an app's own page can
 * ask the same question.
 */
const owner = defineNode("owner", { fields: z.object({ label: z.string() }), plural: "Owners" });
const item = defineNode("item", {
  fields: z.object({ label: z.string() }),
  plural: "Items",
  edges: { "kept-by": { to: ["owner"], description: "who keeps it", inverse: "what they keep" } },
});
const schema = createSchema([item, owner]);
const { defineMutation } = bindSchema(schema);

const addFor = defineMutation("add-item-for", {
  title: "Add an item for someone",
  description: "Bring one in, already handed to somebody.",
  creates: ["item"],
  input: z.object({ label: z.string().min(1), owner: nodeRef(["owner"]) }),
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "item");
    ctx.addNode({ id, kind: "item", label: args.label });
    ctx.addEdge({ kind: "kept-by", from: id, to: args.owner });
  },
});
const addOwner = defineMutation("add-owner", {
  title: "Add an owner",
  creates: ["owner"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "owner"), kind: "owner", label: args.label });
  },
});

const store = (owners: readonly string[] = []) => {
  const made = new Store({ schema, mutations: [addFor, addOwner], invariants: [] });
  for (const label of owners) made.apply({ name: "add-owner", args: { label } });
  return made;
};
const listing = (s: Store<typeof schema>, path = "/items") =>
  renderToStaticMarkup(<PagesApp basename="" context={{ store: s }} initialPath={path} />);

describe("what a list page offers to begin a kind", () => {
  it("is the same answer the scene gives", () => {
    for (const owners of [[], ["Ana"]]) {
      const s = store(owners);
      const scene = deriveAffordances(s, [], {
        providers: defaultProviders(),
        kindSelection: ["item"],
      }).affordances.map((a) => a.mutation);
      expect(kindFacts(s, "item").actions.affordances.map((a) => a.mutation)).toEqual(scene);
    }
  });

  it("withholds an act it cannot ask for, rather than drawing a form that refuses", () => {
    expect(listing(store())).not.toContain("Add an item for someone");
    // And the page still says what a list with nothing on it is for.
    expect(listing(store())).toContain("None yet");
  });

  it("offers it the moment it can be asked", () => {
    const html = listing(store(["Ana"]));
    expect(html).toContain("Add an item for someone");
    // With the candidate the derivation narrowed, not an empty picker.
    expect(html).toContain("Ana");
  });

  it("still offers an act that needs nothing but a name", () => {
    expect(listing(store(), "/owners")).toContain("Add an owner");
  });
});
