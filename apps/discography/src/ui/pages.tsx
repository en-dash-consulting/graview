import { isCurrent } from "@graview/core";
import { Begin } from "@graview/primitives";
import {
  createPageRegistry,
  DefaultHomePage,
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
import { discographySchema, type DiscographySchema } from "../domain/schema.js";

type S = DiscographySchema;

/**
 * THE OTHER FACE, IN YOUR OWN WORDS. /pages is an ordinary routed web
 * application derived from the declaration: a list and a record per kind,
 * forms from the mutations, a problems page from the rules. Every one of
 * those can be replaced per kind — or per surface: shell, home, problems —
 * with a page you write. This is the song's record page; delete it
 * and the derived page takes over again. Everything it shows still comes
 * from the same derivations (`recordFacts`, `DerivedForm`), so a page
 * you write cannot drift from what the graph says.
 */
function SongPage({ context }: { context: PageContext<S> }) {
  const { store, principal, invariantContext } = context;
  useStoreTick(store);
  const id = decodeURIComponent(useParams()["id"] ?? "");
  const facts = recordFacts(store, id, {
    ...(principal ? { principal } : {}),
    ...(invariantContext ? { context: invariantContext } : {}),
  });
  const node = store.graph.getNode(id);
  if (!facts || !node) {
    return (
      <PageMain context={context}>
        <h1 style={pageStyles.h1}>Nothing lives at this address.</h1>
      </PageMain>
    );
  }
  /*
   * THE TIES, AS THE DECLARATION READS THEM.
   *
   * `facts.links` is every edge on this record, both directions, each
   * carrying the caption the declaration gives THAT end. Asking the graph
   * for one edge by name here instead — `out(id, "depends-on")` — is a
   * page that stops telling the truth the day the schema grows a second
   * edge, which is the first thing every project does.
   */
  const ties = facts.links;
  /*
   * THE ACTS AS THE DERIVATION OFFERS THEM, not as the declaration lists
   * them. Reaching for a mutation by name gets an act that is always there;
   * an affordance is an act that can actually be taken RIGHT NOW, and it
   * carries its candidates — everything not already tied, and never this
   * record itself. With one song in the graph there is nothing to
   * point at, so there is no form, rather than a heading over a picker with
   * one wrong answer in it.
   */
  const connecting = facts.actions.affordances.filter((affordance) => affordance.ties === true);

  return (
    <PageMain context={context} data-testid="song-page">
      <header style={{ display: "grid", gap: 10 }}>
        <p style={pageStyles.eyebrow}>A song in Discography</p>
        <h1 style={pageStyles.h1}>{facts.label}</h1>
        <p style={pageStyles.lede}>
          {isCurrent(store.schema.tryDefinition(node.kind), node) ? "Current." : "In the past: out of the picture, never out of the record."}{" "}
          {ties.length === 0 ? "Connected to nothing yet." : null}
        </p>
        <a href={spatialHref(id)} style={{ ...pageStyles.link, ...pageStyles.quiet }} data-testid="spatial-link">
          See it in the scene ↗
        </a>
      </header>
      {facts.violations.length > 0 ? (
        <section style={{ ...pageStyles.rule, display: "grid", gap: 10 }} data-testid="record-violations">
          {facts.violations.map((violation, index) => (
            <div key={index} style={{ display: "grid", gap: 8 }}>
              <p style={{ margin: 0, color: "var(--graview-warn)", fontWeight: 550 }}>{violation.message}</p>
              {/*
                * A repair that needs nothing is one press; one that still has
                * an argument to choose is an ask. `Repairs` is the same
                * component the derived problems page uses, so a page you
                * write cannot get this wrong on its own.
                */}
              <Repairs<S> store={store} repairs={violation.repairs} {...(principal ? { principal } : {})} />
            </div>
          ))}
        </section>
      ) : null}
      {ties.length > 0 ? (
        <section style={{ ...pageStyles.rule, display: "grid", gap: 14 }} data-testid="record-ties">
          {ties.map((group) => (
            <div key={`${group.edgeKind}|${group.direction}`} style={{ display: "grid", gap: 6 }}>
              {/* The edge's own words for THIS end — its description read
                  from the end that declared it, its inverse read from the
                  other. */}
              <h2 style={pageStyles.h2}>
                {(group.description ?? group.edgeKind).replace(/^./, (first) => first.toUpperCase())}
              </h2>
              <p style={{ margin: 0 }}>{group.targets.map((target) => target.label).join(", ")}</p>
            </div>
          ))}
        </section>
      ) : null}
      {/*
        * WITHHELD, NOT HIDDEN. The affordances above are what this seat may
        * do; an act the policy refuses is in withheld, carrying the policy's
        * own sentence. Dropping it teaches a person the software is broken —
        * they watched a colleague do this yesterday and now the control is
        * gone — so it is drawn struck through with the reason beside it, the
        * way the derived pages and the scene's strip both draw it.
        */}
      {facts.actions.withheld.length > 0 ? (
        <section style={{ ...pageStyles.rule, display: "grid", gap: 8 }} data-testid="record-withheld">
          {facts.actions.withheld.map((withheld) => (
            <p key={withheld.id} style={{ margin: 0, ...pageStyles.quiet }}>
              <s>{withheld.label}</s> — {withheld.refusal.message}
            </p>
          ))}
        </section>
      ) : null}
      {connecting.length > 0 ? (
        <section style={{ ...pageStyles.rule, display: "grid", gap: 14 }} data-testid="record-actions">
          {connecting.map((affordance) => {
            const act = store.allMutations().find((mutation) => mutation.name === affordance.mutation);
            return act ? (
              <div key={affordance.id} style={{ display: "grid", gap: 10 }}>
                {/* The act's own title, and the arguments the derivation
                    already settled — never a subject name written out here. */}
                <h2 style={pageStyles.h2}>{affordance.label}</h2>
                <DerivedForm<S> store={store} mutation={act} prefilled={affordance.args} open={affordance.open} label={affordance.label} {...(principal ? { principal } : {})} />
              </div>
            ) : null;
          })}
        </section>
      ) : null}
    </PageMain>
  );
}

/**
 * THE WAY IN, on the home page, until there is a way past it.
 *
 * Every product ships empty once and it is the state its author never sees —
 * your own graph has had data in it since the first afternoon. `Begin` is
 * derived: it reads the chain your declaration already states (which acts
 * `create` which kinds, and what those acts must be handed first), offers
 * the ones that can run now, and says what everything else is waiting for.
 * It stands down on its own once every kind has something in it, which is
 * why the derived home is what it hands back to.
 */
function Home({ context }: { context: PageContext<S> }) {
  useStoreTick(context.store);
  return (
    // The routed face has no provider around it, so the store is handed over.
    <Begin
      store={context.store}
      {...(context.principal ? { principal: context.principal } : {})}
      // The derived home is a whole page — the gallery, at a page's width,
      // in its own landmark — and comes back exactly as given.
      whenFull={<DefaultHomePage context={context} />}
      // The door alone gets a page's column and landmark around it.
      frame={(door) => (
        <PageMain context={context} data-testid="home">
          {door}
        </PageMain>
      )}
    />
  );
}

/** Your pages: every derived page, with the song's record in your own words. */
export function pages() {
  return createPageRegistry<S, PageComponent<S>>(discographySchema)
    .register("song", "record", SongPage as PageComponent<S>)
    .surface("home", Home as PageComponent<S>);
}
