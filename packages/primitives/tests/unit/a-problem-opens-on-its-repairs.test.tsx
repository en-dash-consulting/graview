// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews, useGraview, useSelection } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { fetchInspector, Inspector, registerDefaultViews } from "../../src/index.js";

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

/** What a broken rule's fix that asks for something does (`inbox-pane.tsx`): selects what it names and opens the acts on it. */
function OpenTheActs({ on }: { readonly on: string }) {
  const { setMenuAt } = useGraview();
  const { set } = useSelection();
  return (
    <button
      type="button"
      data-testid="open-the-acts"
      onClick={() => {
        set([on]);
        setMenuAt({ x: 0, y: 0, on });
      }}
    />
  );
}

describe("the acts opened on what a problem is about", () => {
  it("have its repair in them, and the repair repairs it", async () => {
    const store = new Store({ schema, mutations: [lend, giveBack], invariants: [onTime] });
    store.apply({ name: "lend", args: { label: "Hammer drill" } });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }}>
          <OpenTheActs on={store.violations()[0]!.subjectId!} />
          <Inspector placement="menu" />
        </GraviewProvider>,
      );
    });
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="open-the-acts"]')!.click());
    const repair = host.querySelector<HTMLButtonElement>('[data-affordance^="invariant:"]');
    expect(repair?.textContent).toContain("Check it back in");
    await act(async () => repair!.click());
    expect(store.violations()).toEqual([]);
    await act(async () => root.unmount());
    host.remove();
  });
});
