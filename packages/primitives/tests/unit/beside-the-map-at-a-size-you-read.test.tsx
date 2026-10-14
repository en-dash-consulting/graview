// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { aggregateId, EMPTY_VIEW, kindCardId, type ViewState } from "@graview/layout";
import { BesideTheMap, createViews, GraviewProvider, type ViewComponent } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MapPanel, mapPanelShows, registerDefaultViews } from "../../src/index.js";

/*
 * BESIDE THE MAP, AT A SIZE A PERSON READS. A lens pressed from altitude
 * opens at full size in a panel — not as a billboard of eight-pixel text on
 * its plot; a chosen record lists its links there, a relation to a heading
 * in its kind's words — not as a card of chips floating over the districts;
 * a chosen district lists its relations and every record in it.
 */
const area = defineNode("area", { fields: z.object({ label: z.string() }), plural: "Areas", noun: "area" });
const feature = defineNode("feature", {
  fields: z.object({ label: z.string() }),
  plural: "Features",
  noun: "feature",
  edges: { partOf: { to: ["area"], description: "the part it lives in", inverse: "what this part does" } },
});
const schema = createSchema([area, feature]);
const Board: ViewComponent<typeof schema> = ({ nodes, mode }) => (
  <div data-testid="the-board" data-mode={mode}>
    {(nodes ?? []).map((node) => (
      <span key={node.id} data-graview-pick={node.id}>
        {String((node as { label?: string }).label)}
      </span>
    ))}
  </div>
);
const views = () => registerDefaultViews(schema, createViews(schema)).register("feature", { cardinality: "many", fidelity: "full" }, Board, { title: "The board" });
const store = () =>
  new Store({
    schema,
    snapshot: {
      nodes: [
        { id: "a1", kind: "area", label: "core" },
        { id: "a2", kind: "area", label: "pages" },
        { id: "f1", kind: "feature", label: "Undo" },
        { id: "f2", kind: "feature", label: "Search" },
      ] as never,
      edges: [
        { kind: "partOf", from: "f1", to: "a1" },
        { kind: "partOf", from: "f2", to: "a1" },
      ],
    },
  });

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};
/* A desk's width, which jsdom does not lay out: the panel docks beside the map rather than rising as a sheet. */
Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800, toJSON: () => ({}) }) as DOMRect;

async function mounted(view: ViewState, selection: readonly string[] = [], onView?: (next: ViewState) => void) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store()} views={views()} initialView={view} initialSelection={selection} {...(onView ? { onViewChange: onView } : {})}>
        <BesideTheMap.Provider value={true}>
          <MapPanel />
        </BesideTheMap.Provider>
      </GraviewProvider>,
    ),
  );
  /* The panel is fetched the first time it is drawn: wait for it to arrive. */
  for (let tick = 0; tick < 50 && view.overview && !host.querySelector("[data-graview-map-panel]"); tick += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  return { host, unmount: () => act(async () => root.unmount()) };
}

const aloft = { ...EMPTY_VIEW, overview: true };

describe("what the panel beside the map shows", () => {
  it("is decided by the stop: a lens open first, then one record, then one district, else nothing", () => {
    expect(mapPanelShows({ districts: [], records: ["f1"], lens: "feature" })).toEqual({ what: "lens", kind: "feature" });
    expect(mapPanelShows({ districts: [], records: ["f1"], lens: null })).toEqual({ what: "record", id: "f1" });
    expect(mapPanelShows({ districts: ["area"], records: [], lens: null })).toEqual({ what: "district", kind: "area" });
    expect(mapPanelShows({ districts: [], records: ["f1", "f2"], lens: null })).toBeNull();
    expect(mapPanelShows({ districts: [], records: [], lens: null })).toBeNull();
  });

  it("draws nothing on the ground, where the place itself is the picture", async () => {
    const { host, unmount } = await mounted(EMPTY_VIEW, ["f1"]);
    expect(host.querySelector("[data-graview-map-panel]")).toBeNull();
    await unmount();
  });
});

describe("a lens pressed from altitude", () => {
  it("opens at full size beside the map: the lens itself, in the mode it draws a page in, named, counted, with the way to its place", async () => {
    const seen: ViewState[] = [];
    const { host, unmount } = await mounted({ ...aloft, focusId: aggregateId("feature"), within: { view: "the-board" } }, [], (next) => seen.push(next));
    const panel = host.querySelector('[data-testid="lens-panel"]')!;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute("aria-label")).toBe("The board");
    expect(panel.querySelector('[data-testid="the-board"]')?.getAttribute("data-mode")).toBe("fullscreen");
    expect(panel.textContent).toContain("2 features");
    // The city takes the room that is left beside it.
    expect(panel.getAttribute("data-graview-map-panel")).toBe("dock");
    expect([...panel.querySelectorAll("style")].some((style) => style.textContent?.includes("--graview-dock"))).toBe(true);
    // Open goes to the lens's own place, on the ground.
    await act(async () => panel.querySelector<HTMLButtonElement>('[data-testid="lens-panel-open"]')!.click());
    const opened = seen.at(-1)!;
    expect([opened.overview ?? false, opened.focusId, opened.within?.["view"]]).toEqual([false, aggregateId("feature"), "the-board"]);
    await unmount();
  });

  it("chooses a record pressed inside it, and closes back to the map", async () => {
    const seen: ViewState[] = [];
    const { host, unmount } = await mounted({ ...aloft, focusId: aggregateId("feature"), within: { view: "the-board" } }, [], (next) => seen.push(next));
    await act(async () => host.querySelector<HTMLElement>('[data-testid="lens-panel"] [data-graview-pick="f2"]')!.click());
    expect(seen.at(-1)?.selection).toEqual(["f2"]);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="map-panel-close"]')!.click());
    expect(seen.at(-1)?.focusId).toBeNull();
    expect(seen.at(-1)?.within?.["view"]).toBeUndefined();
    await unmount();
  });
});

