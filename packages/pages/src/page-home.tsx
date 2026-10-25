import { counted as countOf, isCurrent, numberAsRead, type AnySchema, type Violation } from "@graview/core";
import { bleeds, type ViewProps } from "@graview/react/provider";
import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { HomeLine } from "@graview/primitives/pages";
import { kindMap } from "./facts.js";
import { pluralSlug } from "./registry.js";
import { type PageContext, useStoreTick } from "./page-context.js";
import { drawnInTheGallery, Gallery } from "./page-places.js";
import { answeredJobs, JobsOnTheHome } from "./page-jobs.js";
import {
  KindMark,
  h2,
  lede,
  link,
  Onward,
  onward,
  homeKinds,
  liveKinds,
  plain,
  pluralOf,
  quiet,
  rule,
  whoDid,
  wide,
} from "./page-typography.js";
import { Bleed, PageMain, PageTitle } from "./page-shell.js";


/**
 * WHAT TO DO, NOT HOW MANY (FR-122), about the records the home draws. The
 * app bar says the count — its standing (FR-131) — so the home points to
 * the problems rather than saying the number again. A rule the app wrote
 * that a record does not meet is the app's business, said in the page's
 * quiet ink; a rule that could not be judged at all is an error, said in
 * the warning color (Roadmap f-problems-in-context).
 */
function ProblemsHere({ violations }: { readonly violations: readonly Violation[] }) {
  const error = violations.some((violation) => violation.status === "could-not-judge" || violation.status === "over-budget");
  return (
    <Link to="/problems" data-testid="problems-here" data-graview-problems-tone={error ? "error" : "rule"} style={{ ...link, color: error ? "var(--graview-warn)" : "var(--graview-ink-muted)" }}>
      {violations.length === 1 ? "A rule is broken" : "Rules are broken"} — see what, and what would fix it
    </Link>
  );
}

/**
 * THE FRONT PAGE IS THE GALLERY.
 *
 * It opens with the standing as its headline — what this installation holds,
 * in a sentence made of its own plurals, and whether its rules hold — and
 * then the pictures: every lens the app named, large and live, and a card
 * for every kind that has none, so no app lands on an empty page. What used
 * to follow — one section per kind with its description and four members,
 * the relations in full — read as a readme under two small cards, and it
 * has gone to where it is read: the kinds are one row of counts that opens
 * each list, the relations live at /map, and Recently stays short at the
 * foot.
 */
