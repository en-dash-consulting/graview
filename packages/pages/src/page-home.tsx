import { isCurrent, labelOf, type AnySchema } from "@graview/core";
import { Link } from "react-router-dom";
import { pluralSlug, recordPath } from "./registry.js";
import { type PageContext, useStoreTick } from "./page-context.js";
import { KindMapSection } from "./page-map.js";
import { PlaceCard, cards, placesOf } from "./page-places.js";
import {
  KindMark,
  glance,
  h1,
  h2,
  lede,
  link,
  liveKinds,
  plain,
  pluralOf,
  quiet,
  rule,
  whoDid,
} from "./page-typography.js";
import { PageMain } from "./page-shell.js";


/**
 * The front page opens with the thing itself: what this installation is
 * and what it holds, in a sentence made of its own plurals — then each kind
 * as a section, a few of its members with a line of their own facts, and
 * the way to the rest. The standing is a sentence, not a widget.
 */
export function DefaultHomePage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { principal } = context;
  const { store, brand, invariantContext } = context;
  useStoreTick(store);
  const violations = store.violations(invariantContext);
  const recent = [...store.log.all()].slice(-5).reverse();
  const kinds = liveKinds(store, context.principal);
  const counted = kinds.map((kind) => ({
    kind,
    definition: store.schema.tryDefinition(kind),
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
      ? beginning
        ? `Nothing here yet. Begin with “${beginning.creator?.title ?? beginning.creator?.name}”, under ${pluralOf(store, beginning.entry.kind)}.`
        : "Nothing here yet."
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
  const flagged = new Set(violations.flatMap((violation) => violation.nodeIds));

  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: 14 }}>
        <h1 style={h1}>{brand?.name ?? "Graview"}</h1>
        <p style={lede}>{summary}</p>
        <p style={{ margin: 0, fontSize: "1rem" }} data-testid="standing-card">
          {violations.length === 0 ? (
            <span style={quiet}>All rules hold.</span>
          ) : (
            <Link to="/problems" style={{ ...link, color: "var(--graview-warn)" }}>
              {violations.length} {violations.length === 1 ? "problem" : "problems"} — see what is
              broken, and what would fix it
            </Link>
          )}
        </p>
      </header>

      {placesOf(context).length > 0 ? (
        /* THE PICTURES FIRST: what this installation looks at, before the piles it looks at it through. */
        <section style={{ ...rule, display: "grid", gap: 14 }} data-testid="pictures">
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h2 style={h2}>
              <Link to="/places" style={plain}>
                Pictures
              </Link>
            </h2>
            <span style={quiet}>{placesOf(context).length}</span>
          </div>
          <div style={cards}>
            {placesOf(context).map((place) => (
              <PlaceCard key={place.as} context={context} place={place} />
            ))}
          </div>
        </section>
      ) : null}

      <KindMapSection context={context} />

      {counted.map(({ kind, definition, members }) => {
        const path = `/${pluralSlug(store.schema, kind)}`;
        const shown = members.slice(0, 4);
        return (
          <section key={kind} style={{ ...rule, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <KindMark kind={kind} brand={brand} schema={store.schema} />
              <h2 style={h2}>
                <Link to={path} style={plain}>
                  {pluralOf(store, kind)}
                </Link>
              </h2>
              <span style={quiet}>{members.length === 0 ? "none yet" : members.length}</span>
            </div>
            {definition?.description ? (
              <p style={{ ...quiet, margin: 0, maxWidth: "58ch" }}>{definition.description}</p>
            ) : null}
            {shown.length > 0 ? (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {shown.map((node) => {
                  const label = labelOf(definition, node);
                  const facts = glance(node as Record<string, unknown>, definition, label);
                  return (
                    <li key={node.id} style={{ display: "grid", gap: 1 }}>
                      <Link to={recordPath(store.schema, kind, node.id)} style={{ ...link, fontWeight: 550 }}>
                        {flagged.has(node.id) ? <span style={{ color: "var(--graview-warn)" }}>⚠ </span> : null}
                        {label}
                      </Link>
                      {facts ? <span style={quiet}>{facts}</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {members.length > shown.length ? (
              <Link to={path} style={{ ...link, ...quiet }}>
                All {members.length} {pluralOf(store, kind).toLowerCase()} →
              </Link>
            ) : null}
          </section>
        );
      })}

      {recent.length > 0 ? (
        <section style={{ ...rule, display: "grid", gap: 10 }}>
          <h2 style={h2}>Recently</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
            {recent.map((op) => (
              <li key={op.id} style={quiet}>
                <span style={{ color: "var(--graview-ink)" }}>{op.intent}</span> — {whoDid(op, principal)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageMain>
  );
}
