// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { planFrom } from "@graview/tools";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { Begin, PlanReview, registerDefaultViews } from "../../src/index.js";

/**
 * THE WAY IN, DERIVED.
 *
 * The framework derives a home, a list per kind, a record per node, a form
 * per act and a problems page — and not the way in, which is the one state
 * every product ships in and the one its author never sees, because their own
 * graph has had data in it since the first afternoon. A ten-kind app on an
 * empty graph is one door and nine silent districts.
 */
const zone = defineNode("zone", { fields: z.object({ label: z.string() }), plural: "Zones" });
const feature = defineNode("feature", { fields: z.object({ label: z.string() }), plural: "Features" });
const almanac = defineNode("almanac", { fields: z.object({ label: z.string() }), plural: "Almanacs" });
const schema = createSchema([zone, feature, almanac]);
const { defineMutation } = bindSchema(schema);

const stakeOut = defineMutation("stake-out", {
  title: "Stake out some ground",
  creates: ["zone"],
  input: z.object({ label: z.string() }),
  apply: (ctx, args) =>
    void ctx.addNode({ id: ctx.freshId(args.label, "zone"), kind: "zone", label: args.label } as never),
});
const placeFeature = defineMutation("place-feature", {
  title: "Place a feature",
  creates: ["feature"],
  input: z.object({ label: z.string(), zoneId: nodeRef(["zone"]) }),
  apply: (ctx, args) =>
    void ctx.addNode({ id: ctx.freshId(args.label, "feature"), kind: "feature", label: args.label } as never),
});

/** Acts on a zone rather than making one — the shape a row gathers. */
const redrawBounds = defineMutation("redraw-bounds", {
  title: "Redraw the bounds",
  subject: { kinds: ["zone"], arg: "zoneId" },
  input: z.object({ zoneId: nodeRef(["zone"]), corners: z.number() }),
  apply: () => undefined,
});

const store = (nodes: readonly unknown[] = []) =>
  new Store({
    schema,
    mutations: [stakeOut, placeFeature, redrawBounds],
    snapshot: { nodes: nodes as never, edges: [] },
  });

/** The same product, with a seat that may plant but may not survey. */
const guarded = (nodes: readonly unknown[] = []) =>
  new Store({
    schema,
    mutations: [stakeOut, placeFeature, redrawBounds],
    policy: { roles: ["keeper", "crew"], grants: [{ roles: ["keeper"], mutations: ["stake-out"] }, { roles: ["crew"], mutations: ["place-feature"] }] },
    snapshot: { nodes: nodes as never, edges: [] },
  });
const crew = { kind: "human", id: "c", roles: ["crew"] } as const;

let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => host.remove());

const draw = async (node: React.ReactNode, at = store(), principal?: Principal) => {
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <GraviewProvider store={at} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW} {...(principal ? { principal } : {})}>
        {node}
      </GraviewProvider>,
    );
  });
  return { root, at };
};

