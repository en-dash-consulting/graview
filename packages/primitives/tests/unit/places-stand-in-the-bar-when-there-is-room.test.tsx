// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { EMPTY_VIEW, fromUrl, toUrl } from "@graview/layout/view";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppBar, placesThatStand, scenePlacesOf, WHOLE_KEY, type BarFaces, type BarPlace } from "../../src/index.js";

/**
 * THE SCENE HAS ITS PLACE CONTROL IN THE BAR (FR-144), AND PLACES STAND IN
 * THE BAR WHEN THERE IS ROOM (FR-145).
 *
 * Nick, on 0.1.17: "is there a way to have a subnav on Scene like how there
 * is for Pages … where i can select from the Lenses available in the
 * Scene? … Might also be nice to have some of them available with a More
 * dropdown when screen real estate allows (for pages nav and scene nav)".
 *
 * What is measured in a browser — the row at 1920, 1280 and 390, the boxes,
 * the presses — is `verify-chrome-quiet`'s; this holds the rule the row is
 * weighed by, the scene's places, and what the bar draws from each answer.
 */
let host: HTMLDivElement | undefined;
afterEach(() => {
  host?.remove();
  host = undefined;
  vi.restoreAllMocks();
});

function drawn(element: ReactElement) {
  host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(element));
  return { root, at: host };
}

/* Cloud's workshop: its home, three lists, two pictures and how the kinds connect. */
const workshop: readonly BarPlace[] = [
  { key: "home", label: "Home", path: "/", group: "home" },
  { key: "kind:date", label: "Dates", path: "/dates", group: "lists", kind: "date" },
  { key: "kind:decision", label: "Decisions", path: "/decisions", group: "lists", kind: "decision" },
  { key: "kind:deliverable", label: "Deliverables", path: "/deliverables", group: "lists", kind: "deliverable" },
  { key: "place:decision:what-the-workshop-covers", label: "What the workshop covers", path: "/places/what-the-workshop-covers", group: "pictures", kind: "decision" },
  { key: "place:deliverable:email-to-todd", label: "Email to Todd", path: "/places/email-to-todd", group: "pictures", kind: "deliverable" },
  // A way to read the declaration, not a place of the work: it folds (`barPlaces`).
  { key: "connections", label: "Connections", path: "/map", group: "pictures", primary: false },
];

describe("which places stand on the row (FR-145)", () => {
  const widths = [60, 60, 90, 110, 200, 120, 110];
  const more = 64;

  it("are every place when every place fits, with no More — never more than six, however wide the row", () => {
    expect(placesThatStand({ widths: widths.slice(0, 5), current: 4, room: 2000, more })).toEqual([0, 1, 2, 3, 4]);
    expect(placesThatStand({ widths, current: 5, room: 2000, more })).toEqual([0, 1, 2, 3, 4, 5]);
    // The place the reader is on stands, the last of the six giving way to it.
    expect(placesThatStand({ widths, current: 6, room: 2000, more })).toEqual([0, 1, 2, 3, 4, 6]);
  });

  it("are the primary places only, ranked: the rest fold into More however much room there is, unless the reader is on one", () => {
    const primary = [true, true, false, true, false, true, false];
    expect(placesThatStand({ widths, current: 0, room: 2000, more, primary })).toEqual([0, 1, 3, 5]);
    expect(placesThatStand({ widths, current: 4, room: 2000, more, primary })).toEqual([0, 1, 3, 4, 5]);
    expect(placesThatStand({ widths, current: 0, room: 2000, more, primary: primary.map(() => false) })).toBeNull();
  });

  it("are the first ones in their order, with room for More, when not every place fits", () => {
    // 60+60+90+110 and three gaps, then More and its gap: 400.
    expect(placesThatStand({ widths, current: 0, room: 400, more })).toEqual([0, 1, 2, 3]);
    expect(placesThatStand({ widths, current: 0, room: 399, more })).toEqual([0, 1, 2]);
  });

  it("always hold the place the reader is on, in its own place in the order, the last of the first ones giving way to it", () => {
    expect(placesThatStand({ widths, current: 5, room: 430, more })).toEqual([0, 1, 2, 5]);
    expect(placesThatStand({ widths, current: 5, room: 330, more })).toEqual([0, 1, 5]);
  });

  it("are none — the one control — when fewer than two would stand, or nothing is laid out", () => {
    expect(placesThatStand({ widths, current: 4, room: 300, more })).toBeNull();
    expect(placesThatStand({ widths, current: 0, room: 0, more })).toBeNull();
    expect(placesThatStand({ widths: widths.map(() => 0), current: 0, room: 2000, more: 0 })).toBeNull();
    expect(placesThatStand({ widths: [], current: -1, room: 2000, more })).toBeNull();
  });

  it("stand with no place marked where the reader is on none of them (Find, the problems)", () => {
    expect(placesThatStand({ widths, current: -1, room: 400, more })).toEqual([0, 1, 2, 3]);
  });

  it("are fewer as the room narrows, and never more than fit", () => {
    let last = Infinity;
    for (let room = 1200; room >= 0; room -= 10) {
      const stand = placesThatStand({ widths, current: 5, room, more });
      const count = stand?.length ?? 0;
      expect(count).toBeLessThanOrEqual(last);
      last = count;
      if (!stand) continue;
      const folded = stand.length < widths.length;
      const span = stand.reduce((sum, at) => sum + widths[at]!, 0) + 4 * (stand.length - 1) + (folded ? 4 + more : 0);
      expect(span).toBeLessThanOrEqual(room);
      expect(stand).toContain(5);
    }
  });
});

