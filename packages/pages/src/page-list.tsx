import { AppLink, ArrangeBar, CHOOSING_CSS, Files, focusInto, pageSays, prefetchSeveral, SeveralBarDoor, SkipLinks, useChoosing, useEndsAboveItsList } from "@graview/primitives/pages";
import { admitArrangement, arrange, arrangeable, formatArrangement, asksForThePast, listGroup, listOpening, orderListGroups, parseArrangement, throughEdges, withWorkedOut } from "@graview/core/arrange";
import {
  archivedFrom,
  humanizeField,
  nounOf,
  isAppAddress,
  isAppLinkField,
  isCurrent,
  labelOf,
  LOCAL_LAYERS,
  type AnyNodeDefinition,
  type AnySchema,
  type Arrangeable,
  type Arrangement,
  type Condition,
  type NodeOfSchema,
} from "@graview/core";
import { describeSearched, matchNode, parseQuery } from "@graview/core/search";
import { fieldSpecOf, firstPicture, withComputed } from "@graview/core/blocks";
import { isDefaultView, type ViewProps } from "@graview/react/provider";
import { useCallback, useId, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { kindFacts, kindMap } from "./facts.js";
import { DerivedForm } from "./form.js";
import { WithheldActs } from "./withheld-acts.js";
import { kindOfSlug, pluralSlug, recordPath } from "./registry.js";
import { type PageContext, useStoreTick } from "./page-context.js";
import { pathOfPlace, placeKey, placesOf } from "./page-places.js";
import { beginningsFrom, WhyLine } from "./page-search.js";
import {
  KindMark,
  ROWS_CSS,
  Glance,
  glance,
  glanceRuns,
  lede,
  link,
  plain,
  pluralOf,
  quiet,
  rule,
} from "./page-typography.js";
import { PageMain, PageTitle } from "./page-shell.js";
import { HeadTrail } from "./place-here.js";
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
 * (newest first where the kind declares when a record is, else by name, and
 * the line says so), its rows are one line each, and an index — the
 * letters, or the years — jumps through it.
 */
export const LARGE_LIST = 40;

/** A record's first link to another app (FR-171), in its kind's declared order: what its row names beside its facts. */
function firstAppLink(node: Readonly<Record<string, unknown>>, definition: AnyNodeDefinition | undefined): string | undefined {
  const shape = (definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape ?? {};
  const key = Object.keys(shape).find((one) => isAppLinkField(shape[one]) && isAppAddress(node[one]));
  return key === undefined ? undefined : (node[key] as string);
}

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
  const listId = `list-${useId().replace(/:/g, "")}`;
  const definition = store.schema.tryDefinition(kind);
  // The live records, unless the address asks for the archived (`?archived=true` or `all`, FR-173).
  const askedArchived = archivedFrom(search.get("archived"));
  const all = store.graph.nodesOfKind(kind, { archived: askedArchived });
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
  // Its kind's own, through each relation the far end's choices (`became.stage`), and what it works out to sort by (a rank).
  const offers = withWorkedOut(store.schema, throughEdges(store.schema, arrangeable(store.schema, kind)));
  const edgeKinds = relations.map((relation) => relation.edgeKind);
  const asked = arrangementFromSearch(search, offers, edgeKinds);
  // What the address says, or — saying nothing — how the design opens the list, or a large list's meaningful order.
  const addressed = ["sort", "filter", "group", "q", "by", "with", "past", "archived", ...edgeKinds].some((key) => search.has(key));
  const large = all.length >= LARGE_LIST;
  // The kind's natural time, which its list opens newest first by and indexes by year.
  const when = definition?.fieldRoles?.["when"];
  /*
   * HOW THE DECLARATION OPENS THIS LIST (`pages.lists.<kind>`): what it
   * filters by, the order it opens in, and its grouping — the closed groups
   * (done, declined) last and shut. A person sorts or groups it another way,
   * and the address says so; a design's own opening wins over it.
   */
  const declared = context.views?.arrangement?.()?.lists?.[kind];
  const declaredOpening = listOpening(declared);
  const declaredGroup = listGroup(declared?.group);
  const natural = naturalOpening(large, when);
  const opened = opening ?? (declaredOpening ? { ...natural, ...declaredOpening } : natural);
  const chosen = addressed ? asked.arrangement : admitArrangement(opened, offers).arrangement;
  // A declared order keeps its tiebreak while the list is in that order, however it was reached.
  const declaredSort = declaredOpening?.sort;
  const arrangement: Arrangement =
    chosen.sort && declaredSort?.then && chosen.sort.by === declaredSort.by && chosen.sort.direction === declaredSort.direction ? { ...chosen, sort: declaredSort } : chosen;
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
  // A rank the kind works out is worked out once a record, over what this seat sees (FR-83).
  const worked = new Map<string, Record<string, unknown>>();
  const arranged = arrange(all, effective, {
    schema: store.schema,
    graph: store.graph,
    flagged,
    ...(typeof invariantContext?.["today"] === "string" ? { today: invariantContext["today"] as string } : {}),
    read: (node, key) => {
      let values = worked.get(node.id);
      if (!values) worked.set(node.id, (values = withComputed(store.schema, store.graph as never, node as never) as unknown as Record<string, unknown>));
      return values[key];
    },
  });
  /*
   * THE DECLARED GROUPS, IN THEIR ORDER, THE CLOSED ONES LAST AND SHUT —
   * while the list is grouped the way the declaration groups it. A closed
   * group opens for a person who presses it (the address keeps it open,
   * `?open=done`), and stands open when the list is narrowed to find
   * something: by words, or by the very field it groups.
   */
  const groupField = declaredGroup && arrangement.group?.by === declaredGroup.by && !arrangement.group.bucket ? offers.groups.find((offer) => offer.key === declaredGroup.by) : undefined;
  const groupsDrawn =
    declaredGroup && groupField && (groupField.type === "choice" || groupField.type === "boolean")
      ? orderListGroups(arranged.groups, declaredGroup, { type: groupField.type, ...(groupField.options ? { options: groupField.options } : {}) })
      : arranged.groups.map((group) => ({ ...group, closed: false }));
  const openedGroups = new Set((search.get("open") ?? "").split(",").filter(Boolean));
  const narrowedToFind = Boolean(arrangement.query) || (arrangement.filter ?? []).some((condition) => condition.key === declaredGroup?.by);
  const groupKeyOf = (key: string) => (groupField?.type === "boolean" ? (key === "1" ? "true" : "false") : key);
  const isShut = (group: { key: string; closed: boolean }) => group.closed && !narrowedToFind && !openedGroups.has(groupKeyOf(group.key));
  const toggleGroup = (key: string) => {
    const params = new URLSearchParams(search);
    const next = new Set(openedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    if (next.size > 0) params.set("open", [...next].join(","));
    else params.delete("open");
    // Opening a group is not a new place to go back to.
    setSearch(params, { replace: true });
  };
  const members = arranged.nodes;
  const current = definition?.lifecycle && !showingPast ? all.filter((node) => isCurrent(definition, node)) : all;
  const retired = all.length - current.length;
  const grouping = arrangement.group?.by ?? null;
  const rearrange = (next: Arrangement) => {
    const params = new URLSearchParams(search);
    for (const key of ["sort", "filter", "group", "q", "by", "with", "past", "archived", ...relations.map((relation) => relation.edgeKind)]) params.delete(key);
    const words = formatArrangement(next);
    for (const key of ["sort", "filter", "group", "q", "archived"] as const) if (words[key]) params.set(key, words[key]!);
    // Everything taken off is still a choice, and not the opening one.
    if (![...params.keys()].some((key) => ["sort", "filter", "group", "q"].includes(key)) && (opening || declaredOpening || large || when)) params.set("sort", "");
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
  /*
   * WHICH BEGINNINGS STAND OPEN, per kind: every one where there is nothing
   * yet, none otherwise, and a kind followed from another starts over.
   */
  const startingOpen = (): ReadonlySet<string> => new Set(members.length === 0 ? creators.map(({ mutation }) => mutation.name) : []);
  const [begun, setBegun] = useState<{ readonly kind: string; readonly open: ReadonlySet<string> }>(() => ({ kind: kind as string, open: startingOpen() }));
  if (begun.kind !== kind) setBegun({ kind: kind as string, open: startingOpen() });
  const beginsOpen = (name: string): boolean => (begun.kind === kind ? begun.open : startingOpen()).has(name);
  const setBegins = (name: string, open: boolean): void =>
    setBegun((was) => {
      const next = new Set(was.open);
      if (open) next.add(name);
      else next.delete(name);
      return { kind: was.kind, open: next };
    });
  const beginId = `begin-${useId().replace(/:/g, "")}`;
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
  /*
   * A ROW DOES NOT REPEAT ITS HEADING. Grouped by day, every session said
   * "Sep 25, 2017" under a heading that said it; narrowed to one status,
   * every row said the status the line above had chosen. The field a group
   * is by (a date to the day, unless the row's value has a time the heading
   * does not), and a choice the list is narrowed to one value of, are left
   * off each row's glance.
   */
  const groupedBy = (arrangement.group?.bucket ?? "day") === "day" ? arrangement.group?.by : undefined;
  const filtered = (arrangement.filter ?? []).map((condition) => condition.key);
  const pinned = filtered.filter(
    (key) => filtered.indexOf(key) === filtered.lastIndexOf(key) && /choice|boolean/.test(offers.filters.find((offer) => offer.key === key)?.type ?? ""),
  );
  const unsaid = (node: object): Record<string, unknown> => {
    const read = { ...((definition as { computed?: object } | undefined)?.computed ? withComputed(store.schema, store.graph as never, node as never) : node) } as Record<string, unknown>;
    if (groupedBy && !String(read[groupedBy]).includes("T")) delete read[groupedBy];
    for (const key of pinned) delete read[key];
    return read;
  };
  // A glance's choice is drawn as a chip (`Glance`): a field the declaration makes a choice of values.
  const isChoice = (key: string) => fieldSpecOf((definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape?.[key])?.type === "enum";
  const row = (node: (typeof members)[number]) => {
    const label = labelOf(definition, node);
    if (ownRowOf) {
      return (
        <li key={node.id} data-testid="record-row" data-graview-record={node.id} style={{ minWidth: 0 }} {...chooseAt(node.id)}>
          {box(node, label)}
          {ownRowOf(node as NodeOfSchema<S>, { label, href: recordPath(store.schema, kind, node.id), flagged: flagged.has(node.id), glance: glance(unsaid(node), definition, label) })}
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
      const rest = Object.fromEntries(Object.entries(unsaid(node)).filter(([key]) => !rowSays?.fields.has(key)));
      const facts = rowSays ? glanceRuns(rest, definition, rowSays.title ?? label, isChoice) : [];
      return (
        <li key={node.id} data-testid="record-row" data-graview-record={node.id} style={{ position: "relative", display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 16, rowGap: 2, paddingBlock: 10, borderTop: "1px solid var(--graview-edge)" }} {...chooseAt(node.id)}>
          {box(node, label)}
          <div style={{ flex: "1 1 14rem", minWidth: 0 }}>
            <RowView node={node as never} cardinality="one" fidelity="glyph" mode="fullscreen" selected={false} {...(flagged.has(node.id) ? { flagged: [node.id] } : {})} />
          </div>
          {facts.length > 0 ? (
            <span style={{ ...quiet, flex: "0 1 auto", minWidth: 0, overflowWrap: "anywhere" }} data-testid="record-glance">
              <Glance runs={facts} />
            </span>
          ) : null}
          {/* The line is the link: stretched over the row, named by the record, under any link the row itself draws. */}
          <StretchedRowLink to={recordPath(store.schema, kind, node.id)} label={flagged.has(node.id) ? `${label} — implicated in a problem` : label} />
        </li>
      );
    }
    // A glance may say a computed field (FR-83), worked out over what this seat sees.
    const runs = glanceRuns(unsaid(node), definition, label, isChoice);
    const said = runs.length > 0;
    // Found by the words in a field rather than the name: say which, as the Find box does.
    const why = typed.words ? matchNode(definition, node, typed.words) : undefined;
    // Its first picture, small, beside its name (FR-162) — not down a large list's index.
    const picture = large ? undefined : firstPicture(node as Record<string, unknown>, definition);
    // Another app it links, by the name the host gives it (FR-171).
    const app = firstAppLink(node as Record<string, unknown>, definition);
    const title = (
      <Link to={recordPath(store.schema, kind, node.id)} className="graview-row-title" {...(label.length > 60 ? { title: label } : {})}>
        {flagged.has(node.id) ? <><span role="img" aria-label="Breaks a rule:" style={{ color: "var(--graview-warn)" }}>⚠</span>{" "}</> : null}
        {label}
      </Link>
    );
    // The name, then its glance in a column of its own (`ROWS_CSS`).
    return (
      <li key={node.id} className="graview-row" data-graview-record={node.id} {...chooseAt(node.id)}>
        {box(node, label)}
        {picture ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <Files as="thumb" file={picture} />
            {title}
          </div>
        ) : (
          title
        )}
        {said || app ? (
          <span className="graview-row-glance">
            <Glance runs={runs} />
            {said && app ? " · " : null}
            {app ? <AppLink address={app} /> : null}
          </span>
        ) : null}
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
  // Its pictures, but none kept off the lists (`set-lens-hidden`): hidden is hidden here too.
  const pictures = placesOf(context).filter((place) => place.kind === kind && !place.hidden);
  // What the declaration says this list filters by (`pages.lists.<kind>.filters`), when it says.
  const named = declared?.filters;
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
  // A record's natural time is a date whatever its field is kept as: a date and a time is offered as words.
  const dated = sortOffer?.type === "date" || (sortOffer !== undefined && sortOffer.key === when);
  const sectionOf =
    large && !arranged.grouped && sortOffer && (sortOffer.about === "label" || sortOffer.type === "text" || dated)
      ? (node: (typeof members)[number]): string => {
          const value = sortOffer.about === "label" ? labelOf(definition, node) : (node as unknown as Record<string, unknown>)[sortOffer.key];
          if (typeof value !== "string" || value.length === 0) return dated ? "No date" : "#";
          if (dated) return value.slice(0, 4);
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
  /*
   * SEVERAL AT ONCE: a box at each row's start chooses it, and the bar over
   * the face acts on every one chosen as one change (`useChoosing`, the
   * selection bar fetched with the first). Offered where this seat may run
   * some act on one of these at all.
   */
  // The records in the order they are drawn — by group, by section, else as arranged — which a range and Cmd/Ctrl-A read.
  const drawn = arranged.grouped && grouping ? groupsDrawn.flatMap((group) => (isShut(group) ? [] : group.nodes)) : sections && sections.length > 1 ? sections.flatMap((section) => section.nodes) : members;
  const order = useMemo(() => drawn.map((node) => node.id), [drawn.map((node) => node.id).join("\n")]); // eslint-disable-line react-hooks/exhaustive-deps
  const choosing = useChoosing(order);
  // The records' own mark, for the skips into them.
  const skipAt = useId();
  const choosable = (principal ? store.permittedMutations(principal) : store.permittedMutations()).some((mutation) => {
    const kinds = mutation.subject?.kinds as readonly string[] | "*" | undefined;
    return kinds !== undefined && (kinds === "*" || kinds.includes(kind));
  });
  const box = (node: (typeof members)[number], label: string) =>
    choosable ? (
      <span className="graview-choose-at">
        <input {...choosing.boxProps(node.id, label)} onPointerEnter={prefetchSeveral} onFocus={prefetchSeveral} />
      </span>
    ) : null;
  const chooseAt = (id: string) => (choosable ? { "data-graview-choose": id } : {});
  const acted = useCallback(
    (still: readonly string[]) => {
      choosing.choose(still);
      // The keyboard goes back to the list: on what is still chosen, else the list itself.
      requestAnimationFrame(() => {
        const list = choosing.list.current;
        const first = still[0] === undefined ? null : list?.querySelector<HTMLElement>(`[data-graview-choose-box="${CSS.escape(still[0])}"]`);
        (first ?? list)?.focus({ preventScroll: true });
      });
    },
    [choosing],
  );
  // The framework's own rows are `ROWS_CSS`'s; a design's rows and a declared row keep their list.
  const rowsStyle: React.CSSProperties | undefined =
    layout === "grid"
      ? // Cards in one row keep their own height.
        { margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 15rem), 1fr))", alignItems: "start", gap: 12 }
      : ownRowOf || RowView
        ? { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: ownRowOf && layout === "list" ? 6 : 0 }
        : undefined;
  const rowsClass = rowsStyle ? undefined : "graview-rows";
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
          {/* The section the list is in, when the app named one (Roadmap gv-pages-where-am-i): nothing else stands before a kind's list. */}
          {bare ? null : <HeadTrail context={context} />}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 10, rowGap: 4, minWidth: 0 }}>
            <KindMark kind={kind} brand={brand} schema={store.schema} size={8} />
            <PageTitle context={context}>{plural}</PageTitle>
            {creators.length > 0 ? (
              /*
               * ADDING ONE IS THE PRESS AFTER THE HEADING. Following a place
               * puts the keyboard on the page's heading; the way to add one
               * stood at the list's end, past the bar or past every row, and
               * making a task from the keyboard cost six presses more than it
               * had. Beside the heading it is the next press, and its form
               * opens under the head, above the list.
               *
               * Each press takes back 4 pixels of the line above and below
               * it, so wrapped rows of them stand 8 apart: on a phone one
               * stood over the next, and a press on one landed on the other.
               */
              <span style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", columnGap: 14, rowGap: 8 }} data-testid="beginnings-open">
                {creators.map(({ affordance, mutation }) => (
                  <BeginButton
                    key={affordance.id}
                    name={mutation.name}
                    title={mutation.title ?? mutation.name}
                    panel={`${beginId}-${mutation.name}`}
                    open={beginsOpen(mutation.name)}
                    onOpen={(open) => setBegins(mutation.name, open)}
                  />
                ))}
              </span>
            ) : null}
          </div>
          {/*
            * THE WAY INTO THE RECORDS, the press after adding one (the
            * eleventh and twelfth walks): between the heading and the first
            * row's box stood every related list, every chip and every way to
            * arrange — twenty-five Tabs on a long list, where the pointer
            * pressed the box. Unseen until the keyboard is on it.
            */}
          {members.length > 0 ? (
            <SkipLinks
              place="here"
              to={[
                { label: `Skip to the ${members.length === 1 ? nounOf(definition, kind) : `${members.length} ${plural.toLowerCase()}`}`, testid: "records", go: () => {
                  // Onto the boxes' one stop, past the index of years or letters a long list opens with.
                  const records = document.querySelector<HTMLElement>(`[data-graview-skip-target="${CSS.escape(skipAt)}"]`);
                  focusInto(records?.querySelector<HTMLElement>('[data-graview-choose-box][tabindex="0"]') ?? records);
                } },
                ...(current.length > 0
                  ? [
                      {
                        label: "Skip to arranging them",
                        testid: "arranging",
                        go: () => {
                          // Onto the line's own way in — "Filter", or the one "Arrange" a narrow line folds it into — past the chips before it.
                          const line = document.querySelector<HTMLElement>(`[data-graview-skip-target="${CSS.escape(skipAt)}"]`)?.parentElement?.querySelector<HTMLElement>('[role="group"][aria-label="Arrange"]');
                          focusInto(line?.querySelector<HTMLElement>('button[data-testid$="-add"], button[data-testid$="-all"]') ?? line);
                        },
                      },
                    ]
                  : []),
              ]}
            />
          ) : null}
          {description ?? definition?.description ? <p style={lede}>{description ?? definition?.description}</p> : null}
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
                      {index > 0 ? <span aria-hidden="true"> · </span> : null}
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
                      {index > 0 ? <span aria-hidden="true"> · </span> : null}
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

        {creators.length > 0 ? (
          /*
           * ADDING ONE IS ONE QUIET ACT, in the act's own words beside the
           * heading; the form opens here, under the head, when it is asked
           * for. A full form at the foot of every list took nearly the room
           * of the list. It stands open where there is nothing yet, and when
           * the words found nothing and the name is already in it.
           */
          <div style={{ display: "contents" }} data-testid="beginnings">
            {creators.map(({ affordance, mutation }) => {
              const prefilled = Boolean(startsWith[mutation.name] && members.length === 0);
              return (
                <BeginningForm
                  key={affordance.id}
                  name={mutation.name}
                  id={`${beginId}-${mutation.name}`}
                  description={mutation.description}
                  open={beginsOpen(mutation.name)}
                  onClose={() => setBegins(mutation.name, false)}
                >
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
                </BeginningForm>
              );
            })}
          </div>
        ) : null}

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
            {...(named ? { filters: named } : {})}
            // Its choice fields as chips over the list, counted over what is in it, where the line arranges.
            offers={offers}
            chips={{ nodes: current, flagged, ...(typeof invariantContext?.["today"] === "string" ? { today: invariantContext["today"] as string } : {}) }}
            // The bar's Find narrows this list; a second box for the same
            // `?q=` would be two answers to one question. An app's own shell
            // has no such box, so there the line keeps its own.
            query={context.framed === true && context.barAbove !== true}
          />
        ) : null}
        <style>{ROWS_CSS}</style>
        {choosable ? <style>{CHOOSING_CSS + LIST_CHOOSING_CSS}</style> : null}
        {/* The rows measure the room they are given, not the window: a list in a narrow embed on a desk stacks as on a phone. */}
        <div
          className="graview-list"
          // Where "Skip to the content" and the list's own skip take the keyboard: its records.
          data-graview-skip-target={skipAt}
          {...(choosable
            ? {
                ...choosing.listProps,
                ref: choosing.list as React.RefObject<HTMLDivElement>,
                tabIndex: -1,
                "data-graview-choosable": "",
                "aria-label": choosing.chosen.length > 0 ? `${plural}, ${choosing.chosen.length} chosen` : plural,
                role: "group",
              }
            : {})}
        >
        {members.length === 0 && typed.words ? (
          /* Honest about nothing: what was searched, and the way forward below — the name already in it. */
          <p style={lede} data-testid="none-yet">
            Nothing here is called “{typed.words}”.{" "}
            <span style={quiet} data-testid="list-searched">
              {describeSearched(store.schema, { kinds: [kind], past: showingPast })}
            </span>{" "}
            <Link to="?" style={link}>
              Show every one
            </Link>
          </p>
        ) : members.length === 0 ? (
          <p style={lede} data-testid="none-yet">
            {arrangement.filter?.length || arrangement.query ? "None of them." : "None yet"}
            {!arrangement.filter?.length && !arrangement.query && creators.length > 0
              ? ` — the first one starts above, with “${creators[0]?.mutation.title ?? creators[0]?.mutation.name}”.`
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
          <div style={{ display: "grid", gap: "1rem" }} data-testid="records" data-grouped={grouping}>
            {groupsDrawn.map((group) => {
              if (!group.closed) {
                return (
                  <section key={group.key || "-"} style={{ display: "grid", gap: 0 }} data-testid="list-group">
                    <h2 className="graview-group-head">
                      {group.label} <span>{group.nodes.length}</span>
                    </h2>
                    <ul style={rowsStyle} className={rowsClass} data-graview-rows="">{group.nodes.map(row)}</ul>
                  </section>
                );
              }
              /*
               * A CLOSED GROUP IS A DISCLOSURE: its heading a button that says
               * what it holds and how many ("done · 12 requests"), expanded or
               * not, the rows it controls drawn once it opens.
               */
              const shut = isShut(group);
              const rowsId = `${listId}-${anchor(group.key || "none")}`;
              return (
                <section key={group.key || "-"} style={{ display: "grid", gap: 0 }} data-testid="list-group" data-closed={shut ? "shut" : "open"}>
                  <h2 className="graview-group-head">
                    <button
                      type="button"
                      className="graview-group-toggle"
                      aria-expanded={!shut}
                      aria-controls={rowsId}
                      data-testid="list-group-toggle"
                      onClick={() => toggleGroup(groupKeyOf(group.key))}
                    >
                      <span aria-hidden="true">{shut ? "▸" : "▾"}</span>
                      {group.label} <span>· {group.nodes.length}</span>
                      <span style={visuallyHidden}> {group.nodes.length === 1 ? nounOf(definition, kind) : plural.toLowerCase()}</span>
                    </button>
                  </h2>
                  <ul id={rowsId} style={shut ? { ...rowsStyle, display: "none" } : rowsStyle} className={rowsClass} data-graview-rows="" hidden={shut}>
                    {shut ? null : group.nodes.map(row)}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : sections && sections.length > 1 ? (
          <div style={{ display: "grid", gap: 14 }} data-testid="records" data-sectioned={sortOffer?.type === "date" ? "year" : "letter"}>
            <nav
              aria-label="Jump to"
              data-testid="list-index"
                            // Wrapped to as many quiet lines as it needs: an entry is never cut at the edge.
              style={{ ...quiet, display: "flex", flexWrap: "wrap", gap: sortOffer?.type === "date" ? "0 10px" : "0 4px", lineHeight: 1.3 }}
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
                  style={{ ...plain, minWidth: 24, justifyContent: "center" }}
                >
                  {section.key}
                </a>
              ))}
            </nav>
            {sections.map((section) => (
              <section key={section.key} data-testid="list-section" aria-labelledby={anchor(section.key)} style={{ display: "grid", gap: 0 }}>
                <h2 id={anchor(section.key)} className="graview-group-head">
                  {section.key}
                </h2>
                <ul style={rowsStyle} className={rowsClass} data-graview-rows="">{section.nodes.map(row)}</ul>
              </section>
            ))}
          </div>
        ) : (
          <ul style={rowsStyle} className={rowsClass} data-testid="records" data-graview-rows="">
            {members.map(row)}
          </ul>
        )}
        </div>
        {choosable ? (
          <SeveralBarDoor
            store={store as never}
            chosen={choosing.chosen}
            {...(principal ? { principal } : {})}
            {...(invariantContext ? { context: invariantContext } : {})}
            anchor={anchorOf}
            of={order.length}
            onChooseAll={() => choosing.choose(order)}
            onClear={choosing.clear}
            onActed={acted}
          />
        ) : null}
        {retired > 0 ? (
          <Link to={withWord(search, "filter", "is:any")} style={{ ...link, ...quiet, justifySelf: "start" }} data-testid="past-link">
            +{retired} past
          </Link>
        ) : null}
        {/* What was set aside is a link away, never in the list (FR-173). */}
        {askedArchived === false && store.graph.count(kind, { archived: true }) > 0 ? (
          <Link to={withWord(search, "archived", "true")} style={{ ...link, ...quiet, justifySelf: "start" }} data-testid="archived-link">
            +{store.graph.count(kind, { archived: true })} archived
          </Link>
        ) : null}
      </div>

      {/* What this seat may not begin, struck with the reason — or, for a visitor, the host's way in (FR-183). */}
      <WithheldActs context={context} withheld={withheld} style={rule} testId="withheld" />
    </Frame>
  );
}

/** Words a screen reader says and a sighted reader does not need: the noun after a closed group's count. */
const visuallyHidden: React.CSSProperties = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };

/** The bar stands at the foot of the embed the list is drawn in, or of the window. */
const anchorOf = (): HTMLElement | null => document.querySelector<HTMLElement>("[data-graview-choosable]")?.closest<HTMLElement>("[data-embed-content]") ?? null;

/*
 * THE BOXES' COLUMN on the framework's list: at each row's start, over the
 * row's own link; on a phone, only once a long press has chosen something,
 * so a list read on a phone is the list it was. On a desk wide enough for
 * the page's column to have a margin, the column hangs in that margin: the
 * rows' names start on the edge the title does, not 34 pixels in from it
 * for a box that is not shown until the row is reached.
 */
const LIST_CHOOSING_CSS = `
.graview-list[data-graview-choosable]{outline:none}
.graview-list [data-graview-choose]{position:relative;padding-left:34px}
.graview-choose-at{position:absolute;left:2px;top:0;bottom:0;z-index:${LOCAL_LAYERS.raised};display:flex;align-items:center}
@media (min-width: 900px) and (pointer: fine){
.graview-list [data-graview-choose]{padding-left:0}
.graview-choose-at{left:-34px}
}
@media (pointer: coarse){
.graview-list:not([data-graview-choosing]) [data-graview-choose]{padding-left:0}
.graview-list:not([data-graview-choosing]) .graview-choose-at{display:none}
}
`;

/** A design's own main holds the list: no column of its own. */
function BareFrame({ children }: { readonly context: unknown; readonly children?: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 40, minWidth: 0 }}>{children}</div>;
}

/**
 * How a list opens when nothing asks: newest first, at any length, where
 * the kind says when a record is (`when`, its `fieldRoles.when`) — runs,
 * commits, releases, a log; else a large one by name, and a short one as
 * it is.
 */
const naturalOpening = (large: boolean, when: string | undefined): Arrangement =>
  when ? { sort: { by: when, direction: "desc" } } : large ? { sort: { by: "label", direction: "asc" } } : {};

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
    ...(search.get("archived") ? { archived: search.get("archived")! } : {}),
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
      ...(parsed.archived !== undefined ? { archived: parsed.archived } : {}),
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
 * deliverable") beside the list's heading, that opens its form under the
 * head, the keyboard going to the form's first field; Escape puts it away
 * and gives the keyboard back. The form is in the page either way — closed,
 * it is hidden — so what it asks is what it would ask open.
 */
function BeginButton({ name, title, panel, open, onOpen }: { readonly name: string; readonly title: string; readonly panel: string; readonly open: boolean; readonly onOpen: (open: boolean) => void }) {
  return (
    <button
      type="button"
      data-testid={`act-open-${name}`}
      // The act it begins, so a right-click on it can offer "Notify me when someone does this" (Roadmap f-notify-subscriptions).
      data-graview-act={name}
      aria-expanded={open}
      aria-controls={panel}
      onClick={() => {
        onOpen(!open);
        if (!open) requestAnimationFrame(() => document.getElementById(panel)?.querySelector<HTMLElement>("input, select, textarea, button")?.focus());
      }}
      // A target of 28 pixels that takes no more of the line than the title does, so the first record stands where it stood.
      style={{ ...plain, minHeight: 28, margin: "-4px 0", padding: "0 2px", border: 0, background: "none", font: "inherit", fontWeight: 600, color: "var(--graview-ink)", cursor: "pointer" }}
    >
      <span aria-hidden="true" style={{ marginRight: 6 }}>
        {open ? "−" : "+"}
      </span>
      {title}
    </button>
  );
}

/** The form a beginning opens, under the list's head; Escape gives the keyboard back to its press. */
function BeginningForm({ name, id, description, open, onClose, children }: { readonly name: string; readonly id: string; readonly description?: string | undefined; readonly open: boolean; readonly onClose: () => void; readonly children: ReactNode }) {
  return (
    // Closed, it is no part of the page's grid, so the list stands where it stood without it.
    <div
      data-testid={`act-${name}`}
      id={id}
      hidden={!open}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onClose();
        document.querySelector<HTMLElement>(`[aria-controls="${id}"]`)?.focus();
      }}
      style={open ? { display: "grid", gap: 12, padding: "4px 0 12px" } : undefined}
    >
      {description ? <p style={{ ...quiet, margin: 0, maxWidth: "58ch" }}>{description}</p> : null}
      {children}
    </div>
  );
}

/** A declared row's way to its record: stretched over the row, down to where a list the row draws begins (`useEndsAboveItsList`). */
function StretchedRowLink({ to, label }: { readonly to: string; readonly label: string }) {
  const link = useRef<HTMLAnchorElement>(null);
  useEndsAboveItsList(link);
  return <Link ref={link} to={to} aria-label={label} style={{ position: "absolute", inset: 0, borderRadius: 6 }} />;
}
