// @vitest-environment jsdom
import { drawnFindings } from "@graview/tools/section";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { headingsOf, readDrawn, recordLabelsOf } from "../../src/better-bar.js";
import { drawingFindings } from "../../src/section-better.js";

/*
 * BETTER UI JUDGES A DRAFT BY WHAT THE PAGE DRAWS (Roadmap
 * f-better-ui-draws-first-time). Graview Cloud reproduced, with no model,
 * every draft of a home view failing: a wedding's vendors as cards in
 * nested headed sections, each card a status tag before the record's link.
 * The record was named by the card's words glued together ("bookedThe
 * Velvet Notes") and looked for in the page's spaced words, so the very
 * script on the page failed; and asked to reword the top heading, a draft
 * that changed only its words failed as a section no longer drawn. The
 * page below is the one Cloud's repro draws (`better-ui-checks.mjs`).
 */
const HEADING = "Our wedding vendors: who is booked and who we are still talking to.";
const REWORDED = "Who we have booked, and who we are still talking to.";
const VENDORS = [
  { id: "v1", name: "The Velvet Notes", status: "booked" },
  { id: "v2", name: "Sugar & Spoon", status: "researching" },
  { id: "v3", name: "Crumbs Bakery", status: "researching" },
];

/** The home as the view draws it: landmarks as the host draws them, each card a tag then the record's link, nothing between them. */
function home({ heading = HEADING, below = "Where we are", tags = true }: { heading?: string; below?: string; tags?: boolean } = {}): string {
  const card = (one: (typeof VENDORS)[number]) => `<li class="pg-card" data-key="${one.id}">${tags ? `<span class="pg-tag">${one.status}</span>` : ""}<a data-record="${one.id}">${one.name}</a></li>`;
  return (
    `<div class="pg"><div data-graview-as="section" class="pg-sec"><h2>${heading}</h2><p>Every business we might hire, with where we are with each one.</p></div>` +
    `<div data-graview-as="section" class="pg-sec"><h3>${below}</h3>` +
    `<div data-graview-as="section" class="pg-sec"><h3>Booked</h3><ul class="pg-grid">${VENDORS.filter((one) => one.status === "booked").map(card).join("")}</ul></div>` +
    `<div data-graview-as="section" class="pg-sec"><h3>Still talking</h3><ul class="pg-grid">${VENDORS.filter((one) => one.status !== "booked").map(card).join("")}</ul></div>` +
    `</div></div>`
  );
}

/** The view's drawing, in a worker view's shadow root as the host draws it. */
function drawn(markup: string): Element {
  const place = document.createElement("div");
  place.setAttribute("data-worker-view-place", "");
  const host = document.createElement("div");
  host.setAttribute("data-worker-view", "home-board");
  place.append(host);
  document.body.append(place);
  const root = document.createElement("div");
  root.setAttribute("data-graview-view-root", "");
  root.innerHTML = markup;
  host.attachShadow({ mode: "open" }).append(root);
  return root;
}

/*
 * jsdom lays nothing out: every element is drawn, and a person reads each
 * card's tag and name apart — as a browser gives innerText for these cards,
 * whose parts are grid items.
 */
const rects = HTMLElement.prototype.getClientRects;
beforeAll(() => {
  HTMLElement.prototype.getClientRects = function () {
    return [{ width: 1, height: 1 }] as unknown as DOMRectList;
  };
  Object.defineProperty(HTMLElement.prototype, "innerText", {
    configurable: true,
    get(this: HTMLElement) {
      const walker = document.createTreeWalker(this, NodeFilter.SHOW_TEXT);
      const said: string[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.textContent?.trim()) said.push(node.textContent.trim());
      return said.join("\n");
    },
  });
});
afterAll(() => {
  HTMLElement.prototype.getClientRects = rects;
  delete (HTMLElement.prototype as { innerText?: string }).innerText;
});

const named = (id: string) => VENDORS.find((one) => one.id === id)?.name;

