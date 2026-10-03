// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Operation, type Policy, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ActivityRail, registerDefaultViews } from "../../src/index.js";

/**
 * THE RAIL SHOWS A CHANGE YOU CANNOT SEE without saying what it touched
 * (FR-16). A served store withholds the ops that touched what a seat may
 * not see; the rail read each op's author and intent as they came, and
 * offered an undo beside them, so a withheld op would have read as the
 * system doing something to nothing — and an undo that could only refuse.
 */
const shopper = defineNode("shopper", { fields: z.object({ label: z.string() }), plural: "Shoppers" });
const enquiry = defineNode("enquiry", {
  fields: z.object({ label: z.string() }),
  plural: "Enquiries",
  edges: { from: { to: ["shopper"], cardinality: "one", description: "who asked", inverse: "their enquiries" } },
});
const schema = createSchema([shopper, enquiry]);
const { defineMutation } = bindSchema(schema);
const ask = defineMutation("ask", {
  title: "Ask",
  subject: { kinds: ["shopper"], arg: "shopperId" },
  creates: ["enquiry"],
  input: z.object({ shopperId: nodeRef(["shopper"]), label: z.string() }),
  describe: (args) => `Ask “${args.label}”`,
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "enquiry");
    ctx.addNode({ id, kind: "enquiry", label: args.label });
    ctx.addEdge({ kind: "from", from: id, to: args.shopperId });
  },
});
const policy: Policy = {
  grants: [{ roles: ["shopper"], mutations: ["ask"], self: true }],
  sees: [{ roles: ["shopper"], kinds: ["shopper", "enquiry"], own: true }],
};
const bethan: Principal = { kind: "human", id: "shopper:bethan", roles: ["shopper"] };
const freya: Principal = { kind: "human", id: "shopper:freya", roles: ["shopper"] };

describe("the activity rail, on a log a seat may not fully see", () => {
  it("shows a withheld op as a change you cannot see, with nothing it touched and no undo", async () => {
    const full = new Store({
      schema,
      mutations: [ask],
      policy,
      snapshot: { nodes: [{ id: "shopper:bethan", kind: "shopper", label: "Bethan" }, { id: "shopper:freya", kind: "shopper", label: "Freya Davies" }] as never, edges: [] },
    });
    full.apply({ name: "ask", args: { shopperId: "shopper:freya", label: "Finance on the Golf" } }, { author: freya });
    // What Bethan's browser holds: the store as a served store sends it to her.
    const seen = full.seenBy(bethan);
    const store = new Store({ schema, mutations: [ask], policy, snapshot: seen.snapshot(), log: [...seen.log.all()] as Operation[] });

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW} principal={bethan}>
          <ActivityRail calls={[]} />
        </GraviewProvider>,
      );
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="activity-button"]')!.click();
    });
    const row = host.querySelector('[data-testid="withheld-change"]');
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain("A change you cannot see");
    expect(host.querySelector('[data-testid="diff-log"]')?.textContent).not.toMatch(/Freya|Finance|shopper:freya/);
    expect(row?.querySelector("[data-touched]")?.getAttribute("data-touched") ?? "").toBe("");
    expect(row?.querySelector('[data-testid="undo-turn"]')).toBeNull();
    await act(async () => root.unmount());
  });
});
