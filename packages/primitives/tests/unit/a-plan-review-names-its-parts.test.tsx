// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { planFrom } from "@graview/tools";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PlanReview, registerDefaultViews } from "../../src/index.js";

/**
 * A PLAN'S REVIEW NAMES ITS PARTS, and an app's own selector reaches them.
 *
 * A product that dresses its review — the rows a model proposed, the press
 * that applies them, the one that throws them away — could only do it with
 * `!important`, because the buttons' size and the struck-through row were
 * style attributes. Each now says what it is in `data-graview-part`, and its
 * look is a rule an app's `[data-graview-part="plan-apply"]` outranks.
 */
const zone = defineNode("zone", { fields: z.object({ label: z.string() }), plural: "Zones" });
const feature = defineNode("feature", { fields: z.object({ label: z.string() }), plural: "Features" });
const schema = createSchema([zone, feature]);
const { defineMutation } = bindSchema(schema);
const stakeOut = defineMutation("stake-out", {
  title: "Stake out some ground",
  creates: ["zone"],
  input: z.object({ label: z.string() }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "zone"), kind: "zone", label: args.label } as never),
});
const place = defineMutation("place", {
  title: "Place a feature",
  creates: ["feature"],
  input: z.object({ label: z.string(), zone: nodeRef(["zone"]) }),
  apply: (ctx, args) =>
    void ctx.addNode({ id: ctx.freshId(args.label, "feature"), kind: "feature", label: args.label } as never),
});

let host: HTMLDivElement;
afterEach(() => host?.remove());

const draw = async () => {
  const store = new Store({ schema, mutations: [stakeOut, place], snapshot: { nodes: [], edges: [] } });
  const plan = planFrom(store, [
    { mutation: "stake-out", as: "lawn", args: { label: "Back Lawn" } },
    { mutation: "stake-out", as: "bed", args: { label: "Side Bed" } },
  ]);
  host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW}>
        <PlanReview plan={plan} declinable onDiscard={() => undefined} />
      </GraviewProvider>,
    ),
  );
  return root;
};
const parts = (part: string) => [...host.querySelectorAll<HTMLElement>(`[data-graview-part="${part}"]`)];

describe("a plan's review names its parts", () => {
  it("marks each row, each press, and where the presses stand", async () => {
    const root = await draw();
    expect(parts("plan-row")).toHaveLength(2);
    expect(parts("plan-decline")).toHaveLength(2);
    expect(parts("plan-actions")).toHaveLength(1);
    expect(parts("plan-apply").map((button) => button.textContent)).toEqual(["Apply all"]);
    expect(parts("plan-discard").map((button) => button.textContent)).toEqual(["Discard"]);
    await act(async () => root.unmount());
  });

  it("dresses them with rules an app's selector outranks, not with style attributes", async () => {
    const root = await draw();
    await act(async () => parts("plan-decline")[0]!.click());
    const row = parts("plan-row").find((one) => one.hasAttribute("data-plan-declined"))!;
    expect(row).toBeDefined();
    const pressed = ["plan-row", "plan-decline", "plan-actions", "plan-apply", "plan-discard"].flatMap(parts);
    expect(pressed.filter((element) => element.hasAttribute("style")).map((element) => element.dataset["graviewPart"])).toEqual([]);
    /* With no sheet of the app's own, a declined row is still struck through. */
    expect(getComputedStyle(row).textDecoration).toContain("line-through");
    expect(getComputedStyle(row).opacity).toBe("0.6");
    expect(getComputedStyle(parts("plan-apply")[0]!).padding).toBe("2px 12px");
    await act(async () => root.unmount());
  });
});
