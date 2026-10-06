import { readFileSync } from "node:fs";
import { createSchema, declaredLenses, defineApp, defineNode, Store, z, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { EMPTY_VIEW } from "@graview/layout";
import { compileBlocks, declaredViews, MAX_LIST_DEPTH, registerDefaultViews, registerViewSpecs, SpecLinks, SpecPlace } from "@graview/primitives";
import { createViews, GraviewProvider, type ViewComponent } from "@graview/react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { declaredLensView } from "../../src/declared-lenses.js";
import { homeView } from "../../src/home-view.js";

/**
 * FR-81 and FR-82, drawn. LifeLogics' front page and four lenses rebuilt as
 * data (`packages/core/tests/document/fixtures/lifelogics.gdd.json`): the
 * home's headline counts, its figure works out money across records, its
 * list draws a chosen record by that record's own card; a package's page
 * lists its offers as rows and a note's row the offers that answer it,
 * each a link — and none of them lists, counts or heads a group with a
 * record the seat may not see (FR-55).
 */
const fixtures = new URL("../../../core/tests/document/fixtures/", import.meta.url);
const document = JSON.parse(readFileSync(new URL("lifelogics.gdd.json", fixtures), "utf8"));
const seed = JSON.parse(readFileSync(new URL("lifelogics.seed.json", fixtures), "utf8"));
const compiled = compileDocument(document, { today: () => "2026-10-05" });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app = compiled.app;
const schema = app.schema as AnySchema;

const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
/** The delivery partner: sees the offers its own firm delivers, and none of the others. */
const partner: Principal = { kind: "human", id: "party-delivery", roles: ["partner"] };

const storeOf = (snapshot: unknown = seed) => new Store<AnySchema>({ schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: snapshot as never });
const views = () => declaredViews(app as GraviewApp<AnySchema>);

function draw(principal: Principal, children: ReactNode, store = storeOf()) {
  return renderToStaticMarkup(
    <GraviewProvider store={store} views={views()} initialView={EMPTY_VIEW} principal={principal}>
      {children}
    </GraviewProvider>,
  );
}
const view = (kind: string, fidelity: "full" | "summary" | "glyph") => views().lookup(kind as never, { cardinality: "one", fidelity }) as ViewComponent<AnySchema>;
const Home = homeView(app.home!);
const home = (principal: Principal, mode: "fullscreen" | "scene" = "fullscreen") => draw(principal, <Home cardinality="many" fidelity="full" mode={mode} selected={false} />);
const record = (principal: Principal, id: string, fidelity: "full" | "summary" | "glyph") => {
  const store = storeOf();
  const View = view(store.graph.getNode(id)!.kind, fidelity);
  return draw(principal, <View node={store.graph.getNode(id) as never} cardinality="one" fidelity={fidelity} mode="fullscreen" selected={false} />, store);
};
const lens = (principal: Principal, title: string) => {
  const drawn = declaredLenses(app).drawn.find((one) => one.title === title)!;
  const Lens = declaredLensView(drawn) as ViewComponent<AnySchema>;
  return draw(principal, <Lens cardinality="many" fidelity="full" mode="fullscreen" selected={false} label={title} />);
};
/** The ids a drawing lists, in order. */
const listed = (html: string) => [...html.matchAll(/data-graview-listed="([^"]+)"/g)].map((m) => m[1]);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("FR-81: a front page made only of data", () => {
  it("draws a headline with a computed count as the page's own heading", () => {
    const html = home(owner);
    expect(html).toMatch(/<h1 class="graview-spec-headline" data-level="1">A small start, on three fronts\.<\/h1>/);
    expect(text(html)).toContain("North Pier Advisory with Keel Engineering, for Harbour Health");
  });

  it("draws a money figure worked out across records, in its currency, with what it is", () => {
    const html = home(owner);
    expect(text(html)).toContain("$21,000 The package we recommend, after the discount");
  });

  it("draws the one chosen record by its own card, and makes it a link", () => {
    const html = home(owner);
    const card = html.slice(html.indexOf('data-graview-listed="pkg-start"'));
    expect(card).toContain('data-graview-spec="card"');
    expect(card).toContain("The small start");
    // On the scene a listed record is a pick target; it is the scene's to route.
    expect(card).toMatch(/<button type="button" class="graview-spec-item-link" data-graview-pick="pkg-start" aria-label="The small start">/);
  });

  it("groups by a choice in its declared order, under the headings the block gives", () => {
    const html = home(owner);
    expect(html.indexOf(">The way in<")).toBeGreaterThan(0);
    expect(html.indexOf(">The way in<")).toBeLessThan(html.indexOf(">For afterwards<"));
    expect(listed(html)).toEqual(expect.arrayContaining(["offer-workshop", "offer-analysis", "offer-suite", "offer-advice"]));
  });

  it("is a link to a record's address on the routed face", () => {
    const html = draw(
      owner,
      <SpecLinks.Provider value={{ href: (node) => `/offers/${node.id}`, go: () => {} }}>
        <Home cardinality="many" fidelity="full" mode="fullscreen" selected={false} />
      </SpecLinks.Provider>,
    );
    expect(html).toContain('<a class="graview-spec-item-link" href="/offers/offer-workshop" aria-label="Two-day workshop">');
  });

  it("is drawn a heading level down on the scene, where it is a panel", () => {
    expect(home(owner, "scene")).toMatch(/<h2 class="graview-spec-headline" data-level="2">A small start/);
  });
});

