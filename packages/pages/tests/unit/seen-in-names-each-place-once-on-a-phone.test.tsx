// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { createViews, type ViewComponent } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp } from "../../src/index.js";

/**
 * "SEEN IN" NAMES EACH PLACE ONCE (Roadmap f-seen-in-phone-length). Threat
 * Watch, on Graview Cloud at 390 pixels: a threat's page said "Seen in" ten
 * places, each followed by its own ↗ link to the scene — twenty links, five
 * wrapped lines and twenty tab stops before the record's own view. The
 * record's "In the scene" says where it stands there already; each place is
 * now one link, and on a phone, past four, the first three are said with
 * "3 more" to open the rest. Measured in a browser at 390 and 1440 by `verify-address`.
 */
const threat = defineNode("threat", { fields: z.object({ label: z.string() }), plural: "Threats" });
const schema = createSchema([threat]);
const store = () => new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "t1", kind: "threat", label: "Phishing" }] as never, edges: [] } });
const Board: ViewComponent<typeof schema> = ({ nodes }) => <div>{nodes?.length ?? 0} threats</div>;
const TITLES = ["The map", "By actor", "By sector", "The timeline", "The watch list", "By region"];
const views = (titles: readonly string[] = TITLES) => titles.reduce((registry, title) => registry.register("threat", { cardinality: "many", fidelity: "full" }, Board, { title }), createViews(schema));
const page = (titles?: readonly string[]) => new DOMParser().parseFromString(renderToStaticMarkup(<PagesApp context={{ store: store(), views: views(titles), sceneHref: "/" }} initialPath="/threats/t1" />), "text/html");

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  unmount = undefined;
});

describe("Seen in", () => {
  it("names each place once, as one link to its page, and no arrow to the scene beside it", () => {
    const seen = page().querySelector('[data-testid="seen-in"]')!;
    const links = [...seen.querySelectorAll("a")];
    expect(links.map((link) => link.textContent)).toEqual(TITLES);
    expect(seen.textContent).not.toContain("↗");
    expect(seen.querySelector('a[href^="/#view="]')).toBeNull();
  });
  it("still says the record's own way to the scene above it", () => {
    expect(page().querySelector('[data-testid="spatial-link"]')).not.toBeNull();
  });
  it("on a phone, keeps the places past the third behind a button that says how many, which opens them", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={{ store: store(), views: views(), sceneHref: "/" }} initialPath="/threats/t1" />));
    unmount = () => {
      act(() => root.unmount());
      host.remove();
    };
    const seen = host.querySelector<HTMLElement>('[data-testid="seen-in"]')!;
    const later = [...seen.querySelectorAll("[data-graview-later]")].map((one) => one.querySelector("a")?.textContent);
    expect(later).toEqual(TITLES.slice(3));
    const rule = seen.querySelector("style")?.textContent ?? "";
    expect(rule).toContain("max-width:680px");
    expect(rule).toContain("[data-graview-later]{display:none}");
    const more = seen.querySelector<HTMLButtonElement>("button[data-graview-seen-more]")!;
    expect(more.textContent).toBe("3 more");
    expect(more.getAttribute("aria-expanded")).toBe("false");
    await act(async () => more.click());
    expect(seen.hasAttribute("data-open")).toBe(true);
    expect(seen.querySelector("button[data-graview-seen-more]")).toBeNull();
    // The button went with what it opened: the keyboard is on the first place it opened, not the page's body.
    await act(async () => new Promise<void>((done) => requestAnimationFrame(() => done())));
    expect(document.activeElement?.textContent).toBe("The timeline");
  });
  it("says four places or fewer whole, with no button: one more is no longer than a button", () => {
    const seen = page(TITLES.slice(0, 4)).querySelector('[data-testid="seen-in"]')!;
    expect(seen.querySelector("[data-graview-later]")).toBeNull();
    expect(seen.querySelector("button")).toBeNull();
  });
});
