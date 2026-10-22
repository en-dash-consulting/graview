import { describe, expect, it } from "vitest";
import { describePlace, shadowedPageSlots, type DescribedHostView } from "../../src/describe.js";
import { Store, type AnySchema, type Principal } from "../../src/index.js";
import { compileDocumentWithoutCheck, type GraviewDocument } from "../../src/document/index.js";

/*
 * A RECORD'S PAGE SAYS ITS VIEW AND ITS SLOT, WHERE THEY ARE DRAWN (Roadmap
 * feature:page-slot-blocks-on-a-kind-with-a-record-view-unclear-whether-and-where-they-draw).
 * Threat Watch, on Graview Cloud: a kind with a page slot ("Read the
 * sources") and a record view of its own, and describe_place said neither
 * the slot nor any sign of it. Told the host's views, a record's page says
 * the view at its head, then the slot's blocks, then the facts; and where
 * the view replaces the page, the view alone and a problem: the slot is
 * never drawn.
 */
const document = {
  format: "graview-document",
  formatVersion: 1,
  name: "Threat Watch",
  kinds: {
    threat: { fields: { name: { type: "string", required: true }, level: { type: "enum", options: ["low", "high"] } } },
    analyst: { fields: { name: { type: "string", required: true } } },
  },
  views: {
    threat: { page: [{ headline: "Read the sources" }, { text: "Rated {level}" }] },
    analyst: { page: [{ headline: "Who they are" }] },
  },
} as unknown as GraviewDocument;

const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const compiled = compileDocumentWithoutCheck(document);
if (!compiled.ok) throw new Error("does not compile");
const app = compiled.app;
const store = new Store<AnySchema>({
  schema: app.schema as AnySchema,
  mutations: app.mutations ?? [],
  snapshot: { nodes: [{ id: "t1", kind: "threat", name: "Phishing wave", level: "high" }, { id: "a1", kind: "analyst", name: "Ada" }], edges: [] } as never,
});
const brief: DescribedHostView = { name: "brief", title: "The brief", attach: "threat", cardinality: "one", parts: [{ t: "text", text: "Phishing wave, at a glance" }] };
const card: DescribedHostView = { name: "card", attach: "analyst", cardinality: "one", replaces: "page" };

function said(id: string, views?: readonly DescribedHostView[]) {
  const described = describePlace(store, owner, id, { app, today: "2026-10-21", ...(views ? { views } : {}) });
  if (!described.ok) throw new Error(described.error);
  return described.description;
}

describe("a record's page with a view the host keeps", () => {
  it("says the view at its head, then the slot's blocks, then the facts", () => {
    const page = said("t1", [brief, card]);
    expect(page.drawnBy).toBe("record");
    expect(page.parts.map((part) => part.t)).toEqual(["view", "heading", "text", "field"]);
    expect(page.parts[0]).toEqual({ t: "view", name: "brief", title: "The brief", parts: [{ t: "text", text: "Phishing wave, at a glance" }] });
    expect(page.problems).toEqual([]);
    expect(page.text).toMatch(/\[the view "The brief"\]\n {2}Phishing wave, at a glance\n## Read the sources\nRated high/);
  });
  it("says the slot and the facts alone, as before, when the host names no view of the kind", () => {
    expect(said("t1").parts.map((part) => part.t)).toEqual(["heading", "text", "field"]);
    expect(said("t1", [card]).parts[0]).toMatchObject({ t: "heading", text: "Read the sources" });
  });
  it("says a view that replaces the page alone, and that the kind's page slot is never drawn", () => {
    const page = said("a1", [brief, card]);
    expect(page.drawnBy).toBe("view:card");
    expect(page.parts).toEqual([{ t: "view", name: "card", replaces: true }]);
    expect(page.text).not.toContain("Who they are");
    expect(page.problems).toEqual([{ at: "views.analyst.page", says: expect.stringMatching(/"card" replaces an analyst's page, so its page slot is never drawn/) }]);
  });
});

describe("the page slots a host's views shadow", () => {
  it("are the slots of kinds whose view replaces the page, and no other", () => {
    expect(shadowedPageSlots(app, [brief, card]).map((one) => one.at)).toEqual(["views.analyst.page"]);
    expect(shadowedPageSlots(app, [brief, { ...card, attach: "threat" }]).map((one) => one.at)).toEqual(["views.threat.page"]);
    expect(shadowedPageSlots(app, [{ ...card, cardinality: "many" }])).toEqual([]);
  });
});
