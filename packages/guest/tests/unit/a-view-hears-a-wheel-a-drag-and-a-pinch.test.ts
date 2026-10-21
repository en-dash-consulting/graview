// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Store, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { ada, mapApp, MAP_EXAMPLE, manifestOf, mapSeed } from "../../../../scripts/fixtures/map-app.js";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { createGuestGestures } from "../../src/host/gestures.js";
import { checkManifest, type WorkerViewManifest } from "../../src/host/manifest.js";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { createGuestHost } from "../../src/host/session.js";
import type { GuestDomEvent, GuestGestureBinding } from "../../src/protocol.js";
import { createViewRuntime } from "../../src/worker/view-global.js";

/**
 * A VIEW HEARS A WHEEL, A DRAG AND A PINCH (0.1.42, TrueNorth's recon app):
 * its architecture map ran as a worker view that could select and open a
 * zone but never pan or zoom, because only clicks, typing, choices and a
 * drop crossed into the worker. A view whose manifest says `gestures:
 * true` now hears `wheel`, `drag` and `pinch` over what it listens on —
 * where the pointer is on that element and the element's size, at most
 * once a frame with the deltas summed — and the host takes the wheel from
 * the page only there, so the page still scrolls everywhere else.
 */
const EXAMPLE = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../..", MAP_EXAMPLE), "utf8");
const MANIFEST = manifestOf(EXAMPLE) as unknown as WorkerViewManifest;
const store = () => new Store<AnySchema>({ schema: mapApp.schema, mutations: (mapApp.mutations ?? []) as never, policy: mapApp.policy!, snapshot: structuredClone(mapSeed) as never });

const INSERT = 0;
const svg = (attributes: Record<string, string> = { class: "map" }) => ({
  id: "s1",
  type: 1,
  element: "svg",
  attributes: { viewBox: "0 0 800 500", ...attributes },
  children: [{ id: "g1", type: 1, element: "g", attributes: { "data-zone": "zone:core" }, children: [{ id: "c1", type: 1, element: "circle", attributes: { r: "34" }, children: [] }] }],
});
const aside = { id: "p1", type: 1, element: "p", attributes: {}, children: [{ id: "t1", type: 3, data: "Notes" }] };

/** A view's region as `mountWorkerView` wires it for a view that opted in, with the frames held until the test lets them go. */
function region(bound: readonly GuestGestureBinding[]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const told: GuestDomEvent[] = [];
  const frames: (() => void)[] = [];
  const drawing = createOpenDrawing(shadow, { origin: "null", send: (message) => told.push(message) });
  drawing.apply([
    [INSERT, "~", svg(), 0],
    [INSERT, "~", aside, 1],
  ]);
  const gestures = createGuestGestures(shadow, { root: () => shadow.querySelector("[data-graview-view-root]") ?? undefined, idOf: (one) => drawing.renderer.idOf(one), send: (message) => told.push(message), frame: (run) => frames.push(run) });
  gestures.bind(bound);
  const at = (selector: string) => shadow.querySelector(selector)!;
  const raise = (on: Element, type: string, fields: Record<string, unknown>) => {
    const event = new Event(type, { bubbles: true, composed: true, cancelable: true });
    for (const [key, value] of Object.entries(fields)) Object.defineProperty(event, key, { value });
    on.dispatchEvent(event);
    return event;
  };
  const wheel = (on: Element, fields: Record<string, unknown>) => raise(on, "wheel", { deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, metaKey: false, clientX: 100, clientY: 50, ...fields });
  const pointer = (on: Element, type: string, fields: Record<string, unknown>) => raise(on, type, { pointerId: 1, button: 0, pressure: 0.5, clientX: 0, clientY: 0, ...fields });
  const frame = () => frames.splice(0).forEach((run) => run());
  return { shadow, told, at, wheel, pointer, raise, frame, gestures };
}

describe("a manifest that takes gestures", () => {
  it("says gestures: true, or leaves it out", () => {
    const s = store();
    expect(checkManifest(MANIFEST, s)).toEqual([]);
    expect(MANIFEST.gestures).toBe(true);
    expect(checkManifest({ ...MANIFEST, gestures: "yes" } as unknown as WorkerViewManifest, s)).toEqual([expect.stringContaining('gestures is "yes"')]);
    expect(checkManifest({ ...MANIFEST, gestures: undefined }, s)).toEqual([]);
  });
});

