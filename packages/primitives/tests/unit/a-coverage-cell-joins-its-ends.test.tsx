import { readFileSync } from "node:fs";
import { declaredLenses, Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, type ViewComponent } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { declaredLensView } from "../../src/declared-lenses.js";
import { declaredViews } from "../../src/index.js";

/**
 * FR-111: A COVERAGE CELL OVER A PATH SELECTS WHAT IT JOINS. The Strengths
 * lens crosses people with skills through a strength record. A filled cell
 * wore only its column's id, so choosing Ryan × SEO selected SEO, and the
 * line went to the collapsed strengths' district. The cell now says what it
 * joins — the row, the column, and the record on the path — and choosing it
 * selects exactly those.
 */
const fixtures = new URL("../../../core/tests/document/fixtures/", import.meta.url);
const document = JSON.parse(readFileSync(new URL("org-strengths.gdd.json", fixtures), "utf8"));
const seed = JSON.parse(readFileSync(new URL("org-strengths.seed.json", fixtures), "utf8"));
const compiled = compileDocument(document, { today: () => "2026-10-06" });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed as never });

function drawn(implicated?: readonly string[]): string {
  const lens = declaredLenses(app).drawn.find((one) => one.title === "Strengths")!;
  const Lens = declaredLensView(lens) as ViewComponent<AnySchema>;
  return renderToStaticMarkup(
    <GraviewProvider store={store} views={declaredViews(app)} initialView={EMPTY_VIEW} principal={{ kind: "human", id: "u", roles: ["owner"] }}>
      <Lens cardinality="many" fidelity="full" mode="fullscreen" selected={false} label="Strengths" {...(implicated ? { implicated } : {})} />
    </GraviewProvider>,
  );
}

const joins = (html: string) => [...html.matchAll(/data-graview-joins="([^"]+)"/g)].map((match) => JSON.parse(match[1]!.replace(/&quot;/g, '"')) as string[]);

describe("a coverage cell over a path", () => {
  it("says it joins the row, the column and the record on the path — and only a filled cell does", () => {
    expect(joins(drawn())).toEqual([["p-ryan", "sk-seo", "st-ryan-seo"]]);
  });

  it("is lit with its row and its column when those are what is chosen, and the rest are dimmed", () => {
    const html = drawn(["p-ryan", "sk-seo", "st-ryan-seo"]);
    const emphasis = (id: string) => [...html.matchAll(new RegExp(`data-graview-pick="${id}"[^>]*?data-graview-emphasis="(\\w+)"`, "g"))].map((match) => match[1]);
    expect(emphasis("p-ryan")).toEqual(["lit"]);
    expect(emphasis("p-val")).toEqual(["dimmed"]);
    // The column's head and the filled cell under it.
    expect(emphasis("sk-seo")).toEqual(["lit", "lit"]);
    expect(emphasis("sk-copy")).toEqual(["dimmed"]);
  });
});
