// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { planFrom, type PlannedCall } from "@graview/tools";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PlanReview, registerDefaultViews } from "../../src/index.js";

/**
 * APPLY RUNS ONLY THE ROWS A PERSON KEPT. A review is one row per thing,
 * and a row struck through — declined, or refused — runs nothing, whatever
 * calls were filed under it. A call that acts on a record already standing
 * is a row of its own, named by that record, never filed under something
 * new that a plan happened to give the record's id as a name; and the press
 * is not offered when no row is left to run.
 */
const bed = defineNode("bed", { fields: z.object({ label: z.string() }), plural: "Beds" });
const schema = createSchema([bed]);
const { defineMutation } = bindSchema(schema);
const plant = defineMutation("plant-bed", {
  title: "Plant a bed",
  creates: ["bed"],
  input: z.object({ label: z.string() }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "bed"), kind: "bed", label: args.label } as never),
});
const rename = defineMutation("rename-bed", {
  title: "Rename a bed",
  subject: { kinds: ["bed"], arg: "bedId" },
  input: z.object({ bedId: nodeRef(["bed"]), label: z.string() }),
  apply: (ctx, args) => void ctx.patchNode(args.bedId, { label: args.label } as never),
});
const dig = defineMutation("dig-up", {
  title: "Dig up a bed",
  subject: { kinds: ["bed"], arg: "bedId" },
  input: z.object({ bedId: nodeRef(["bed"]) }),
  apply: (ctx, args) => void ctx.removeNode(args.bedId),
});
const make = (policy?: unknown) =>
  new Store({
    schema,
    mutations: [plant, rename, dig],
    ...(policy ? { policy: policy as never } : {}),
    snapshot: { nodes: [{ id: "b_roses", kind: "bed", label: "Rose Bed" }, { id: "b_herbs", kind: "bed", label: "Herb Bed" }] as never, edges: [] },
  });
const beds = (store: Store<typeof schema>) => store.graph.nodesOfKind("bed").map((node) => node.id).sort();

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot> | undefined;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

async function review(store: Store<typeof schema>, calls: readonly PlannedCall[], principal?: Principal) {
  const plan = planFrom(store, calls, principal ? { principal } : {});
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root!.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW} {...(principal ? { principal } : {})}>
        <PlanReview plan={plan} declinable />
      </GraviewProvider>,
    ),
  );
  return pressOf;
}

// Asked afresh each time: the review draws its rows again on every decline.
const pressOf = () => host.querySelector<HTMLButtonElement>('[data-testid="plan-apply"]')!;

describe("apply runs only the rows a person kept", () => {
  it("names a call on a standing record by that record, apart from a new thing given its id", async () => {
    const store = make();
    await review(store, [
      { mutation: "plant-bed", as: "b_herbs", args: { label: "New Tomatoes" }, why: "tomatoes" },
      { mutation: "rename-bed", args: { bedId: "b_herbs", label: "x" } },
      { mutation: "dig-up", args: { bedId: "b_herbs" } },
    ]);
    const rows = [...host.querySelectorAll('[data-testid="plan"] li')].map((li) => li.textContent ?? "");
    expect(rows.some((row) => row.includes("Herb Bed"))).toBe(true);
    expect(rows.find((row) => row.includes("New Tomatoes"))).not.toMatch(/Dig up/);
  });

  it("runs nothing filed under a row it declined", async () => {
    const store = make();
    const person: Principal = { kind: "human", id: "p9" } as Principal;
    await review(
      store,
      [
        { mutation: "plant-bed", as: "tomatoes", args: { label: "New Tomatoes" }, why: "tomatoes" },
        { mutation: "rename-bed", args: { bedId: { $plan: "tomatoes" }, label: "Tomatoes" } },
      ],
      person,
    );
    expect(pressOf().disabled).toBe(false);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="plan-decline-tomatoes"]')!.click());
    expect(pressOf().disabled).toBe(true);
    await act(async () => pressOf().click());
    expect(beds(store)).toEqual(["b_herbs", "b_roses"]);
  });

  it("offers no press when the only row is refused, and runs nothing waiting on it", async () => {
    const store = make({ roles: ["keeper", "crew"], grants: [{ roles: ["keeper"], mutations: ["plant-bed"] }, { roles: ["crew"], mutations: ["dig-up", "rename-bed"] }] });
    const crew: Principal = { kind: "human", id: "p9", roles: ["crew"] } as Principal;
    await review(
      store,
      [
        { mutation: "plant-bed", as: "seedlings", args: { label: "Seedlings" } },
        { mutation: "dig-up", args: { bedId: { $plan: "seedlings" } } },
      ],
      crew,
    );
    expect(pressOf().disabled).toBe(true);
    await act(async () => pressOf().click());
    expect(beds(store)).toEqual(["b_herbs", "b_roses"]);
  });

  it("runs no part of a row drawn as refused", async () => {
    // The crew may plant but not dig: the row is the new bed and the dig on it, and the dig is refused.
    const store = make({ roles: ["crew"], grants: [{ roles: ["crew"], mutations: ["plant-bed"] }] });
    const crew: Principal = { kind: "human", id: "p9", roles: ["crew"] } as Principal;
    await review(
      store,
      [
        { mutation: "plant-bed", as: "seedlings", args: { label: "Seedlings" } },
        { mutation: "dig-up", args: { bedId: { $plan: "seedlings" } } },
      ],
      crew,
    );
    expect(host.querySelectorAll("[data-plan-refused]").length).toBe(1);
    expect(pressOf().disabled).toBe(true);
    await act(async () => pressOf().click());
    expect(beds(store)).toEqual(["b_herbs", "b_roses"]);
  });

  it("runs a row on a standing record it kept, beside one it declined", async () => {
    const store = make();
    await review(store, [
      { mutation: "plant-bed", as: "tomatoes", args: { label: "New Tomatoes" } },
      { mutation: "rename-bed", args: { bedId: "b_roses", label: "Roses" } },
    ]);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="plan-decline-tomatoes"]')!.click());
    expect(pressOf().disabled).toBe(false);
    await act(async () => pressOf().click());
    expect(beds(store)).toEqual(["b_herbs", "b_roses"]);
    expect((store.graph.getNode("b_roses") as { label: string }).label).toBe("Roses");
  });
});
