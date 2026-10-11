// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * A RECORD'S NAME IS CHANGED WHERE IT STANDS (W-181). Every fact on a
 * record's page is pressed and changed in place, as the scene's record is;
 * the name above them was not, so renaming a shelf of the tool library on
 * its page took "Change the category" and a form — "works only the long way
 * round", at both widths, with either hand (the eighth walk). The scene
 * renamed the same record by pressing its name.
 */
const shelf = defineNode("category", { fields: z.object({ label: z.string().min(1), about: z.string().optional() }), plural: "Categories", label: (node) => node.label });
const schema = createSchema([shelf]);
const { defineMutation } = bindSchema(schema);
const open = defineMutation("add-category", {
  title: "Add a shelf",
  creates: ["category"],
  input: z.object({ label: z.string().min(1) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "category"), kind: "category", label: args.label }),
});

describe("a record's name on its page", () => {
  it("is pressed, changed in place, and changed in the store", async () => {
    const store = new Store({ schema, mutations: [open], snapshot: { nodes: [{ id: "wood", kind: "category", label: "Woodworking" }] as never, edges: [] } });
    const context: PageContext<typeof schema> = { store, views: createViews(schema) };
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={context} initialPath="/categories/wood" />));
    const name = host.querySelector<HTMLElement>("[data-graview-page-title] button");
    expect(name?.textContent).toBe("Woodworking");
    await act(async () => name!.click());
    const field = host.querySelector<HTMLInputElement>("[data-graview-page-title] input")!;
    expect(field).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "Woodshop");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => field.closest("form")!.requestSubmit());
    expect((store.graph.getNode("wood") as { label?: string }).label).toBe("Woodshop");
    await act(async () => root.unmount());
    host.remove();
  });
});
