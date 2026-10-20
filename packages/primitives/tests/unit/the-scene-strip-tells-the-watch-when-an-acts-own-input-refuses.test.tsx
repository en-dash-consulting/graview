// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { fetchInspector, Inspector, Standing, registerDefaultViews } from "../../src/index.js";

beforeAll(() => fetchInspector());

/**
 * THE SCENE'S STRIP TELLS THE WATCH WHEN AN ACT'S OWN INPUT REFUSES THERE
 * (carried from W-228 and W-238). The pages apply a press, and the store
 * tells a watching harness when the act's own input refuses it
 * (`refusedInput`), so an act offered whole and refused on press is a
 * finding. The scene's strip previews an act before it applies it, and the
 * preview refused first — said in the strip, and told to nobody — so the
 * same offer on the scene passed every harness.
 */
const loan = defineNode("loan", {
  fields: z.object({ label: z.string(), late: z.boolean() }),
  plural: "Loans",
  label: (node) => node.label,
});
const schema = createSchema([loan]);
const { defineMutation, defineInvariant } = bindSchema(schema);
const giveBack = defineMutation("give-back", {
  title: "Check it back in",
  subject: { kinds: ["loan"], arg: "loanId" },
  writes: ["late"],
  input: z.object({ loanId: nodeRef(["loan"]), note: z.string().optional() }),
  apply(ctx, args) {
    ctx.patchNode(args.loanId, { late: false });
  },
});
// A repair offered whole whose argument its act's input refuses: the shape of the twelfth walk's "Not yet: Venue id — invalid input".
const onTime = defineInvariant("on-time", {
  label: "Back on time",
  description: "Nothing is late.",
  scope: { kind: "loan" },
  repairs: ["give-back"],
  evaluate({ subject }) {
    return subject.late
      ? [{ invariant: "on-time", subjectId: subject.id, label: subject.label, message: `${subject.label} is late`, nodeIds: [subject.id], repairs: [{ mutation: "give-back", args: { loanId: subject.id, note: 7 }, label: "Check it back in" }] }]
      : [];
  },
});

afterEach(() => {
  delete (globalThis as { __graviewWatch?: unknown }).__graviewWatch;
});

describe("a press on the scene's strip that the act's own input refuses", () => {
  it("is told to a watching harness, as it is on the pages, and said in the strip", async () => {
    const told: { mutation: string; message: string; author?: string }[] = [];
    (globalThis as { __graviewWatch?: unknown }).__graviewWatch = { refusedInput: (refusal: (typeof told)[number]) => told.push(refusal) };
    const store = new Store({ schema, mutations: [giveBack], invariants: [onTime], snapshot: { nodes: [{ id: "l1", kind: "loan", label: "Hammer drill", late: true }] as never, edges: [] } });
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
    // Working out what to offer, before anything is pressed, tells nothing.
    expect(told).toEqual([]);
    await act(async () => repair!.click());
    expect(store.violations()).not.toEqual([]);
    expect(host.querySelector('[data-testid="refused"]')?.textContent).toBeTruthy();
    expect(told).toEqual([expect.objectContaining({ mutation: "give-back", message: expect.stringContaining("note") })]);
    await act(async () => root.unmount());
    host.remove();
  });
});