describe("the host, over a view that opted in", () => {
  it("takes a wheel from the page over what the view listens on, and sends it once a frame with its deltas summed", () => {
    const view = region([{ event: "wheel", selector: ".map" }]);
    const events = [view.wheel(view.at("circle"), { deltaY: -40 }), view.wheel(view.at("circle"), { deltaY: -60, deltaX: 5 }), view.wheel(view.at("circle"), { deltaY: -100, clientX: 120, clientY: 70 })];
    expect(events.every((one) => one.defaultPrevented)).toBe(true);
    expect(view.told).toEqual([]);
    view.frame();
    expect(view.told).toEqual([expect.objectContaining({ type: "dom-event", target: "c1", event: "wheel", deltaX: 5, deltaY: -200, deltaMode: 0, ctrlKey: false, metaKey: false, x: 120, y: 70 })]);
  });

  it("leaves a wheel anywhere else to the page", () => {
    const view = region([{ event: "wheel", selector: ".map" }]);
    expect(view.wheel(view.at("p"), { deltaY: -40 }).defaultPrevented).toBe(false);
    view.frame();
    expect(view.told).toEqual([]);
    const listening = region([]);
    expect(listening.wheel(listening.at("circle"), { deltaY: -40 }).defaultPrevented).toBe(false);
  });

  it("hears a wheel with Control held — a trackpad's pinch — as a pinch where the view listens for one, and as a wheel with ctrlKey where it does not", () => {
    const pinching = region([
      { event: "wheel", selector: ".map" },
      { event: "pinch", selector: ".map" },
    ]);
    expect(pinching.wheel(pinching.at("circle"), { deltaY: -10, ctrlKey: true }).defaultPrevented).toBe(true);
    pinching.wheel(pinching.at("circle"), { deltaY: -10, ctrlKey: true });
    pinching.frame();
    expect(pinching.told).toEqual([expect.objectContaining({ event: "pinch", phase: "change" })]);
    expect(pinching.told[0]!.scale).toBeCloseTo(Math.exp(0.2), 6);
    const wheeling = region([{ event: "wheel", selector: ".map" }]);
    expect(wheeling.wheel(wheeling.at("circle"), { deltaY: -10, ctrlKey: true }).defaultPrevented).toBe(true);
    wheeling.frame();
    expect(wheeling.told).toEqual([expect.objectContaining({ event: "wheel", deltaY: -10, ctrlKey: true })]);
  });

  it("sends a drag's start and end at once and its moves once a frame, summed, for each pointer", () => {
    const view = region([{ event: "drag", selector: ".map" }]);
    view.pointer(view.at("circle"), "pointerdown", { clientX: 10, clientY: 10 });
    expect(view.told).toEqual([expect.objectContaining({ event: "drag", phase: "start", pointerId: 1, button: 0, pressure: 0.5, dx: 0, dy: 0, x: 10, y: 10 })]);
    view.pointer(view.at("circle"), "pointermove", { clientX: 20, clientY: 15 });
    view.pointer(view.at("circle"), "pointermove", { clientX: 40, clientY: 25 });
    expect(view.told).toHaveLength(1);
    view.frame();
    expect(view.told[1]).toEqual(expect.objectContaining({ event: "drag", phase: "move", dx: 30, dy: 15, x: 40, y: 25 }));
    view.pointer(view.at("circle"), "pointermove", { clientX: 45, clientY: 25 });
    view.pointer(view.at("circle"), "pointerup", { clientX: 50, clientY: 30 });
    expect(view.told.slice(2)).toEqual([expect.objectContaining({ phase: "move", dx: 10, dy: 5 }), expect.objectContaining({ phase: "end", pointerId: 1 })]);
    /* A pointer that went down on nothing the view drags is none of its business. */
    view.pointer(view.at("p"), "pointerdown", { pointerId: 2 });
    view.pointer(view.at("p"), "pointermove", { pointerId: 2, clientX: 9 });
    view.frame();
    expect(view.told).toHaveLength(4);
  });

  it("hears Safari's pinch as a pinch, its scale since the view last heard, and takes it from the page", () => {
    const view = region([{ event: "pinch", selector: ".map" }]);
    expect(view.raise(view.at("circle"), "gesturestart", { scale: 1, rotation: 0, clientX: 5, clientY: 5 }).defaultPrevented).toBe(true);
    view.raise(view.at("circle"), "gesturechange", { scale: 1.5, rotation: 10 });
    view.raise(view.at("circle"), "gesturechange", { scale: 2, rotation: 15 });
    view.frame();
    view.raise(view.at("circle"), "gesturechange", { scale: 3, rotation: 15 });
    view.raise(view.at("circle"), "gestureend", { scale: 3, rotation: 15 });
    expect(view.told.map((one) => [one.phase, one.scale, one.rotation])).toEqual([
      ["start", 1, 0],
      ["change", 2, 15],
      ["change", 1.5, 0],
      ["end", 1, 0],
    ]);
  });

  it("listens nowhere once disposed", () => {
    const view = region([{ event: "wheel", selector: ".map" }]);
    view.gestures.dispose();
    expect(view.wheel(view.at("circle"), { deltaY: -40 }).defaultPrevented).toBe(false);
  });
});

