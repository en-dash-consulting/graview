// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppBar, type BarFaces, type BarPlace } from "../../src/index.js";

/**
 * THE PLACES LIST RENDERS ONCE AS IT OPENS (FR-158).
 *
 * Graview Cloud, after 0.1.20: the bar ranks its places and folds the rest
 * into More, and opening More rendered the list, then rendered it again
 * with the ranking, so a press between the two landed on an element no
 * longer in the document ("element is not attached"; on a slow phone a tap
 * did nothing, or hit the entry that moved there). The row is weighed again
 * whenever its room may change; while the list is open, what it holds stays
 * as it was when it opened. `verify-chrome-quiet` holds an entry from
 * before the open and presses it after, in a browser.
 */
const workshop: readonly BarPlace[] = [
  { key: "home", label: "Home", path: "/", group: "home" },
  { key: "kind:date", label: "Dates", path: "/dates", group: "lists", kind: "date" },
  { key: "kind:decision", label: "Decisions", path: "/decisions", group: "lists", kind: "decision" },
  { key: "kind:deliverable", label: "Deliverables", path: "/deliverables", group: "lists", kind: "deliverable" },
  { key: "place:decision:what-the-workshop-covers", label: "What the workshop covers", path: "/places/what-the-workshop-covers", group: "pictures", kind: "decision" },
  { key: "place:deliverable:email-to-todd", label: "Email to Todd", path: "/places/email-to-todd", group: "pictures", kind: "deliverable" },
  { key: "connections", label: "Connections", path: "/map", group: "pictures", primary: false },
];
const faces: BarFaces = { scene: { label: "Scene", current: false, go: () => undefined }, pages: { label: "Pages", current: true, go: () => undefined } };

/* A row laid out as a browser would, its width changeable between two weighings. */
let barWidth = 1280;
function layOut() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const box = (left: number, width: number, height = 30) => ({ left, right: left + width, width, top: 0, bottom: height, height, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
    if (this.matches(".graview-bar")) return box(0, barWidth, 48);
    if (this.matches(".graview-bar-mid")) return box(420, 300);
    if (this.matches(".graview-bar-find")) return box(barWidth - 264, 144);
    if (this.matches(".graview-bar-app-name")) return box(16, 200, 19);
    if (this.closest(".graview-bar-ruler")) return box(0, (this.textContent ?? "").length * 8 + 16);
    return box(0, 0, 0);
  });
  vi.spyOn(window, "getComputedStyle").mockImplementation(((element: Element) => ({ minWidth: element.matches(".graview-bar-find") ? "120px" : "0px", lineHeight: "19px", fontSize: "14px", flexBasis: "144px" })) as never);
}

let host: HTMLDivElement | undefined;
afterEach(() => {
  host?.remove();
  host = undefined;
  vi.restoreAllMocks();
  barWidth = 1280;
});

describe("the places list as it opens (FR-158)", () => {
  it("is ranked before it is first drawn: More lists only what does not stand, and opening it draws nothing new", () => {
    layOut();
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const bar = (name: string) => <AppBar brand={undefined} name={name} home={{ go: () => undefined, current: false }} faces={faces} switch="icons" places={workshop} current="home" reach={{}} tools={null} />;
    act(() => root.render(bar("Farm Bureau POM Workshop")));
    const entries = () => [...host!.querySelectorAll('[data-testid="app-places"] [data-place-path]')];
    const before = entries();
    const standing = host.querySelectorAll('[data-testid="app-places-standing"] > [data-place-path]').length;
    expect(standing).toBeGreaterThanOrEqual(2);
    expect(before).toHaveLength(workshop.length - standing);
    act(() => host!.querySelector<HTMLButtonElement>('[data-testid="app-places-open"]')!.click());
    // The same elements, still in the document, whatever was weighed as it opened.
    expect(entries()).toEqual(before);
    expect(before.every((one) => one.isConnected)).toBe(true);
    act(() => root.unmount());
  });

  it("keeps every entry it was opened with while it stays open, though the row is weighed again with more room; the new ranking comes when it closes", () => {
    layOut();
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const went: string[] = [];
    const bar = (name: string) => <AppBar brand={undefined} name={name} home={{ go: () => undefined, current: false }} faces={faces} switch="icons" places={workshop} current="home" reach={{ go: (place) => went.push(place.path) }} tools={null} />;
    act(() => root.render(bar("Farm Bureau POM Workshop")));
    const entries = () => [...host!.querySelectorAll('[data-testid="app-places"] [data-place-path]')];
    const more = host.querySelector<HTMLButtonElement>('[data-testid="app-places-open"]')!;
    act(() => more.click());
    const opened = entries();
    const last = opened.at(-1) as HTMLElement;
    // The room grows while the list is open (a face arrived, someone left the bar): the row is weighed again.
    barWidth = 1920;
    act(() => root.render(bar("Farm Bureau")));
    expect(entries()).toEqual(opened);
    expect(last.isConnected).toBe(true);
    // A press on the entry held from before goes to its place.
    act(() => last.click());
    expect(went).toEqual([last.getAttribute("data-place-path")]);
    // Closed, the list takes the new ranking: at 1920 every main place stands.
    act(() => root.render(bar("Farm Bureau POM")));
    expect(host.querySelectorAll('[data-testid="app-places-standing"] > [data-place-path]')).toHaveLength(6);
    expect(entries().map((one) => one.textContent)).toEqual(["Connections"]);
    act(() => root.unmount());
  });
});
