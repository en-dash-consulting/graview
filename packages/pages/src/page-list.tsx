import { ArrangeBar, pageSays } from "@graview/primitives/pages";
import { admitArrangement, arrange, arrangeable, formatArrangement, asksForThePast, parseArrangement } from "@graview/core/arrange";
import {
  describeSearched,
  humanizeField,
  nounOf,
  isCurrent,
  labelOf,
  matchNode,
  parseQuery,
  type AnySchema,
  type Arrangeable,
  type Arrangement,
  type Condition,
  type NodeOfSchema,
} from "@graview/core";
import { withComputed } from "@graview/core/blocks";
import { isDefaultView, type ViewProps } from "@graview/react/provider";
import { useId, useRef, useState, type ComponentType, type ReactNode } from "react";
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
  glance,
  h2,
  lede,
  link,
  plain,
  pluralOf,
  quiet,
  rule,
} from "./page-typography.js";
import { PageMain, PageTitle } from "./page-shell.js";
import { capitalize } from "./page-typography.js";

/**
 * From how many records a list offers to sort, group and filter itself.
 * Fewer are read at a glance, and three controls over one reason are
 * chrome; the count still stands, and a list the address already arranged
 * keeps its line whatever its length.
 */
export const ARRANGE_FROM = 8;

/**
 * From how many records a list is LARGE: it opens in a meaningful order
 * (newest first where the kind declares when it starts, else by name, and
 * the line says so), its rows are one line each, and an index — the
 * letters, or the years — jumps through it.
 */
export const LARGE_LIST = 40;

/** What a design hands its row: the record's name, its address, whether it is in a problem, and its glance. */
export interface ListRowFacts {
  readonly label: string;
  readonly href: string;
  readonly flagged: boolean;
  readonly glance: string;
}

export interface ListPageProps<S extends AnySchema> {
  readonly context: PageContext<S>;
  readonly kind: string;
  /** How the list opens when its address says nothing: a design's own opening (todo's tasks by list, open ones, by name). */
  readonly opening?: Arrangement;
  /** A design's own row: the inside of each record's line. The framework's row (the name and its glance) when unsaid. */
  readonly row?: (node: NodeOfSchema<S>, facts: ListRowFacts) => ReactNode;
  /** `list`: a design's rows a little apart (cards); `lines`: flush, each drawing its own rule; `grid`: cards side by side, for a kind drawn as a picture of itself (a plot). */
  readonly layout?: "list" | "lines" | "grid";
  /** The sentence under the title, where the design says it better than the declaration. */
  readonly description?: ReactNode;
  /** Drawn inside a design's own main, without the page's column of its own. */
  readonly bare?: boolean;
}


/**
 * A kind's page opens with the kind: its plural, its declared description,
 * how many there are. The members read as a list of things, each with a
 * line of its own facts. Adding one is below the list, as a section with
 * the act's own title — not a form at the top of a grid.
 */
export function DefaultListPage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const params = useParams();
  const kind = kindOfSlug(context.store.schema, params["slug"] ?? "");
  if (!kind) {
    return (
      <PageMain context={context}>
        <PageTitle context={context}>No such kind of thing here.</PageTitle>
      </PageMain>
    );
  }
  return <ListPage context={context} kind={kind} />;
}

/**
 * A KIND'S LIST, AS THE BUILDING BLOCK A DESIGN DRAWS WITH.
 *
 * Every design that drew its own list page drew its own head — an eyebrow
 * saying the app's name, "479 of 479 shown.", a second Find under the
 * bar's — and its own rows, and each fell short of the derived page in a
 * different way: no glance, no way through 479 albums, a form at the foot.
 * A design hands this its kind and what is its own — how the list opens,
 * its row, cards instead of lines — and the head, the arranging line, the
 * index, the rows' order and adding one are the framework's.
 */
