import { describe, expect, it } from "vitest";
import { describePlace, type DescribedHostView } from "../../src/describe.js";
import { Store, type AnySchema, type Principal } from "../../src/index.js";
import { placesOf, viewPlaceOf } from "../../src/seat.js";
import { compileDocumentWithoutCheck, type GraviewDocument } from "../../src/document/index.js";

/*
 * A TITLED VIEW'S PLACE IS DESCRIBED (Roadmap f-check-view-places). Threat
 * Watch, on Graview Cloud, keeps a view of many threats titled "Live
 * threats", drawn at `/places/live-threats`; describe_place said nothing of
 * it — "not a place this app has". Told the host's views, `describePlace`
 * says that place as it says a lens's: its title, slug and address, that a
 * view draws it, whether it flows with the page or keeps a frame when the
 * host said, and what the view drew when the host ran it headless.
 */
const document = {
  format: "graview-document",
  formatVersion: 1,
  name: "Threat Watch",
  kinds: {
    threat: { fields: { name: { type: "string", required: true }, level: { type: "enum", options: ["low", "high"] } } },
  },
} as unknown as GraviewDocument;

const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const compiled = compileDocumentWithoutCheck(document);
if (!compiled.ok) throw new Error("does not compile");
const app = compiled.app;
const store = new Store<AnySchema>({
  schema: app.schema as AnySchema,
  mutations: app.mutations ?? [],
  snapshot: { nodes: [{ id: "t1", kind: "threat", name: "Phishing wave", level: "high" }], edges: [] } as never,
});
const live: DescribedHostView = { name: "live", title: "Live threats", attach: "threat", cardinality: "many", parts: [{ t: "heading", level: 1, text: "Live threats" }, { t: "text", text: "1 threat, rated high" }] };
const framed: DescribedHostView = { name: "map", title: "Threat map", attach: "threat", cardinality: "many", flows: false };
const flowing: DescribedHostView = { ...live, flows: true };

describe("a titled view's own place, told the host's views", () => {
  it("is found by its slug, its title and its address, at the address the router gives it", () => {
    expect(viewPlaceOf(live)).toMatchObject({ as: "live-threats", kind: "threat", name: "live" });
    const listed = placesOf(app, { views: [live] }).find((one) => one.view === "live");
    expect(listed).toMatchObject({ slug: "live-threats", address: "/places/live-threats" });
    for (const asked of ["live-threats", "Live threats", "/places/live-threats"]) {
      const described = describePlace(store, owner, asked, { app, views: [live] });
      expect(described.ok, asked).toBe(true);
    }
  });

  it("says a view draws it, by its title, with what the view drew", () => {
    const described = describePlace(store, owner, "live-threats", { app, views: [live] });
    if (!described.ok) throw new Error(described.error);
    const { description } = described;
    expect(description.place).toEqual({ slug: "live-threats", title: "Live threats", kind: "threat", address: "/places/live-threats" });
    expect(description.drawnBy).toBe("view:live");
    expect(description.parts).toEqual([{ t: "view", name: "live", title: "Live threats", parts: live.parts }]);
    expect(description.problems).toEqual([]);
    expect(description.text).toMatch(/^Live threats \(\/places\/live-threats\)/);
    expect(description.text).toMatch(/\[the view "Live threats"\]\n {2}# Live threats\n {2}1 threat, rated high/);
  });

  it("says it flows with the page, or keeps a frame of its own, only where the host said", () => {
    const said = (view: DescribedHostView, slug: string) => {
      const described = describePlace(store, owner, slug, { app, views: [view] });
      if (!described.ok) throw new Error(described.error);
      return described.description;
    };
    expect(said(flowing, "live-threats").parts[0]).toMatchObject({ t: "view", flows: true });
    expect(said(flowing, "live-threats").text).toMatch(/\[the view "Live threats", flowing with the page\]/);
    expect(said(framed, "threat-map").parts[0]).toEqual({ t: "view", name: "map", title: "Threat map", flows: false });
    expect(said(framed, "threat-map").text).toMatch(/\[the view "Threat map", in a frame of its own\]/);
    expect(said(live, "live-threats").parts[0]).not.toHaveProperty("flows");
  });

  it("is no place at all when the host names no such view, as before", () => {
    const described = describePlace(store, owner, "live-threats", { app });
    expect(described.ok).toBe(false);
    if (!described.ok) expect(described.places).not.toContain("live-threats");
  });
});