describe("FR-82: a view lists related records", () => {
  it("a package's page lists its offers as rows, each a link", () => {
    const html = record(owner, "pkg-whole", "full");
    expect(listed(html)).toEqual(["offer-workshop", "offer-analysis", "offer-suite", "offer-advice"]);
    expect(html).toContain('data-graview-pick="offer-suite"');
    expect(text(html)).toContain("× 3, 45,000 at list");
  });

  it("a note's row lists the offers that answer it", () => {
    const html = record(owner, "note-pilot", "glyph");
    expect(listed(html)).toEqual(["offer-workshop", "offer-analysis"]);
    expect(html).toContain("data-graview-tall");
  });

  it("an empty list says its empty words", () => {
    expect(text(record(owner, "note-records", "glyph"))).toContain("No offer answers this yet.");
  });
});

describe("a related record the viewer may not see is not listed, counted or headed (FR-55)", () => {
  it("a package's page lists only the offers its seat sees", () => {
    expect(listed(record(partner, "pkg-whole", "full"))).toEqual(["offer-analysis", "offer-suite"]);
  });

  it("a note answered only by an offer the seat cannot see says nobody answers it", () => {
    const html = record(partner, "note-ai", "glyph");
    expect(listed(html)).toEqual([]);
    expect(text(html)).toContain("No offer answers this yet.");
    expect(html).not.toContain("Two-day workshop");
  });

  it("a package of only hidden offers is drawn empty", () => {
    expect(text(record(partner, "pkg-later", "full"))).toContain("Nothing in this package yet.");
  });

  it("the home counts and groups what the seat sees: no heading for a choice whose records are hidden", () => {
    const html = home(partner);
    expect(text(html)).toContain("A small start, on two fronts.");
    expect(html).not.toContain(">For afterwards<");
    expect(html).not.toContain("Monthly advice");
    expect(listed(html).filter((id) => id?.startsWith("offer-"))).toEqual(["offer-analysis", "offer-suite"]);
  });

  it("the offers lens lists only what the seat sees", () => {
    expect(listed(lens(partner, "The offers"))).toEqual(["offer-analysis", "offer-suite"]);
    expect(listed(lens(owner, "The offers"))).toEqual(["offer-workshop", "offer-analysis", "offer-suite", "offer-advice"]);
  });
});

describe("the four lenses, as data", () => {
  it("draws the packages in their standing's declared order, each with its offers", () => {
    const html = lens(owner, "The packages");
    expect(listed(html).filter((id) => id?.startsWith("pkg-"))).toEqual(["pkg-start", "pkg-whole", "pkg-later"]);
  });

  it("draws what was heard under a heading per kind of note, in their declared order", () => {
    const html = text(lens(owner, "What we heard"));
    const at = ["What hurts", "What they could do", "What they asked for", "What is simply true"].map((heading) => html.indexOf(heading));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("draws the open questions by name, and not the answered one", () => {
    // Sorted by name: "Which CI…" before "Whose budget…"; "When could they start?" was answered.
    expect(listed(lens(owner, "Open questions"))).toEqual(["q-ci", "q-budget"]);
  });
});

describe("a list of related records cannot recurse for ever", () => {
  const step = defineNode("step", { fields: z.object({ name: z.string() }), edges: { next: { to: ["step"] } } });
  const steps = createSchema([step]);
  const loop = defineApp({ name: "Loop", schema: steps, viewSpecs: { step: { card: [{ title: "{name}" }, { list: "out('next')", as: "card" }] } } });
  const store = new Store({
    schema: steps,
    mutations: [],
    snapshot: {
      nodes: [{ id: "a", kind: "step", name: "A" }, { id: "b", kind: "step", name: "B" }] as never,
      edges: [{ id: "ab", kind: "next", from: "a", to: "b" }, { id: "ba", kind: "next", from: "b", to: "a" }] as never,
    },
  });

  it(`draws cards ${MAX_LIST_DEPTH} lists deep, and then names, round a loop`, () => {
    const registry = registerViewSpecs(registerDefaultViews(steps, createViews(steps)), steps, loop.viewSpecs);
    const Card = registry.lookup("step", { cardinality: "one", fidelity: "summary" }) as ViewComponent<typeof steps>;
    const html = renderToStaticMarkup(
      <GraviewProvider store={store} views={registry} initialView={EMPTY_VIEW}>
        <Card node={store.graph.getNode("a") as never} cardinality="one" fidelity="summary" mode="scene" selected={false} />
      </GraviewProvider>,
    );
    expect((html.match(/data-graview-spec="card"/g) ?? []).length).toBe(MAX_LIST_DEPTH + 1);
    expect(html).toContain('data-as="names"');
    expect((html.match(/data-graview-listed=/g) ?? []).length).toBe(MAX_LIST_DEPTH + 1);
  });
});

describe("blocks about no one record are drawn from what the seat sees", () => {
  it("a figure over nothing says so rather than a number", () => {
    const html = draw(owner, <SpecPlace blocks={compileBlocks([{ figure: "first(all('package') where standing == 'nonesuch').net", as: "money", currency: "USD" }])} slot="home" />);
    expect(text(html)).toContain("—");
  });
});
