// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { DerivedForm } from "../../src/index.js";

/**
 * A FORM ASKS FOR SEVERAL OPTIONS AS BOXES (Roadmap f-multi-select-enum,
 * FR-233). A choice that takes several of its options is one control, a
 * box per option said by its label, and the act is sent the list of those
 * ticked — never a row of pickers with "add another" under them, and never
 * one option where two were meant.
 */
const document = {
  format: "graview-document",
  formatVersion: 1,
  name: "Memos",
  kinds: {
    memo: {
      fields: {
        title: { type: "string", required: true },
        recipients: { type: "enum", multiple: true, options: ["cto", "developers", "qa", "product"], optionLabels: { cto: "CTO", qa: "QA" } },
      },
    },
  },
  acts: { "add-memo": { title: "Add a memo", creates: "memo" } },
  policy: { grants: [{ roles: "*", mutations: "*" }] },
};

describe("a form for a choice that takes several options", () => {
  it("draws a box per option, said by its label, and sends the ticked ones as a list", async () => {
    const compiled = compileDocument(document);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    const app = compiled.app as GraviewApp<AnySchema>;
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [], edges: [] } as never });
    const add = store.allMutations().find((one) => one.name === "add-memo")!;
    const host = globalThis.document.createElement("div");
    globalThis.document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<DerivedForm store={store} mutation={add} />));
    const group = host.querySelector<HTMLFieldSetElement>('fieldset[data-graview-choices="recipients"]')!;
    expect(group).not.toBeNull();
    const boxes = [...group.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(boxes.map((box) => box.value)).toEqual(["cto", "developers", "qa", "product"]);
    expect(boxes.map((box) => box.closest("label")?.textContent?.trim())).toEqual(["CTO", "Developers", "QA", "Product"]);
    expect(host.querySelector('select[name="recipients"]')).toBeNull();
    expect(group.textContent).not.toContain("add another");
    const name = host.querySelector<HTMLInputElement>('input[name="title"]')!;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(name, "Q4 plan");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    // Ticked out of order, sent in the options' order.
    await act(async () => boxes[2]!.click());
    await act(async () => boxes[0]!.click());
    await act(async () => host.querySelector("form")!.requestSubmit());
    expect(host.querySelector('[data-testid="refused"]')?.textContent ?? "").toBe("");
    expect(store.graph.allNodes().map((node) => (node as { recipients?: unknown }).recipients)).toEqual([["cto", "qa"]]);
    await act(async () => root.unmount());
    host.remove();
  });
});
