// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createViews, GraviewProvider, Scene } from "../../src/index.js";

/**
 * THE DISTRICTS THE ROW COULD NOT HOLD ARE NAMED, AND ONE PRESS AWAY.
 *
 * A district is read, not glanced at, so the row never squeezes a name below
 * a word — measured, a card needs about 132px to hold a plural on one line.
 * Past what it can hold it keeps the ones that fit and hands the rest to a
 * card that says how many are missing and names them. Every name is an
 * ordinary pick target: pressing one goes to that district, which is exactly
 * what pressing a district does.
 */
const kinds = ["zone", "practice", "routine", "concern", "task", "person", "note", "rule"];
const schema = createSchema(
  kinds.map((kind) =>
    defineNode(kind, { fields: z.object({ label: z.string() }), plural: `${kind[0]!.toUpperCase()}${kind.slice(1)}s` }),
  ) as never,
);

const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: { nodes: kinds.map((kind, i) => ({ id: `n${i}`, kind, label: "A" })) as never, edges: [] },
  });

let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  /* jsdom measures nothing, so the scene is told its size. */
  Object.defineProperty(host, "clientWidth", { configurable: true, value: 700 });
  Object.defineProperty(host, "clientHeight", { configurable: true, value: 520 });
  document.body.append(host);
});
afterEach(() => host.remove());

const scene = async (width: number) => {
  Object.defineProperty(host, "clientWidth", { configurable: true, value: width });
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <GraviewProvider store={store()} views={createViews(schema)} initialView={EMPTY_VIEW}>
        <Scene options={{ width, height: 520 }} animate={false} />
      </GraviewProvider>,
    );
  });
  const card = host.querySelector("[data-graview-beyond]");
  /* The names are behind one press now: the card is a button that says how
     many more, and the panel it opens names them. Open it before reading. */
  await act(async () => {
    card?.querySelector<HTMLButtonElement>(".graview-beyond-more")?.click();
  });
  const said = {
    districts: host.querySelectorAll("[data-graview-view^='kind:']").length,
    beyond: card ? Number(card.getAttribute("data-graview-beyond")) : 0,
    /* The panel is portalled onto the ground, so it is read off the host. */
    names: card ? [...host.querySelectorAll(".graview-beyond-list .graview-beyond-name")].map((el) => el.textContent) : [],
    label: host.querySelector("[data-graview-view='kinds:beyond']")?.getAttribute("aria-label") ?? null,
    picks: card ? [...host.querySelectorAll(".graview-beyond-list [data-graview-pick]")].map((el) => el.getAttribute("data-graview-pick")) : [],
  };
  await act(async () => root.unmount());
  return said;
};

describe("eight kinds in a narrow host", () => {
  it("draws the ones that fit and names the rest", async () => {
    /* jsdom measures nothing, so the reserved rails are computed from the
       default width and the row is narrower here than in a browser. What is
       under test is that nothing is lost, whatever the row can hold. */
    const said = await scene(700);
    expect(said.beyond).toBeGreaterThan(0);
    /* Every kind is either a district or a name on the card: nothing is lost. */
    expect(said.districts + said.beyond).toBe(kinds.length);
    expect(said.names.length).toBe(said.beyond);
  });

  it("says what it is, rather than reading out an address", async () => {
    const said = await scene(700);
    expect(said.label).toMatch(/more districts?$/);
    expect(said.label).not.toContain("kinds:beyond");
  });

  it("makes each name an ordinary pick target", async () => {
    const said = await scene(700);
    expect(said.picks.every((pick) => pick?.startsWith("kind:"))).toBe(true);
  });

  it("sheds nothing when the row has the room", async () => {
    const said = await scene(2400);
    expect(said.beyond).toBe(0);
    expect(said.districts).toBe(kinds.length);
  });
});