describe("a record's acts beside the map", () => {
  it("open at a right-click on a record in a lens or a district's list, as on the map, and choose it", async () => {
    const seen: ViewState[] = [];
    const { host, unmount } = await mounted({ ...aloft, focusId: aggregateId("feature"), within: { view: "the-board" } }, [], (next) => seen.push(next));
    await act(async () => host.querySelector('[data-testid="lens-panel"] [data-graview-pick="f1"]')!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 40, clientY: 50 })));
    expect(seen.at(-1)?.selection).toEqual(["f1"]);
    await unmount();
    const listed = await mounted(aloft, [kindCardId("area")], (next) => seen.push(next));
    const row = listed.host.querySelector('[data-graview-record="a2"]')!;
    const press = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    await act(async () => row.dispatchEvent(press));
    expect(press.defaultPrevented).toBe(true);
    expect(seen.at(-1)?.selection).toEqual(["a2"]);
    await listed.unmount();
  });
});

describe("a record chosen from altitude", () => {
  it("lists its links beside the map, a heading per relation in its kind's words", async () => {
    const { host, unmount } = await mounted(aloft, ["a1"]);
    const panel = host.querySelector('[data-testid="record-panel"]')!;
    expect(panel.querySelector('[data-testid="record-panel-title"]')?.textContent).toBe("core");
    const group = panel.querySelector('[data-graview-links="partOf"]')!;
    expect(group.querySelector("h3")?.textContent).toContain("What this part does");
    expect([...group.querySelectorAll("[data-graview-record]")].map((row) => row.textContent)).toEqual(["Undo", "Search"]);
    await unmount();
  });

  it("chooses a linked record when it is pressed, and Escape puts the panel away", async () => {
    const seen: ViewState[] = [];
    const { host, unmount } = await mounted(aloft, ["a1"], (next) => seen.push(next));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-graview-record="f1"]')!.click());
    expect(seen.at(-1)?.selection).toEqual(["f1"]);
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(seen.at(-1)?.selection ?? []).toEqual([]);
    await unmount();
  });
});

describe("a record risen from", () => {
  it("stands beside the map, its card and its links, and closing the panel leaves it rather than the map", async () => {
    const seen: ViewState[] = [];
    const { host, unmount } = await mounted({ ...aloft, focusId: "a1" }, [], (next) => seen.push(next));
    const panel = host.querySelector('[data-testid="record-panel"]')!;
    expect(panel.querySelector('[data-testid="record-panel-title"]')?.textContent).toBe("core");
    expect(panel.querySelector('[data-graview-record-card="a1"]')).not.toBeNull();
    expect([...panel.querySelectorAll('[data-graview-links="partOf"] [data-graview-record]')].map((row) => row.textContent)).toEqual(["Undo", "Search"]);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="map-panel-close"]')!.click());
    expect(seen.at(-1)?.focusId ?? null).toBeNull();
    expect(seen.at(-1)?.overview).toBe(true);
    await unmount();
  });
});

describe("a district chosen from altitude", () => {
  it("lists its relations with how many each joins, and every record in it", async () => {
    const { host, unmount } = await mounted(aloft, [kindCardId("area")]);
    const panel = host.querySelector('[data-testid="district-panel"]')!;
    expect(panel.querySelector('[data-graview-relation-said="partOf"]')?.textContent).toContain("2 features → 1 area, the part it lives in");
    expect([...panel.querySelectorAll("[data-graview-record]")].map((row) => row.textContent)).toEqual(["core", "pages"]);
    await unmount();
  });
});

describe("on a phone", () => {
  it("rises as a sheet from the foot and says how tall it stands, so the city is laid out above it, with what was chosen in sight", async () => {
    const desk = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844, toJSON: () => ({}) }) as DOMRect;
    try {
      const { host, unmount } = await mounted(aloft, [kindCardId("area")]);
      const panel = host.querySelector('[data-testid="district-panel"]')!;
      expect(panel.getAttribute("data-graview-map-panel")).toBe("sheet");
      const said = [...panel.querySelectorAll("style")].map((style) => style.textContent ?? "").join("");
      // Its height and the gap above and below it, and the foot of a phone that is not the screen's: the city is laid out in what is left.
      expect(said).toContain("--graview-sheet: calc(52% + 2 * var(--graview-gap, 8px) + env(safe-area-inset-bottom, 0px))");
      expect(said).not.toContain("--graview-dock");
      await unmount();
    } finally {
      Element.prototype.getBoundingClientRect = desk;
    }
  });
});