export function ListPage<S extends AnySchema>({ context, kind, opening, row: ownRowOf, layout = "list", description, bare }: ListPageProps<S>) {
  const { store, brand, invariantContext } = context;
  useStoreTick(store);
  const [search, setSearch] = useSearchParams();
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
  const edgeKinds = relations.map((relation) => relation.edgeKind);
  const asked = arrangementFromSearch(search, offers, edgeKinds);
  // What the address says, or — saying nothing — how the design opens the list, or a large list's meaningful order.
  const addressed = ["sort", "filter", "group", "q", "by", "with", "past", ...edgeKinds].some((key) => search.has(key));
  const large = all.length >= LARGE_LIST;
  const arrangement = addressed ? asked.arrangement : admitArrangement(opening ?? (large ? largeOpening(offers, definition) : {}), offers).arrangement;
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
  const grouping = arrangement.group?.by ?? null;
  const rearrange = (next: Arrangement) => {
    const params = new URLSearchParams(search);
    for (const key of ["sort", "filter", "group", "q", "by", "with", "past", ...relations.map((relation) => relation.edgeKind)]) params.delete(key);
    const words = formatArrangement(next);
    for (const key of ["sort", "filter", "group", "q"] as const) if (words[key]) params.set(key, words[key]!);
    // Everything taken off is still a choice, and not the opening one.
    if (![...params.keys()].some((key) => ["sort", "filter", "group", "q"].includes(key)) && (opening || large)) params.set("sort", "");
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
    if (ownRowOf) {
      const read = (definition as { computed?: object } | undefined)?.computed ? withComputed(store.schema, store.graph as never, node as never) : node;
      return (
        <li key={node.id} data-testid="record-row" style={{ minWidth: 0 }}>
          {ownRowOf(node as NodeOfSchema<S>, { label, href: recordPath(store.schema, kind, node.id), flagged: flagged.has(node.id), glance: glance(read as Record<string, unknown>, definition, label) })}
        </li>
      );
    }
    if (RowView) {
      /*
       * THE GLANCE IS NEVER LOST. A row a chat declared as its title alone
       * drew a list of bare names; the facts the kind's glance names that
       * the row does not already say follow it, quiet, on its line.
       */
      const rowSays = pageSays(ownRow, node as never, store.graph as never);
      const read = (definition as { computed?: object } | undefined)?.computed ? withComputed(store.schema, store.graph as never, node as never) : node;
      const rest = Object.fromEntries(Object.entries(read as Record<string, unknown>).filter(([key]) => !rowSays?.fields.has(key)));
      const facts = rowSays ? glance(rest, definition, rowSays.title ?? label) : "";
      return (
        <li key={node.id} data-testid="record-row" style={{ position: "relative", display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 16, rowGap: 2, padding: "10px 0", borderTop: "1px solid var(--graview-edge)" }}>
          <div style={{ flex: "1 1 14rem", minWidth: 0 }}>
            <RowView node={node as never} cardinality="one" fidelity="glyph" mode="fullscreen" selected={false} {...(flagged.has(node.id) ? { flagged: [node.id] } : {})} />
          </div>
          {facts ? (
            <span style={{ ...quiet, flex: "0 1 auto", minWidth: 0, overflowWrap: "anywhere" }} data-testid="record-glance">
              {facts}
            </span>
          ) : null}
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
    // A large list is read down a column: each record one line, its glance at the line's end.
    return (
      <li
        key={node.id}
        style={
          large
            ? { display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 16, rowGap: 0, padding: "5px 0", borderTop: "1px solid var(--graview-edge)", overflowWrap: "anywhere" }
            : {
                display: "grid",
                // One track no wider than the page, and a long unbroken value (an email) breaks inside it (W-175).
                gridTemplateColumns: "minmax(0, 1fr)",
                gap: 2,
                padding: "14px 0",
                borderTop: "1px solid var(--graview-edge)",
                overflowWrap: "anywhere",
              }
        }
      >
        <Link
          to={recordPath(store.schema, kind, node.id)}
          style={large ? { ...plain, flex: "1 1 14rem", minWidth: 0, fontSize: "1rem", fontWeight: 600, lineHeight: 1.35 } : { ...plain, fontFamily: DISPLAY, fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.3 }}
        >
          {flagged.has(node.id) ? <span style={{ color: "var(--graview-warn)" }}>⚠ </span> : null}
          {label}
        </Link>
        {said ? <span style={large ? { ...quiet, flex: "0 1 auto", minWidth: 0, fontSize: "0.875rem" } : quiet}>{said}</span> : null}
        {why ? <WhyLine why={why} /> : null}
      </li>
    );
  };

  /*
   * THE HEAD SAYS EACH THING ONCE, AND THE RECORDS COME FIRST.
   *
   * The page opened with an eyebrow that counted ("◆ 16 PURCHASE
   * SCENARIOS"), a title that said the same word, "Related:" and "See … as:"
   * on lines of their own, then three form-sized selects — some 400 pixels
   * before the first record. Now: the title (the kind's mark beside it), the
   * declared description, one quiet line of where else to go, and the
   * arranging line, which carries the count; the records follow at once.
   *
   * CONTROLS IN PROPORTION: a short list is read, not arranged. Under
   * `ARRANGE_FROM` records the line is the count alone — unless the address
   * already arranged it, when the line says how and offers the way back.
   */
  const pictures = placesOf(context).filter((place) => place.kind === kind);
  // `is:any` is the horizon widened by "+N past", not an arrangement to undo.
  const narrowed = (arrangement.filter ?? []).some((condition) => condition.key !== "is" || condition.value !== "any");
  const arrangedAlready = Boolean(arrangement.sort || arrangement.group || arrangement.query || narrowed);
  // The line arranges a list long enough to want it, or one its address already arranged; a design's opening is not the reader's.
  const controls = current.length >= ARRANGE_FROM || (addressed && arrangedAlready);
  /*
   * A WAY THROUGH A LARGE LIST: in name order its letters, in date order its
   * years, each a heading the index above the rows jumps to. 479 albums had
   * been a bare column of names to scroll.
   */
  const sortOffer = arrangement.sort ? offers.sorts.find((offer) => offer.key === arrangement.sort!.by) : undefined;
  const sectionOf =
    large && !arranged.grouped && sortOffer && (sortOffer.about === "label" || sortOffer.type === "text" || sortOffer.type === "date")
      ? (node: (typeof members)[number]): string => {
          const value = sortOffer.about === "label" ? labelOf(definition, node) : (node as unknown as Record<string, unknown>)[sortOffer.key];
          if (typeof value !== "string" || value.length === 0) return sortOffer.type === "date" ? "No date" : "#";
          if (sortOffer.type === "date") return value.slice(0, 4);
          const first = value.trim().charAt(0).toLocaleUpperCase();
          return /\p{L}/u.test(first) ? first : "#";
        }
      : undefined;
  const sections = sectionOf
    ? members.reduce<{ key: string; nodes: (typeof members)[number][] }[]>((out, node) => {
        const key = sectionOf(node);
        if (out.at(-1)?.key === key) out.at(-1)!.nodes.push(node);
        else out.push({ key, nodes: [node] });
        return out;
      }, [])
    : undefined;
  const rowsStyle: React.CSSProperties =
    layout === "grid"
      ? { margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 15rem), 1fr))", gap: 12 }
      : { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: ownRowOf && layout === "list" ? 6 : 0 };
  const anchor = (key: string) => `list-at-${key.replace(/[^\p{L}\p{N}]/gu, "_")}`;
  const roads = relations.map((relation) => {
    const far = relation.from === kind ? relation.to : relation.from;
    const words = relation.from === kind ? relation.description : (relation.inverse ?? relation.description);
    return { relation, far, words };
  });
  /*
   * ONE TIE TO TWO KINDS SAYS WHICH. A reason "explains" a task or a list:
   * one edge, two far ends, and the line read "What this is about · What
   * this is about" — two links that looked the same and went to two places.
   * Words said twice carry their far end ("What this is about: tasks").
   */
  const saidTwice = new Set(roads.map((road) => (road.words ?? "").toLowerCase()).filter((words, at, all) => words && all.indexOf(words) !== at));
  const Frame = bare ? BareFrame : PageMain;
  return (
    <Frame context={context}>
      <div style={{ display: "grid", gap: 12 }}>
        <header style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <KindMark kind={kind} brand={brand} schema={store.schema} size={8} />
            <PageTitle context={context}>{plural}</PageTitle>
          </div>
          {description ?? definition?.description ? <p style={{ ...lede, fontSize: "1.0625rem", lineHeight: 1.4 }}>{description ?? definition?.description}</p> : null}
          {roads.length > 0 || pictures.length > 0 ? (
            /*
             * WHERE ELSE TO GO, IN ONE QUIET LINE: the kinds this one is tied
             * to, each in the relation's own words from this end ("The
             * decision it follows from"), and the kind's own pictures, which
             * the bar's place list holds too.
             */
            <p style={{ ...quiet, margin: 0, display: "flex", flexWrap: "wrap", columnGap: 18, rowGap: 2 }} data-testid="kind-related">
              {roads.length > 0 ? (
                <span data-testid="kind-relations">
                  Related:{" "}
                  {roads.map(({ relation, far, words }, index) => (
                    <span key={`${relation.edgeKind}|${relation.from}|${relation.to}`} data-relation={relation.edgeKind}>
                      {index > 0 ? " · " : null}
                      {far === "*" ? (
                        capitalize(words ?? humanizeField(relation.edgeKind))
                      ) : (
                        <Link to={`/${pluralSlug(store.schema, far)}`} style={link} title={pluralOf(store, far)}>
                          {words && saidTwice.has(words.toLowerCase()) ? `${capitalize(words)}: ${pluralOf(store, far).toLowerCase()}` : capitalize(words ?? pluralOf(store, far))}
                        </Link>
                      )}
                    </span>
                  ))}
                </span>
              ) : null}
              {pictures.length > 0 ? (
                <span data-testid="kind-pictures">
                  Also as:{" "}
                  {pictures.map((place, index) => (
                    <span key={placeKey(place)}>
                      {index > 0 ? " · " : null}
                      <Link to={pathOfPlace(context, place)} style={link}>
                        {place.title}
                      </Link>
                    </span>
                  ))}
                </span>
              ) : null}
            </p>
          ) : null}
        </header>

        {asked.dropped.length > 0 ? (
          <p style={{ ...quiet, margin: 0 }} data-testid="list-dropped">
            This link asked for {asked.dropped.join(", ")}, which {plural.toLowerCase()} cannot be arranged by; the rest is shown.
          </p>
        ) : null}
        {current.length > 0 ? (
          <ArrangeBar
            schema={store.schema}
            graph={store.graph}
            kind={kind}
            arrangement={arrangement}
            onChange={rearrange}
            kept={{ shown: members.length, of: current.length }}
            noun={{ one: nounOf(definition, kind), many: plural.toLowerCase() }}
            {...(controls ? {} : { allow: false })}
            // The bar's Find narrows this list; a second box for the same
            // `?q=` would be two answers to one question. An app's own shell
            // has no such box, so there the line keeps its own.
            query={context.framed === true && context.barAbove !== true}
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
                <ul style={rowsStyle} data-graview-rows="">{group.nodes.map(row)}</ul>
              </section>
            ))}
          </div>
        ) : sections && sections.length > 1 ? (
          <div style={{ display: "grid", gap: 14 }} data-testid="records" data-sectioned={sortOffer?.type === "date" ? "year" : "letter"}>
            <nav
              aria-label="Jump to"
              data-testid="list-index"
                            // Wrapped to as many quiet lines as it needs: an entry is never cut at the edge.
              style={{ ...quiet, display: "flex", flexWrap: "wrap", gap: sortOffer?.type === "date" ? "0 10px" : "0 4px", fontSize: "0.8125rem", lineHeight: 1.3 }}
            >
              {sections.map((section) => (
                <a
                  key={section.key}
                  href={`#${anchor(section.key)}`}
                  onClick={(event) => {
                    // A jump within the page, not a new address: the router keeps the list's own.
                    event.preventDefault();
                    document.getElementById(anchor(section.key))?.scrollIntoView({ block: "start" });
                  }}
                  style={{ ...link, flex: "0 0 auto", minWidth: 24, justifyContent: "center", textDecoration: "none" }}
                >
                  {section.key}
                </a>
              ))}
            </nav>
            {sections.map((section) => (
              <section key={section.key} data-testid="list-section" aria-labelledby={anchor(section.key)} style={{ display: "grid", gap: 0 }}>
                <h2 id={anchor(section.key)} style={{ ...h2, fontSize: "0.9375rem", color: "var(--graview-ink-muted)", marginBottom: 2, scrollMarginTop: 64 }}>
                  {section.key}
                </h2>
                <ul style={rowsStyle} data-graview-rows="">{section.nodes.map(row)}</ul>
              </section>
            ))}
          </div>
        ) : (
          <ul style={rowsStyle} data-testid="records" data-graview-rows="">
            {members.map(row)}
          </ul>
        )}
        {retired > 0 ? (
          <Link to={withWord(search, "filter", "is:any")} style={{ ...link, ...quiet, justifySelf: "start" }} data-testid="past-link">
            +{retired} past
          </Link>
        ) : null}
        {creators.length > 0 ? (
          /*
           * ADDING ONE IS ONE QUIET ACT at the list's end, in the act's own
           * words; the form opens in place when it is asked for. A full form
           * at the foot of every list took nearly the room of the list. It
           * stands open where there is nothing yet, and when the words found
           * nothing and the name is already in it.
           */
          <div style={{ display: "grid", gap: 6 }} data-testid="beginnings">
            {creators.map(({ affordance, mutation }) => {
              const prefilled = Boolean(startsWith[mutation.name] && members.length === 0);
              return (
                <Beginning key={affordance.id} name={mutation.name} title={mutation.title ?? mutation.name} description={mutation.description} open={members.length === 0}>
                  {/* The candidates the derivation narrowed, not every node. */}
                  <DerivedForm
                    key={prefilled ? `${mutation.name}|${typed.words}` : mutation.name}
                    store={store}
                    mutation={mutation}
                    prefilled={affordance.args}
                    open={affordance.open}
                    {...(prefilled ? { initial: { [startsWith[mutation.name]!]: typed.words } } : {})}
                    {...(context.principal ? { principal: context.principal } : {})}
                  />
                </Beginning>
              );
            })}
          </div>
        ) : null}
      </div>

      {withheld.length > 0 ? (
        <ul style={{ ...rule, margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }} data-testid="withheld">
          {withheld.map((entry) => (
            <li key={entry.id} style={quiet}>
              <s>{entry.label}</s> — {entry.refusal.message}
            </li>
          ))}
        </ul>
      ) : null}
    </Frame>
  );
}

