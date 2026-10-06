import { readFileSync } from "node:fs";
import { declaredLenses, Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { describePlace, type DescribedPart, type PlaceDescription } from "@graview/core/describe";
import { compileDocument } from "@graview/core/document";
import { EMPTY_VIEW } from "@graview/layout";
import { declaredViews } from "@graview/primitives";
import { GraviewProvider, type ViewComponent } from "@graview/react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { declaredLensView } from "../../src/declared-lenses.js";
import { homeView } from "../../src/home-view.js";

/**
 * FR-89: A PLACE IS DESCRIBED AS IT IS DRAWN. `describePlace` says what a
 * place shows one seat without a browser, from the same resolution the
 * faces draw from. Here every LifeLogics place that is drawn from blocks —
 * the front page and its four lenses — is drawn on the routed face, as a
 * phone gets it, and its words are compared with the description's: the
 * same headings, figures, group headings, records, what each record's card
 * or row says, and empty words, in the same order. For an owner, and for
 * the delivery partner, who sees fewer offers on the face and is told of
 * exactly those.
 */
const fixtures = new URL("../../../core/tests/document/fixtures/", import.meta.url);
const document = JSON.parse(readFileSync(new URL("lifelogics.gdd.json", fixtures), "utf8"));
const seed = JSON.parse(readFileSync(new URL("lifelogics.seed.json", fixtures), "utf8"));
const compiled = compileDocument(document, { today: () => "2026-10-05" });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
const schema = app.schema as AnySchema;
const store = new Store<AnySchema>({ schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed as never });

const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const partner: Principal = { kind: "human", id: "party-delivery", roles: ["partner"] };

function draw(principal: Principal, children: ReactNode) {
  return renderToStaticMarkup(
    // The app's brand, as an embed hands it over: it carries the app's currency (FR-100).
    <GraviewProvider store={store} views={declaredViews(app)} initialView={EMPTY_VIEW} principal={principal} {...(app.brand ? { brand: app.brand } : {})}>
      {children}
    </GraviewProvider>,
  );
}

/** What a drawing says, word by word: its text, entities read, whitespace collapsed. */
function words(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** What a description says, in the order a face lays it out. */
function said(parts: readonly DescribedPart[]): string {
  const out: string[] = [];
  const walk = (list: readonly DescribedPart[]) => {
    for (const part of list) {
      switch (part.t) {
        case "heading":
        case "text":
        case "badge":
          out.push(part.text);
          break;
        case "field":
        case "progress":
          out.push(part.label, part.text);
          break;
        case "figure":
          out.push(part.text, ...(part.label ? [part.label] : []));
          break;
        case "list":
          if (part.groups.length === 0 && part.empty) out.push(part.empty);
          for (const group of part.groups) {
            if (group.heading) out.push(group.heading);
            for (const item of group.items) {
              out.push(item.title);
              walk(item.parts);
            }
          }
          if (part.more) out.push(`and ${part.more} more`);
          break;
      }
    }
  };
  walk(parts);
  return out.join(" ").replace(/\s+/g, " ").trim();
}

function described(principal: Principal, place: string): PlaceDescription {
  const result = describePlace(store, principal, place, { app, width: 390, today: "2026-10-05" });
  if (!result.ok) throw new Error(result.error);
  return result.description;
}

const Home = homeView(app.home!);
const home = (principal: Principal) => draw(principal, <Home cardinality="many" fidelity="full" mode="fullscreen" selected={false} />);
const lens = (principal: Principal, title: string) => {
  const drawn = declaredLenses(app).drawn.find((one) => one.title === title)!;
  const Lens = declaredLensView(drawn) as ViewComponent<AnySchema>;
  return draw(principal, <Lens cardinality="many" fidelity="full" mode="fullscreen" selected={false} label={title} />);
};
const listed = (html: string) => [...html.matchAll(/data-graview-listed="([^"]+)"/g)].map((m) => m[1]);
const ids = (parts: readonly DescribedPart[]): string[] =>
  parts.flatMap((part) => (part.t === "list" ? part.groups.flatMap((group) => group.items.flatMap((item) => [item.id, ...ids(item.parts)])) : []));

const PLACES = [
  { slug: "home", draw: home },
  { slug: "the-offers", draw: (p: Principal) => lens(p, "The offers") },
  { slug: "the-packages", draw: (p: Principal) => lens(p, "The packages") },
  { slug: "what-we-heard", draw: (p: Principal) => lens(p, "What we heard") },
  { slug: "open-questions", draw: (p: Principal) => lens(p, "Open questions") },
] as const;

describe("FR-89: each LifeLogics place says, at a phone's width, the words its face draws", () => {
  for (const seat of [
    ["an owner", owner],
    ["the delivery partner", partner],
  ] as const) {
    for (const place of PLACES) {
      it(`${place.slug}, as ${seat[0]}`, () => {
        const html = place.draw(seat[1]);
        const description = described(seat[1], place.slug);
        expect(said(description.parts)).toBe(words(html));
        // The same records, in the same order, nested lists included.
        expect(ids(description.parts)).toEqual(listed(html));
        expect(description.problems).toEqual([]);
      });
    }
  }

  it("the partner is told of fewer offers, exactly the ones the partner's face lists", () => {
    const offers = (principal: Principal) => ids(described(principal, "the-offers").parts).filter((id) => id.startsWith("offer-"));
    expect(offers(owner)).toEqual(["offer-workshop", "offer-analysis", "offer-suite", "offer-advice"]);
    expect(offers(partner)).toEqual(["offer-analysis", "offer-suite"]);
    expect(offers(partner)).toEqual(listed(lens(partner, "The offers")).filter((id) => id?.startsWith("offer-")));
    expect(described(partner, "home").text).toContain("# A small start, on two fronts.");
    expect(described(partner, "home").text).not.toContain("For afterwards");
  });

  it("says the front page as text a chat can quote: headings, figures as drawn, lists under their headings", () => {
    const text = described(owner, "home").text;
    expect(text.split("\n").slice(0, 6)).toEqual([
      "Home (/) — as owner, 390 wide (phone).",
      "North Pier Advisory with Keel Engineering, for Harbour Health",
      "# A small start, on three fronts.",
      "A suite they trust, Codebase analysis and Two-day workshop. A proposal still being thought through.",
      "$21,000 — The package we recommend, after the discount",
      "- The small start",
    ]);
    expect(text).toContain("The way in:");
    expect(text).toContain("For afterwards:");
  });

  it("a card list is one column on a phone and several on a desk", () => {
    const columns = (width: number) => {
      const result = describePlace(store, owner, "the-offers", { app, width, today: "2026-10-05" });
      if (!result.ok) throw new Error(result.error);
      return result.description.parts.flatMap((part) => (part.t === "list" ? [part.columns] : []));
    };
    expect(columns(390)).toEqual([1]);
    expect(columns(1440)).toEqual([4]);
  });

  it("says a problem where a block could not be worked out, at its path", () => {
    const broken = { ...app, home: [{ headline: "Hello" }, { figure: "first(all('package')).nonesuch + 1", as: "number" }] } as GraviewApp<AnySchema>;
    const result = describePlace(store, owner, "home", { app: broken, width: 390 });
    if (!result.ok) throw new Error(result.error);
    expect(result.description.problems.map((problem) => problem.at)).toEqual(["views.home.1"]);
    expect(result.description.text).toMatch(/Problems:\n- views\.home\.1: /);
  });

  it("refuses a place there is not, naming the places there are", () => {
    const result = describePlace(store, owner, "nowhere", { app });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.places).toEqual(expect.arrayContaining(["home", "the-offers", "offers"]));
  });

  it("a record a seat may not see is no place for that seat", () => {
    expect(describePlace(store, owner, "offer-workshop", { app }).ok).toBe(true);
    expect(describePlace(store, partner, "offer-workshop", { app }).ok).toBe(false);
  });
});
