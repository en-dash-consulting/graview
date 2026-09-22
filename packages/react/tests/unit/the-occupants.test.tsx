// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createViews, GraviewProvider, Occupants, useGraview } from "../../src/index.js";
import { useEffect } from "react";

/**
 * THE OCCUPANTS OVERLAY draws a docked figure the moment a seat sits
 * down, as a named button; pressing it makes it follow, Escape releases.
 */
const thing = defineNode("thing", { fields: z.object({ label: z.string() }), plural: "Things" });
const schema = createSchema([thing]);
const store = () => new Store({ schema, snapshot: { nodes: [{ id: "a", kind: "thing", label: "A" }] as never, edges: [] } });

function Seated({ who }: { who: string }) {
  const { registerSeatWho } = useGraview();
  useEffect(() => {
    registerSeatWho(who);
    return () => registerSeatWho(null);
  }, [who, registerSeatWho]);
  return null;
}

/* From altitude: a city with a pad at its origin block, where a docked robot stands. */
const frame = { nodes: [], connectors: [], width: 800, height: 500, t: 1, city: { cell: 40, originX: 200, originY: 120 } } as never;
/* In the stack: no city, no pad. */
const stack = { nodes: [], connectors: [], width: 800, height: 500, t: 1 } as never;

describe("the occupants", () => {
  it("draws no body for the seat at all: it lives on the frame, in the companion", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store()} views={createViews(schema)} initialView={EMPTY_VIEW}>
          <Seated who="tidy" />
          <Occupants frame={frame} width={800} height={500} whereIs={() => null} stageRef={{ current: host }} pan={{ x: 0, y: 0 }} />
        </GraviewProvider>,
      ),
    );
    /* No pad, no walk, no follow: a thing in the middle of the picture that
       moved on its own read as a distraction, and had no place inside a
       full-screen lens. The companion says who the seat is and what it is
       doing, at every height. */
    expect(host.querySelector('[data-graview-figure^="agent:tidy:"]')).toBeNull();
    await act(async () => root.unmount());
    host.remove();
  });

});
