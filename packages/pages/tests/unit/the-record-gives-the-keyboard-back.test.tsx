// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * AN ACT TAKEN ON A RECORD GIVES THE KEYBOARD BACK TO THE ACT.
 *
 * On a staff member's record, "Assign to a location" opens its form in
 * place; answering it closed the form and the keyboard fell to <body>,
 * the shape W-083 fixed on a product's own design and the derived record
 * page had grown since.
 */
const location = defineNode("location", { fields: z.object({ label: z.string() }), plural: "Locations" });
const staff = defineNode("staff", {
  fields: z.object({ label: z.string() }),
  plural: "Staff",
  edges: { "works-at": { to: ["location"], description: "where they work", inverse: "who works here" } },
});
const schema = createSchema([location, staff]);
const { defineMutation } = bindSchema(schema);
const assign = defineMutation("works-at", {
  title: "Assign to a location",
  fromTheOtherEnd: "Assign somebody here",
  subject: { kinds: ["staff"], arg: "staffId" },
  connects: ["works-at"],
  input: z.object({ staffId: nodeRef(["staff"]), locationId: nodeRef(["location"]) }),
  apply: (ctx, args) => void ctx.addEdge({ kind: "works-at", from: args.staffId, to: args.locationId }),
});

describe("a record's act, answered", () => {
  it("leaves the keyboard on the button that asked, not on the body", async () => {
    const store = new Store({
      schema,
      mutations: [assign],
      snapshot: {
        nodes: [
          { id: "north", kind: "location", label: "North lot" },
          { id: "main", kind: "location", label: "Main Street" },
          { id: "priya", kind: "staff", label: "Priya Raman" },
        ] as never,
        edges: [],
      },
    });
    const context: PageContext<typeof schema> = { store };
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={context} initialPath="/staff/priya" />));
    const opener = [...host.querySelectorAll<HTMLButtonElement>("[data-affordance]")].find((button) => button.textContent === "Assign to a location")!;
    expect(opener).toBeDefined();
    await act(async () => opener.click());
    const select = host.querySelector<HTMLSelectElement>("select")!;
    await act(async () => {
      const option = [...select.options].find((one) => one.text === "North lot")!;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, option.value);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const form = select.closest("form")!;
    form.querySelector<HTMLButtonElement>('button[type="submit"]')!.focus();
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(store.graph.out("priya", "works-at").map((node) => node.id)).toEqual(["north"]);
    expect(document.activeElement?.textContent).toBe("Assign to a location");
    await act(async () => root.unmount());
    host.remove();
  });
});
