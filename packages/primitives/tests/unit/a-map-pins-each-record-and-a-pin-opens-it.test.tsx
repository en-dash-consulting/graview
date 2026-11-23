// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { declaredLenses, Store, type AnyGraphNode, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import type { GraviewDocument } from "@graview/core/document";
import { aggregateId, EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { declaredLensView } from "../../src/declared-lenses.js";
import { fanOut, frameOf, graticuleOf, inFrame, MapTilesContext, SpecLinks, tilesFor } from "../../src/index.js";
import trips from "../../../core/tests/document/fixtures/field-trips.gdd.json";
import tripsSeed from "../../../core/tests/document/fixtures/field-trips.seed.json";

/**
 * A MAP PINS EACH RECORD, AND A PIN OPENS IT (Graview HQ feature:f-map-lens).
 * Field trips whose place the host found a point for are a pin each, on a
 * ground drawn here — nothing fetched unless a host hands its own tiles —
 * and each pin is a named link a press or the keyboard follows to its
 * record. The trips with no point are said under the map, never dropped.
 */
const document = trips as unknown as GraviewDocument;
const seed = tripsSeed as unknown as { nodes: { id: string; kind: string }[]; edges: [] };
const compiled = compileDocument(document);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app as GraviewApp<AnySchema>;
const [whereWeGo, coachStops] = declaredLenses(app).drawn;

async function drawn(lens = whereWeGo!, options: { links?: boolean; tiles?: boolean; mode?: "fullscreen" | "scene" } = {}) {
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: seed as never });
  const kind = lens.kinds[0]!;
  const went: string[] = [];
  const View = declaredLensView(lens);
  const host = window.document.createElement("div");
  window.document.body.append(host);
  const root = createRoot(host);
  const picture = <View nodes={store.graph.nodesOfKind(kind as never) as never} fidelity="full" cardinality="many" mode={options.mode ?? "fullscreen"} selected={false} />;
  const linked = options.links === false ? picture : <SpecLinks.Provider value={{ href: (node: AnyGraphNode) => `/trips/${node.id}`, go: (node: AnyGraphNode) => went.push(node.id) }}>{picture}</SpecLinks.Provider>;
  await act(() => {
    root.render(
      <GraviewProvider store={store} views={createViews(app.schema)} initialView={{ ...EMPTY_VIEW, focusId: aggregateId(kind) }}>
        {options.tiles ? <MapTilesContext.Provider value={{ url: "https://tiles.example/{z}/{x}/{y}.png", attribution: "Tiles by Example" }}>{linked}</MapTilesContext.Provider> : linked}
      </GraviewProvider>,
    );
  });
  return { host, went, done: () => (root.unmount(), host.remove()) };
}

const pinsIn = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>("[data-map-pin]")];

describe("a map over a place field the host found points for", () => {
  it("draws a pin for each record with a point, each a named link to it", async () => {
    const { host, done } = await drawn();
    const pins = pinsIn(host);
    expect(pins.map((pin) => pin.getAttribute("data-map-pin")).sort()).toEqual(["trip-greenwich", "trip-kew", "trip-museum", "trip-science", "trip-zoo"]);
    for (const pin of pins) {
      expect(pin.tagName).toBe("A");
      expect(pin.getAttribute("href")).toBe(`/trips/${pin.getAttribute("data-map-pin")}`);
    }
    expect(pins.find((pin) => pin.getAttribute("data-map-pin") === "trip-kew")?.getAttribute("aria-label")).toBe("Kew Gardens");
    done();
  });

  it("opens the record a pin is pressed on", async () => {
    const { host, went, done } = await drawn();
    const kew = pinsIn(host).find((pin) => pin.getAttribute("data-map-pin") === "trip-kew")!;
    await act(() => kew.click());
    expect(went).toEqual(["trip-kew"]);
    done();
  });

  it("is reached by the keyboard: each pin takes focus inside a group named for the map", async () => {
    const { host, done } = await drawn();
    const kew = pinsIn(host).find((pin) => pin.getAttribute("data-map-pin") === "trip-kew")!;
    kew.focus();
    expect(window.document.activeElement).toBe(kew);
    expect(host.querySelector('.graview-map')?.getAttribute("aria-label")).toBe("Where we go: 5 places on a map");
    done();
  });

  it("says the trips it has no point for, rather than dropping them", async () => {
    const { host, done } = await drawn();
    expect(host.querySelector('[data-testid="map-unplaced"]')?.textContent).toBe("2 trips have no place yet.");
    done();
  });

  it("in the scene, where a record is a pick rather than a page, makes each pin a button the scene picks", async () => {
    const { host, done } = await drawn(whereWeGo!, { links: false, mode: "scene" });
    const pins = pinsIn(host);
    expect(pins).toHaveLength(5);
    expect(pins.every((pin) => pin.tagName === "BUTTON" && pin.getAttribute("data-graview-pick") === pin.getAttribute("data-map-pin"))).toBe(true);
    done();
  });

  it("pins a latitude and a longitude bound as numbers", async () => {
    const { host, done } = await drawn(coachStops!);
    expect(pinsIn(host).map((pin) => pin.getAttribute("data-map-pin")).sort()).toEqual(["stop-depot", "stop-school"]);
    expect(host.querySelector('[data-testid="map-unplaced"]')).toBeNull();
    done();
  });
});

