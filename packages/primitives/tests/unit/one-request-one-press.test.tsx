// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ChatPanel, registerDefaultViews } from "../../src/index.js";

/**
 * ONE REQUEST, ONE PRESS, AND IT LANDS WHERE IT WAS OFFERED.
 *
 * "Add a new plot and put a sunflower in it" read as five messages: the
 * reply, "Stake out a plot …", "Sow something …", and a "Done — … Undo
 * works." bubble for each. The proposals were named by the menu's titles,
 * the sowing asked for a plot the model had already named, and each press
 * posted a message of its own. Now: proposals in the act's own words, one
 * press for both — the sowing resolved against the plot the first press
 * made — and each proposal turning into its own outcome in place.
 */
const plot = defineNode("plot", { fields: z.object({ label: z.string() }), plural: "Plots" });
const planting = defineNode("planting", {
  fields: z.object({ label: z.string() }),
  plural: "Plantings",
  edges: { "grows-in": { to: ["plot"] } },
});
const schema = createSchema([plot, planting]);
const { defineMutation } = bindSchema(schema);
const addPlot = defineMutation("add-plot", {
  title: "Stake out a plot",
  creates: ["plot"],
  input: z.object({ label: z.string().min(1) }),
  describe: (args) => `Stake out ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "plot"), kind: "plot", label: args.label });
  },
});
const sow = defineMutation("sow", {
  title: "Sow something",
  creates: ["planting"],
  input: z.object({ label: z.string().min(1), plotId: nodeRef(["plot"]) }),
  describe: (args, graph) => `Sow ${args.label} in ${String(graph.getNode(args.plotId)?.["label"] ?? args.plotId)}`,
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "planting");
    ctx.addNode({ id, kind: "planting", label: args.label });
    ctx.addEdge({ kind: "grows-in", from: id, to: args.plotId });
  },
});
const gardener: Principal = { kind: "human", id: "erin" };

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

describe("a request the seat answers with several changes", () => {
  it("offers them in their own words, applies them in one press, and settles each in place", async () => {
    const store = new Store({ schema, mutations: [addPlot, sow], invariants: [] });
    const respond = async () => ({
      say: "Adding a plot and sowing a sunflower.",
      proposals: [
        { mutation: "add-plot", args: { label: "back bed" } },
        // Named by the plot the first proposal makes — which does not exist yet.
        { mutation: "sow", args: { label: "sunflower", plotId: "back bed" } },
      ],
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW} principal={gardener}>
          <ChatPanel inside respond={respond as never} />
        </GraviewProvider>,
      ),
    );
    const field = host.querySelector<HTMLInputElement>('[aria-label="Message the seat"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "add a new plot and put a sunflower in it");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      field.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => new Promise((r) => setTimeout(r, 20)));

    const offered = [...host.querySelectorAll('[data-testid="chat-apply"]')].map((button) => button.textContent);
    expect(offered[0]).toBe("Stake out back bed");
    // Waiting on the plot the first one makes: named, not asked for, and not pressable alone yet.
    expect(offered[1]).toBe("Sow sunflower in back bed");
    expect(host.querySelectorAll<HTMLButtonElement>('[data-testid="chat-apply"]')[1]!.disabled).toBe(true);

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="chat-apply-all"]')!.click());
    await act(async () => new Promise((r) => setTimeout(r, 20)));

    const landed = [...host.querySelectorAll('[data-testid="chat-applied"]')].map((line) => line.textContent);
    expect(landed).toEqual(["✓ Stake out back bed", "✓ Sow sunflower in back bed"]);
    expect(store.graph.nodesOfKind("planting")).toHaveLength(1);
    // No message of its own per press: the thread is still the ask and the answer.
    expect(host.querySelectorAll('[data-testid="chat-panel"] ol > li')).toHaveLength(2);
    expect(host.textContent).not.toContain("Undo works");
    await act(async () => root.unmount());
  });
});
