import { readFileSync } from "node:fs";
import { declaredLenses, Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, type ViewComponent } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { declaredLensView } from "../../src/declared-lenses.js";
import { spanOf } from "../../src/lens/calendar-spans.js";
import { declaredViews } from "../../src/index.js";

/**
 * A CALENDAR OF YEARS SPANS ITS RECORDS (2026-10-15, The Beatles).
 *
 * A career calendar opened on 1970-04-10 with a horizon of thirty years drew
 * 1970–1999, and the releases of 1962–1969 and 2000–2023 were nowhere. The
 * years now reach back to the first record and on to the last as well as
 * across the horizon; `from` and `to`, said outright, still win.
 */
const fixtures = new URL("../../../core/tests/document/fixtures/", import.meta.url);
const base = JSON.parse(readFileSync(new URL("beatles.gdd.json", fixtures), "utf8"));
const seed = JSON.parse(readFileSync(new URL("beatles.seed.json", fixtures), "utf8"));

function drawn(horizon: Record<string, unknown>) {
  const document = structuredClone(base);
  document.lenses[0].options = { range: "years", horizon, today: "1970-04-10" };
  const compiled = compileDocument(document, { today: () => "2026-10-15" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed as never });
  const lens = declaredLenses(app).drawn.find((one) => one.title === "Releases by year")!;
  const Lens = declaredLensView(lens) as ViewComponent<AnySchema>;
  const nodes = store.graph.nodesOfKind("release" as never);
  return renderToStaticMarkup(
    <GraviewProvider store={store} views={declaredViews(app)} initialView={EMPTY_VIEW} principal={{ kind: "human", id: "u", roles: ["owner"] }}>
      <Lens cardinality="many" fidelity="full" mode="fullscreen" selected={false} label="Releases by year" nodes={nodes as never} />
    </GraviewProvider>,
  );
}

describe("a calendar of years", () => {
  it("spans its records from the first to the last, past the horizon it opens on", () => {
    const html = drawn({ years: 30, title: "The career" });
    expect(html).toContain("The career · 1962–2023");
  });

  it("keeps the years a horizon says outright", () => {
    expect(drawn({ years: 30, title: "The career", from: 1960, to: 1970 })).toContain("The career · 1960–1970");
  });

  it("is held to a span of years by the checker: a number is the years, and anything else is said by its path", () => {
    const withHorizon = (horizon: unknown) => {
      const document = structuredClone(base);
      document.lenses[0].options = { range: "years", horizon };
      const compiled = compileDocument(document, { today: () => "2026-10-15" });
      if (!compiled.ok) throw new Error("did not compile");
      return declaredLenses(compiled.app as GraviewApp<AnySchema>);
    };
    expect(withHorizon(30).drawn[0]!.options["horizon"]).toEqual({ years: 30, title: "Years" });
    const wrong = withHorizon({ years: 30, title: "The career", from: 2000, to: 1990 });
    expect(wrong.findings.map((finding) => [finding.code, finding.path])).toContainEqual(["lens-horizon", "lenses.0.options.horizon"]);
    expect(wrong.drawn[0]!.options["horizon"]).toBeUndefined();
  });

  it("still looks out as far as its horizon where its records stop short", () => {
    expect(spanOf("years", "2026-04-01", { horizon: { years: 3, title: "Three years" }, fit: { first: 2026, last: 2026 } }).years).toEqual(["2026", "2027", "2028"]);
    expect(spanOf("years", "1970-04-10", { horizon: { years: 30, title: "The career" }, fit: { first: 1962, last: 2023 } }).years).toHaveLength(62);
  });
});
