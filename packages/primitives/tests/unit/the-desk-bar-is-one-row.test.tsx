// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AppBar, barPlaces, type BarFaces, type BarPlace } from "../../src/index.js";

/**
 * THE SCENE AND THE PAGES ARE TWO THINGS, AND THE PLACES ARE OUT OF THE BAR
 * (FR-137, FR-138).
 *
 * Nick, on 0.1.16 at a desk: "the new nav kinda sucks, and i don't see a way
 * to go to the scene vs pages anymore". The scene had become "Overview", one
 * of seven equal tabs, and the tabs grew with the app until the bar wrapped.
 * The bar is one row of one height now: the app, a switch between the scene
 * and the pages, the place you are on as one control that opens every
 * place — the home first, then Lists and Pictures — and the tools.
 */
let host: HTMLDivElement | undefined;
afterEach(() => {
  host?.remove();
  host = undefined;
});

const many: readonly BarPlace[] = [
  { key: "home", label: "Home", path: "/", group: "home" },
  ...Array.from({ length: 12 }, (_, at) => ({ key: `kind:k${at}`, label: `Kind number ${at}`, path: `/k${at}`, group: "lists" as const, kind: `k${at}` })),
  ...Array.from({ length: 18 }, (_, at) => ({ key: `place:p${at}`, label: `A picture with a name as long as a sentence, number ${at}`, path: `/places/p${at}`, group: "pictures" as const, kind: "k0" })),
];

function faces(pages: boolean, said: string[]): BarFaces {
  return {
    scene: { label: "Scene", current: !pages, go: () => said.push("scene") },
    pages: { label: "Pages", current: pages, go: () => said.push("pages") },
  };
}

function drawn(element: ReactElement) {
  host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(element));
  return { root, host };
}

describe("the bar's switch (FR-137)", () => {
  it("is a group of two pressed-or-not buttons, Scene and Pages, the one drawn pressed, each naming itself in words", () => {
    const said: string[] = [];
    const { root, host: at } = drawn(<AppBar brand={undefined} name="Farm Bureau POM Workshop" home={{ go: () => undefined, current: false }} faces={faces(true, said)} places={many} current="kind:k1" reach={{}} tools={null} find={false} />);
    const group = at.querySelector('[data-testid="app-faces"]')!;
    expect(group.getAttribute("role")).toBe("group");
    const scene = at.querySelector<HTMLButtonElement>('[data-testid="app-face-scene"]')!;
    const pages = at.querySelector<HTMLButtonElement>('[data-testid="app-face-pages"]')!;
    expect([scene.textContent, pages.textContent]).toEqual(["Scene", "Pages"]);
    expect([scene.getAttribute("aria-pressed"), pages.getAttribute("aria-pressed")]).toEqual(["false", "true"]);
    act(() => scene.click());
    act(() => pages.click());
    // The face already drawn is not asked for again.
    expect(said).toEqual(["scene"]);
    // Nothing on the bar says "overview" for the scene.
    expect(at.querySelector("[data-graview-app-bar]")?.textContent?.toLowerCase()).not.toContain("overview");
    act(() => root.unmount());
  });
});

describe("the place control (FR-138)", () => {
  it("says the place you are on, and opens every place grouped as the home, Lists and Pictures, each two presses away", () => {
    const went: string[] = [];
    const { root, host: at } = drawn(<AppBar brand={undefined} name="Farm Bureau POM Workshop" home={{ go: () => undefined, current: false }} faces={faces(true, [])} places={many} current="place:p3" reach={{ go: (place) => went.push(place.path) }} tools={null} find={false} />);
    const open = at.querySelector<HTMLButtonElement>('[data-testid="app-places-open"]')!;
    expect(open.textContent).toBe(many.find((place) => place.key === "place:p3")!.label);
    expect(at.querySelector('[data-testid="app-places"]')?.hasAttribute("hidden")).toBe(true);
    act(() => open.click());
    const list = at.querySelector('[data-testid="app-places"]')!;
    expect(list.hasAttribute("hidden")).toBe(false);
    expect([...list.querySelectorAll("[data-place-group]")].map((group) => group.getAttribute("data-place-group"))).toEqual(["home", "lists", "pictures"]);
    expect([...list.querySelectorAll(".graview-bar-list p")].map((heading) => heading.textContent)).toEqual(["Lists", "Pictures"]);
    expect(list.querySelector('[aria-current="page"]')?.getAttribute("data-testid")).toBe("app-place-place:p3");
    // Each entry has its mark.
    expect([...list.querySelectorAll(".graview-bar-item")].every((item) => item.querySelector(".graview-bar-mark") !== null)).toBe(true);
    act(() => list.querySelector<HTMLButtonElement>('[data-testid="app-place-place:p17"]')!.click());
    expect(went).toEqual(["/places/p17"]);
    act(() => root.unmount());
  });

  it("is not on the bar while the scene is drawn", () => {
    const { root, host: at } = drawn(<AppBar brand={undefined} name="Errands" home={{ go: () => undefined, current: false }} faces={faces(false, [])} places={many} current={null} reach={{}} tools={null} find={false} />);
    expect(at.querySelector('[data-testid="app-places-open"]')).toBeNull();
    act(() => root.unmount());
  });

  it("lays its own rules over any a host's stylesheet could give the bar: one row of one height, every control in the middle of it", () => {
    const { root, host: at } = drawn(<AppBar brand={undefined} name="Errands" home={{ go: () => undefined, current: false }} faces={faces(true, [])} places={many} current="home" reach={{}} tools={null} find={false} />);
    const css = at.querySelector("style")?.textContent ?? "";
    const rule = (selector: string) => css.match(new RegExp(`\\n${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\{([^}]*)\\}`))?.[1] ?? "";
    expect(rule(".graview-bar")).toMatch(/display:block/);
    expect(rule(".graview-bar-row")).toMatch(/flex-wrap:nowrap/);
    // 47 px and the rule under it: 48 px in all.
    expect(rule(".graview-bar-row")).toMatch(/height:47px/);
    expect(rule(".graview-bar-row")).toMatch(/align-items:center/);
    act(() => root.unmount());
  });
});

describe("the app's places (FR-136, FR-138)", () => {
  const fixtures = resolve(import.meta.dirname, "../../../core/tests/document/fixtures");
  const compiled = compileDocument(JSON.parse(readFileSync(resolve(fixtures, "lifelogics.gdd.json"), "utf8")), { today: () => "2026-10-05" });
  if (!compiled.ok) throw new Error("lifelogics did not compile");
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy! });
  const owner = { kind: "human" as const, id: "u:owner", roles: ["owner"] };

  it("are the home first, then each kind's list, then each picture; the scene is not one of them", () => {
    const views = { places: () => [{ kind: "offer", title: "The offers", as: "the-offers" }], arrangement: () => app.pages };
    const places = barPlaces({ store, principal: owner, views });
    expect(places[0]).toMatchObject({ key: "home", label: "Home", path: "/", group: "home" });
    const groups = places.map((place) => place.group);
    expect(groups.lastIndexOf("lists")).toBeLessThan(groups.indexOf("pictures"));
    expect(places.find((place) => place.group === "pictures")).toMatchObject({ label: "The offers", path: "/places/the-offers", kind: "offer" });
    expect(places.some((place) => place.path === "/places/overview")).toBe(false);
  });
});