describe("the first screen of an empty product", () => {
  it("names the door, and what everything else is waiting for", async () => {
    const { root } = await draw(<Begin />);
    const list = host.querySelector('[data-testid="begin"]')!;
    expect(list.textContent).toContain("Zones");
    /* The one act that can run with nothing in the graph. */
    expect(host.querySelector('[data-testid="begin-stake-out"]')).not.toBeNull();
    /* And the one that cannot, saying why rather than showing nothing. */
    expect(host.querySelector('[data-testid="begin-place-feature"]')).toBeNull();
    expect(list.textContent).toContain("Waiting for Zones");
    await act(async () => root.unmount());
  });

  it("says plainly when a kind arrives with the data rather than by an act", async () => {
    const { root } = await draw(<Begin />);
    expect(host.querySelector('[data-testid="begin"]')!.textContent).toContain(
      "Nothing here makes almanacs",
    );
    await act(async () => root.unmount());
  });

  it("offers the next door once the first is through", async () => {
    const { root } = await draw(<Begin />, store([{ id: "lawn", kind: "zone", label: "Back Lawn" }]));
    expect(host.querySelector('[data-testid="begin-place-feature"]')).not.toBeNull();
    /* And stops offering what is already done. */
    expect(host.querySelector('[data-begin-kind="zone"]')!.textContent).not.toContain("none yet");
    await act(async () => root.unmount());
  });

  it("says who may, rather than drawing an empty page at a seat that may not", async () => {
    /*
     * A guarded store answers an unroled — or under-roled — seat by refusing
     * everything. A first screen that responds by rendering nothing puts a
     * person in front of a blank page with no way in and no reason given,
     * which is the exact thing this surface exists to end.
     */
    const { root } = await draw(<Begin />, guarded(), crew);
    expect(host.querySelector('[data-testid="begin-stake-out"]')).toBeNull();
    expect(host.querySelector('[data-testid="begin-withheld-zone"]')!.textContent).toMatch(/keeper/);
    await act(async () => root.unmount());
  });

  it("stands down when nothing left is this seat's to begin, rather than listing other people's work", async () => {
    /*
     * Found by a working property: every area planted and tended, and the
     * front page still headed "what has to exist before the rest of it can"
     * — because two kinds were empty and the reader was not permitted
     * either of them. An empty graph keeps the opposite rule, above.
     */
    const standing = guarded([
      { id: "lawn", kind: "zone", label: "Back Lawn" },
      { id: "a", kind: "almanac", label: "2026" },
    ]);
    const asKeeper = { kind: "human", id: "k", roles: ["keeper"] } as const;
    const { root } = await draw(<Begin whenFull={<p data-testid="full">All set.</p>} />, standing, asKeeper);
    /* A keeper may not place features, and features are all that is left. */
    expect(host.querySelector('[data-testid="begin"]')).toBeNull();
    expect(host.querySelector('[data-testid="full"]')).not.toBeNull();
    await act(async () => root.unmount());
  });

  it("stands down when everything has something in it", async () => {
    const full = store([
      { id: "lawn", kind: "zone", label: "Back Lawn" },
      { id: "oak", kind: "feature", label: "The oak" },
      { id: "a", kind: "almanac", label: "2026" },
    ]);
    const { root } = await draw(<Begin whenFull={<p data-testid="full">All set.</p>} />, full);
    expect(host.querySelector('[data-testid="begin"]')).toBeNull();
    expect(host.querySelector('[data-testid="full"]')).not.toBeNull();
    await act(async () => root.unmount());
  });
});

