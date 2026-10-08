import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSchema, defineApp, defineNode, Store, z } from "@graview/core";
import { EMPTY_VIEW, withFocus } from "@graview/layout";
import { PagesApp } from "@graview/pages";
import { registerDefaultViews, registerViewSpecs, themeCss } from "@graview/primitives";
import { createViews, GraviewProvider, Scene, useGraview, type ViewProps } from "@graview/react";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * FR-03: a card, a row and a page declared as data and drawn by the
 * framework — in the workbench and on the pages face — with no component
 * code, and nothing in it that runs.
 */
const category = defineNode("category", { fields: z.object({ name: z.string() }), plural: "Categories" });
const vendor = defineNode("vendor", {
  fields: z.object({
    name: z.string(),
    status: z.enum(["researching", "booked"]),
    quote: z.number().optional(),
    site: z.url().optional(),
    notes: z.string().optional(),
  }),
  edges: { fills: { to: ["category"], cardinality: "one" } },
  plural: "Vendors",
});
const schema = createSchema([category, vendor]);
const app = defineApp({
  name: "Vendors",
  schema,
  viewSpecs: {
    vendor: {
      card: [
        { title: "{name}" },
        { badge: "{status}", tone: { expr: "if(status == 'booked', 'good', 'neutral')" } },
        { field: "quote", as: "money" },
        { text: "for {fills.name}" },
      ],
      row: [{ title: "{name}" }, { badge: "{status}", tone: "accent" }],
      page: [{ text: "Quoted {quote|money}", tone: "good" }, { field: "site" }],
    },
  },
});

const store = (extra: Record<string, unknown> = {}) =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "florist", kind: "category", name: "Florist" },
        { id: "bloom", kind: "vendor", name: "Bloom & Co", status: "booked", quote: 2400, site: "https://bloom.example/", ...extra },
      ] as never,
      edges: [{ id: "e1", kind: "fills", from: "bloom", to: "florist" }] as never,
    },
  });
const views = () => registerViewSpecs(registerDefaultViews(schema, createViews(schema)), schema, app.viewSpecs);

/** One cell of the registry, drawn for one record under the provider every view is drawn under. */
function draw(cell: { cardinality: "one"; fidelity: "full" | "summary" | "glyph" }, s = store()) {
  const registry = views();
  const View = registry.lookup("vendor", cell) as ComponentType<ViewProps<typeof schema>>;
  const node = s.graph.getNode("bloom") as never;
  return renderToStaticMarkup(
    <GraviewProvider store={s} views={registry} initialView={EMPTY_VIEW}>
      <View node={node} cardinality="one" fidelity={cell.fidelity} mode="scene" selected={false} />
    </GraviewProvider>,
  );
}

describe("views as data", () => {
  it("draws a spec-registered card in the workbench with no component code", () => {
    const html = renderToStaticMarkup(
      <GraviewProvider store={store()} views={views()} initialView={withFocus(EMPTY_VIEW, "florist")}>
        <Scene renderer="dom" />
      </GraviewProvider>,
    );
    expect(html).toContain('data-graview-spec="card"');
    expect(html).toContain("Bloom &amp; Co");
    expect(html).toContain('data-graview-tone="good"');
    expect(html).toContain("2,400");
    // A one-edge hop, read through the graph.
    expect(html).toContain("for Florist");
  });

  it("draws the same card on the pages face's gallery", () => {
    const html = renderToStaticMarkup(<PagesApp context={{ store: store(), views: views() }} initialPath="/" />);
    expect(html).toContain('data-graview-spec="card"');
    expect(html).toContain("Bloom &amp; Co");
  });

  it("draws a row at one × glyph and a page at the head of the default record view", () => {
    const row = draw({ cardinality: "one", fidelity: "glyph" });
    expect(row).toContain('data-graview-spec="row"');
    expect(row).toContain('data-graview-tone="accent"');
    const page = draw({ cardinality: "one", fidelity: "full" });
    expect(page).toContain('data-graview-spec="page"');
    expect(page).toContain("Quoted 2,400");
    // One frame (FR-141): the page inside the default record, at its head, above the fields it does not say.
    expect(page.split('data-graview-primitive="panel"').length - 1).toBe(1);
    expect(page.indexOf('data-graview-primitive="panel"')).toBeLessThan(page.indexOf('data-graview-spec="page"'));
    expect(page.indexOf('data-graview-spec="page"')).toBeLessThan(page.indexOf("data-graview-fields"));
  });

  it("tones a badge from the theme's tokens, and nothing else", () => {
    const css = themeCss("light");
    expect(css).toContain(".graview-spec [data-graview-tone=\"good\"] { --graview-spec-tone: var(--graview-good); }");
    expect(css).toContain(".graview-spec [data-graview-tone=\"bad\"] { --graview-spec-tone: var(--graview-bad); }");
    expect(css).toMatch(/--graview-good: #1b6436;/);
  });

  it("draws a link only for an http(s) url field's own value", () => {
    const safe = draw({ cardinality: "one", fidelity: "full" });
    expect(safe).toContain('href="https://bloom.example/"');
    expect(safe).toContain('rel="noopener noreferrer"');
    const hostile = draw({ cardinality: "one", fidelity: "full" }, store({ site: "javascript:alert(1)" }));
    expect(hostile).not.toContain("href=");
    expect(hostile).toContain("javascript:alert(1)");
    // A url in words is words: a template never makes a link.
    const said = renderToStaticMarkup(
      <GraviewProvider store={store({ notes: "https://evil.example/" })} views={registerViewSpecs(createViews(schema), schema, { vendor: { card: [{ text: "{notes}" }] } })} initialView={EMPTY_VIEW}>
        <Card />
      </GraviewProvider>,
    );
    expect(said).toContain("https://evil.example/");
    expect(said).not.toContain("<a ");
  });

  it("evaluates no string as code: markup is escaped, and a name on the prototype is no field", () => {
    const s = store({ name: '<img src=x onerror="alert(1)">' });
    const registry = registerViewSpecs(createViews(schema), schema, {
      vendor: { card: [{ title: "{name}" }, { text: "{constructor}" }, { text: "{__proto__}" }, { badge: "{toString}" }, { field: "constructor" }] },
    });
    const html = renderToStaticMarkup(
      <GraviewProvider store={s} views={registry} initialView={EMPTY_VIEW}>
        <Card />
      </GraviewProvider>,
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).not.toMatch(/function|native code|\[object/);
  });

  it("holds the view path to no eval, no Function and no markup from a string", () => {
    for (const file of ["../../src/spec-views.tsx", "../../src/spec-css.ts", "../../src/default-view.tsx", "../../../core/src/document/expr/evaluate.ts", "../../../core/src/document/template.ts"]) {
      const source = readFileSync(resolve(import.meta.dirname, file), "utf8");
      expect(source, file).not.toMatch(/\beval\s*\(|new Function|Function\s*\(|dangerouslySetInnerHTML|innerHTML/);
    }
  });
});

/** The vendor's card, drawn from whatever registry the provider holds. */
function Card() {
  const { store: s, views: registry } = useGraview<typeof schema>();
  const View = registry.lookup("vendor", { cardinality: "one", fidelity: "summary" }) as ComponentType<ViewProps<typeof schema>>;
  return <View node={s.graph.getNode("bloom") as never} cardinality="one" fidelity="summary" mode="scene" selected={false} />;
}
