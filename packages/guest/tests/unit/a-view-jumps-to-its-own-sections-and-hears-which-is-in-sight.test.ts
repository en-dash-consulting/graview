// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { sanitizeStylesheet } from "../../src/host/css.js";
import { judgeLink } from "../../src/host/external-links.js";
import { createGuestSections } from "../../src/host/sections.js";
import { createRefusalNotes } from "../../src/host/refused-note.js";
import type { GuestDomEvent } from "../../src/protocol.js";

/**
 * A VIEW JUMPS TO ITS OWN SECTIONS, AND HEARS WHICH IS IN SIGHT (Roadmap
 * f-views-scroll-and-anchors). From the Farm Bureau workshop's agenda and
 * TECH N9NE's eras: in the view's worker, an anchor link, scrollIntoView
 * and the address's hash were refused, and a view heard no scroll, had no
 * IntersectionObserver and no frame. So the host does it: `<a href="#id">`
 * is drawn and followed within the view, the kit keeps `scroll-margin-top`,
 * the host watches the sections and tells the view which is in sight, and a
 * record's file is a link to view or download. And a refused press is said
 * beside its control (Roadmap f-views-work-end-to-end).
 */
const region = () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const root = document.createElement("div");
  root.setAttribute("data-graview-view-root", "");
  shadow.appendChild(root);
  return { host, shadow, root };
};
const at = (element: Element, top: number) => vi.spyOn(element, "getBoundingClientRect").mockReturnValue({ top, bottom: top + 400, left: 0, right: 600, width: 600, height: 400, x: 0, y: top, toJSON: () => ({}) });

describe("the view kit", () => {
  it("draws an href that names an element of the view's own, and no other address it was not handed", () => {
    expect(judgeLink("#eras", { handed: new Set() })).toBe("#eras");
    expect(judgeLink("#", { handed: new Set() })).toBeUndefined();
    expect(judgeLink("#a b", { handed: new Set() })).toBeUndefined();
    expect(judgeLink("/elsewhere#eras", { handed: new Set() })).toBeUndefined();
  });
  it("keeps scroll-margin-top and scroll-padding-top", () => {
    const judged = sanitizeStylesheet("section { scroll-margin-top: 72px; } .rail { scroll-padding-top: 4rem; scroll-margin-block-start: 8px; }");
    expect(judged.refused).toEqual([]);
    expect(judged.css).toContain("scroll-margin-top");
    expect(judged.css).toContain("scroll-padding-top");
  });
});

describe("a jump within the view", () => {
  it("scrolls the element it names into view and gives it the keyboard", () => {
    const { shadow, root } = region();
    root.innerHTML = `<a href="#fees" target="_blank">Fees</a><section id="fees"><h2>Fees</h2></section>`;
    const section = shadow.getElementById("fees")!;
    const scrolled = vi.fn();
    section.scrollIntoView = scrolled;
    const sections = createGuestSections(window, { shadow, idOf: () => "1", send: () => {}, record: () => undefined });
    sections.refresh();
    expect(root.querySelector("a")!.hasAttribute("target")).toBe(false);
    expect(sections.jump(root.querySelector("a")!, root)).toBe(true);
    expect(scrolled).toHaveBeenCalledWith(expect.objectContaining({ block: "start" }));
    expect(shadow.activeElement).toBe(section);
    sections.dispose();
  });
  it("says a jump to an id it never drew goes nowhere", () => {
    const { shadow, root } = region();
    root.innerHTML = `<a href="#terms">Terms</a>`;
    const said: string[] = [];
    const sections = createGuestSections(window, { shadow, idOf: () => "1", send: () => {}, record: () => undefined, onProblem: (one) => said.push(one) });
    sections.jump(root.querySelector("a")!, root);
    expect(said).toEqual(['The jump "#terms" goes nowhere: the view drew no element with that id.']);
    sections.dispose();
  });
});

