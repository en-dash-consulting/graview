// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store, type Policy, type Principal } from "@graview/core";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * A BLANK FACT AN ACT WRITES IS AN EMPTY SLOT (Roadmap
 * request:record-pages-draw-writable-but-blank-facts-as-empty-editable-slots).
 * A placement made without its allocation or its role had nowhere on its own
 * page to be given them: a blank fact was not drawn, and `edit-placement`
 * surfaces only as the editor on a fact. Now each blank a seat may fill is
 * its label and a dim "add" — "Add Allocation" — that opens the same editor;
 * a blank nothing writes stays unsaid, and a reader is offered no slot.
 */
const placement = defineNode("placement", {
  fields: z.object({
    label: z.string().min(1),
    allocation: z.number().int().min(0).max(100).optional(),
    role: z.enum(["lead", "support"]).optional(),
    source: z.string().optional(),
  }),
  // Where it came from is kept as it was made: no act writes it.
  fixed: { source: "where the placement came from, as it was made" },
  label: (node) => node.label,
});
const schema = createSchema([placement]);
const { defineMutation } = bindSchema(schema);
const place = defineMutation("add-placement", {
  title: "Add a placement",
  creates: ["placement"],
  input: z.object({ label: z.string().min(1) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "placement"), kind: "placement", label: args.label }),
});
const policy: Policy = { roles: ["staffer", "reader"], grants: [{ roles: ["staffer"], mutations: ["add-placement"] }] };
const STAFFER: Principal = { kind: "human", id: "user-ana", roles: ["staffer"] };
const READER: Principal = { kind: "human", id: "user-rui", roles: ["reader"] };

async function opened(principal: Principal) {
  const store = new Store({ schema, mutations: [place], policy, snapshot: { nodes: [{ id: "p4", kind: "placement", label: "Placement 4" }] as never, edges: [] } });
  const context: PageContext<typeof schema> = { store, views: createViews(schema), principal };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={context} initialPath="/placements/p4" />));
  const done = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { store, host, done };
}

describe("a blank fact on a record's page", () => {
  it("is an empty slot where an act the seat may run writes it, and filling it sets it", async () => {
    const { store, host, done } = await opened(STAFFER);
    const slot = host.querySelector<HTMLButtonElement>('[data-graview-blank-fact="allocation"] button[data-graview-blank]');
    expect(slot).not.toBeNull();
    expect(slot!.getAttribute("aria-label")).toBe("Add Allocation");
    expect(slot!.textContent).toBe("add");
    expect(host.querySelector('[data-graview-blank-fact="allocation"] dt')?.textContent).toBe("Allocation");
    expect(host.querySelector('[data-graview-blank-fact="role"] button')?.getAttribute("aria-label")).toBe("Add Role");
    await act(async () => slot!.click());
    const box = host.querySelector<HTMLInputElement>('[data-graview-blank-fact="allocation"] input')!;
    expect(box).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(box, "60");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => box.closest("form")!.requestSubmit());
    expect((store.graph.getNode("p4") as { allocation?: number }).allocation).toBe(60);
    // Filled, it is a fact like any other: no longer a slot.
    expect(host.querySelector('[data-graview-blank-fact="allocation"]')).toBeNull();
    expect(host.querySelector('[data-graview-field="allocation"]')?.textContent).toBe("60");
    await done();
  });

  it("stays hidden where no act writes it", async () => {
    const { host, done } = await opened(STAFFER);
    expect(host.querySelector('[data-graview-blank-fact="source"]')).toBeNull();
    expect(host.querySelector('[data-testid="record-fields"]')?.textContent ?? "").not.toContain("Source");
    await done();
  });

  it("is no slot for a reader the policy keeps from the act", async () => {
    const { host, done } = await opened(READER);
    // The reader is shown the record; only the slots are not offered.
    expect(host.querySelector("[data-graview-page-title]")?.textContent).toContain("Placement 4");
    expect(host.querySelector("[data-graview-blank-fact]")).toBeNull();
    expect(host.querySelector("[data-graview-blank]")).toBeNull();
    await done();
  });
});
