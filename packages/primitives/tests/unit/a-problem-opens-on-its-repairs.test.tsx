// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { fetchInspector, Inspector, Standing, registerDefaultViews } from "../../src/index.js";

// The pane is fetched when it is first wanted; here, before anything is drawn.
beforeAll(() => fetchInspector());

/**
 * A PROBLEM OPENS ON ITS REPAIRS (W-179). The scene's acts are the menu at
 * the pointer; there is no inspector standing beside a selection. Pressing
 * a problem under the standing only SELECTED what it named — at altitude,
 * a loan inside a shut district — and its repair was on no surface at all:
 * "Getting from a problem to its repair" could not be done on the scene in
 * any example, at either width, with either hand (the eighth walk).
 */
const loan = defineNode("loan", {
  description: "A tool out with a member.",
  fields: z.object({ label: z.string(), late: z.boolean() }),
  plural: "Loans",
  label: (node) => node.label,
});
const schema = createSchema([loan]);
const { defineMutation, defineInvariant } = bindSchema(schema);
const lend = defineMutation("lend", {
  title: "Lend it",
  creates: ["loan"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "loan"), kind: "loan", label: args.label, late: true });
  },
});
const giveBack = defineMutation("give-back", {
  title: "Check it back in",
  subject: { kinds: ["loan"], arg: "loanId" },
  writes: ["late"],
  input: z.object({ loanId: nodeRef(["loan"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.loanId, { late: false });
  },
});
const onTime = defineInvariant("on-time", {
  label: "Back on time",
  description: "Nothing is late.",
  scope: { kind: "loan" },
  repairs: ["give-back"],
  evaluate({ subject }) {
    return subject.late
      ? [{ invariant: "on-time", subjectId: subject.id, label: subject.label, message: `${subject.label} is late`, nodeIds: [subject.id], repairs: [{ mutation: "give-back", args: { loanId: subject.id }, label: "Check it back in" }] }]
      : [];
  },
});

describe("a problem pressed under the standing", () => {
  it("opens the acts on what it is about, with its repair in them, and the repair repairs it", async () => {
    const store = new Store({ schema, mutations: [lend, giveBack], invariants: [onTime] });
    store.apply({ name: "lend", args: { label: "Hammer drill" } });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }}>
          <Standing />
          <Inspector placement="menu" />
        </GraviewProvider>,
      );
    });
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="standing"]')!.click());
    for (let tries = 0; tries < 40 && !host.querySelector('[data-testid="problems"] button'); tries += 1) await act(async () => new Promise((wait) => setTimeout(wait, 25)));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="problems"] button')!.click());
    const repair = host.querySelector<HTMLButtonElement>('[data-affordance^="invariant:"]');
    expect(repair?.textContent).toContain("Check it back in");
    await act(async () => repair!.click());
    expect(store.violations()).toEqual([]);
    await act(async () => root.unmount());
    host.remove();
  });
});