export function DefaultHomePage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { principal } = context;
  const { store, brand, invariantContext } = context;
  useStoreTick(store);
  const violations = store.violations(invariantContext);
  const recent = [...store.log.all()].slice(-5).reverse();
  // In the declaration's order, less what it leaves off the home (FR-80).
  const kinds = homeKinds(context);
  const counted = kinds.map((kind) => ({
    kind,
    members: store.graph
      .nodesOfKind(kind)
      .filter((node) => isCurrent(store.schema.tryDefinition(kind), node)),
  }));
  const present = counted.filter((entry) => entry.members.length > 0);
  // An empty installation says where to begin, in the act's own words.
  // The beginning it names is one THIS seat may take.
  const beginning = counted
    .map((entry) => ({
      entry,
      creator: store
        .allMutations()
        .find(
          (mutation) =>
            (mutation.creates ?? []).includes(entry.kind) &&
            store.permits({ name: mutation.name, args: {} }, context.principal).ok,
        ),
    }))
    .find((candidate) => candidate.creator !== undefined);
  const summary =
    present.length === 0
      ? "Nothing here yet."
      : `${present
          // Each kind counted as every face counts it, in the page's locale (W-198): "7,540 inspections".
          .map((entry) => countOf(store.schema, entry.kind, entry.members.length))
          .join(", ")
          .replace(/, ([^,]*)$/, " and $1")}.`;
  /*
   * THE HOME'S OWN VIEW (FR-81). A declaration that writes its home as
   * blocks gets them here in place of this body — the shell stays — once
   * there is anything this seat can see. An empty graph keeps the way in
   * below: blocks about records that do not exist yet would be a page of
   * dashes, and the beginning is what an empty installation needs.
   */
  const HomeView = context.views?.homeView?.() as ComponentType<ViewProps<S>> | undefined;
  const anything = (store.schema.kinds as readonly string[]).some((kind) => store.graph.nodesOfKind(kind as never).length > 0);
  if (HomeView && anything) {
    /*
     * A HOME OF ITS OWN MARKS ITS OWN RECORDS (Roadmap f-problems-in-context).
     * What it draws is the view's to know, so it is handed the records a
     * broken rule names (`flagged`), as a place's lens is, and marks them
     * where it draws them; the page says nothing over it. The bar's count
     * still says how many and opens every one.
     */
    const flagged = [...new Set(violations.flatMap((violation) => violation.nodeIds))];
    const line = brand?.subtitle && brand.subtitleDrawn !== false ? <p style={{ ...quiet, margin: 0 }} data-testid="app-subtitle">{brand.subtitle}</p> : null;
    // A home written as blocks says the app's line under its own headline (`HomeLine`); any other home view, over it.
    const placesItsLine = (HomeView as unknown as Record<symbol, unknown>)[Symbol.for("graview.home-blocks")] === true;
    return (
      <PageMain context={context} style={wide}>
        <div style={{ display: "grid", gap: 12 }} data-testid="home-view">
          {placesItsLine ? null : line}
          <HomeLine.Provider value={placesItsLine ? line : null}>
            {/* Edge to edge on a phone, where the view says `bleed` (Bleed). */}
            <Bleed when={bleeds(HomeView)}>
              <HomeView cardinality="many" fidelity="full" mode="fullscreen" selected={false} {...(flagged.length > 0 ? { flagged } : {})} />
            </Bleed>
          </HomeLine.Provider>
        </div>
      </PageMain>
    );
  }
  const live = new Set(liveKinds(store, context.principal));
  const relations = kindMap(store).relations.filter((relation) => live.has(relation.from) && (relation.to === "*" || live.has(relation.to)));
  /*
   * THE JOBS LEAD (Roadmap f-design-composer). An app that says what its
   * people come to do opens on it: the first job with records waiting is
   * the page's title, and what the app holds — the standing, the pictures —
   * follows, smaller. An app with no jobs keeps this home as it was.
   */
  const answered = answeredJobs(context);
  const leads = answered.some((one) => one.count > 0);
  /*
   * THE PROBLEMS OF WHAT THE HOME DRAWS (Roadmap f-problems-in-context): a
   * rule broken on a record its pictures or its jobs show. One broken on a
   * record the home leaves off is the bar's count's, which opens the whole
   * list; the home says nothing of it, and does not say all rules hold.
   */
  const drawn = new Set([...drawnInTheGallery(context), ...answered.flatMap((one) => one.ids)]);
  const here = violations.filter((violation) => violation.nodeIds.some((id) => drawn.has(id)));
  const beginsHere = present.length === 0 && beginning !== undefined;
  // Said under the headline when there is a beginning, a problem here, or nothing broken anywhere and no job leads.
  const standingCard = beginsHere || here.length > 0 || (violations.length === 0 && !leads);

  return (
    <PageMain context={context} style={wide}>
      <header style={{ display: "grid", gap: 12 }}>
        {/* The app is named once, on the bar (FR-131); the line under its name is said here, where it is about the app. */}
        {brand?.subtitle && brand.subtitleDrawn !== false ? <p style={{ ...quiet, margin: 0 }} data-testid="app-subtitle">{brand.subtitle}</p> : null}
        {/* THE NUMBERS ARE THE HEADLINE: what is here, said once, as big as the page says anything. */}
        {leads ? null : <PageTitle context={context} data-testid="standing">{summary}</PageTitle>}
        {standingCard ? <p style={{ ...lede, display: "grid", gap: 4 }} data-testid="standing-card">
          {present.length === 0 && beginning ? (
            <span>
              Begin with “{beginning.creator?.title ?? beginning.creator?.name}”, under{" "}
              <Link to={`/${pluralSlug(store.schema, beginning.entry.kind)}`} style={link}>
                {pluralOf(store, beginning.entry.kind)}
              </Link>
              .
            </span>
          ) : null}
          {violations.length === 0 ? <span>All rules hold.</span> : here.length > 0 ? <ProblemsHere violations={here} /> : null}
        </p> : null}
      </header>

      {answered.length > 0 ? (
        <>
          <JobsOnTheHome context={context} answered={answered} />
          {/* What the app holds, after what its people came to do: the standing in a line, the pictures smaller. */}
          <section style={{ display: "grid", gap: 20 }} data-testid="after-the-jobs">
            {leads ? (
              <p style={{ ...quiet, margin: 0 }} data-testid="standing">
                {summary}
                {violations.length === 0 ? " All rules hold." : ""}
              </p>
            ) : null}
            <Gallery context={context} small />
          </section>
        </>
      ) : (
        <Gallery context={context} />
      )}

      {/* THE KINDS, AS ONE ROW OF COUNTS: each the way into its list; the rest of what a kind is, is said there. */}
      <section style={{ ...rule, display: "grid", gap: 14 }} data-testid="kinds">
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h2 style={h2}>What is here</h2>
          {relations.length > 0 ? (
            <Link to="/map" style={{ ...onward, ...quiet, marginLeft: "auto" }} data-testid="map-link">
              <Onward>Connections · {relations.length === 1 ? "1 relation" : `${relations.length} relations`}</Onward>
            </Link>
          ) : null}
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "8px 10px" }}>
          {counted.map(({ kind, members }) => (
            <li key={kind} style={{ maxWidth: "100%" }}>
              <Link
                to={`/${pluralSlug(store.schema, kind)}`}
                style={{
                  ...plain,
                  // A long plural and its count wrap inside the card rather than push the page sideways (320 wide, 32px text).
                  flexWrap: "wrap",
                  gap: 8,
                  padding: "6px 14px 6px 10px",
                  // A way to a kind's list is a small card, not a capsule: capsules are for choices and states (FR-117).
                  borderRadius: 8,
                  border: "1px solid var(--graview-edge-bright)",
                  background: "var(--graview-panel)",
                }}
              >
                <KindMark kind={kind} brand={brand} schema={store.schema} size={7} />
                <span style={{ fontWeight: 550, overflowWrap: "anywhere" }}>{pluralOf(store, kind)}</span>
                <span style={{ ...quiet, fontVariantNumeric: "tabular-nums" }}>{members.length === 0 ? "none yet" : numberAsRead(members.length)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {recent.length > 0 ? (
        <section style={{ ...rule, display: "grid", gap: 10 }}>
          <h2 style={h2}>Recently</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
            {recent.map((op) => (
              <li key={op.id} style={quiet}>
                <span style={{ color: "var(--graview-ink)" }}>{op.intent}</span> — {whoDid(op, principal, { graph: store.graph as never, schema: store.schema, ...(context.seats ? { seats: context.seats } : {}), ...(context.people ? { people: context.people } : {}) })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageMain>
  );
}
