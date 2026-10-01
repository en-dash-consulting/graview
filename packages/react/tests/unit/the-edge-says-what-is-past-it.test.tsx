// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { districtsPastTheEdge, EMPTY_VIEW, layout, type ViewState } from "@graview/layout";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createViews, GraviewProvider, Scene, useGraview } from "../../src/index.js";

/**
 * THE EDGE SAYS WHAT IS PAST IT. On a phone the conference's city keeps its
 * shape and runs past the window, and Topics and Staff stood wholly off the
 * left edge: nothing on the screen said they were there, so a pointer had
 * nothing to press. A district whose middle is past the edge gets a sign on
 * that edge, and pressing the sign pans the ground until it is in view.
 */
const kinds = ["talk", "speaker", "session", "workshop", "room", "topic", "staff"];
const schema = createSchema(
  kinds.map((kind) =>
    defineNode(kind, { fields: z.object({ label: z.string() }), plural: `${kind[0]!.toUpperCase()}${kind.slice(1)}s` }),
  ) as never,
);
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: { nodes: kinds.flatMap((kind) => Array.from({ length: 6 }, (_, i) => ({ id: `${kind}:${i}`, kind, label: `${kind} ${i}` }))) as never, edges: [] },
  });

const PHONE = { width: 390, height: 640 };
const aloft: ViewState = { ...EMPTY_VIEW, overview: true };

describe("districts past the edge", () => {
  /* The phone's city as the gauntlet drew it: Topics wholly past the left edge, Rooms half on, Talks past the right. */
  const district = (kind: string, x: number, y: number) => ({ id: `kind:${kind}`, kind: "", plane: 2, x, y, width: 50, height: 70 }) as never;
  const city = { cell: 20, originX: 0, originY: 0, pan: { x: 0, y: 0 }, extent: { x: -300, y: 0, width: 900, height: 640 } };
  const phone = {
    width: PHONE.width,
    height: PHONE.height,
    city,
    nodes: [district("topic", -215, 275), district("room", -35, 362), district("session", 144, 449), district("talk", 503, 622)],
  };

  it("are named, with the side they lie past and a pan that brings each one in", () => {
    const past = districtsPastTheEdge(phone);
    expect(past.map((one) => [one.kind, one.side])).toEqual([
      ["topic", "left"],
      ["room", "left"],
      ["talk", "right"],
    ]);
    for (const one of past) {
      const card = phone.nodes.find((node: { id: string }) => node.id === one.id) as unknown as { x: number; y: number; width: number; height: number };
      const cx = card.x + card.width / 2 + one.by.x;
      const cy = card.y + card.height / 2 + one.by.y;
      expect(cx, `${one.kind} brought in across`).toBeGreaterThan(0);
      expect(cx).toBeLessThan(PHONE.width);
      expect(cy, `${one.kind} brought in down`).toBeGreaterThan(0);
      expect(cy).toBeLessThan(PHONE.height);
    }
  });

  it("and none on the ground of a place, or when the city fits", () => {
    expect(districtsPastTheEdge({ width: phone.width, height: phone.height, nodes: phone.nodes })).toEqual([]);
    expect(districtsPastTheEdge(layout(store().graph, schema, aloft, { width: 1800, height: 1200 }))).toEqual([]);
  });
});

let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  /* jsdom measures nothing, so the scene is told its size. */
  Object.defineProperty(host, "clientWidth", { configurable: true, value: PHONE.width });
  Object.defineProperty(host, "clientHeight", { configurable: true, value: PHONE.height });
  document.body.append(host);
});
afterEach(() => host.remove());

describe("on the ground", () => {
  it("puts a sign on the edge for each, and pressing one pans the ground to it", async () => {
    let pan: { x: number; y: number } | undefined;
    const Watch = () => {
      pan = useGraview().view.pan;
      return null;
    };
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store()} views={createViews(schema)} initialView={aloft}>
          <Scene options={PHONE} animate={false} />
          <Watch />
        </GraviewProvider>,
      );
    });
    const signs = [...host.querySelectorAll<HTMLButtonElement>("[data-graview-past-edge]")];
    expect(signs.length).toBeGreaterThan(0);
    const sign = signs[0]!;
    const kind = sign.getAttribute("data-graview-past-edge")!.slice("kind:".length);
    expect(sign.textContent).toContain(`${kind[0]!.toUpperCase()}${kind.slice(1)}s`);
    await act(async () => sign.click());
    expect(pan, "the ground moved").toBeDefined();
    expect(host.querySelector(`[data-graview-past-edge="kind:${kind}"]`), "and the district is no longer past the edge").toBeNull();
    root.unmount();
  });
});
