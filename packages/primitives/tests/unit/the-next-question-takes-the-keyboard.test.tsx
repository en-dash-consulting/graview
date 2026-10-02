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
 * THE NEXT QUESTION TAKES THE KEYBOARD. "Put a car on sale" asks its fuel
 * and then its gearbox, both as choices; pressing "Petrol" took its button
 * away and left the keyboard on <body> (the seventh walk's journeys, every
 * scene run of "Making a car").
 */
const car = defineNode("car", { fields: z.object({ label: z.string(), fuel: z.enum(["petrol", "diesel"]), gearbox: z.enum(["manual", "automatic"]) }), plural: "Cars", label: (node) => node.label });
const schema = createSchema([car]);
const { defineMutation } = bindSchema(schema);
const sell = defineMutation("add-car", {
  title: "Put a car on sale",
  creates: ["car"],
  input: z.object({ fuel: z.enum(["petrol", "diesel"]), gearbox: z.enum(["manual", "automatic"]) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(`${args.fuel} ${args.gearbox}`, "car"), kind: "car", label: `${args.fuel} ${args.gearbox}`, ...args }),
});

describe("an ask of two questions of choices", () => {
  it("hands the keyboard to the second question when the first is answered", async () => {
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
    await act(async () => host.querySelector<HTMLButtonElement>('button[data-affordance="schema:add:add-car"]')!.click());
    const petrol = host.querySelector<HTMLButtonElement>('[data-graview-asking] [role=group] button[aria-label$="Petrol"]')!;
    petrol.focus();
    await act(async () => petrol.click());
    expect(document.activeElement?.getAttribute("aria-label")).toMatch(/^Gearbox: /);
    await act(async () => root.unmount());
    host.remove();
  });
});