describe("the scene's places (FR-144)", () => {
  const registered = [
    { kind: "decision", title: "What the workshop covers", as: "what-the-workshop-covers" },
    { kind: "deliverable", title: "Email to Todd", as: "email-to-todd" },
    { kind: "secret", title: "Who may see what", as: "who-may-see-what" },
  ];

  it("are the whole thing, then each picture the seat may see, grouped as on Pages, each at the scene's address for it", () => {
    const scene = scenePlacesOf({ places: registered, hidden: new Set(["secret"]), view: EMPTY_VIEW });
    expect(scene.places.map((place) => [place.label, place.group])).toEqual([
      ["The whole thing", "home"],
      ["What the workshop covers", "pictures"],
      ["Email to Todd", "pictures"],
    ]);
    // The whole thing is the overview at altitude: its address alone (FR-154).
    expect(scene.places[0]!.path).toBe("/places/overview");
    const todd = scene.places[2]!;
    expect(todd.path.startsWith("/places/overview#")).toBe(true);
    const there = fromUrl(todd.path.slice("/places/overview".length));
    expect(there.within?.["view"]).toBe("email-to-todd");
    expect(there.focusId).toBe("aggregate:deliverable");
    expect(scene.current).toBe(WHOLE_KEY);
  });

  it("go where every other way to a picture goes: its kind in focus, on the ground, its picture in view — and the whole thing from above, where Up goes", () => {
    const scene = scenePlacesOf({ places: registered, hidden: new Set(), view: { ...EMPTY_VIEW, overview: true } });
    const todd = scene.to("scene:deliverable:email-to-todd", { ...EMPTY_VIEW, overview: true })!;
    expect(todd.focusId).toBe("aggregate:deliverable");
    expect(todd.overview).toBeFalsy();
    expect(todd.within?.["view"]).toBe("email-to-todd");
    expect(toUrl(todd)).toContain("in.view=email-to-todd");
    const whole = scene.to(WHOLE_KEY, todd)!;
    expect(whole.overview).toBe(true);
    expect(whole.within?.["view"]).toBeUndefined();
    expect(scenePlacesOf({ places: registered, hidden: new Set(), view: whole }).current).toBe(WHOLE_KEY);
    expect(scene.to("place:nowhere", todd)).toBeNull();
  });

  it("say which picture is in view: the one the view names, or the one its district draws when it names none; else the whole thing", () => {
    const named = scenePlacesOf({ places: registered, hidden: new Set(), view: fromUrl("#focus=aggregate:deliverable&in.view=email-to-todd") });
    expect(named.current).toBe("scene:deliverable:email-to-todd");
    // Aloft with a picture on its billboard: that picture is what the scene shows.
    expect(scenePlacesOf({ places: registered, hidden: new Set(), view: fromUrl("#focus=aggregate:decision&overview=1&in.view=what-the-workshop-covers") }).current).toBe("scene:decision:what-the-workshop-covers");
    expect(scenePlacesOf({ places: registered, hidden: new Set(), view: fromUrl("#focus=aggregate:decision") }).current).toBe("scene:decision:what-the-workshop-covers");
    expect(scenePlacesOf({ places: registered, hidden: new Set(), view: fromUrl("#focus=d1") }).current).toBe(WHOLE_KEY);
  });
});

const faces = (pages: boolean): BarFaces => ({
  scene: { label: "Scene", current: !pages, go: () => undefined },
  pages: { label: "Pages", current: pages, go: () => undefined },
});

