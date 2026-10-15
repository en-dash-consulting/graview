// @vitest-environment jsdom
import { Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { createLinks, listsOf, type Arrival } from "../../src/host/links.js";
import { createGuestHost } from "../../src/host/session.js";
import { navigateRequest } from "../../src/protocol.js";

/**
 * A VIEW GOES TO A LIST NARROWED, OR TO A SECTION OF A PAGE (Roadmap
 * f-navigate-filters). `graview.navigate` took a place's slug and nothing
 * else, so a custom home that wanted "offers at the start" needed a lens
 * for it. Now a view goes to a kind's list or a lens narrowed —
 * `{ place: "offers", where: { stage: "start" } }` — and to a section,
 * the filter held to the kind's fields and refused in a sentence where the
 * kind has no such field. What the face makes of the arrival — the
 * address, the stop — is `a-view-arrives-where-it-asked` in pages.
 */
const store = () => new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: structuredClone(offersSeed) as never });
const places = [{ as: "the-packages", title: "The packages", kind: "package" }];

function links() {
  const shelf = store();
  const went: Arrival[] = [];
  const lost: string[] = [];
  const made = createLinks({
    sees: (id) => shelf.seenBy(lin).graph.has(id),
    places: () => places,
    lists: () => listsOf(shelf.schema),
    schema: shelf.schema,
    onNavigate: (to) => went.push(to),
    onLost: (said) => lost.push(said),
  });
  return { made, went, lost, shelf };
}

describe("a view's navigate, narrowed and to a section", () => {
  it("goes to a kind's list by its plural, narrowed by a field it has, in the address's words", () => {
    const { made, went, lost } = links();
    expect(made.go({ place: "offers", where: { stage: "start" } })).toBe(true);
    expect(made.go({ place: "offer", where: { stage: "later", units: 2 } })).toBe(true);
    expect(went).toEqual([
      { list: "offer", filter: "stage:start" },
      { list: "offer", filter: "stage:later,units:2" },
    ]);
    expect(lost).toEqual([]);
  });

  it("goes to a lens narrowed, by the lens's own kind", () => {
    const { made, went } = links();
    expect(made.go({ place: "the-packages", where: { standing: "recommended" } })).toBe(true);
    expect(went).toEqual([{ place: "the-packages", filter: "standing:recommended" }]);
  });

  it("goes to a section of a page — a list's, a place's or a record's", () => {
    const { made, went } = links();
    expect(made.go({ place: "offers", section: "Shipping soon" })).toBe(true);
    expect(made.go({ place: "the-packages", where: { standing: "later" }, section: "later" })).toBe(true);
    expect(made.go({ record: "offer:strategy", section: "notes" })).toBe(true);
    expect(went).toEqual([
      { list: "offer", section: "Shipping soon" },
      { place: "the-packages", filter: "standing:later", section: "later" },
      { record: "offer:strategy", section: "notes" },
    ]);
  });

  it("refuses a filter on a field the kind does not have, in a sentence to the view, and goes nowhere", () => {
    const { made, went, lost } = links();
    expect(made.go({ place: "offers", where: { stag: "start" } })).toBe(false);
    expect(made.go({ place: "offers", where: { stage: "someday" } })).toBe(false);
    expect(made.go({ record: "offer:strategy", where: { stage: "start" } })).toBe(false);
    expect(made.go({ place: "offers", section: "   " })).toBe(false);
    expect(went).toEqual([]);
    expect(lost).toEqual([
      'The filter on "offers" goes nowhere: Offers have no field "stag" to filter by; they filter by list, units, stage, cost, for, includes, for.role, includes.standing and is.',
      'The filter on "offers" goes nowhere: Stage has no choice "someday"; its choices are "start" and "later".',
      '"offer:strategy" is one record, and a filter narrows a list or a place: it goes nowhere. Go to { place, where } for a list narrowed.',
      'The section "   " names nothing on a page: a section is a heading\'s words or an element\'s id, like "shipping-soon". It goes nowhere.',
    ]);
  });

  it("follows a link's data-filter and data-section the same way", () => {
    const { made, went, lost } = links();
    const anchor = document.createElement("a");
    anchor.setAttribute("data-place", "offers");
    anchor.setAttribute("data-filter", "stage:start");
    anchor.setAttribute("data-section", "the-start");
    made.follow(anchor);
    anchor.setAttribute("data-filter", "color:red");
    made.follow(anchor);
    expect(went).toEqual([{ list: "offer", filter: "stage:start", section: "the-start" }]);
    expect(lost[0]).toMatch(/^The filter on "offers" goes nowhere: Offers have no field "color"/);
  });

  it("carries where and section from a frame guest's navigate to the host, which judges it the same way", async () => {
    expect(navigateRequest({ place: "offers", where: { stage: "start" }, section: "top" })).toEqual({ type: "navigate", place: "offers", where: { stage: "start" }, section: "top" });
    expect(navigateRequest({ record: "offer:strategy", section: "notes" })).toEqual({ type: "navigate", to: "offer:strategy", section: "notes" });
    const shelf = store();
    const arrived: Arrival[] = [];
    const lost: string[] = [];
    const host = createGuestHost({ store: shelf, principal: lin, view: "home", nonce: "n", send: () => {}, placesShown: () => places, onArrive: (to) => arrived.push(to), onLost: (said) => lost.push(said) });
    host.receive({ nonce: "n", ...navigateRequest({ place: "offers", where: { stage: "start" }, section: "top" }) });
    host.receive({ nonce: "n", ...navigateRequest({ place: "offers", where: { color: "red" } }) });
    // The links' judging is fetched with the first navigate.
    await new Promise((done) => setTimeout(done, 20));
    expect(arrived).toEqual([{ list: "offer", filter: "stage:start", section: "top" }]);
    expect(lost).toHaveLength(1);
    expect(host.stats.dropped).toBe(1);
  });
});
