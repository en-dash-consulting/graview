// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Inspector, registerDefaultViews } from "../../src/index.js";

/**
 * SEVERAL WORDS, ASKED IN THE SCENE. "Put a car on sale" takes the car's
 * features as a list of words; the strip asked for them in one text field
 * and sent the line as a string, the act refused "Features — expected
 * array, received string", and the ask sat on its last step refusing every
 * Apply (the seventh walk).
 */
const car = defineNode("car", { fields: z.object({ label: z.string(), features: z.array(z.string()) }), plural: "Cars", label: (node) => node.label });
const schema = createSchema([car]);
const { defineMutation } = bindSchema(schema);
const sell = defineMutation("add-car", {
  title: "Put a car on sale",
  creates: ["car"],
  input: z.object({ label: z.string().min(1), features: z.array(z.string().min(1)).max(24) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "car"), kind: "car", label: args.label, features: args.features }),
});

async function answering(lines: readonly string[]) {
  const store = new Store({ schema, mutations: [sell] });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(() => {
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true, selection: ["kind:car"] }}>
        <Inspector />
      </GraviewProvider>,
    );
  });
  const offer = host.querySelector<HTMLButtonElement>('button[data-affordance="schema:add:add-car"]')!;
  await act(async () => offer.click());
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  for (const line of lines) {
    const input = host.querySelector<HTMLInputElement>("[data-graview-asking] form input")!;
    await act(async () => {
      set.call(input, line);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.form!.requestSubmit());
  }
  root.unmount();
  host.remove();
  return store.graph.allNodes().map((node) => (node as { features?: unknown }).features);
}

describe("a list of words, asked in the strip", () => {
  it("is sent as a list, split where the person put commas", async () => {
    expect(await answering(["2021 Golf Life", "Heated seats, Apple CarPlay"])).toEqual([["Heated seats", "Apple CarPlay"]]);
  });

  it("and nothing typed is an empty list, not a refusal", async () => {
    expect(await answering(["2021 Golf Life", ""])).toEqual([[]]);
  });
});
