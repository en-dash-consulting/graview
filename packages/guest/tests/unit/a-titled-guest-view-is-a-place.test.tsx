// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { defineApp, placesOf, Store, type AnySchema } from "@graview/core";
import { PagesApp } from "@graview/pages";
import { createViews } from "@graview/react/provider";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { guestView } from "../../src/host/index.js";

/**
 * A TITLED GUEST VIEW IS A NAMED PLACE (FR-87). `guestView({ …, title })`
 * names its frame for assistive technology by the title, and registering it
 * with the same title makes it a place on both faces: listed by `placesOf`
 * with an address on the routed face and a stop in the scene, and drawn at
 * that address. Owner-uploaded frames are the "bring your own" form; the
 * worker form is FR-91.
 */
const store = () => new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: offersSeed as never }) as unknown as Store<AnySchema>;

function registered() {
  const views = createViews(offersApp.schema);
  const title = "The price sheet";
  views.register("package", { cardinality: "many", fidelity: "full" }, guestView({ url: "https://cards.example/prices.html", name: "prices", title }) as never, { title });
  return views;
}

describe("a guest view registered with a title", () => {
  it("is a place among the app's places, with an address on each face", () => {
    const views = registered();
    expect(views.places()).toEqual([{ kind: "package", title: "The price sheet", as: "the-price-sheet" }]);
    const place = placesOf(defineApp({ ...offersApp, views } as never)).find((one) => one.slug === "the-price-sheet");
    expect(place).toMatchObject({ title: "The price sheet", kind: "package", address: "/places/the-price-sheet" });
    expect(place!.stop).toMatch(/view=the-price-sheet/);
  });

  it("is drawn at its address on the routed face, its frame named by its title", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={{ store: store(), views: registered() as never, principal: lin }} initialPath="/places/the-price-sheet" />));
    await act(async () => new Promise((done) => setTimeout(done, 20)));
    const frame = host.querySelector<HTMLIFrameElement>('iframe[data-guest-view="prices"]');
    expect(frame).not.toBeNull();
    expect(frame!.getAttribute("title")).toBe("The price sheet");
    expect(host.querySelector("main h1")?.textContent).toBe("The price sheet");
    await act(async () => root.unmount());
    host.remove();
  });

  it("is no place when it is registered with no title, as before", () => {
    const views = createViews(offersApp.schema);
    views.register("package", { cardinality: "many", fidelity: "full" }, guestView({ url: "https://cards.example/prices.html", name: "prices" }) as never);
    expect(views.places()).toEqual([]);
  });
});