/** A design's own main holds the list: no column of its own. */
function BareFrame({ children }: { readonly context: unknown; readonly children?: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 40, minWidth: 0 }}>{children}</div>;
}

/** How a large list opens: newest first where the kind says when it starts, else by name. */
function largeOpening(offers: Arrangeable, definition: { readonly fieldRoles?: { readonly start?: string } } | undefined): Arrangement {
  const start = definition?.fieldRoles?.start;
  const dated = start ? offers.sorts.find((offer) => offer.key === start && offer.type === "date") : undefined;
  return dated ? { sort: { by: dated.key, direction: "desc" } } : { sort: { by: "label", direction: "asc" } };
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

/**
 * One way to begin a record: the act's title as a quiet press ("+ Add a
 * deliverable") that opens its form in place, the keyboard going to the
 * form's first field; Escape puts it away and gives the keyboard back.
 * The form is in the page either way — closed, it is hidden — so what it
 * asks is what it would ask open.
 */
function Beginning({ name, title, description, open: opening, children }: { readonly name: string; readonly title: string; readonly description?: string | undefined; readonly open: boolean; readonly children: ReactNode }) {
  const [open, setOpen] = useState(opening);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = `begin-${useId().replace(/:/g, "")}`;
  return (
    <div data-testid={`act-${name}`} style={{ display: "grid", gap: 10 }}>
      <button
        ref={button}
        type="button"
        data-testid={`act-open-${name}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
          if (!open) requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus());
        }}
        style={{ ...plain, justifySelf: "start", minHeight: 32, padding: "0 2px", border: 0, background: "none", font: "inherit", fontSize: "0.9375rem", fontWeight: 600, color: "var(--graview-ink)", cursor: "pointer" }}
      >
        <span aria-hidden="true" style={{ marginRight: 6 }}>
          {open ? "−" : "+"}
        </span>
        {title}
      </button>
      <div
        ref={panel}
        id={id}
        hidden={!open}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          setOpen(false);
          button.current?.focus();
        }}
        style={open ? { display: "grid", gap: 12, padding: "4px 0 12px" } : undefined}
      >
        {description ? <p style={{ ...quiet, margin: 0, maxWidth: "58ch" }}>{description}</p> : null}
        {children}
      </div>
    </div>
  );
}
