import { bindSchema, createSchema, defineNode, isoDate, Store, z } from "@graview/core";
import { PagesApp } from "@graview/pages";
import { registerDefaultViews, registerViewSpecs } from "@graview/primitives";
import { createViews } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * A LIST KEEPS ITS GLANCE, AND ADDS ONE QUIETLY.
 *
 * Nick, on the quiet list: Cloud's workshop rows had become bare names — a
 * chat had declared each deliverable's row as its title alone — and "Add a
 * deliverable" stood at the list's foot as a whole form, nearly the size
 * of the list. A declared row is followed by the facts the glance names
 * that it does not say itself; adding one is a press that opens its form
 * in place, open already where there is nothing yet.
 */
const deliverable = defineNode("deliverable", {
  fields: z.object({ name: z.string(), due: isoDate.optional(), status: z.enum(["drafting", "sent"]) }),
  plural: "Deliverables",
  label: (node) => node.name,
});
const schema = createSchema([deliverable]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-deliverable", {
  title: "Add a deliverable",
  creates: ["deliverable"],
  input: z.object({ name: z.string().min(1) }),
  describe: () => "Add a deliverable",
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId("deliverable", "deliverable"), kind: "deliverable", name: args.name, status: "drafting" } as never);
  },
});
const store = (nodes: readonly object[]) => new Store({ schema, mutations: [add as never], snapshot: { nodes: nodes as never, edges: [] } });
const views = () => registerViewSpecs(registerDefaultViews(schema, createViews(schema)), schema, { deliverable: { row: [{ title: "{name}" }] } });
const draw = (nodes: readonly object[]) => renderToStaticMarkup(<PagesApp context={{ store: store(nodes), views: views() }} initialPath="/deliverables" />);

describe("a list of declared rows", () => {
  it("follows each row with the glance's facts it does not say itself", () => {
    const html = draw([{ id: "v1", kind: "deliverable", name: "The pilot's budget", due: "2026-10-20", status: "sent" }]);
    expect(html).toContain('data-testid="record-row"');
    const facts = /data-testid="record-glance"[^>]*>([^<]*)</.exec(html)?.[1] ?? "";
    expect(facts).toMatch(/Sent/i);
    expect(facts).toMatch(/Oct/);
    // Never the name again: the row said it.
    expect(facts).not.toContain("budget");
  });

  it("offers adding one as a press that opens its form in place, the form there but put away", () => {
    const html = draw([{ id: "v1", kind: "deliverable", name: "The pilot's budget", status: "sent" }]);
    expect(html).toMatch(/data-testid="act-open-add-deliverable"[^>]*aria-expanded="false"/);
    expect(html).toContain("Add a deliverable");
    expect(html).toMatch(/<div[^>]*hidden=""[^>]*>[\s\S]*data-testid="form-add-deliverable"/);
  });

  it("stands open where there is nothing yet", () => {
    const html = draw([]);
    expect(html).toMatch(/data-testid="act-open-add-deliverable"[^>]*aria-expanded="true"/);
    expect(html).toContain("None yet");
  });
});