describe("the view's runtime", () => {
  function runtime() {
    const sent: { type: string; [key: string]: unknown }[] = [];
    const made = createViewRuntime({
      send: (request) => sent.push(request as never),
      act: () => Promise.resolve({ type: "answer", id: 1, ok: true, intent: "" }),
      navigate: () => {},
      microtask: (task) => queueMicrotask(task),
      now: () => 0,
      threw: (error) => {
        throw error;
      },
      warn: () => {},
      hardening: () => ({ removed: [], stuck: [], sealed: false }),
    });
    return { ...made, sent };
  }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("tells the host where it listens for a gesture, all of it, whenever that moves", async () => {
    const view = runtime();
    view.view.on("click", ".map", () => {});
    const off = view.view.on("wheel", ".map", () => {});
    view.view.on("drag", ".map", () => {});
    view.view.on("wheel", ".map", () => {});
    await settle();
    expect(view.sent.filter((one) => one.type === "gestures")).toEqual([{ type: "gestures", bound: [{ event: "drag", selector: ".map" }, { event: "wheel", selector: ".map" }] }]);
    off();
    await settle();
    expect(view.sent.filter((one) => one.type === "gestures")).toHaveLength(1);
  });
});

describe("the session", () => {
  it("hands on where a view listens for a gesture, and the host's gestures read nothing they do not know", () => {
    const said: unknown[][] = [];
    const session = createGuestHost({ store: store(), principal: ada, view: "map", nonce: "n", send: () => {}, props: () => ({ view: "map", edges: [], acts: [] }), onGestures: (bound) => said.push([...bound]) });
    session.receive({ type: "gestures", nonce: "n", bound: [{ event: "scroll", selector: ".map" }, { event: "drag", selector: "x".repeat(300) }, { event: "wheel", selector: ".aside" }, { event: "wheel", selector: ".map", extra: 1 }] });
    session.receive({ type: "gestures", nonce: "wrong", bound: [{ event: "wheel", selector: "p" }] });
    expect(said).toHaveLength(1);
    const view = region([]);
    view.gestures.bind(said[0]!);
    expect(view.wheel(view.at("circle"), { deltaY: -40 }).defaultPrevented).toBe(true);
    expect(view.wheel(view.at("p"), { deltaY: -40 }).defaultPrevented).toBe(false);
  });
});

describe("the view checker on gestures", () => {
  const run = nodeIsolate();
  const problemsOf = async (source: string, manifest: WorkerViewManifest) => {
    const result = await runWorkerViewHeadless({ manifest, source, store: store(), principal: ada, run });
    if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
    return result.description.problems.map((one) => one.says);
  };

  it("draws the skill's worked map with no problems", async () => {
    expect(await problemsOf(EXAMPLE, MANIFEST)).toEqual([]);
  });

  it("says a view that listens for a wheel without gestures: true hears none, and one that says it and listens for none has nothing to hear", async () => {
    const { gestures: _, ...plain } = MANIFEST;
    expect(await problemsOf(EXAMPLE, plain)).toEqual([expect.stringMatching(/listens for drag on "\.map", pinch on "\.map", wheel on "\.map", and its manifest does not say "gestures": true/)]);
    expect(await problemsOf(`graview.onProps(() => graview.render("<p>Zones</p>"));`, MANIFEST)).toEqual([expect.stringContaining("listens for no wheel, drag or pinch")]);
  });
});