describe("the scene's place control (FR-144)", () => {
  it("names what is in view after the switch, and opens the whole thing and every picture, grouped as on Pages", () => {
    const went: string[] = [];
    const scene = scenePlacesOf({ places: [{ kind: "deliverable", title: "Email to Todd", as: "email-to-todd" }], hidden: new Set(), view: EMPTY_VIEW });
    const { root, at } = drawn(
      <AppBar brand={undefined} name="Farm Bureau POM Workshop" home={{ go: () => undefined, current: false }} faces={faces(false)} places={workshop} current={null} reach={{}} tools={null} find={false} scenePlaces={{ places: scene.places, current: scene.current, reach: { go: (place) => went.push(place.key) } }} />,
    );
    const open = at.querySelector<HTMLButtonElement>('[data-testid="app-places-open"]')!;
    expect(open.textContent).toBe("The whole thing");
    expect(open.getAttribute("aria-label")).toBe("The whole thing — everything the scene shows");
    // After the switch.
    expect(at.querySelector('[data-testid="app-faces"]')!.compareDocumentPosition(open) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    act(() => open.click());
    const list = at.querySelector('[data-testid="app-places"]')!;
    expect(list.closest("nav")?.getAttribute("aria-label")).toBe("What the scene shows");
    expect([...list.querySelectorAll("[data-place-group]")].map((group) => group.getAttribute("data-place-group"))).toEqual(["home", "pictures"]);
    expect(list.querySelector('[aria-current="page"]')?.getAttribute("data-testid")).toBe(`app-place-${WHOLE_KEY}`);
    act(() => list.querySelector<HTMLButtonElement>('[data-testid="app-place-scene:deliverable:email-to-todd"]')!.click());
    expect(went).toEqual(["scene:deliverable:email-to-todd"]);
    // The Pages' places are not the scene's.
    expect(at.querySelector('[data-testid="app-place-kind:date"]')).toBeNull();
    act(() => root.unmount());
  });
});

describe("the places standing on the row (FR-145)", () => {
  /*
   * A row laid out as a browser would: the bar 1920 wide, the places
   * beginning at 420, Find ending at 1800 at its least 120 — and each
   * place's width eight pixels a letter and its padding.
   */
  function layOut(barWidth: number) {
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
  const bar = (current: string | null, reach = {}) => (
    <AppBar brand={undefined} name="Farm Bureau POM Workshop" home={{ go: () => undefined, current: false }} faces={faces(true)} switch="icons" places={workshop} current={current} reach={reach} tools={null} />
  );

  it("stand as words in their order, the primary ones only, the one you are on marked and saying so, the rest in More", () => {
    layOut(1920);
    const { root, at } = drawn(bar("place:deliverable:email-to-todd"));
    const standing = at.querySelector('[data-testid="app-places-standing"]')!;
    expect(standing.tagName).toBe("NAV");
    expect([...standing.querySelectorAll(":scope > [data-place-path]")].map((one) => one.textContent)).toEqual(workshop.filter((place) => place.primary !== false).map((place) => place.label));
    const here = standing.querySelector('[aria-current="page"]')!;
    expect(here.getAttribute("data-testid")).toBe("app-place-place:deliverable:email-to-todd");
    expect(here.getAttribute("data-place-path")).toBe("/places/email-to-todd");
    expect(at.querySelector('[data-testid="app-place-current"]')?.textContent).toBe("Email to Todd");
    // The one control is gone; what supports the work is in More.
    expect(at.querySelector('[data-testid="app-places-open"]')?.textContent).toBe("More");
    // No pill: a place standing is words, underlined where you are.
    const css = at.querySelector("style")?.textContent ?? "";
    expect(css).toMatch(/\.graview-bar-at\{[^}]*border-radius:0/);
    expect(css).toMatch(/\.graview-bar-at\[aria-current\]\{[^}]*border-bottom-color:var\(--graview-accent\)/);
    act(() => root.unmount());
  });

  it("fold what does not fit into More, which is app-places-open and lists the rest, each place once in the bar", () => {
    layOut(1280);
    const went: string[] = [];
    const { root, at } = drawn(bar("place:deliverable:email-to-todd", { go: (place: BarPlace) => went.push(place.path) }));
    const standing = [...at.querySelectorAll('[data-testid="app-places-standing"] > [data-place-path]')].map((one) => one.textContent);
    expect(standing.length).toBeGreaterThanOrEqual(2);
    expect(standing.length).toBeLessThan(workshop.length);
    expect(standing).toContain("Email to Todd");
    const more = at.querySelector<HTMLButtonElement>('[data-testid="app-places-open"]')!;
    expect(more.textContent).toBe("More");
    act(() => more.click());
    const rest = [...at.querySelectorAll('[data-testid="app-places"] [data-place-path]')].map((one) => one.textContent);
    expect([...standing, ...rest].sort()).toEqual(workshop.map((place) => place.label).sort());
    // Each place is in the bar once, so a harness's selector finds one.
    for (const place of workshop) expect(at.querySelectorAll(`[data-place-path="${place.path}"]`)).toHaveLength(1);
    act(() => at.querySelector<HTMLButtonElement>('[data-testid="app-places"] [data-place-path="/map"]')!.click());
    expect(went).toEqual(["/map"]);
    act(() => root.unmount());
  });

  it("give way to the one control on a phone's bar", () => {
    layOut(390);
    const { root, at } = drawn(bar("home"));
    expect(at.querySelector('[data-testid="app-places-standing"]')).toBeNull();
    expect(at.querySelector('[data-testid="app-places-open"]')?.textContent).toBe("Home");
    act(() => root.unmount());
  });
});
