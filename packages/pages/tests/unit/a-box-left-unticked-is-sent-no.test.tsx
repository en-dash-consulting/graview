// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DerivedForm } from "../../src/index.js";

/**
 * A BOX NOBODY TICKED IS A NO. "Add a tool" asks whether the tool needs an
 * induction first, as a box; a hand saw does not, so the librarian leaves
 * it unticked — and the press was refused "Induction first — invalid
 * input: expected boolean, received undefined" (the eighth walk, W-177).
 * The box was also marked "*", as if it had to be ticked.
 */
const tool = defineNode("tool", { fields: z.object({ label: z.string(), inductionRequired: z.boolean() }), plural: "Tools", display: { labels: { inductionRequired: "Induction first" } } });
const schema = createSchema([tool]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-tool", {
  title: "Add a tool",
  creates: ["tool"],
  input: z.object({ label: z.string().min(1), inductionRequired: z.boolean() }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "tool"), kind: "tool", label: args.label, inductionRequired: args.inductionRequired }),
});

describe("a form with a box nobody ticked", () => {
  it("sends it as no, the act takes it, and the box is not marked as one that must be ticked", async () => {
    const store = new Store({ schema, mutations: [add] });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<DerivedForm store={store} mutation={add} />));
    const box = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(box.closest("label")?.textContent).not.toContain("*");
    const name = host.querySelector<HTMLInputElement>('input[name="label"]')!;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(name, "Hand saw");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => host.querySelector("form")!.requestSubmit());
    expect(host.querySelector('[data-testid="refused"]')?.textContent ?? "").toBe("");
    expect(store.graph.allNodes().map((node) => (node as { inductionRequired?: unknown }).inductionRequired)).toEqual([false]);
    await act(async () => root.unmount());
    host.remove();
  });
});
