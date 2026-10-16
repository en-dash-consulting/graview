// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, Store } from "@graview/core";
import { createViews } from "@graview/react";
import { registerDeclaredLenses, registerDefaultViews } from "@graview/primitives";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * A PICTURE ON THE HOME IS DRAWN AS IT NEARS THE WINDOW (the first load,
 * 0.1.31). The home drew every picture the app has at once: on the
 * Roadmap, a board, a coverage and a calendar a phone's reader would
 * scroll a screen or three to reach, each a lens fetched and laid out over
 * every record it shows before the page answered a press. A card's frame
 * stands empty until it is within half a screen of the window, and its
 * picture is drawn then and stays.
 */
const hive = defineNode("hive", {
  fields: z.object({ label: z.string(), status: z.enum(["strong", "weak"]) }),
  plural: "Hives",
  noun: "hive",
});
const schema = createSchema([hive]);
const app = defineApp({
  name: "Co-op",
  schema,
  lenses: [
    { name: "columns", title: "How the hives are", bindings: { hive: { column: "status" } } },
    { name: "blocks", title: "A dozen hives", on: "hive", options: { blocks: [{ list: "all('hive')", as: "row", limit: 12 }] } },
  ],
});
const context = (): PageContext<typeof schema> => ({
  store: new Store({ schema, snapshot: { nodes: [{ id: "h1", kind: "hive", label: "Meadow", status: "strong" }] as never, edges: [] } }),
  views: registerDeclaredLenses(registerDefaultViews(schema, createViews(schema)), app as never),
  app: app as never,
});

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

/** A window that says what is in view only when told: each card's frame watched, and none near until `come` is called for it. */
const watched: { element: Element; tell: (entries: { isIntersecting: boolean; target: Element }[]) => void }[] = [];
class FakeIntersectionObserver {
  constructor(private readonly tell: (entries: { isIntersecting: boolean; target: Element }[]) => void) {}
  observe(element: Element) {
    watched.push({ element, tell: this.tell });
  }
  disconnect() {}
  unobserve() {}
}
const come = (element: Element) => {
  for (const one of watched.filter((one) => one.element === element)) one.tell([{ isIntersecting: true, target: element }]);
};
/** Whether the lens is drawn in the card's frame: the frame's stage holds something. */
const drawn = (picture: Element) => (picture.firstElementChild?.childElementCount ?? 0) > 0;

afterEach(() => {
  watched.length = 0;
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
});

describe("a picture on the home", () => {
  it("stands empty until it nears the window, and is drawn then", async () => {
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = FakeIntersectionObserver;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={context()} initialPath="/" />));
    const pictures = [...host.querySelectorAll('[data-testid="place-picture"]')];
    expect(pictures.length).toBe(2);
    expect(pictures.map(drawn)).toEqual([false, false]);
    await act(async () => come(pictures[0]!));
    for (let tick = 0; tick < 100 && !drawn(pictures[0]!); tick += 1) await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(pictures.map(drawn)).toEqual([true, false]);
    await act(async () => root.unmount());
    host.remove();
  });

  it("is drawn at once where nothing can say what is in view", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={context()} initialPath="/" />));
    const pictures = [...host.querySelectorAll('[data-testid="place-picture"]')];
    for (let tick = 0; tick < 100 && !pictures.every(drawn); tick += 1) await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(pictures.map(drawn)).toEqual([true, true]);
    await act(async () => root.unmount());
    host.remove();
  });
});
