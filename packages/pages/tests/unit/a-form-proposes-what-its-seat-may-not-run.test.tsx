// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { suggestions } from "@graview/core/tidying";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DerivedForm } from "../../src/index.js";

/**
 * A FORM PROPOSES WHAT ITS SEAT MAY NOT RUN (Roadmap
 * f-proposals-for-review). Where the policy lets a seat propose an act and
 * not run it (a grant's `propose`), the act's form says "Propose" on its
 * button, and pressed it keeps the change as the seat's proposal — nothing
 * of the record changes — which waits for whoever may make it. A seat that
 * may run the act is offered the act as ever.
 */
const note = defineNode("note", { fields: z.object({ label: z.string(), done: z.boolean() }), plural: "Notes" });
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const close = defineMutation("close-note", {
  title: "Close it",
  subject: { kinds: ["note"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["note"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const keeper: Principal = { kind: "human", id: "nina", name: "Nina", roles: ["keeper"] };
const helper: Principal = { kind: "human", id: "hal", name: "Hal", roles: ["helper"] };
const storeOf = () =>
  new Store({
    schema,
    mutations: [close],
    policy: { roles: ["keeper", "helper"], grants: [{ roles: ["keeper"], mutations: "*" }, { roles: ["helper"], mutations: [], propose: ["close-note"] }] },
    snapshot: { nodes: [{ id: "n1", kind: "note", label: "One", done: false }] as never, edges: [] },
  });

async function mounted(element: React.ReactElement) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, unmount: () => act(async () => root.unmount()) };
}

describe("an act's form, for a seat that may propose it and may not run it", () => {
  it("reads Propose, and keeps the change as the seat's proposal", async () => {
    const store = storeOf();
    const { host, unmount } = await mounted(<DerivedForm store={store} mutation={close} prefilled={{ id: "n1" }} principal={helper} />);
    expect(host.querySelector('[data-graview-part="submit"]')?.textContent).toBe("Propose");
    await act(async () => {
      host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    for (let turn = 0; turn < 50 && suggestions(store).length === 0; turn++) await act(async () => { await vi.dynamicImportSettled(); await new Promise((done) => setTimeout(done, 10)); });
    expect(host.querySelector('[data-testid="refused"]')).toBeNull();
    expect((store.graph.getNode("n1") as { done: boolean }).done).toBe(false);
    expect(suggestions(store)[0]).toMatchObject({ author: { id: "hal" }, calls: [{ name: "close-note", args: { id: "n1" } }], lineage: { proposedBy: "hal" } });
    expect(host.querySelector('[data-testid="proposed"]')?.textContent).toMatch(/waits in Suggested/);
    await unmount();
  });

  it("reads as the act for a seat that may run it", async () => {
    const { host, unmount } = await mounted(<DerivedForm store={storeOf()} mutation={close} prefilled={{ id: "n1" }} principal={keeper} />);
    expect(host.querySelector('[data-graview-part="submit"]')?.textContent).toBe("Close it");
    await unmount();
  });
});
