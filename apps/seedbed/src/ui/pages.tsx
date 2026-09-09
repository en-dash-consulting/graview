import type { AnySchema } from "@graview/core";
import {
  createPageRegistry,
  DerivedForm,
  PageMain,
  pageStyles,
  recordFacts,
  spatialHref,
  useStoreTick,
  type PageComponent,
  type PageContext,
} from "@graview/pages";
import { useParams } from "react-router-dom";
import type { SeedbedSchema } from "../domain/schema.js";

type S = SeedbedSchema;

/**
 * THE OTHER FACE, CUSTOMISED. The routed pages are derived from the
 * declaration — lists, records, forms, problems — and every one of them can
 * be replaced per kind, or per surface, with a page the app writes. This is
 * the plot's record page in the garden's own words: the beds, the caretaker,
 * what is growing, and the one act a plot invites, sowing. Everything it
 * shows still comes from the same derivations the default page uses; only
 * the sentences are the garden's.
 */
function PlotPage({ context }: { context: PageContext<S> }) {
  const { store, principal, invariantContext } = context;
  useStoreTick(store);
  const id = decodeURIComponent(useParams()["id"] ?? "");
  const facts = recordFacts(store, id, {
    ...(principal ? { principal } : {}),
    ...(invariantContext ? { context: invariantContext } : {}),
  });
  const plot = store.graph.getNode(id) as { label: string; beds: number } | undefined;
  if (!facts || !plot) {
    return (
      <PageMain context={context}>
        <h1 style={pageStyles.h1}>No such plot.</h1>
      </PageMain>
    );
  }
  const caretaker = store.graph.out(id, "tended-by")[0] as { label: string } | undefined;
  const growing = store.graph
    .in(id, "grows-in")
    .filter((planting) => (planting as { status: string }).status === "growing")
    .map((planting) => (planting as { label: string }).label);
  const sow = store.allMutations().find((mutation) => mutation.name === "sow");
  const untended = facts.violations.length > 0;

  return (
    <PageMain context={context} data-testid="plot-page">
      <header style={{ display: "grid", gap: 10 }}>
        <p style={pageStyles.eyebrow}>A plot in the garden</p>
        <h1 style={pageStyles.h1}>{plot.label}</h1>
        <p style={pageStyles.lede}>
          {plot.beds} {plot.beds === 1 ? "bed" : "beds"},{" "}
          {caretaker ? `looked after by ${caretaker.label}` : "and nobody looks after it yet"}.
          {growing.length > 0 ? ` Growing now: ${growing.join(", ")}.` : " Nothing is growing."}
        </p>
        <a href={spatialHref(id)} style={{ ...pageStyles.link, ...pageStyles.quiet }} data-testid="spatial-link">
          See it in the scene ↗
        </a>
      </header>
      {untended ? (
        <section style={{ ...pageStyles.rule, display: "grid", gap: 10 }} data-testid="record-violations">
          {facts.violations.map((violation, index) => (
            <div key={index} style={{ display: "grid", gap: 8 }}>
              <p style={{ margin: 0, color: "var(--graview-warn)", fontWeight: 550 }}>{violation.message}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {violation.repairs.map((repair, at) => (
                  <button key={at} type="button" style={pageStyles.button} onClick={() => store.apply({ name: repair.mutation, args: { ...repair.args } })}>
                    {repair.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}
      {sow ? (
        <section style={{ ...pageStyles.rule, display: "grid", gap: 12 }} data-testid="record-actions">
          <h2 style={pageStyles.h2}>Sow something here</h2>
          <DerivedForm<S> store={store} mutation={sow} prefilled={{ plotId: id }} />
        </section>
      ) : null}
    </PageMain>
  );
}

/** The garden's pages: every default page, with the plot's record in its own words. */
export function seedbedPages(schema: AnySchema) {
  return createPageRegistry<S, PageComponent<S>>(schema as never).register("plot", "record", PlotPage as PageComponent<S>);
}
