// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { declaredViews, fetchDeclaredLenses, fetchHomeView } from "@graview/primitives";
import { drawnFindings } from "@graview/tools/section";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readDrawn } from "../../../primitives/src/better-bar.js";
import { fieldsShownOf, labelsShown, markupOf } from "../../../primitives/src/page-better.js";
import type { PagePart } from "../../../primitives/src/page-parts.js";
import { PagesApp } from "../../src/index.js";

/*
 * BETTER UI HOLDS A DRAFT OF A DECLARED HOME TO WHAT IT SHOWED, AND NO
 * MORE (Roadmap f-better-ui-facts-beside-their-record,
 * f-better-ui-computer-words-false-alarms). Nick, in production on 0.1.67:
 * Better UI on Book Manuscript's home failed "details lost on 3 records",
 * then "on 2 records, again", for a draft that showed every detail.
 * Graview Cloud reproduced it with no model (`better-ui-book.mjs`): the
 * book's declaration and the fixed drafts it answers with are the fixtures
 * here, drawn as a worker view draws them. A tag one box over from its
 * record's link, the hero's tags beside a record drawn with no link, a
 * count said in words, a goal held to its nested chapter's badge, and
 * "draft 3" or a story that says "true" read as the computer's words —
 * each failed a draft that kept everything.
 */
const fixtures = resolve(import.meta.dirname, "fixtures");
const compiled = compileDocument(JSON.parse(readFileSync(resolve(fixtures, "book.gdd.json"), "utf8")));
if (!compiled.ok) throw new Error("the book did not compile");
const app = compiled.app as GraviewApp<AnySchema>;
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const DRAFT_BESIDE = readFileSync(resolve(fixtures, "every-detail-beside.js"), "utf8");
const DRAFT_INSIDE = readFileSync(resolve(fixtures, "every-detail-inside.js"), "utf8");

/** The records Cloud's reproduction makes, by its acts. */
const snapshot = {
  nodes: [
    { id: "p1", kind: "purpose", title: "Departure From the Blueprint", thesis: "The end of believing someone else has defined a blueprint for your life.", coverLine: "Live free" },
    { id: "a1", kind: "audience", name: "Students", priority: "primary" },
    { id: "g1", kind: "goal", statement: "You can question the script you were handed", priority: "must-have" },
    { id: "c1", kind: "chapter", title: "01 · The End", status: "draft" },
    { id: "c2", kind: "chapter", title: "02 · Who Drew the Map", status: "draft" },
    { id: "c3", kind: "chapter", title: "03 · Without a Map", status: "draft" },
    { id: "i1", kind: "idea", title: "Bookends", point: "Open with the end, close with the beginning.", status: "keeper" },
    { id: "i2", kind: "idea", title: "Where the blueprint shows up", point: "It runs through school, career, friendships.", status: "raw" },
    { id: "i3", kind: "idea", title: "The permission slip", point: "Nobody is coming to give you permission.", status: "raw" },
    { id: "i4", kind: "idea", title: "Claude's note on pacing", point: "Chapter two is heavy.", status: "raw" },
    { id: "s1", kind: "story", title: "Steve Jobs at Stanford", type: "person", status: "candidate", factCheck: "unchecked", whyItFits: "It shows a script being broken." },
    { id: "s2", kind: "story", title: "The marshmallow study", type: "study", status: "candidate", factCheck: "unchecked", whyItFits: "It shows a script being broken." },
    { id: "s3", kind: "story", title: "The Overview Effect", type: "concept", status: "candidate", factCheck: "unchecked", whyItFits: "It shows a script being broken." },
    { id: "s4", kind: "story", title: "Roger Bannister's mile", type: "history", status: "keeper", factCheck: "unchecked", whyItFits: "It shows a script being broken." },
  ] as readonly Record<string, unknown>[],
  edges: [
    { id: "e1", kind: "serves", from: "g1", to: "a1" },
    { id: "e2", kind: "delivers", from: "c1", to: "g1" },
  ],
};

/** A worker view's script run as the host runs it, its `graview.html` made a string: the markup it renders for these records. */
function rendered(source: string, nodes: readonly object[]): string {
  class Html {
    constructor(readonly markup: string) {}
  }
  const escaped = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const shown = (value: unknown): string => (value instanceof Html ? value.markup : Array.isArray(value) ? value.map(shown).join("") : value === undefined || value === null || value === false ? "" : escaped(String(value)));
  let props: ((props: { nodes: readonly object[] }) => void) | undefined;
  let out = "";
  const graview = {
    style: () => undefined,
    html: (strings: TemplateStringsArray, ...values: unknown[]) => new Html(strings.reduce((all, one, at) => all + one + (at < values.length ? shown(values[at]) : ""), "")),
    onProps: (listener: typeof props) => void (props = listener),
    render: (html: Html) => void (out = html.markup),
  };
  new Function("graview", source)(graview);
  props!({ nodes });
  return out;
}

/** The draft drawn as the host draws a worker view, in the page's region. */
function drawnDraft(markup: string): Element {
  const main = document.createElement("main");
  const place = document.createElement("div");
  place.setAttribute("data-worker-view-place", "");
  const view = document.createElement("div");
  view.setAttribute("data-worker-view", "home-draft");
  place.append(view);
  main.append(place);
  document.body.append(main);
  const root = document.createElement("div");
  root.setAttribute("data-graview-view-root", "");
  root.innerHTML = markup;
  view.attachShadow({ mode: "open" }).append(root);
  return main;
}

