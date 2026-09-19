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

const frame = { nodes: [], connectors: [], width: 800, height: 500, t: 1 } as never;

describe("the occupants", () => {
  it("draws the seated robot docked, as a named button, and follows on press until Escape", async () => {
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
    const figure = host.querySelector('[data-graview-figure^="agent:tidy:"]')!;
    expect(figure).not.toBeNull();
    expect(figure.getAttribute("data-graview-mode")).toBe("docked");
    const button = figure.querySelector<HTMLButtonElement>("button")!;
    expect(button.getAttribute("aria-label")).toContain("tidy — at its dock");
    await act(async () => button.click());
    expect(host.querySelector('[data-graview-figure^="agent:tidy:"]')!.getAttribute("data-graview-mode")).toBe("following");
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(host.querySelector('[data-graview-figure^="agent:tidy:"]')!.getAttribute("data-graview-mode")).not.toBe("following");
    await act(async () => root.unmount());
    host.remove();
  });
});
