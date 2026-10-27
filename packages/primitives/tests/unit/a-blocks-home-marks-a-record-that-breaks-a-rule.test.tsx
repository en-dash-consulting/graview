import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { EMPTY_VIEW } from "@graview/layout";
import { declaredViews } from "@graview/primitives";
import { GraviewProvider } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { homeView } from "../../src/home-view.js";

/**
 * A BLOCKS HOME MARKS A RECORD THAT BREAKS A RULE (Roadmap
 * f-blocks-home-flagged). A custom home view gets the broken records as
 * `flagged` and marks them where it draws them (f-problems-in-context),
 * but a home written as blocks ignored `flagged`: neither a banner nor a
 * mark. Now every record a blocks home lists that a broken rule names
 * carries the kit's flag beside its name, is said as implicated in a
 * problem, and says so in the DOM, as the derived home's chips do.
 */
const DOCUMENT = {
  format: "graview-document",
  formatVersion: 1,
  name: "Garden",
  kinds: {
    plot: { fields: { name: { type: "string", required: true }, watered: { type: "boolean" } }, label: "{name}" },
  },
  rules: { watered: { title: "Every plot is watered", over: "plot", require: "watered" } },
  views: {
    home: [
      { headline: "The garden" },
      { list: "all('plot')", as: "row" },
      { list: "all('plot')", as: "card" },
    ],
  },
};
const SEED = {
  nodes: [
    { id: "plot:a", kind: "plot", name: "The apple bed", watered: true },
    { id: "plot:b", kind: "plot", name: "The bean rows", watered: false },
  ],
  edges: [],
};

const compiled = compileDocument(DOCUMENT, { today: () => "2026-10-27" });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((finding) => finding.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;

function home(flagged: readonly string[] | undefined) {
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], snapshot: structuredClone(SEED) as never });
  const Home = homeView(app.home!);
  return renderToStaticMarkup(
    <GraviewProvider store={store} views={declaredViews(app)} initialView={EMPTY_VIEW}>
      <Home cardinality="many" fidelity="full" mode="fullscreen" selected={false} {...(flagged ? { flagged } : {})} />
    </GraviewProvider>,
  );
}
/** The listed item for one record, through every list that draws it. */
const items = (html: string, id: string) => [...html.matchAll(/<li class="graview-spec-item"[^>]*data-graview-listed="([^"]+)"[^>]*>/g)].filter((match) => match[1] === id).map((match) => match[0]);

describe("a blocks home handed the records a broken rule names", () => {
  const html = home(["plot:b"]);

  it("marks each one where it draws it, and says it is implicated in a problem", () => {
    const marked = items(html, "plot:b");
    expect(marked.length).toBeGreaterThanOrEqual(2);
    for (const item of marked) {
      expect(item).toContain('data-graview-flagged=""');
      expect(item).toContain("The bean rows — implicated in a problem");
    }
    // The kit's flag beside its name, as a district's chip carries it.
    expect(html).toContain("The bean rows ⚠");
  });

  it("leaves a record no rule names unmarked", () => {
    for (const item of items(html, "plot:a")) expect(item).not.toContain("data-graview-flagged");
    expect(html).not.toContain("The apple bed ⚠");
  });

  it("marks nothing when it is handed nothing", () => {
    expect(home(undefined)).not.toContain("data-graview-flagged");
    expect(home([])).not.toContain("data-graview-flagged");
  });
});