describe("what a model wants to do, before it does it", () => {
  const proposals = [
    { mutation: "place-feature", args: { label: "The oak", zoneId: { $plan: "lawn" } }, why: "it stands there" },
    { mutation: "stake-out", as: "lawn", args: { label: "Back Lawn" }, why: "the ground it stands on" },
    { mutation: "invent-a-thing", args: {} },
  ];

  it("shows them in the order they will run, with what it makes", async () => {
    const at = store();
    const { root } = await draw(<PlanReview plan={planFrom(at, proposals)} />, at);
    const shown = [...host.querySelectorAll('[data-testid="plan"] li')].map((li) => li.textContent);
    /* Named by the THING, not the act: a person decides about the lawn. */
    expect(shown[0]).toContain("Back Lawn");
    expect(shown[1]).toContain("The oak");
    /* The panel's subtitle carries the count and what it makes. */
    expect(host.textContent).toContain("2 of 3 to run");
    expect(host.textContent).toContain("making 1 zone, 1 feature");
    await act(async () => root.unmount());
  });

  it("strikes a refusal through with its reason rather than dropping it", async () => {
    const at = store();
    const { root } = await draw(<PlanReview plan={planFrom(at, proposals)} />, at);
    const refused = host.querySelector("[data-plan-refused]")!;
    expect(refused.textContent).toContain("invent-a-thing");
    expect(host.querySelector('[data-testid="plan-refusal"]')!.textContent).toContain("registered");
    await act(async () => root.unmount());
  });

  it("lets a person decline, and says what goes with it", async () => {
    const at = store();
    const survey = [
      { mutation: "stake-out", as: "lawn", args: { label: "Back Lawn" }, why: "the big one" },
      { mutation: "place-feature", args: { label: "The oak", zoneId: { $plan: "lawn" } }, why: "it stands there" },
    ];
    const { root } = await draw(<PlanReview plan={planFrom(at, survey)} declinable />, at);
    /* Said before the press: declining the area declines the tree in it. */
    expect(host.querySelector('[data-testid="plan-goes-with"]')!.textContent).toContain("1 other goes with it");
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="plan-decline-lawn"]')!.click());
    expect(host.querySelectorAll("[data-plan-declined]")).toHaveLength(2);
    /* And the struck row says which decision carried it, by name. */
    expect(host.querySelector('[data-testid^="plan-carried-"]')!.textContent).toContain("goes with Back Lawn");
    expect(host.textContent).toContain("0 of 2 to run");
    /* And it is a decision, not a deletion. */
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="plan-decline-lawn"]')!.click());
    expect(host.textContent).toContain("2 of 2 to run");
    await act(async () => root.unmount());
  });

  it("gathers what the plan says about one thing into that thing's row", async () => {
    /*
     * The model proposes an area and then draws its outline. Listed as
     * calls that read "Back Lawn" and then "Redraw the bounds" underneath —
     * the model repeating itself, except it was not.
     */
    const at = store();
    const survey = [
      { mutation: "stake-out", as: "lawn", args: { label: "Back Lawn" }, why: "the big one" },
      { mutation: "redraw-bounds", args: { zoneId: { $plan: "lawn" }, corners: 4 } },
    ];
    const { root } = await draw(<PlanReview plan={planFrom(at, survey)} />, at);
    expect(host.querySelectorAll('[data-testid="plan"] li')).toHaveLength(1);
    expect(host.querySelector('[data-plan-row="lawn"]')!.textContent).toContain("Back Lawn");
    /* And what else it said about the lawn, under it, in the act's own words. */
    expect(host.querySelector('[data-testid="plan-also-lawn"]')!.textContent).toContain("Redraw the bounds");
    expect(host.textContent).toContain("1 of 1 to run");
    await act(async () => root.unmount());
  });

  it("names a row after the thing already standing, and gathers what is said about it", async () => {
    /*
     * A plan that only changes things already in the graph carries no
     * labels — the names are on the nodes. Asking the plan to repeat them
     * would be asking it to duplicate the graph, so the row reads them off
     * the node it is about, and two acts on the same node are one row.
     */
    const at = store([{ id: "lawn", kind: "zone", label: "Back Lawn" }]);
    const plan = planFrom(at, [
      { mutation: "redraw-bounds", args: { zoneId: "lawn", corners: 4 } },
      { mutation: "redraw-bounds", args: { zoneId: "lawn", corners: 6 } },
    ]);
    const { root } = await draw(
      <PlanReview plan={plan} also={(entry) => `drawn with ${String(entry.call.args["corners"])} corners`} />,
      at,
    );
    const rows = [...host.querySelectorAll('[data-testid="plan"] li')];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.textContent).toContain("Back Lawn");
    /* Including the first act, because the row is not named after it. */
    expect(rows[0]!.textContent).toContain("drawn with 4 corners · drawn with 6 corners");
    await act(async () => root.unmount());
  });

  it("applies the ready ones as one turn, and says so", async () => {
    const at = store();
    let batch: string | null = null;
    const { root } = await draw(
      <PlanReview plan={planFrom(at, proposals)} onApplied={(id) => (batch = id)} />,
      at,
    );
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="plan-apply"]')!.click());
    expect(host.querySelector('[data-testid="plan-done"]')!.textContent).toContain("2 applied as one turn");
    expect(at.graph.nodesOfKind("zone")).toHaveLength(1);
    expect(at.graph.nodesOfKind("feature")).toHaveLength(1);
    /* One handle, so the whole seeding goes back together. */
    at.undo(batch!);
    expect(at.graph.allNodes()).toHaveLength(0);
    await act(async () => root.unmount());
  });
});
