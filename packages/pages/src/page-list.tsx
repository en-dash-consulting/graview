import { ArrangeBar, RelationMark } from "@graview/primitives/pages";
import { admitArrangement, arrange, arrangeable, formatArrangement, asksForThePast, parseArrangement } from "@graview/core/arrange";
import {
  describeSearched,
  humaniseField,
  nounOf,
  isCurrent,
  labelOf,
  matchNode,
  parseQuery,
  type AnySchema,
  type Arrangeable,
  type Arrangement,
  type Condition,
} from "@graview/core";
import { withComputed } from "@graview/core/blocks";
import { isDefaultView, type ViewProps } from "@graview/react/provider";
import type { ComponentType } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { kindFacts, kindMap } from "./facts.js";
import { DerivedForm } from "./form.js";
import { kindOfSlug, pluralSlug, recordPath } from "./registry.js";
import { type PageContext, useStoreTick } from "./page-context.js";
import { pathOfPlace, placeKey, placesOf } from "./page-places.js";
import { beginningsFrom, WhyLine } from "./page-search.js";
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
  const all = store.graph.nodesOfKind(kind);
  const relations = kindMap(store).relations.filter((relation) => relation.from === kind || relation.to === kind);
  const flagged = new Set(store.violations(invariantContext).flatMap((violation) => violation.nodeIds));
  /*
   * ARRANGED THROUGH THE SHARED MODULE, in the shared words. `sort`, `filter`,
   * `group` and `q` in the search are the same grammar a lens carries in its
   * fragment, so what a person arranged here is what an agent can ask a
   * picture for. The keys this page grew before the module existed still
   * land — `?by=<edge>` groups, `?<edge>=<id>` and `?with=<edge>` narrow,
   * `?past=1` widens the horizon — because a record's "all the tasks on this
   * list" is a link somebody may have sent.
   */
  const offers = arrangeable(store.schema, kind);
  const asked = arrangementFromSearch(search, offers, relations.map((relation) => relation.edgeKind));
  const arrangement = asked.arrangement;
  // The words may say `is:any` too, as they do in the Find box.
  const typed = parseQuery(arrangement.query ?? "");
  const showingPast =
    [...(arrangement.filter ?? []), ...typed.conditions].some(
      (condition) => condition.key === "is" && (condition.value === "past" || condition.value === "any"),
    ) ||
    // `status:demo` where demos are past is the past, asked for by name.
    asksForThePast(definition, [...(arrangement.filter ?? []), ...typed.conditions]);
  const effective: Arrangement = showingPast || !definition?.lifecycle
    ? arrangement
    : { ...arrangement, filter: [...(arrangement.filter ?? []), { key: "is", value: "current" }] };
  const arranged = arrange(all, effective, {
    schema: store.schema,
    graph: store.graph,
    flagged,
    ...(typeof invariantContext?.["today"] === "string" ? { today: invariantContext["today"] as string } : {}),
  });
  const members = arranged.nodes;
  const current = definition?.lifecycle && !showingPast ? all.filter((node) => isCurrent(definition, node)) : all;
  const retired = all.length - current.length;
  const narrowing = (arrangement.filter ?? []).filter((condition) => condition.key !== "is" && relations.some((relation) => relation.edgeKind === condition.key));
  const grouping = arrangement.group?.by ?? null;
  const named = (id: string): string => {
    const node = store.graph.getNode(id);
    return node ? labelOf(store.schema.tryDefinition(node.kind), node) : id;
  };
  const rearrange = (next: Arrangement) => {
    const params = new URLSearchParams(search);
    for (const key of ["sort", "filter", "group", "q", "by", "with", "past", ...relations.map((relation) => relation.edgeKind)]) params.delete(key);
    const words = formatArrangement(next);
    for (const key of ["sort", "filter", "group", "q"] as const) if (words[key]) params.set(key, words[key]!);
    setSearch(params);
  };
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
  // Search-to-create: when the words found nothing, the beginnings start with them as the name.
  const startsWith: Record<string, string> =
    typed.words && members.length === 0
      ? Object.fromEntries(beginningsFrom(store, kind, facts.actions.affordances).map((beginning) => [beginning.mutation.name, beginning.arg]))
      : {};
  const plural = pluralOf(store, kind);
  /*
   * A MEMBER DRAWN AS A ROW (FR-37): when the app gave the kind a line of
   * its own at one × glyph — a component or a spec's `row` — each record
   * on its list is that line, and the whole line is the way to the record.
   */
  const ownRow = context.views?.lookup(kind, { cardinality: "one", fidelity: "glyph" });
  const RowView = ownRow !== undefined && !isDefaultView(ownRow) ? (ownRow as ComponentType<ViewProps<S>>) : undefined;
  const row = (node: (typeof members)[number]) => {
    const label = labelOf(definition, node);
    if (RowView) {
      return (
        <li key={node.id} data-testid="record-row" style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 4, padding: "10px 0", borderTop: "1px solid var(--graview-edge)" }}>
          <RowView node={node as never} cardinality="one" fidelity="glyph" mode="fullscreen" selected={false} {...(flagged.has(node.id) ? { flagged: [node.id] } : {})} />
          {/* The line is the link: stretched over the row, named by the record, under any link the row itself draws. */}
          <Link to={recordPath(store.schema, kind, node.id)} aria-label={flagged.has(node.id) ? `${label} — implicated in a problem` : label} style={{ position: "absolute", inset: 0, borderRadius: 6 }} />
        </li>
      );
    }
    // A glance may say a computed field (FR-83), worked out over what this seat sees.
    const read = (definition as { computed?: object } | undefined)?.computed ? withComputed(store.schema, store.graph as never, node as never) : node;
    const said = glance(read as Record<string, unknown>, definition, label);
    // Found by the words in a field rather than the name: say which, as the Find box does.
    const why = typed.words ? matchNode(definition, node, typed.words) : undefined;
    return (
      <li
        key={node.id}
        style={{
          display: "grid",
          // One track no wider than the page, and a long unbroken value (an email) breaks inside it (W-175).
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 2,
          padding: "14px 0",
          borderTop: "1px solid var(--graview-edge)",
          overflowWrap: "anywhere",
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
        {why ? <WhyLine why={why} /> : null}
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
            : `${members.length} ${members.length === 1 ? nounOf(definition, kind) : plural.toLowerCase()}`}
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
                /*
                 * THE RELATION IN ITS OWN WORDS, from this end: "The test
                 * drives booked in it", never the edge's name ("Drives Test
                 * drives", "About Enquiries", "Towards Trade-ins").
                 */
                <span key={`${relation.edgeKind}|${relation.from}|${relation.to}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <RelationMark edgeKind={relation.edgeKind} width={22} {...(context.brand?.kit ? { kit: context.brand.kit } : {})} />
                  {far === "*" ? (
                    <span>{capitalise(words ?? humaniseField(relation.edgeKind))}</span>
                  ) : (
                    <Link to={`/${pluralSlug(store.schema, far)}`} style={link} title={pluralOf(store, far)}>
                      {capitalise(words ?? pluralOf(store, far))}
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
                <span key={placeKey(place)}>
                  {index > 0 ? " · " : null}
                  <Link to={pathOfPlace(context, place)} style={link}>
                    {place.title}
                  </Link>
                </span>
              ))}
          </p>
        ) : null}
      </header>

      {narrowing.length > 0 ? (
        <p style={{ ...quiet, margin: 0 }} data-testid="list-filter-note">
          {[
            `Only the ${plural.toLowerCase()}`,
            ...narrowing.map((condition) =>
              condition.value === "*"
                ? `that ${humaniseField(condition.key).toLowerCase()} anything`
                : condition.value === "none"
                  ? `that ${humaniseField(condition.key).toLowerCase()} nothing`
                  : `${humaniseField(condition.key).toLowerCase()} ${named(condition.value)}`,
            ),
          ].join(" ")}
          {" · "}
          <Link to={showingPast ? "?filter=is:any" : "?"} style={link}>
            All {plural.toLowerCase()}
          </Link>
        </p>
      ) : null}
      {asked.dropped.length > 0 ? (
        <p style={{ ...quiet, margin: 0 }} data-testid="list-dropped">
          This link asked for {asked.dropped.join(", ")}, which {plural.toLowerCase()} cannot be arranged by; the rest is shown.
        </p>
      ) : null}
      {all.length > 1 ? (
        <ArrangeBar
          schema={store.schema}
          graph={store.graph}
          kind={kind}
          arrangement={arrangement}
          onChange={rearrange}
          kept={{ shown: members.length, of: all.length }}
          // The nav's Find box narrows this list; a second box for the same
          // `?q=` would be two answers to one question. An app's own shell
          // has no such box, so there the row keeps its own.
          query={context.framed === true}
        />
      ) : null}
      {members.length === 0 && typed.words ? (
        /* Honest about nothing: what was searched, and the way forward below — the name already in it. */
        <p style={{ ...lede, fontSize: "1.0625rem" }} data-testid="none-yet">
          Nothing here is called “{typed.words}”.{" "}
          <span style={quiet} data-testid="list-searched">
            {describeSearched(store.schema, { kinds: [kind], past: showingPast })}
          </span>{" "}
          <Link to="?" style={link}>
            Show every one
          </Link>
        </p>
      ) : members.length === 0 ? (
        <p style={{ ...lede, fontSize: "1.0625rem" }} data-testid="none-yet">
          {arrangement.filter?.length || arrangement.query ? "None of them." : "None yet"}
          {!arrangement.filter?.length && !arrangement.query && creators.length > 0
            ? ` — the first one starts below, with “${creators[0]?.mutation.title ?? creators[0]?.mutation.name}”.`
            : !arrangement.filter?.length && !arrangement.query
              ? "."
              : ""}
          {arrangement.filter?.length || arrangement.query ? (
            <>
              {" "}
              <Link to="?" style={link}>
                Show every one
              </Link>
            </>
          ) : null}
        </p>
      ) : arranged.grouped && grouping ? (
        <div style={{ display: "grid", gap: 18 }} data-testid="records" data-grouped={grouping}>
          {arranged.groups.map((group) => (
            <section key={group.key || "-"} style={{ display: "grid", gap: 0 }} data-testid="list-group">
              <h2 style={{ ...h2, fontSize: "1.0625rem", marginBottom: 4 }}>
                {group.label} <span style={quiet}>{group.nodes.length}</span>
              </h2>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 0 }}>{group.nodes.map(row)}</ul>
            </section>
          ))}
        </div>
      ) : (
        <ul
          style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 0 }}
          data-testid="records"
        >
          {members.map(row)}
        </ul>
      )}
      {retired > 0 ? (
        <Link to={withWord(search, "filter", "is:any")} style={{ ...link, ...quiet }} data-testid="past-link">
          +{retired} past
        </Link>
      ) : null}

      {creators.map(({ affordance, mutation }) => (
        <section key={affordance.id} style={{ ...rule, display: "grid", gap: 14 }}>
          <h2 style={h2}>{mutation.title ?? mutation.name}</h2>
          {mutation.description ? <p style={{ ...quiet, margin: 0, maxWidth: "58ch" }}>{mutation.description}</p> : null}
          {/* The candidates the derivation narrowed, not every node. */}
          <DerivedForm
            key={startsWith[mutation.name] && members.length === 0 ? `${mutation.name}|${typed.words}` : mutation.name}
            store={store}
            mutation={mutation}
            prefilled={affordance.args}
            open={affordance.open}
            {...(startsWith[mutation.name] && members.length === 0 ? { initial: { [startsWith[mutation.name]!]: typed.words } } : {})}
            {...(context.principal ? { principal: context.principal } : {})}
          />
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

/**
 * The search, read as an arrangement — the shared words first, then the
 * keys this page grew before there was a shared module, folded in so every
 * link that ever worked still lands: `by` is a grouping, an edge kind names
 * a far end to keep, `with` keeps the ones tied to anything, `past` widens
 * the horizon. What the kind cannot be arranged by is named, not thrown.
 */
export function arrangementFromSearch(
  search: URLSearchParams,
  offers: Arrangeable,
  edgeKinds: readonly string[],
): { readonly arrangement: Arrangement; readonly dropped: readonly string[] } {
  const parsed = parseArrangement({
    ...(search.get("sort") ? { sort: search.get("sort")! } : {}),
    ...(search.get("filter") ? { filter: search.get("filter")! } : {}),
    ...(search.get("group") ? { group: search.get("group")! } : {}),
    ...(search.get("q") ? { q: search.get("q")! } : {}),
  });
  const conditions: Condition[] = [...(parsed.filter ?? [])];
  const by = search.get("by");
  const group = parsed.group ?? (by ? { by } : undefined);
  for (const edgeKind of edgeKinds) {
    const otherId = search.get(edgeKind);
    if (otherId) conditions.push({ key: edgeKind, value: otherId });
  }
  const withEdge = search.get("with");
  if (withEdge) conditions.push({ key: withEdge, value: "*" });
  if (search.get("past") === "1" && !conditions.some((condition) => condition.key === "is")) conditions.push({ key: "is", value: "any" });
  return admitArrangement(
    {
      ...(parsed.sort ? { sort: parsed.sort } : {}),
      ...(parsed.query ? { query: parsed.query } : {}),
      ...(conditions.length > 0 ? { filter: conditions } : {}),
      ...(group ? { group } : {}),
    },
    offers,
  );
}

/** The current search with one word set — a link to the same list, arranged one step differently. */
function withWord(search: URLSearchParams, key: string, value: string): string {
  const next = new URLSearchParams(search);
  next.set(key, value);
  next.delete("past");
  return `?${next.toString()}`;
}