/** The book's home drawn by the routed face, read as Better UI reads it on Home, and a draft judged against it. */
async function home(nodes = snapshot.nodes) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: { ...snapshot, nodes } as never });
  await act(async () => root.render(<PagesApp context={{ store, views: declaredViews(app), principal: owner }} initialPath="/" />));
  await act(async () => new Promise((done) => setTimeout(done, 50)));
  const main = host.querySelector("main")!;
  const part: PagePart = { name: "Home", slot: "home", elements: [], main };
  const labels = labelsShown(store as never, part, (main as HTMLElement).innerText);
  const before = readDrawn(main, labels);
  const shown = fieldsShownOf(store as never, part);
  const judged = (source: string, asked = "make it more enticing for me to do the next atomic step") => {
    const draft = drawnDraft(rendered(source, nodes));
    const findings = drawnFindings(before, readDrawn(draft, labels), { ...shown, asked });
    draft.remove();
    return findings;
  };
  const done = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { main, before, labels, shown, judged, done };
}

// jsdom lays nothing out: every element is drawn, and each one's words read apart.
const rects = HTMLElement.prototype.getClientRects;
beforeAll(async () => {
  await Promise.all([fetchDeclaredLenses(), fetchHomeView()]);
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

describe("Better UI on a declared home", () => {
  it("passes a draft that draws a tag one box over from its record's link: a record's details are the block that holds it and no other record", async () => {
    const page = await home();
    expect(page.judged(DRAFT_BESIDE)).toEqual([]);
    expect(page.judged(DRAFT_INSIDE)).toEqual([]);
    await page.done();
  });

  it("finds a record drawn with no link by the heading it was drawn with, and holds it to its tags", async () => {
    const page = await home();
    expect(page.before.records.find((one) => one.label === "Departure From the Blueprint")?.facts).toEqual(["Live free", "Your book"]);
    const noCover = DRAFT_BESIDE.replace('<span class="tag">${p.coverLine}</span>', "");
    expect(noCover).not.toBe(DRAFT_BESIDE);
    expect(page.judged(noCover).join(" ")).toContain("“Live free” on “Departure From the Blueprint”");
    await page.done();
  });

  it("holds a count by its number, and a nothing said as “no”", async () => {
    const page = await home();
    const reworded = DRAFT_BESIDE.replace("const COUNTS = true;", "const COUNTS = false;");
    expect(reworded).not.toBe(DRAFT_BESIDE);
    expect(page.judged(reworded)).toEqual([]);
    // A count said with another number is a count lost.
    expect(page.judged(DRAFT_BESIDE.replace('"1 chapters · 0 stories · 0 ideas"', '"2 chapters · 0 stories · 0 ideas"')).join(" ")).toContain("“1 chapters” on “You can question the script you were handed”");
    await page.done();
  });

  it("never gives a card the facts of the rows nested in it", async () => {
    const page = await home();
    expect(page.before.records.find((one) => one.label === "You can question the script you were handed")?.facts).toEqual(["Must have", "1 chapters", "0 stories", "0 ideas"]);
    await page.done();
  });

  it("still fails a draft that drops a record, or a record's status", async () => {
    const page = await home();
    const fewer = DRAFT_BESIDE.replace('of("idea").filter((i) => i.status === "raw").slice(0, 3)', 'of("idea").filter((i) => i.status === "raw").slice(0, 2)');
    expect(fewer).not.toBe(DRAFT_BESIDE);
    expect(page.judged(fewer).join(" ")).toContain("It no longer shows “Claude's note on pacing”");
    const unsaid = DRAFT_BESIDE.replace('<a data-record="${i.id}">${i.title}</a> <span class="tag">${cap(i.status)}</span>', '<a data-record="${i.id}">${i.title}</a>');
    expect(unsaid).not.toBe(DRAFT_BESIDE);
    expect(page.judged(unsaid).join(" ")).toContain("“Raw” on “Where the blueprint shows up”");
    await page.done();
  });

  it("passes words a person wrote and counts said beside a field's name: “draft 3”, and a story whose text says true", async () => {
    const told = snapshot.nodes.map((one) => (one["id"] === "s1" ? { ...one, story: "He said it was true: you cannot connect the dots looking forward." } : one));
    const page = await home(told);
    expect(page.shown.fields).toEqual(expect.arrayContaining(["draft", "story", "type", "status", "summary", "point"]));
    const counted = DRAFT_BESIDE.replace(
      "<section><strong>Ideas to triage</strong>",
      '<p>Chapters: draft ${chapters.filter((c) => c.status === "draft").length} · revising 0 · done 0 · story 2</p><p>${(of("story").find((s) => s.story) || {}).story}</p><section><strong>Ideas to triage</strong>',
    );
    expect(counted).not.toBe(DRAFT_BESIDE);
    expect(page.judged(counted)).toEqual([]);
    // A value as the computer keeps it, that no record says, is still the computer's; and a field's name with its own value beside it.
    expect(page.judged(counted.replace("revising 0", "revising undefined")).join(" ")).toContain("“undefined”");
    expect(page.judged(counted.replace("revising 0", "revising false")).join(" ")).toContain("“false”");
    expect(page.judged(counted.replace("revising 0", "status: candidate")).join(" ")).toContain("“status”, a field's name");
    await page.done();
  });

  it("gives the model each record's link with its name in the page it reads", async () => {
    const page = await home();
    const markup = markupOf(page.main)!;
    expect(markup).toContain('<a data-record="c2">02 · Who Drew the Map</a>');
    expect(markup).not.toContain("<a></a>");
    await page.done();
  });
});
