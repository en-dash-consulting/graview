import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DerivedForm } from "../../src/index.js";

/**
 * NOTHING IS ITS OWN FAR END.
 *
 * A page that pins the record in `prefilled` and lets the candidates fall
 * back — no affordance to ask, which is what a page written by hand does —
 * listed every node of the kind, the record included. For a self-referential
 * kind, which is what `graview create` writes, that record was the ONLY
 * candidate: "Make it depend on something" whose only something was itself.
 * The act then guards against it invisibly, so the one press anyone could
 * make did nothing and left a line in the history saying it had.
 */
const item = defineNode("item", {
  description: "A thing.",
  fields: z.object({ label: z.string() }),
  plural: "Items",
  label: (node) => node.label,
  edges: { "depends-on": { to: ["item"], description: "what has to be closed first", inverse: "what is waiting on this" } },
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
const link = defineMutation("link-item", {
  title: "Depends on",
  subject: { kinds: ["item"], arg: "id" },
  connects: ["depends-on"],
  input: z.object({ id: nodeRef(["item"]), dependsOn: nodeRef(["item"]) }),
  apply(ctx, args) {
    if (args.id === args.dependsOn) return;
    ctx.addEdge({ kind: "depends-on", from: args.id, to: args.dependsOn });
  },
});

const stocked = (labels: readonly string[]) => {
  const store = new Store({ schema, mutations: [add, link], invariants: [] });
  for (const label of labels) store.apply({ name: "add-item", args: { label } });
  return store;
};

const optionsOf = (markup: string) =>
  [...markup.matchAll(/<option value="([^"]*)"/g)].map(([, value]) => value).filter(Boolean);

describe("a form that is about one record", () => {
  it("does not offer that record as an answer to its own edge", () => {
    const store = stocked(["First thing", "Second thing"]);
    const markup = renderToStaticMarkup(
      <DerivedForm store={store} mutation={link} prefilled={{ id: "item:first-thing" }} />,
    );
    expect(optionsOf(markup)).toEqual(["item:second-thing"]);
  });

  it("offers nothing at all when the record is the only one there is", () => {
    const store = stocked(["First thing"]);
    const markup = renderToStaticMarkup(
      <DerivedForm store={store} mutation={link} prefilled={{ id: "item:first-thing" }} />,
    );
    expect(optionsOf(markup)).toEqual([]);
  });

  it("still lists everything when the form is about nothing in particular", () => {
    const store = stocked(["First thing", "Second thing"]);
    // Nothing pinned: both ends are still being asked, so both records are
    // honest answers to both of them.
    const markup = renderToStaticMarkup(<DerivedForm store={store} mutation={link} />);
    expect(new Set(optionsOf(markup))).toEqual(new Set(["item:first-thing", "item:second-thing"]));
  });
});
