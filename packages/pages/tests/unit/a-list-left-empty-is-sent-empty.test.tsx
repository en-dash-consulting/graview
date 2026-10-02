// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DerivedForm } from "../../src/index.js";

/**
 * A LIST NOBODY ADDED TO IS SENT EMPTY. "Put a car on sale" takes the
 * car's features as a list, and a car with none listed is a car the
 * declaration allows; the form sent nothing at all for it and the press
 * was refused "Features — expected array, received undefined" (the
 * seventh walk). No example had a list argument, so no form had ever been
 * sent without filling one.
 */
const car = defineNode("car", { fields: z.object({ label: z.string(), features: z.array(z.string()).max(24) }), plural: "Cars" });
const schema = createSchema([car]);
const { defineMutation } = bindSchema(schema);
const sell = defineMutation("add-car", {
  title: "Put a car on sale",
  creates: ["car"],
  input: z.object({ label: z.string().min(1), features: z.array(z.string().min(1)).max(24) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "car"), kind: "car", label: args.label, features: args.features }),
});

describe("a form with a list argument nobody added to", () => {
  it("sends it as an empty list, and the act takes it", async () => {
    const store = new Store({ schema, mutations: [sell] });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<DerivedForm store={store} mutation={sell} />));
    const name = host.querySelector<HTMLInputElement>('input[name="label"]')!;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(name, "2021 Volkswagen Golf Life");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => host.querySelector("form")!.requestSubmit());
    expect(host.querySelector('[data-testid="refused"]')?.textContent ?? "").toBe("");
    expect(store.graph.allNodes().map((node) => (node as { features?: unknown }).features)).toEqual([[]]);
    await act(async () => root.unmount());
    host.remove();
  });
});
