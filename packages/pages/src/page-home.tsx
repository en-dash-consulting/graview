import { isCurrent, type AnySchema } from "@graview/core";
import { Link } from "react-router-dom";
import { kindMap } from "./facts.js";
import { pluralSlug } from "./registry.js";
import { type PageContext, useStoreTick } from "./page-context.js";
import { Gallery } from "./page-places.js";
import {
  KindMark,
  eyebrow,
  h1,
  h2,
  lede,
  link,
  homeKinds,
  liveKinds,
  plain,
  pluralOf,
  quiet,
  rule,
  whoDid,
  wide,
} from "./page-typography.js";
import { PageMain } from "./page-shell.js";


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
          .map(
            (entry) =>
              `${entry.members.length} ${
                entry.members.length === 1
                  ? entry.kind
                  : pluralOf(store, entry.kind).toLowerCase()
              }`,
          )
          .join(", ")
          .replace(/, ([^,]*)$/, " and $1")}.`;
  const live = new Set(liveKinds(store, context.principal));
  const relations = kindMap(store).relations.filter((relation) => live.has(relation.from) && (relation.to === "*" || live.has(relation.to)));

  return (
    <PageMain context={context} style={wide}>
      <header style={{ display: "grid", gap: 12 }}>
        <p style={eyebrow}>{brand?.name ?? "Graview"}</p>
        {/* THE NUMBERS ARE THE HEADLINE: what is here, said once, as big as the page says anything. */}
        <h1 style={h1} data-testid="standing">{summary}</h1>
        <p style={{ ...lede, display: "grid", gap: 4 }} data-testid="standing-card">
          {present.length === 0 && beginning ? (
            <span>
              Begin with “{beginning.creator?.title ?? beginning.creator?.name}”, under{" "}
              <Link to={`/${pluralSlug(store.schema, beginning.entry.kind)}`} style={link}>
                {pluralOf(store, beginning.entry.kind)}
              </Link>
              .
            </span>
          ) : null}
          {violations.length === 0 ? (
            <span>All rules hold.</span>
          ) : (
            <Link to="/problems" style={{ ...link, color: "var(--graview-warn)" }}>
              {violations.length} {violations.length === 1 ? "problem" : "problems"} — see what is
              broken, and what would fix it
            </Link>
          )}
        </p>
      </header>

      <Gallery context={context} />

      {/* THE KINDS, AS ONE ROW OF COUNTS: each the way into its list; the rest of what a kind is, is said there. */}
      <section style={{ ...rule, display: "grid", gap: 14 }} data-testid="kinds">
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h2 style={h2}>What is here</h2>
          {relations.length > 0 ? (
            <Link to="/map" style={{ ...link, ...quiet, marginLeft: "auto" }} data-testid="map-link">
              How it fits together · {relations.length === 1 ? "1 relation" : `${relations.length} relations`} →
            </Link>
          ) : null}
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "8px 10px" }}>
          {counted.map(({ kind, members }) => (
            <li key={kind}>
              <Link
                to={`/${pluralSlug(store.schema, kind)}`}
                style={{
                  ...plain,
                  gap: 8,
                  padding: "6px 14px 6px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--graview-edge-bright)",
                  background: "var(--graview-panel)",
                }}
              >
                <KindMark kind={kind} brand={brand} schema={store.schema} size={7} />
                <span style={{ fontWeight: 550 }}>{pluralOf(store, kind)}</span>
                <span style={{ ...quiet, fontVariantNumeric: "tabular-nums" }}>{members.length === 0 ? "none yet" : members.length}</span>
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
