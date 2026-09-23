import { RelationMark } from "@graview/primitives";
import { humaniseField, labelOf, type AnySchema, type Store } from "@graview/core";
import { Link } from "react-router-dom";
import { kindMap, type KindRelation } from "./facts.js";
import { useGraviewIfAny } from "@graview/react";
import { pluralSlug, recordPath } from "./registry.js";
import { type PageContext, useStoreTick } from "./page-context.js";
import { KindMark, eyebrow, h1, h2, lede, link, liveKinds, plain, pluralOf, quiet, rule } from "./page-typography.js";
import { PageMain } from "./page-shell.js";
import { capitalise } from "./page-typography.js";


/** "anything" for a relation the declaration leaves open. */
function endOf<S extends AnySchema>(store: Store<S>, kind: string): { readonly label: string; readonly path: string | null } {
  if (kind === "*") return { label: "anything", path: null };
  return { label: pluralOf(store, kind), path: `/${pluralSlug(store.schema, kind)}` };
}

/**
 * ONE RELATION, AS A LINE: its mark, the two kinds it joins with the edge's
 * name between them, its own words from each end, and how many of it there
 * are — the count opening the far kind's list narrowed to the ones that
 * have it.
 */
function RelationLine<S extends AnySchema>({ context, relation }: { context: PageContext<S>; relation: KindRelation }) {
  const { store } = context;
  const from = endOf(store, relation.from);
  const to = endOf(store, relation.to);
  const end = (one: typeof from) => (one.path ? <Link to={one.path} style={{ ...plain, fontWeight: 550 }}>{one.label}</Link> : <span>{one.label}</span>);
  return (
    <li
      data-testid="relation"
      data-relation={relation.edgeKind}
      style={{ display: "grid", gridTemplateColumns: "30px minmax(0, 1fr) auto", gap: 12, alignItems: "baseline" }}
    >
      <RelationMark edgeKind={relation.edgeKind} {...(context.brand?.kit ? { kit: context.brand.kit } : {})} />
      <span style={{ display: "grid", gap: 1 }}>
        <span>
          {end(from)} <span style={quiet}>{humaniseField(relation.edgeKind)}</span> {end(to)}
        </span>
        {relation.description || relation.inverse ? (
          <span style={{ ...quiet, fontSize: "0.875rem" }}>
            {relation.description ? capitalise(relation.description) : null}
            {relation.description && relation.inverse ? " · " : null}
            {relation.inverse ? `from the other end, ${relation.inverse}` : null}
          </span>
        ) : null}
      </span>
      {to.path ? (
        <Link
          to={`${to.path}?with=${encodeURIComponent(relation.edgeKind)}`}
          // A count is a small word and a real target: a fingertip's width at least.
          style={{ ...link, ...quiet, fontVariantNumeric: "tabular-nums", display: "inline-block", minWidth: 24, minHeight: 24, textAlign: "center" }}
          title={`The ${to.label.toLowerCase()} that have this`}
        >
          {relation.count}
        </Link>
      ) : (
        <span style={{ ...quiet, fontVariantNumeric: "tabular-nums" }}>{relation.count}</span>
      )}
    </li>
  );
}

/**
 * HOW IT FITS TOGETHER: every declared relation between the kinds, in the
 * declaration's words, with its count — the roads between the districts
 * and the key that names them, as a page can carry them. On the home page
 * as a section; at `/map` on its own.
 */
export function KindMapSection<S extends AnySchema>({ context, heading = true }: { context: PageContext<S>; heading?: boolean }) {
  const { store } = context;
  const live = new Set(liveKinds(store, context.principal));
  const relations = kindMap(store).relations.filter((relation) => live.has(relation.from) && (relation.to === "*" || live.has(relation.to)));
  if (relations.length === 0) return null;
  return (
    <section style={{ ...rule, display: "grid", gap: 12 }} data-testid="kind-map">
      {heading ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h2 style={h2}>
            <Link to="/map" style={plain}>
              How it fits together
            </Link>
          </h2>
          <span style={quiet}>{relations.length === 1 ? "1 relation" : `${relations.length} relations`}</span>
        </div>
      ) : null}
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
        {relations.map((relation) => (
          <RelationLine key={`${relation.edgeKind}|${relation.from}|${relation.to}`} context={context} relation={relation} />
        ))}
      </ul>
    </section>
  );
}

export function DefaultMapPage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store } = context;
  useStoreTick(store);
  const live = new Set(liveKinds(store, context.principal));
  const map = kindMap(store);
  const relations = map.relations.filter((relation) => live.has(relation.from));
  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: 12 }}>
        <p style={eyebrow}>{relations.length === 0 ? "No relations" : `${relations.length} ${relations.length === 1 ? "relation" : "relations"}`}</p>
        <h1 style={h1}>How it fits together</h1>
        <p style={lede}>
          {relations.length === 0
            ? "Nothing here is declared to relate to anything else yet."
            : "The kinds this installation holds, and the relations declared between them — each in the declaration's own words, with how many of it there are."}
        </p>
      </header>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "6px 18px" }} data-testid="map-kinds">
        {map.kinds
          .filter((entry) => live.has(entry.kind))
          .map((entry) => (
            <li key={entry.kind} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <KindMark kind={entry.kind} brand={context.brand} schema={store.schema} size={7} />
              <Link to={`/${pluralSlug(store.schema, entry.kind)}`} style={link}>
                {entry.plural}
              </Link>
              <span style={quiet}>{entry.count}</span>
            </li>
          ))}
      </ul>
      <KindMapSection context={context} heading={false} />
    </PageMain>
  );
}

/** The questions the seat has asked and nobody has answered, each at the record it is about. */
export function SeatQuestions<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const here = useGraviewIfAny<S>();
  const asked = [...(here?.robots.values() ?? [])].filter((one) => one.mode === "asking" && one.say);
  if (asked.length === 0) return null;
  const { store } = context;
  return (
    <section style={{ ...rule, display: "grid", gap: 10 }} data-testid="seat-questions">
      <h2 style={h2}>{asked.length === 1 ? "The seat asked something" : `The seat asked ${asked.length} things`}</h2>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
        {asked.map((one) => {
          const about = one.at ? store.graph.getNode(one.at) : undefined;
          return (
            <li key={one.participant} style={{ display: "grid", gap: 2 }}>
              <span>{one.say}</span>
              {about ? (
                <Link to={recordPath(store.schema, about.kind as string, about.id)} style={{ ...link, ...quiet }}>
                  {labelOf(store.schema.tryDefinition(about.kind), about)} →
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