describe("Better UI judging a draft of a view", () => {
  it("names each record by its own link, never glued to the tag beside it", () => {
    const root = drawn(home());
    expect(recordLabelsOf(root, named)).toEqual(["The Velvet Notes", "Sugar & Spoon", "Crumbs Bakery"]);
    // With no store to ask, by the link's own words.
    expect(recordLabelsOf(root)).toEqual(["The Velvet Notes", "Sugar & Spoon", "Crumbs Bakery"]);
    const read = readDrawn(root, recordLabelsOf(root, named));
    expect(read.records.find((one) => one.label === "The Velvet Notes")).toMatchObject({ facts: ["booked"], under: "Booked", opens: true });
  });

  it("reads the words either side of a chip as two facts, as a glance led by its date draws them", () => {
    const root = drawn(`<ul><li class="pg-card"><a data-record="t1">Write the brief</a><span>Sep 3, 2026 <span class="graview-chip">Todo</span> Done: no</span></li></ul>`);
    const read = readDrawn(root, ["Write the brief"]);
    expect([...(read.records[0]?.facts ?? [])].sort()).toEqual(["Done: no", "Sep 3, 2026", "Todo"]);
  });

  it("passes the unchanged draft: the script already on the page loses nothing", () => {
    const live = drawn(home());
    const before = readDrawn(live, recordLabelsOf(live, named));
    const draft = drawn(home());
    const asked = "make it more modern looking";
    expect(drawnFindings(before, readDrawn(draft, before.records.map((one) => one.label)), { asked })).toEqual([]);
    expect(drawingFindings({ source: "", css: "", root: live }, { source: "", css: "", root: draft }, { asked })).toEqual([]);
  });

  it("still fails a draft that drops a record's status", () => {
    const live = drawn(home());
    const before = readDrawn(live, recordLabelsOf(live, named));
    const findings = drawnFindings(before, readDrawn(drawn(home({ tags: false })), before.records.map((one) => one.label)), { asked: "make it more modern looking" });
    expect(findings).toHaveLength(1);
    // "booked" is said still, by the heading its card sits under; "researching" is said nowhere now.
    expect(findings[0]).toContain("“researching” on “Sugar & Spoon”");
  });

  it("passes a draft that rewords only the heading it was asked to: the part is found by where it stands, not by its words", () => {
    const live = drawn(home());
    const part = [live.querySelector('[data-graview-as="section"]')!];
    const mayReword = headingsOf(part);
    expect(mayReword).toEqual([HEADING]);
    const before = readDrawn(live, recordLabelsOf(live, named));
    const draft = drawn(home({ heading: REWORDED }));
    const asked = "reword the top heading so it is shorter";
    expect(drawnFindings(before, readDrawn(draft, before.records.map((one) => one.label)), { asked, mayReword })).toEqual([]);
    expect(drawingFindings({ source: "", css: "", root: live }, { source: "", css: "", root: draft }, { asked, mayReword })).toEqual([]);
  });

  it("keeps every heading the person did not ask to reword", () => {
    const live = drawn(home());
    const part = [live.querySelector('[data-graview-as="section"]')!];
    const before = readDrawn(live, recordLabelsOf(live, named));
    // Not asked to reword it: the heading is the page's to keep.
    const reworded = drawn(home({ heading: REWORDED }));
    const modern = { asked: "make it more modern looking", mayReword: headingsOf(part) };
    expect(drawnFindings(before, readDrawn(reworded, before.records.map((one) => one.label)), modern).join(" ")).toContain(`“${HEADING}”`);
    expect(drawingFindings({ source: "", css: "", root: live }, { source: "", css: "", root: reworded }, modern).join(" ")).toContain(`“${HEADING}”`);
    // Asked to reword, but another part's heading changed: that one is still kept.
    const elsewhere = drawn(home({ below: "Where things stand" }));
    const asked = { asked: "reword the top heading so it is shorter", mayReword: headingsOf(part) };
    // (Its words are still on the page — "with where we are with each one" — so the part, found by where it stands, is what says it is gone.)
    expect(drawingFindings({ source: "", css: "", root: live }, { source: "", css: "", root: elsewhere }, asked).join(" ")).toContain("“Where we are”");
  });
});