describe("the section in sight", () => {
  it("is the last one past a quarter of the window: marked, its jump current, and told to the view", async () => {
    const { shadow, root } = region();
    root.innerHTML = `<nav><a href="#one">One</a><a href="#two">Two</a></nav><section id="one"></section><section id="two"></section>`;
    const one = shadow.getElementById("one")!;
    const two = shadow.getElementById("two")!;
    at(one, -300);
    at(two, 100);
    const sent: GuestDomEvent[] = [];
    const ids = new Map<Node, string>([[one, "11"], [two, "12"]]);
    const sections = createGuestSections(window, { shadow, idOf: (node) => ids.get(node), send: (event) => sent.push(event), record: () => undefined });
    sections.refresh();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(two.hasAttribute("data-in-sight")).toBe(true);
    expect(one.hasAttribute("data-in-sight")).toBe(false);
    expect(root.querySelector('a[href="#two"]')!.getAttribute("aria-current")).toBe("location");
    expect(root.querySelector('a[href="#one"]')!.hasAttribute("aria-current")).toBe(false);
    expect(sent).toEqual([{ type: "dom-event", target: "12", event: "sight" }]);
    sections.dispose();
  });
});

describe("a record's file, from a view", () => {
  const contract = { href: "/graview/files/rhea.pdf", name: "Rhea — contract.pdf", type: "application/pdf", bytes: 4_000 };
  it("is a link to view it in a tab of its own, or to download it under its own name, from a record the view was shown", () => {
    const { shadow, root } = region();
    root.innerHTML = `<a id="view" data-file="placement:rhea" data-field="contract">View</a><a id="get" data-file="placement:rhea" data-field="contract" data-download>Download</a>`;
    const sections = createGuestSections(window, { shadow, idOf: () => undefined, send: () => {}, record: (id) => (id === "placement:rhea" ? { contract } : undefined), file: (href) => `/base${href}` });
    sections.refresh();
    const view = shadow.getElementById("view")!;
    const get = shadow.getElementById("get")!;
    expect([view.getAttribute("href"), view.getAttribute("target"), view.hasAttribute("download")]).toEqual(["/base/graview/files/rhea.pdf", "_blank", false]);
    expect([get.getAttribute("href"), get.getAttribute("download")]).toEqual(["/base/graview/files/rhea.pdf", "Rhea — contract.pdf"]);
    sections.dispose();
  });
  it("is drawn with no address, and said, where the record was not shown or holds no file", () => {
    const { shadow, root } = region();
    root.innerHTML = `<a id="a" data-file="placement:nobody" data-field="contract">View</a><a id="b" data-file="placement:omar" data-field="contract">View</a>`;
    const said: string[] = [];
    const sections = createGuestSections(window, { shadow, idOf: () => undefined, send: () => {}, record: (id) => (id === "placement:omar" ? {} : undefined), onProblem: (one) => said.push(one) });
    sections.refresh();
    expect([shadow.getElementById("a")!.hasAttribute("href"), shadow.getElementById("b")!.hasAttribute("href")]).toEqual([false, false]);
    expect(said).toEqual(['The file link to "placement:nobody" goes nowhere: it names no record this view was shown.', 'The file link to "placement:omar" goes nowhere: its "contract" holds no file.']);
    sections.dispose();
  });
});

describe("a refused press", () => {
  it("is said beside its control in the host's own note, outside what the view drew, and goes when it is cleared", () => {
    const { shadow, root } = region();
    root.innerHTML = `<button data-act="set-economics">Save economics</button>`;
    const button = root.querySelector("button")!;
    const notes = createRefusalNotes(shadow);
    notes.say(button, "Not applied: “fixedFee” expects a number.");
    const note = shadow.querySelector<HTMLElement>("[data-graview-refused-note]")!;
    expect(note.textContent).toBe("Not applied: “fixedFee” expects a number.");
    expect(note.getAttribute("role")).toBe("status");
    expect(root.contains(note)).toBe(false);
    notes.clear(button);
    expect(shadow.querySelector("[data-graview-refused-note]")).toBeNull();
  });
  it("is taken away once its control is no longer drawn", () => {
    const { shadow, root } = region();
    root.innerHTML = `<button>Save</button>`;
    const notes = createRefusalNotes(shadow);
    notes.say(root.querySelector("button")!, "That was not applied.");
    root.innerHTML = "";
    notes.refresh();
    expect(shadow.querySelector("[data-graview-refused-note]")).toBeNull();
  });
});
