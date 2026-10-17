// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { BesideTheMap, createViews, GraviewProvider, useNavigation } from "@graview/react";
import { act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MapPanel, registerDefaultViews } from "../../src/index.js";

/*
 * "GO TO IT" HANDS THE KEYBOARD TO WHERE IT WENT. The press takes the map,
 * the panel and the button in it away, and the keyboard fell to <body>
 * (the nightly's watch, `keyboard-lands-nowhere`, on discography's record
 * panel). It goes to the record's card on the ground once the card is
 * drawn — a frame or several later, as the scene draws it. Until then it
 * waits on the scene's ground, which the press does not take away: on the
 * nightly's loaded runner the card came seconds late, and the keyboard sat
 * on <body> the whole while.
 */
const hive = defineNode("hive", { fields: z.object({ label: z.string() }), plural: "Hives", noun: "hive" });
const schema = createSchema([hive]);
const store = () => new Store({ schema, snapshot: { nodes: [{ id: "h1", kind: "hive", label: "Meadow 01" }] as never, edges: [] } });

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};
Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 1280, bottom: 800, width: 1280, height: 800, toJSON: () => ({}) }) as DOMRect;

/* What the scene draws on the ground once the stop is the record's: its card, which takes the keyboard. */
function Ground({ late = 0 }: { readonly late?: number }) {
  const { view } = useNavigation();
  const down = !view.overview && view.focusId === "h1";
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!down) return;
    const timer = setTimeout(() => setDrawn(true), late);
    return () => clearTimeout(timer);
  }, [down, late]);
  return (
    <div className="graview-ground">
      <div data-graview-stage="">{down && drawn ? <div data-graview-view="h1" tabIndex={-1} /> : null}</div>
    </div>
  );
}

const frames = (n: number) => act(async () => new Promise((resolve) => setTimeout(resolve, n * 20)));
/* Until the scene has drawn the record's card, and a few frames after. */
const cardDrawn = async (host: HTMLElement) => {
  for (let tick = 0; tick < 100 && !host.querySelector('[data-graview-view="h1"]'); tick += 1) await frames(1);
  await frames(4);
};

async function pressGo(late: number, check: (host: HTMLElement) => Promise<void>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store()} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} initialSelection={["h1"]}>
        <BesideTheMap.Provider value={true}>
          <MapPanel />
          <Ground late={late} />
        </BesideTheMap.Provider>
      </GraviewProvider>,
    ),
  );
  for (let tick = 0; tick < 50 && !host.querySelector('[data-testid="record-panel-go"]'); tick += 1) await frames(1);
  const go = host.querySelector<HTMLButtonElement>('[data-testid="record-panel-go"]');
  expect(go, "the record panel's Go to it").not.toBeNull();
  go!.focus();
  await act(async () => go!.click());
  try {
    await check(host);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
}

describe("Go to it", () => {
  it("hands the keyboard to the record's card on the ground, not to the page", async () => {
    await pressGo(0, async (host) => {
      await cardDrawn(host);
      expect(document.activeElement?.getAttribute("data-graview-view")).toBe("h1");
    });
  });

  it("keeps the keyboard on the scene's ground while the card is still to be drawn, never on <body>", async () => {
    await pressGo(400, async (host) => {
      expect(host.querySelector('[data-testid="record-panel-go"]'), "the panel went with the map").toBeNull();
      expect(document.activeElement).toBe(host.querySelector(".graview-ground"));
      await frames(8);
      expect(document.activeElement).toBe(host.querySelector(".graview-ground"));
      // Then, the card drawn, it is handed on.
      await cardDrawn(host);
      expect(document.activeElement?.getAttribute("data-graview-view")).toBe("h1");
      // Handed on, the ground is not left a stop of its own.
      expect(host.querySelector(".graview-ground")?.hasAttribute("tabindex")).toBe(false);
    });
  });
});
