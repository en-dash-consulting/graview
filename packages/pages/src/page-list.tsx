import { RelationMark } from "@graview/primitives";
import { humaniseField, isCurrent, labelOf, type AnySchema } from "@graview/core";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { kindFacts, kindMap } from "./facts.js";
import { DerivedForm } from "./form.js";
import { kindOfSlug, placePath, pluralSlug, recordPath } from "./registry.js";
import { type PageContext, useStoreTick } from "./page-context.js";
import { placesOf } from "./page-places.js";
import {
  DISPLAY,
  KindMark,
  eyebrow,
  glance,
  h1,
  h2,
  lede,
  link,
  plain,
  pluralOf,
  quiet,
  rule,
} from "./page-typography.js";
import { PageMain } from "./page-shell.js";
import { capitalise } from "./page-typography.js";


/**
 * A kind's page opens with the kind: its plural, its declared description,
 * how many there are. The members read as a list of things, each with a
 * line of its own facts. Adding one is below the list, as a section with
 * the act's own title — not a form at the top of a grid.
 */
export function DefaultListPage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store, brand, invariantContext } = context;
  useStoreTick(store);
  const params = useParams();
  const [search, setSearch] = useSearchParams();
  const kind = kindOfSlug(store.schema, params["slug"] ?? "");
  if (!kind) {
    return (
      <PageMain context={context}>
        <h1 style={h1}>No such kind of thing here.</h1>
      </PageMain>
    );
  }
  const definition = store.schema.tryDefinition(kind);
  const past = search.get("past") === "1";
  const all = store.graph.nodesOfKind(kind);
  const current = past ? all : all.filter((node) => isCurrent(definition, node));
  const retired = all.length - current.length;
  /*
   * RELATIONS ARE STRUCTURE HERE TOO. A list can be NARROWED by a relation —
   * `?<edge>=<id>` keeps the members joined to that one node by that edge,
   * either way round, which is what a record's "all the tasks on this list"
   * links to; `?with=<edge>` keeps the ones that have the relation at all,
   * which is what the map's counts open — and GROUPED by one: `?by=<edge>`
   * reads the pile as piles-per-far-end, in the URL like every arrangement
   * on this face, so a list you arranged is a link you can send.
   */
  const edges = store.graph.allEdges();
  const relations = kindMap(store).relations.filter((relation) => relation.from === kind || relation.to === kind);
  const relatedTo = (memberId: string, edgeKind: string, otherId?: string) =>
    edges.some(
      (edge) =>
        edge.kind === edgeKind &&
        ((edge.from === memberId && (otherId === undefined || edge.to === otherId)) ||
          (edge.to === memberId && (otherId === undefined || edge.from === otherId))),
    );
  const narrowing = [...search.entries()].filter(([key, value]) => !["past", "by", "with", "q", "group"].includes(key) && relations.some((relation) => relation.edgeKind === key) && value.length > 0);
  const withEdge = search.get("with");
  const members = current.filter(
    (node) =>
      narrowing.every(([edgeKind, otherId]) => relatedTo(node.id, edgeKind, otherId)) &&
      (withEdge === null || relatedTo(node.id, withEdge)),
  );
  const by = search.get("by");
  const grouping = by && relations.some((relation) => relation.edgeKind === by) ? by : null;
  const farEnds = (memberId: string, edgeKind: string): string[] =>
    [...new Set(edges.filter((edge) => edge.kind === edgeKind && (edge.from === memberId || edge.to === memberId)).map((edge) => (edge.from === memberId ? edge.to : edge.from)))]
      .map((otherId) => store.graph.getNode(otherId))
      .filter((other): other is NonNullable<typeof other> => other !== undefined)
      .map((other) => labelOf(store.schema.tryDefinition(other.kind), other))
      .sort();
  const named = (id: string): string => {
    const node = store.graph.getNode(id);
    return node ? labelOf(store.schema.tryDefinition(node.kind), node) : id;
  };
  const flagged = new Set(store.violations(invariantContext).flatMap((violation) => violation.nodeIds));
  /*
   * AN ACT THE SEAT MAY NOT TAKE IS STATED, NOT OFFERED. The strip and the
   * record page already withhold by the policy; the list page offered every
   * creating act to everyone, and a gardener met "Agree every plot has a
   * caretaker" as a live form that refused on submit. The verdict is the
   * store's own, asked before anything is drawn.
   */
  const { principal } = context;
  /*
   * THE ACTS THE DERIVATION OFFERS, not the ones the declaration lists.
   *
   * This scanned `allMutations()` by `creates` and checked `store.permits` —
   * which is the thing `graview-pages` tells an app's own page not to do,
   * done by the framework's own page. The two answers differ: the derivation
   * also drops an act it cannot ASK for. "Add an item for someone", with
   * nobody to hand it to yet, is withheld in the scene and was offered here
   * as a live form whose picker was empty and whose submit could only refuse.
   */
  const facts = kindFacts(store, kind as string, {
    ...(principal ? { principal } : {}),
    ...(context.invariantContext ? { context: context.invariantContext } : {}),
  });
  const creators = facts.actions.affordances
    .map((affordance) => ({
      affordance,
      mutation: store.allMutations().find((m) => m.name === affordance.mutation),
    }))
    .filter((entry): entry is { affordance: typeof entry.affordance; mutation: NonNullable<typeof entry.mutation> } =>
      entry.mutation !== undefined,
    );
  const withheld = facts.actions.withheld;
  const plural = pluralOf(store, kind);
  const row = (node: (typeof members)[number]) => {
    const label = labelOf(definition, node);
    const said = glance(node as Record<string, unknown>, definition, label);
    return (
      <li
        key={node.id}
        style={{
          display: "grid",
          gap: 2,
          padding: "14px 0",
          borderTop: "1px solid var(--graview-edge)",
        }}
      >
        <Link
          to={recordPath(store.schema, kind, node.id)}
          style={{ ...plain, fontFamily: DISPLAY, fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.3 }}
        >
          {flagged.has(node.id) ? <span style={{ color: "var(--graview-warn)" }}>⚠ </span> : null}
          {label}
        </Link>
        {said ? <span style={quiet}>{said}</span> : null}
      </li>
    );
  };

  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: 12 }}>
        <p style={{ ...eyebrow, display: "flex", alignItems: "center", gap: 8 }}>
          <KindMark kind={kind} brand={brand} schema={store.schema} size={8} />
          {members.length === 0
            ? "None yet"
            : `${members.length} ${members.length === 1 ? kind : plural.toLowerCase()}`}
        </p>
        <h1 style={h1}>{plural}</h1>
        {definition?.description ? <p style={lede}>{definition.description}</p> : null}
        {relations.length > 0 ? (
          /* The roads out of this district: each relation this kind takes part in, with the far end named and linked. */
          <p style={{ ...quiet, margin: 0, display: "flex", flexWrap: "wrap", gap: "4px 14px", alignItems: "center" }} data-testid="kind-relations">
            <span>Related:</span>
            {relations.map((relation) => {
              const far = relation.from === kind ? relation.to : relation.from;
              const words = relation.from === kind ? relation.description : (relation.inverse ?? relation.description);
              return (
                <span key={`${relation.edgeKind}|${relation.from}|${relation.to}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }} title={words ? capitalise(words) : undefined}>
                  <RelationMark edgeKind={relation.edgeKind} width={22} {...(context.brand?.kit ? { kit: context.brand.kit } : {})} />
                  <span>{humaniseField(relation.edgeKind)}</span>
                  {far === "*" ? (
                    <span>anything</span>
                  ) : (
                    <Link to={`/${pluralSlug(store.schema, far)}`} style={link}>
                      {pluralOf(store, far)}
                    </Link>
                  )}
                </span>
              );
            })}
          </p>
        ) : null}
        {placesOf(context).some((place) => place.kind === kind) ? (
          /* A district's board, in the page's idiom: the kind's own pictures, by name. */
          <p style={{ ...quiet, margin: 0 }} data-testid="kind-pictures">
            See {plural.toLowerCase()} as:{" "}
            {placesOf(context)
              .filter((place) => place.kind === kind)
              .map((place, index) => (
                <span key={place.as}>
                  {index > 0 ? " · " : null}
                  <Link to={placePath(place.as)} style={link}>
                    {place.title}
                  </Link>
                </span>
              ))}
          </p>
        ) : null}
      </header>

      {narrowing.length > 0 || withEdge !== null ? (
        <p style={{ ...quiet, margin: 0 }} data-testid="list-filter-note">
          {[
            `Only the ${plural.toLowerCase()}`,
            ...(withEdge !== null ? [`that ${humaniseField(withEdge).toLowerCase()} anything`] : []),
            ...narrowing.map(([edgeKind, otherId]) => `${humaniseField(edgeKind).toLowerCase()} ${named(otherId)}`),
          ].join(" ")}
          {" · "}
          <Link to={past ? "?past=1" : "?"} style={link}>
            All {plural.toLowerCase()}
          </Link>
        </p>
      ) : null}
      {relations.length > 0 && current.length > 1 ? (
        <form
          style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
          data-testid="list-by-controls"
          onSubmit={(event) => event.preventDefault()}
        >
          <label style={{ ...quiet, display: "inline-flex", alignItems: "center", gap: 6 }}>
            Group by
            <select
              data-testid="list-by"
              value={grouping ?? ""}
              onChange={(event) => {
                const next = new URLSearchParams(search);
                if (event.target.value) next.set("by", event.target.value);
                else next.delete("by");
                setSearch(next);
              }}
              style={{ font: "inherit", minHeight: 32, padding: "4px 8px", borderRadius: 8, border: "1px solid var(--graview-edge)", background: "var(--graview-panel)", color: "var(--graview-ink)" }}
            >
              <option value="">nothing</option>
              {[...new Map(relations.map((relation) => [relation.edgeKind, relation])).values()].map((relation) => {
                const far = relation.from === kind ? relation.to : relation.from;
                return (
                  <option key={relation.edgeKind} value={relation.edgeKind}>
                    {humaniseField(relation.edgeKind)} — {far === "*" ? "anything" : pluralOf(store, far).toLowerCase()}
                  </option>
                );
              })}
            </select>
          </label>
        </form>
      ) : null}
      {members.length === 0 ? (
        <p style={{ ...lede, fontSize: "1.0625rem" }} data-testid="none-yet">
          {narrowing.length > 0 || withEdge !== null ? "None of them." : "None yet"}
          {narrowing.length === 0 && withEdge === null && creators.length > 0
            ? ` — the first one starts below, with “${creators[0]?.mutation.title ?? creators[0]?.mutation.name}”.`
            : narrowing.length === 0 && withEdge === null
              ? "."
              : ""}
        </p>
      ) : grouping ? (
        (() => {
          const groups = new Map<string, typeof members>();
          for (const node of members) {
            const ends = farEnds(node.id, grouping);
            const key = ends.length > 0 ? ends.join(", ") : "";
            groups.set(key, [...(groups.get(key) ?? []), node]);
          }
          const ordered = [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
          return (
            <div style={{ display: "grid", gap: 18 }} data-testid="records" data-grouped={grouping}>
              {ordered.map(([key, nodes]) => (
                <section key={key || "-"} style={{ display: "grid", gap: 0 }} data-testid="list-group">
                  <h2 style={{ ...h2, fontSize: "1.0625rem", marginBottom: 4 }}>
                    {key || `No ${humaniseField(grouping).toLowerCase()}`} <span style={quiet}>{nodes.length}</span>
                  </h2>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 0 }}>{nodes.map(row)}</ul>
                </section>
              ))}
            </div>
          );
        })()
      ) : (
        <ul
          style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 0 }}
          data-testid="records"
        >
          {members.map(row)}
        </ul>
      )}
      {retired > 0 ? (
        <Link to={`?past=1`} style={{ ...link, ...quiet }} data-testid="past-link">
          +{retired} past
        </Link>
      ) : null}

      {creators.map(({ affordance, mutation }) => (
        <section key={affordance.id} style={{ ...rule, display: "grid", gap: 14 }}>
          <h2 style={h2}>{mutation.title ?? mutation.name}</h2>
          {mutation.description ? <p style={{ ...quiet, margin: 0, maxWidth: "58ch" }}>{mutation.description}</p> : null}
          {/* The candidates the derivation narrowed, not every node. */}
          <DerivedForm store={store} mutation={mutation} prefilled={affordance.args} open={affordance.open} {...(context.principal ? { principal: context.principal } : {})} />
        </section>
      ))}
      {withheld.length > 0 ? (
        <ul style={{ ...rule, margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }} data-testid="withheld">
          {withheld.map((entry) => (
            <li key={entry.id} style={quiet}>
              <s>{entry.label}</s> — {entry.refusal.message}
            </li>
          ))}
        </ul>
      ) : null}
    </PageMain>
  );
}
