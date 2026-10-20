import { compileDocument } from "@graview/core/check";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { declaredViews, SPEC_VIEW_CSS } from "@graview/primitives";
import { GraviewProvider, type ViewComponent } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * A HEADLINE BOUND TO A LONG FIELD is drawn a step smaller and clamped.
 * `{"headline": "{call}"}`, where a call is three sentences, filled a focus
 * card at display size. Past about 90 characters a headline says it is
 * long (`data-long`), and is drawn at a heading's size, clamped to four
 * lines; the words are all there for a reader that does not see it.
 */
const CALL = "Caller reports smoke from the second floor of a terraced house on Mill Lane. Two residents are out; one is unaccounted for. Access is by the rear alley, and the hydrant at the corner is marked as out of service.";
const compiled = compileDocument(
  {
    format: "graview-document",
    formatVersion: 1,
    name: "Dispatch",
    kinds: { incident: { noun: "incident", plural: "incidents", fields: { name: { type: "string", required: true }, call: { type: "text" } } } },
    views: { incident: { page: [{ headline: "{name}" }, { headline: "{call}" }] } },
  },
  { today: () => "2026-10-20" },
);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
const anyone: Principal = { kind: "human", id: "u:anyone", roles: [] };

describe("a headline bound to a long field", () => {
  it("says it is long past 90 characters, keeps every word, and a short one does not", () => {
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [{ id: "incident:mill-lane", kind: "incident", name: "Mill Lane fire", call: CALL }], edges: [] } as never });
    const View = declaredViews(app).lookup("incident" as never, { cardinality: "one", fidelity: "full" }) as ViewComponent<AnySchema>;
    const html = renderToStaticMarkup(
      <GraviewProvider store={store} views={declaredViews(app)} initialView={EMPTY_VIEW} principal={anyone}>
        <View node={store.graph.getNode("incident:mill-lane") as never} cardinality="one" fidelity="full" mode="fullscreen" selected={false} />
      </GraviewProvider>,
    );
    const headlines = [...html.matchAll(/<h\d class="graview-spec-headline"([^>]*)>([^<]*)</g)].map((m) => [m[1]!.includes("data-long"), m[2]]);
    expect(headlines).toEqual([
      [false, "Mill Lane fire"],
      [true, CALL],
    ]);
  });

  it("is drawn at a heading's size and clamped to four lines, whatever its level", () => {
    expect(SPEC_VIEW_CSS).toMatch(/\.graview-spec-headline\[data-long\]\[data-level\]\{[^}]*font-size:1\.125rem[^}]*-webkit-line-clamp:4/);
  });
});
