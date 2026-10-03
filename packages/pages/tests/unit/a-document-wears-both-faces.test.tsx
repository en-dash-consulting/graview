import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store } from "@graview/core";
import { compileDocument } from "@graview/core/document";
import { EMPTY_VIEW } from "@graview/layout";
import { PagesApp } from "@graview/pages";
import { registerDefaultViews } from "@graview/primitives";
import { createViews, GraviewProvider, Scene } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/** FR-01: a compiled document is an app the workbench and the pages face draw with no other code. */
const vendors = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/vendors.gdd.json"), "utf8"));

describe("a document wears both faces", () => {
  const compiled = compileDocument(vendors);
  if (!compiled.ok) throw new Error("vendors did not compile");
  const app = compiled.app;
  const store = () =>
    new Store({
      schema: app.schema,
      mutations: app.mutations ?? [],
      invariants: app.invariants ?? [],
      ...(app.policy ? { policy: app.policy } : {}),
      snapshot: { nodes: [{ id: "florist", kind: "category", name: "Florist", budget: 3000 }, { id: "bloom", kind: "vendor", name: "Bloom & Co", status: "booked", quote: 2400 }] as never, edges: [] },
    });
  const views = () => registerDefaultViews(app.schema, createViews(app.schema));

  it("the workbench draws its kinds", () => {
    const html = renderToStaticMarkup(
      <GraviewProvider store={store()} views={views()} initialView={EMPTY_VIEW}>
        <Scene renderer="dom" />
      </GraviewProvider>,
    );
    expect(html).toContain('data-graview-stage');
    expect(html).toMatch(/data-graview-view="(kind|aggregate):vendor/);
  });

  it("the pages face lists its records", () => {
    const html = renderToStaticMarkup(<PagesApp context={{ store: store(), views: views() }} initialPath="/vendors" />);
    expect(html).toContain("Bloom &amp; Co");
  });
});
