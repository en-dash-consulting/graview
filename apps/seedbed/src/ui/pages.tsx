import type { AnySchema } from "@graview/core";
import {
  createPageRegistry,
  DerivedForm,
  PageMain,
  pageStyles,
  recordFacts,
  Repairs,
  spatialHref,
  useStoreTick,
  type PageComponent,
  type PageContext,
} from "@graview/pages";
import { useParams } from "react-router-dom";
import type { SeedbedSchema } from "../domain/schema.js";

type S = SeedbedSchema;

/**
 * THE OTHER FACE, CUSTOMIZED. The routed pages are derived from the
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
  const untended = facts.violations.length > 0;
  /*
   * EVERY ACT THE DERIVATION OFFERS ON THE PLOT, not only sowing: naming a
   * caretaker was on no page of the routed face (the eighth walk carried it,
   * the tenth fixed it). Sowing first, as the act a plot invites; a repair
   * stays beside its problem; what takes the plot away comes last.
   */
  const rank = (affordance: { mutation: string; destructive?: boolean; setsAside?: boolean }) =>
    affordance.mutation === "sow" ? 0 : affordance.destructive || affordance.setsAside ? 2 : 1;
  const offered = facts.actions.affordances.filter((affordance) => affordance.provider !== "invariant").sort((a, b) => rank(a) - rank(b));

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
              {/* Applied as the seat at the keyboard, an ask where it still needs something: the derived pages' own. */}
              <Repairs<S> store={store} repairs={violation.repairs} {...(principal ? { principal } : {})} />
            </div>
          ))}
        </section>
      ) : null}
      {offered.length > 0 ? (
        <section style={{ ...pageStyles.rule, display: "grid", gap: 14 }} data-testid="record-actions">
          {offered.map((affordance) => {
            const act = store.allMutations().find((mutation) => mutation.name === affordance.mutation);
            return act ? (
              <div key={affordance.id} style={{ display: "grid", gap: 10 }}>
                <h2 style={pageStyles.h2}>{affordance.mutation === "sow" ? "Sow something here" : affordance.label}</h2>
                <DerivedForm<S> store={store} mutation={act} prefilled={affordance.args} open={affordance.open} label={affordance.label} {...(principal ? { principal } : {})} />
              </div>
            ) : null;
          })}
        </section>
      ) : null}
    </PageMain>
  );
}

/** The garden's pages: every default page, with the plot's record in its own words. */
export function seedbedPages(schema: AnySchema) {
  const registry = createPageRegistry<S, PageComponent<S>>(schema as never);
  // The plot's own page, where the declaration has plots: the studio's schema has kinds, not plots.
  return (schema.kinds as readonly string[]).includes("plot") ? registry.register("plot", "record", PlotPage as PageComponent<S>) : registry;
}