describe("the ground a map draws", () => {
  it("loads nothing from elsewhere unless a host hands tiles", async () => {
    const plain = await drawn();
    expect(plain.host.querySelector("image")).toBeNull();
    plain.done();
    const tiled = await drawn(whereWeGo!, { tiles: true });
    const hrefs = [...tiled.host.querySelectorAll("image")].map((image) => image.getAttribute("href"));
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.every((href) => /^https:\/\/tiles\.example\/\d+\/\d+\/\d+\.png$/.test(href ?? ""))).toBe(true);
    expect(tiled.host.textContent).toContain("Tiles by Example");
    tiled.done();
  });

  it("fits every pin inside its frame, widened to the picture's shape and never stretched", () => {
    const points = [
      { lat: 51.4967, lng: -0.1764 },
      { lat: 51.4787, lng: -0.2956 },
      { lat: 51.5353, lng: -0.1534 },
      { lat: 51.4769, lng: -0.0005 },
    ];
    for (const aspect of [1, 1.6]) {
      const frame = frameOf(points, aspect)!;
      expect(frame.width / frame.height).toBeCloseTo(aspect, 6);
      for (const point of points) {
        const at = inFrame(frame, point.lat, point.lng);
        expect(at.x).toBeGreaterThan(0);
        expect(at.x).toBeLessThan(1);
        expect(at.y).toBeGreaterThan(0);
        expect(at.y).toBeLessThan(1);
      }
      // North is up: the zoo, the northernmost, is highest.
      expect(inFrame(frame, 51.5353, -0.1534).y).toBeLessThan(inFrame(frame, 51.4769, -0.0005).y);
    }
  });

  it("stands one pin on some ground, and draws lines of latitude and longitude at a round step", () => {
    const frame = frameOf([{ lat: 51.5, lng: -0.12 }], 1.6)!;
    expect(frame.width).toBeGreaterThan(0);
    const lines = graticuleOf(frameOf([{ lat: 51.4767, lng: -0.2956 }, { lat: 51.5353, lng: 0 }], 1.6)!);
    expect([0.05, 0.1]).toContain(lines.step);
    expect(lines.meridians.length).toBeGreaterThanOrEqual(2);
    expect(lines.parallels.some((line) => line.said.endsWith("° N"))).toBe(true);
    expect(lines.meridians.some((line) => line.said.endsWith("° W"))).toBe(true);
  });

  it("holds pins a world apart inside its frame too", () => {
    const points = [
      { lat: 78.2232, lng: 15.6267 },
      { lat: -77.846, lng: 166.676 },
      { lat: 21.3069, lng: -157.8583 },
    ];
    for (const aspect of [1, 1.6]) {
      const frame = frameOf(points, aspect)!;
      for (const point of points) {
        const at = inFrame(frame, point.lat, point.lng);
        expect(at.x >= 0 && at.x <= 1 && at.y >= 0 && at.y <= 1, JSON.stringify({ aspect, point, at })).toBe(true);
      }
    }
  });

  it("sets out pins that share a spot so no press covers another, each keeping its point", () => {
    const at = (id: string, x: number, y: number) => ({ id, kind: "trip", label: id, lat: 0, lng: 0, x, y });
    const laid = fanOut([at("a", 0.5, 0.5), at("b", 0.501, 0.5), at("c", 0.5, 0.5), at("d", 0.1, 0.1)], 800, 500);
    const far = laid.find((one) => one.id === "d")!;
    expect([far.drawnX, far.drawnY]).toEqual([0.1, 0.1]);
    const ring = laid.filter((one) => one.id !== "d");
    for (const one of ring) for (const other of ring) if (one !== other) expect(Math.hypot((one.drawnX - other.drawnX) * 800, (one.drawnY - other.drawnY) * 500)).toBeGreaterThanOrEqual(24);
    expect(ring.find((one) => one.id === "b")).toMatchObject({ x: 0.501, y: 0.5 });
  });

  it("lays a host's tiles at the zoom that fits the picture, and no more of them than it shows", () => {
    const frame = frameOf([{ lat: 51.4967, lng: -0.1764 }, { lat: 51.4769, lng: -0.0005 }], 1.6)!;
    const laid = tilesFor(frame, 800, { url: "t/{z}/{x}/{y}" });
    expect(laid.length).toBeGreaterThan(0);
    expect(laid.length).toBeLessThanOrEqual(64);
    const z = Number(laid[0]!.href.split("/")[1]);
    expect(z).toBeGreaterThan(9);
    expect(z).toBeLessThan(15);
  });
});
