import { arrange, arrangeable, throughEdges } from "@graview/core/arrange";
import { counted, dayAsRead, labelOf, numberAsRead, pluralLabel, type AnySchema, type Arrangement, type GraviewApp, type NodeOfSchema } from "@graview/core";
import { failureWords } from "@graview/core/words";
import { kindCardId, withFocus, withOverview, withWithin, type ViewState } from "@graview/layout/view";
import { useAffordances, useApplyAffordance } from "@graview/react";
import { ViewBoundary } from "@graview/react/drawing";
import { isDefaultView, useGraph, useGraview, useNavigation, useViolations, ViewModeProvider, type ViewComponent } from "@graview/react/provider";
import { draftSight, isDraftFailure, recipeDraft, type SeatDraft } from "@graview/tools/draft";
import type { Affordance } from "@graview/tools";
import { Suspense, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrangeBar } from "./arrange-bar.js";
import { arrangementOf, withArrangement } from "./arrangement.js";
import { barPanes } from "./bar-panes-door.js";
import { declaredLensView } from "./declared-lenses.js";
import {
  cellOf,
  changedSince,
  dateFacts,
  dateFilter,
  kindShape,
  problemsByRule,
  shapeRecipe,
  tableColumns,
  tableOrder,
  TABLE_PAGE,
  type KindShape,
  type ProblemGroup,
  type TableColumn,
} from "./kind-shape.js";
import { useLensKeeping } from "./lens-keeping.js";
import { appKeyOf } from "./reader-lenses.js";
import { useSceneGo } from "./seat-move.js";
import { AnswerArgs } from "./workbench/answer-args.js";
import { CHOOSING_CSS, useChoosing } from "./choosing.js";
import { prefetchSeveral, SeveralBarDoor } from "./several-door.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * A KIND OPENS TO SOMETHING USEFUL.
 *
 * Going into a district the app drew no picture of — "open", a double
 * press, `#focus=aggregate:<kind>` — drew six chips and "+30 more" in a box
 * that floated in an empty field, under a "⚠ 36" that was the number of
 * rooms painted in the warning tone. Nothing said what the records were,
 * what was wrong with them, what to do, or let you do it.
 *
 * This is that stop, derived from the kind's declaration and its records
 * (`kind-shape.ts`), in the box a declared lens fills:
 *
 * - its HEAD says what the set is and offers the kind's creating act
 *   first ("Add a room"), asked in place, with the rest of its acts behind
 *   "Acts…" — the same derived, ranked acts the strip and the menu offer;
 * - WHAT IS GOING ON, in words, only where there is something to say: how
 *   many are overdue or coming up, its problems counted by the rule that
 *   found them (each opening the bar's own rows and their repairs), and
 *   what changed since this reader last looked;
 * - the ARRANGING LINE every list has (counted chips, typed filters);
 * - a picture CHOSEN BY THE DATA — a board by its main choice, a calendar
 *   on its main date, a table of the facts that say something — with the
 *   other shape one press away, said to be derived, and kept as a lens
 *   with one more press (the seat's own draft, `recipeDraft`).
 *
 * Fetched when a district is first gone into (`default-views.tsx`): a page
 * that never opens one carries none of it.
 */

export interface KindStopProps {
  readonly kind: string;
  /** The records the stop is of: the district's members on this side of the horizon. */
  readonly members: readonly { readonly id: string; readonly kind: string }[];
  /** The records a broken rule names. */
  readonly flagged?: readonly string[];
  /** What the place is called, when the address names it differently from the kind's plural. */
  readonly label?: string;
}

type Rec = { readonly id: string; readonly kind: string } & Readonly<Record<string, unknown>>;

/** Which picture the reader asked for, kept in the stop (`in.as`): the derived one unless they chose the table. */
const SHAPE_KEY = "as";

/** Where the reader last looked at each kind, in this browser: what "since you last looked" reads. */
const seenKey = (app: string, kind: string) => `graview:kind-seen:${app}:${kind}`;
function readSeen(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSeen(key: string, at: string): void {
  try {
    localStorage.setItem(key, at);
  } catch {
    // Remembered for this page only: nothing else depends on it.
  }
}

/** Going to a record from the stop: the same stop a double press on it makes. */
const travelTo = (view: ViewState, id: string): ViewState => ({ ...withFocus(withOverview(view, false), id), relation: null });

export function KindStop<S extends AnySchema>({ kind, members: given, flagged = [], label }: KindStopProps) {
  const { store, brand, principal, views, view: stop } = useGraview<S>();
  const { go } = useNavigation();
  const graph = useGraph<S>();
  const schema = store.schema as AnySchema;
  const definition = schema.tryDefinition(kind);
  const plural = label ?? pluralLabel(schema, kind);
  const today = store.today() ?? new Date().toISOString().slice(0, 10);
  const members = given as readonly Rec[];
  const headingId = useId();

  /* THE SHAPE, read from the declaration and the records. */
  const derived = useMemo(() => kindShape(schema, kind, members, today), [schema, kind, members, today]);
  const asked = stop.within?.[SHAPE_KEY];
  const shape: KindShape = asked === "table" ? { shape: "table" } : derived;

  /* ITS ARRANGEMENT, carried in the stop like any list's: a table opens in its main date's order. */
  const chosen = arrangementOf(stop);
  const opening = shape.shape === "table" && !chosen.sort ? tableOrder(schema, kind) : undefined;
  const arrangement: Arrangement = opening ? { ...chosen, sort: opening } : chosen;
  const flaggedSet = useMemo(() => new Set(flagged), [flagged]);
  const arranged = useMemo(
    () => arrange(members as never[], arrangement, { schema, graph: store.graph as never, flagged: flaggedSet, today }),
    [members, arrangement, schema, store, flaggedSet, today, graph], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const offers = useMemo(() => throughEdges(schema, arrangeable(schema, kind)), [schema, kind]);
  const named = views.arrangement?.()?.lists?.[kind]?.filters;
  const rearrange = (next: Arrangement) => go(withArrangement(stop, next));

  /* THE DRAFT IT IS, as the seat would draw it: what keeping it declares. */
  const seatApp = useMemo(() => ({ name: brand?.name ?? "app", schema, ...(store.policy ? { policy: store.policy } : {}) }) as unknown as GraviewApp<AnySchema>, [brand, schema, store]);
  // Made again only when what it would declare changes: a lens drawn from it keeps its own state (a calendar's month) meanwhile.
  const recipe = JSON.stringify(shapeRecipe(kind, shape, arrangement));
  const draft = useMemo<SeatDraft | undefined>(() => {
    const made = recipeDraft(JSON.parse(recipe), { app: seatApp, sight: draftSight(seatApp, principal) });
    return isDraftFailure(made) ? undefined : made;
  }, [recipe, seatApp, principal]);

  // Drawn by the lens it derived — a board, a calendar — rather than the table.
  const pictured = shape.shape !== "table" && draft !== undefined;
  return (
    <section
      aria-labelledby={headingId}
      className="graview-kind-stop"
      data-testid="kind-stop"
      data-graview-kind-stop={kind}
      data-graview-shape={shape.shape}
    >
      <style>{KIND_STOP_CSS}</style>
      <Head kind={kind} plural={plural} count={members.length} headingId={headingId} description={definition?.description} />
      <GoingOn kind={kind} plural={plural} members={members} today={today} arrangement={arrangement} onArrange={rearrange} />
      {/*
        * A DERIVED LENS ARRANGES ON ITS OWN LINE, over the same stop (`in.sort`,
        * `in.filter`, `in.q`): a board and a calendar draw theirs, and the
        * table draws the list's — one line, never two.
        */}
      {members.length > 1 && !pictured ? (
        <ArrangeBar
          schema={schema}
          graph={store.graph as never}
          kind={kind}
          arrangement={arrangement}
          onChange={rearrange}
          offers={offers}
          {...(named ? { filters: named } : {})}
          kept={{ shown: arranged.nodes.length, of: members.length }}
          testId="kind-arrange"
          chips={{ nodes: members as never, flagged: flaggedSet, today }}
        />
      ) : null}
      {members.length > 0 ? <ShapeLine derived={derived} shape={shape} draft={draft} /> : null}
      <div className="graview-kind-stop-body" data-testid="kind-stop-body">
        {members.length === 0 ? (
          <p className="graview-kind-stop-empty" data-testid="kind-stop-empty">
            Nothing here yet.
          </p>
        ) : pictured ? (
          <DerivedLens<S> draft={draft!} nodes={members} />
        ) : arranged.nodes.length === 0 ? (
          <p className="graview-kind-stop-empty" data-testid="kind-stop-none-kept">
            None of the {numberAsRead(members.length)} {plural.toLowerCase()} {arrangement.query ? `says “${arrangement.query}”` : "is kept by these filters"}.{" "}
            <button type="button" className="graview-kind-stop-link" onClick={() => rearrange({})}>
              Show them all
            </button>
          </p>
        ) : (
          <KindTable<S> kind={kind} nodes={arranged.nodes as readonly Rec[]} groups={arranged.grouped ? arranged.groups.map((group) => ({ key: group.key, label: group.label, nodes: group.nodes as readonly Rec[] })) : undefined} flagged={flaggedSet} plural={plural} arrangement={arrangement} />
        )}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- the head */

function Head<S extends AnySchema>({ kind, plural, count, headingId, description }: { kind: string; plural: string; count: number; headingId: string; description: string | undefined }) {
  const { store, setSelection, setMenuAt } = useGraview<S>();
  const about = useMemo(() => ({ about: [kindCardId(kind)] }), [kind]);
  const { affordances } = useAffordances(about);
  const { apply, preview } = useApplyAffordance();
  /*
   * THE KIND'S OWN FIRST ACT: the one that makes a record of it, as the
   * derivation ranks them — the act a stop of rooms exists to offer.
   */
  const primary = useMemo(() => {
    const makes = (affordance: Affordance) => (store.allMutations().find((mutation) => mutation.name === affordance.mutation)?.creates as readonly string[] | undefined)?.includes(kind) ?? false;
    return affordances.find((affordance) => !affordance.destructive && !affordance.setsAside && makes(affordance));
  }, [affordances, store, kind]);
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  /*
   * OPENED, THE KEYBOARD IS HERE: on the stop's heading, where a screen reader
   * starts reading it — unless it is already somewhere inside the stop.
   */
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    const at = heading.current;
    if (!at || at.closest('[data-testid="kind-stop"]')?.contains(document.activeElement)) return;
    at.focus({ preventScroll: true });
  }, [kind]);
  const run = (affordance: Affordance, args?: Record<string, unknown>): readonly string[] | void => {
    try {
      preview(affordance, args);
      apply(affordance, args);
      setFailed(null);
      setAsking(false);
      // Back to the press that started it: the asking that held the keyboard is gone.
      requestAnimationFrame(() => button.current?.focus());
    } catch (error) {
      setFailed(failureWords(store.schema, store.allMutations(), error));
      return [];
    }
  };
  return (
    <header className="graview-kind-stop-head">
      <div className="graview-kind-stop-title">
        <h2 id={headingId} ref={heading} tabIndex={-1} data-testid="kind-stop-title">
          {plural}
        </h2>
        <p data-testid="kind-stop-count">
          {counted(store.schema, kind, count)}
          {description ? ` · ${description}` : ""}
        </p>
      </div>
      <div className="graview-kind-stop-acts">
        {primary ? (
          <button
            ref={button}
            type="button"
            className="graview-kind-stop-primary"
            data-testid="kind-stop-primary"
            data-affordance={primary.id}
            aria-expanded={primary.open.length > 0 ? asking : undefined}
            onClick={() => {
              setFailed(null);
              if (primary.open.length === 0) run(primary);
              else setAsking((now) => !now);
            }}
          >
            {primary.label}
          </button>
        ) : null}
        <button
          type="button"
          className="graview-kind-stop-quiet"
          data-testid="kind-stop-acts"
          aria-haspopup="menu"
          aria-label={`What can be done with the ${plural.toLowerCase()}`}
          onClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            setSelection([kindCardId(kind)]);
            setMenuAt({ x: Math.round(box.left), y: Math.round(box.bottom + 4), on: kindCardId(kind) });
          }}
        >
          Acts…
        </button>
      </div>
      {asking && primary ? (
        <div className="graview-kind-stop-ask" data-testid="kind-stop-ask" aria-label={primary.label} role="group">
          <AnswerArgs
            affordance={primary}
            onApply={(args) => run(primary, args)}
            onCancel={() => {
              setAsking(false);
              button.current?.focus();
            }}
          />
        </div>
      ) : null}
      {failed ? (
        <p role="alert" className="graview-kind-stop-failed" data-testid="kind-stop-failed">
          {failed}
        </p>
      ) : null}
    </header>
  );
}

/* ------------------------------------------------------ what is going on */

/** The bar's own problem rows, fetched with its panes: one set of words, one set of repairs. */
type RowsProps = Parameters<typeof import("./bar-panes.js").ProblemRows>[0];
const ProblemRows = barPanes.part((panes, props: RowsProps) => <panes.ProblemRows {...props} />, { what: "The problems", as: "li" });

function GoingOn<S extends AnySchema>({ kind, plural, members, today, arrangement, onArrange }: { kind: string; plural: string; members: readonly Rec[]; today: string; arrangement: Arrangement; onArrange: (next: Arrangement) => void }) {
  const { store, brand, setSelection } = useGraview<S>();
  const schema = store.schema as AnySchema;
  const violations = useViolations<S>();
  const ids = useMemo(() => new Set(members.map((member) => member.id)), [members]);
  const groups = useMemo(() => problemsByRule(violations, ids, (name) => store.allInvariants().find((rule) => rule.name === name)?.label), [violations, ids, store]);
  const dates = useMemo(() => dateFacts(schema, kind, members, today), [schema, kind, members, today]);
  /* SINCE YOU LAST LOOKED: read once when the stop opens; this visit is remembered as it closes. */
  const key = seenKey(appKeyOf(brand, schema), kind);
  const [since] = useState(() => readSeen(key));
  useEffect(() => () => writeSeen(key, new Date().toISOString()), [key]);
  const graph = useGraph<S>();
  const news = useMemo(
    () => (since ? changedSince(store.log.all() as never, kind, since, (id) => store.graph.getNode(id)?.kind as string | undefined) : null),
    [since, store, kind, graph], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [open, setOpen] = useState<string | null>(null);
  const keep = (filter: Arrangement["filter"]) => onArrange({ ...arrangement, filter: [...(arrangement.filter ?? []).filter((one) => !filter?.some((other) => other.key === one.key)), ...(filter ?? [])] });
  const problems = groups.reduce((sum, group) => sum + group.violations.length, 0);
  const lines: ReactNode[] = [];
  if (dates && (dates.overdue > 0 || dates.soon > 0)) {
    const field = dates.field;
    lines.push(
      <li key="dates" data-testid="kind-stop-dates">
        {dates.overdue > 0 ? (
          <button type="button" className="graview-kind-stop-fact" data-tone="warn" onClick={() => keep(dateFilter(dates, "overdue", today))} aria-label={`${numberAsRead(dates.overdue)} overdue — show only these`}>
            {numberAsRead(dates.overdue)} overdue
          </button>
        ) : null}
        {dates.soon > 0 ? (
          <button type="button" className="graview-kind-stop-fact" onClick={() => keep(dateFilter(dates, "soon", today))} aria-label={`${numberAsRead(dates.soon)} in the next 7 days — show only these`}>
            {numberAsRead(dates.soon)} {dates.due ? "due" : ""} in the next 7 days
          </button>
        ) : null}
        <span className="graview-kind-stop-quiet-text"> by {field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}</span>
      </li>,
    );
  }
  if (groups.length > 0) {
    lines.push(
      <li key="problems" data-testid="kind-stop-problems" data-graview-problems={problems}>
        <span className="graview-kind-stop-warn">
          <span aria-hidden="true">⚠ </span>
          {problems === 1 ? "1 problem" : `${numberAsRead(problems)} problems`}
        </span>
        <span className="graview-kind-stop-quiet-text"> in {plural.toLowerCase()}:</span>
        <ul className="graview-kind-stop-rules">
          {groups.map((group) => (
            <ProblemLine key={group.invariant} group={group} open={open === group.invariant} onToggle={() => setOpen((now) => (now === group.invariant ? null : group.invariant))} onPick={(id) => setSelection([id])} />
          ))}
        </ul>
        <button type="button" className="graview-kind-stop-link" data-testid="kind-stop-only-problems" onClick={() => keep([{ key: "is", value: "flagged" }])}>
          Show only the {plural.toLowerCase()} with a problem
        </button>
      </li>,
    );
  }
  if (news && (news.added > 0 || news.changed > 0)) {
    const parts = [news.added > 0 ? `${numberAsRead(news.added)} added` : "", news.changed > 0 ? `${numberAsRead(news.changed)} changed` : ""].filter(Boolean);
    lines.push(
      <li key="since" data-testid="kind-stop-since">
        <span className="graview-kind-stop-quiet-text">Since you last looked ({dayAsRead(since!.slice(0, 10))}):</span> {parts.join(", ")}
      </li>,
    );
  }
  if (lines.length === 0) return null;
  return (
    <ul className="graview-kind-stop-going-on" aria-label={`What is going on in the ${plural.toLowerCase()}`} data-testid="kind-stop-going-on">
      {lines}
    </ul>
  );
}

function ProblemLine({ group, open, onToggle, onPick }: { group: ProblemGroup; open: boolean; onToggle: () => void; onPick: (id: string) => void }) {
  const rows = useId();
  return (
    <li data-graview-rule={group.invariant}>
      <button type="button" className="graview-kind-stop-rule" aria-expanded={open} aria-controls={rows} onClick={onToggle} onPointerEnter={barPanes.prefetch} onFocus={barPanes.prefetch}>
        <span aria-hidden="true" className="graview-kind-stop-chevron" data-open={open || undefined}>
          ›
        </span>
        {group.label} <span className="graview-kind-stop-quiet-text">· {numberAsRead(group.violations.length)}</span>
      </button>
      {open ? (
        <ol id={rows} className="graview-kind-stop-problem-rows" data-testid="kind-stop-problem-rows">
          <Suspense fallback={null}>
            <ProblemRows
              violations={group.violations}
              pick={(violation) => {
                const id = violation.subjectId ?? group.records[0] ?? violation.nodeIds[0];
                if (id !== undefined) onPick(id);
              }}
            />
          </Suspense>
        </ol>
      ) : null}
    </li>
  );
}

/* -------------------------------------------------------- the shape line */

const SHAPE_WORDS: Record<KindShape["shape"], string> = { board: "Board", calendar: "Calendar", table: "Table" };

function ShapeLine<S extends AnySchema>({ derived, shape, draft }: { derived: KindShape; shape: KindShape; draft: SeatDraft | undefined }) {
  const { view: stop } = useGraview<S>();
  const { go } = useNavigation();
  const { keep } = useLensKeeping(useSceneGo());
  const [keeping, setKeeping] = useState(false);
  const choices = derived.shape === "table" ? [] : [derived.shape, "table" as const];
  return (
    <div className="graview-kind-stop-shape" data-testid="kind-stop-shape">
      {choices.length > 0 ? (
        <span role="group" aria-label="Show as" className="graview-kind-stop-switch">
          {choices.map((one) => (
            <button
              key={one}
              type="button"
              aria-pressed={shape.shape === one}
              data-testid={`kind-stop-as-${one}`}
              onClick={() => go(withWithin(stop, SHAPE_KEY, one === derived.shape ? null : one))}
            >
              {SHAPE_WORDS[one]}
            </button>
          ))}
        </span>
      ) : null}
      <span className="graview-kind-stop-quiet-text" data-testid="kind-stop-derived">
        {draft ? `${draft.said.replace(/\.$/, "")}, derived from the declaration` : "Derived from the declaration"}
      </span>
      {draft ? (
        <button
          type="button"
          className="graview-kind-stop-link"
          data-testid="kind-stop-keep"
          disabled={keeping}
          title={`Keep “${draft.title}” as a lens: a place of its own`}
          onClick={() => {
            setKeeping(true);
            void keep(draft).finally(() => setKeeping(false));
          }}
        >
          Keep as a lens
        </button>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------- the lens it derived */

function DerivedLens<S extends AnySchema>({ draft, nodes }: { draft: SeatDraft; nodes: readonly Rec[] }) {
  const View = declaredLensView(draft.drawn) as unknown as ViewComponent<S>;
  return (
    <div className="graview-kind-stop-lens" data-graview-draft={draft.lens.name}>
      <ViewModeProvider mode="scene">
        <ViewBoundary kind={draft.kind} view={draft.title}>
          <View nodes={nodes as unknown as NodeOfSchema<S>[]} label={draft.title} fidelity="full" cardinality="many" mode="fullscreen" selected={false} />
        </ViewBoundary>
      </ViewModeProvider>
    </div>
  );
}

/* ---------------------------------------------------------------- a table */

function KindTable<S extends AnySchema>({
  kind,
  nodes,
  groups,
  flagged,
  plural,
  arrangement,
}: {
  kind: string;
  nodes: readonly Rec[];
  groups: readonly { key: string; label: string; nodes: readonly Rec[] }[] | undefined;
  flagged: ReadonlySet<string>;
  plural: string;
  arrangement: Arrangement;
}) {
  const { store, views, view: stop, selection, setSelection, setMenuAt, principal } = useGraview<S>();
  const { go } = useNavigation();
  const schema = store.schema as AnySchema;
  const graph = store.graph as never;
  /*
   * SEVERAL AT ONCE (`choosing.ts`): a box at each row's start, Shift for a
   * range, Cmd/Ctrl-A for every record the table holds, Escape to put them
   * down, a long press on a phone; the bar acts on all of them as one
   * change. Offered where this seat may run some act on one of these.
   */
  // In the order the rows are drawn: by group where it is grouped.
  const order = useMemo(() => (groups ? groups.flatMap((group) => group.nodes) : nodes).map((node) => node.id), [nodes, groups]);
  const choosing = useChoosing(order);
  const choosable = useMemo(
    () =>
      store.permittedMutations(principal).some((mutation) => {
        const kinds = mutation.subject?.kinds as readonly string[] | "*" | undefined;
        return kinds !== undefined && (kinds === "*" || kinds.includes(kind));
      }),
    [store, principal, kind],
  );
  const table = useRef<HTMLDivElement | null>(null);
  const acted = (still: readonly string[]) => {
    choosing.choose(still);
    requestAnimationFrame(() => {
      const list = choosing.list.current;
      const first = still[0] === undefined ? null : list?.querySelector<HTMLElement>(`[data-graview-choose-box="${CSS.escape(still[0])}"]`);
      (first ?? list)?.focus({ preventScroll: true });
    });
  };
  const all = choosing.chosen.length;
  /* A kind the app gave a line of its own (one × glyph) is drawn as that line, as its list page draws it. */
  const own = views.lookup(kind as never, { cardinality: "one", fidelity: "glyph" });
  const RowView = own !== undefined && !isDefaultView(own) ? (own as ViewComponent<S>) : undefined;
  const isSelected = (id: string) => selection.includes(id);
  const violations = useViolations<S>();
  const columns = useMemo(() => tableColumns(schema, kind, nodes, graph), [schema, kind, nodes, graph]);
  const [shown, setShown] = useState(TABLE_PAGE);
  // A new arrangement starts from the top.
  useEffect(() => setShown(TABLE_PAGE), [arrangement.query, arrangement.filter?.length, arrangement.sort?.by, arrangement.group?.by]);
  const definition = schema.tryDefinition(kind);
  const said = (id: string) => violations.filter((violation) => violation.nodeIds.includes(id) || violation.subjectId === id).map((violation) => violation.message);
  const sortedBy = arrangement.sort?.by;
  const caption = `${plural}${arrangement.sort ? `, in order of ${columns.find((column) => column.key === sortedBy)?.label.toLowerCase() ?? sortedBy}` : ""}`;
  let left = shown;
  const row = (node: Rec) => {
    const name = labelOf(definition, node as never);
    const problems = flagged.has(node.id) ? said(node.id) : [];
    return (
      /*
       * THE ROW IS ITS RECORD, as a record is anywhere in the scene: pressed, it
       * is chosen; right-clicked, long-pressed or given the menu key, its acts
       * open. Not a tab stop of its own — its name and its "⋯" are.
       */
      <tr key={node.id} data-graview-pick={node.id} tabIndex={-1} data-graview-record={node.id} data-flagged={problems.length > 0 || undefined} {...(choosable ? { "data-graview-choose": node.id } : {})}>
        {choosable ? (
          <td className="graview-choose-at">
            <input {...choosing.boxProps(node.id, name)} onPointerEnter={prefetchSeveral} onFocus={prefetchSeveral} />
          </td>
        ) : null}
        <th scope="row" className="graview-kind-stop-name">
          {RowView ? (
            /* The kind's own line (FR-37), a target for its record: pressed, chosen; pressed again, gone to. */
            <div data-graview-pick={node.id} className="graview-kind-stop-own-row">
              <RowView node={node as never} cardinality="one" fidelity="glyph" mode="scene" selected={isSelected(node.id)} {...(problems.length > 0 ? { flagged: [node.id] } : {})} />
            </div>
          ) : (
            <button type="button" data-testid="kind-stop-row-go" title={`Go to ${name}`} onClick={() => go(travelTo(stop, node.id))}>
              {name}
            </button>
          )}
          {problems.length > 0 ? (
            <span className="graview-kind-stop-flag" title={problems.join(" · ")}>
              <span aria-hidden="true">⚠</span>
              <span className="graview-kind-stop-hidden">{`Problem: ${problems.join(". ")}`}</span>
            </span>
          ) : null}
        </th>
        {columns.map((column) => {
          const cell = cellOf(schema, node, column, graph);
          return (
            <td key={column.key} data-label={column.label} data-short={(cell.text.length > 0 && cell.text.length <= 14) || undefined} data-empty={cell.text ? undefined : ""} {...(cell.title ? { title: cell.title } : {})}>
              {/* A value it has not got is said quietly, never a hole: a dash, read as "none". */}
              {cell.text ? <span>{cell.text}</span> : <><b aria-hidden="true">—</b><i className="graview-kind-stop-hidden">none</i></>}
            </td>
          );
        })}
        <td className="graview-kind-stop-row-acts">
          <button
            type="button"
            data-testid="kind-stop-row-acts"
            aria-haspopup="menu"
            aria-label={`What can be done with ${name}`}
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              setSelection([node.id]);
              setMenuAt({ x: Math.round(box.left), y: Math.round(box.bottom + 4), on: node.id });
            }}
          >
            <span aria-hidden="true">⋯</span>
          </button>
        </td>
      </tr>
    );
  };
  const body = (list: readonly Rec[]) => {
    const drawn = list.slice(0, Math.max(0, left));
    left -= drawn.length;
    return drawn.map(row);
  };
  return (
    <div
      className="graview-kind-stop-table-at"
      {...(choosable
        ? {
            ...choosing.listProps,
            ref: (element: HTMLDivElement | null) => {
              table.current = element;
              choosing.list.current = element;
            },
            tabIndex: -1,
            role: "group",
            "aria-label": all > 0 ? `${plural}, ${all} chosen` : plural,
            "data-graview-choosable": "",
          }
        : {})}
    >
      {choosable ? <style>{CHOOSING_CSS}</style> : null}
      <table className="graview-kind-stop-table" data-testid="kind-stop-table">
        <caption className="graview-kind-stop-hidden">{caption}</caption>
        <thead>
          <tr>
            {choosable ? (
              <td className="graview-choose-at graview-choose-all">
                <input
                  type="checkbox"
                  className="graview-choose-box"
                  data-testid="kind-stop-choose-all"
                  aria-label={`Choose all ${numberAsRead(nodes.length)} ${plural.toLowerCase()}`}
                  checked={all > 0 && all === nodes.length}
                  ref={(element) => {
                    if (element) element.indeterminate = all > 0 && all < nodes.length;
                  }}
                  onPointerEnter={prefetchSeveral}
                  onFocus={prefetchSeveral}
                  onChange={() => (all === nodes.length ? choosing.clear() : choosing.choose(order))}
                />
              </td>
            ) : null}
            <th scope="col" aria-sort={sortedBy === "label" ? (arrangement.sort?.direction === "desc" ? "descending" : "ascending") : undefined}>
              Name
            </th>
            {columns.map((column: TableColumn) => (
              <th key={column.key} scope="col" aria-sort={column.about === "field" && column.key === sortedBy ? (arrangement.sort?.direction === "desc" ? "descending" : "ascending") : undefined}>
                {column.label}
              </th>
            ))}
            <th scope="col">
              <span className="graview-kind-stop-hidden">Acts</span>
            </th>
          </tr>
        </thead>
        {groups
          ? groups.map((group) =>
              left <= 0 ? null : (
                <tbody key={group.key || "-"} data-graview-group={group.key}>
                  <tr className="graview-kind-stop-group">
                    <th scope="rowgroup" colSpan={columns.length + (choosable ? 3 : 2)}>
                      {group.label} <span className="graview-kind-stop-quiet-text">· {numberAsRead(group.nodes.length)}</span>
                    </th>
                  </tr>
                  {body(group.nodes)}
                </tbody>
              ),
            )
          : <tbody>{body(nodes)}</tbody>}
      </table>
      {choosable ? (
        <SeveralBarDoor
          store={store as never}
          chosen={choosing.chosen}
          principal={principal}
          anchor={() => table.current?.closest<HTMLElement>('[data-testid="kind-stop"]') ?? null}
          of={order.length}
          onChooseAll={() => choosing.choose(order)}
          onClear={choosing.clear}
          onActed={acted}
        />
      ) : null}
      {nodes.length > shown ? (
        <p className="graview-kind-stop-more">
          <span className="graview-kind-stop-quiet-text" data-testid="kind-stop-shown">
            {numberAsRead(shown)} of {numberAsRead(nodes.length)} shown
          </span>{" "}
          <button type="button" className="graview-kind-stop-link" data-testid="kind-stop-more" onClick={() => setShown((now) => now + TABLE_PAGE)}>
            Show {numberAsRead(Math.min(TABLE_PAGE, nodes.length - shown))} more
          </button>
        </p>
      ) : null}
    </div>
  );
}

/*
 * THE STOP FILLS ITS BOX AND SCROLLS INSIDE IT; it is its own container, so a
 * narrow box (a phone, an embed in a column) stacks its head and draws the
 * table as rows of words. Targets are 28 pixels, 44 on a coarse pointer, and
 * nothing is wider than the box.
 */
const KIND_STOP_CSS = `
.graview-kind-stop{container-type:inline-size;box-sizing:border-box;height:100%;min-height:0;display:flex;flex-direction:column;gap:10px;padding:16px 18px 12px;border:1px solid var(--graview-edge);border-radius:var(--graview-radius,12px);background:var(--graview-panel);color:var(--graview-ink);box-shadow:var(--graview-lift-low);overflow:auto;overscroll-behavior:contain}
[data-graview-map-panel] .graview-kind-stop{height:auto;padding:4px 6px 12px;border:0;box-shadow:none;background:none;overflow:visible}
.graview-kind-stop :focus-visible{outline:2px solid var(--graview-accent);outline-offset:2px}
.graview-kind-stop button{font:inherit;cursor:pointer}
.graview-kind-stop :is(.graview-kind-stop-link,.graview-kind-stop-rule,.graview-kind-stop-name button,.graview-kind-stop-row-acts button,.graview-kind-stop-fact,.graview-kind-stop-switch button){box-shadow:none}
.graview-kind-stop-head{display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px 16px}
.graview-kind-stop-title{flex:1 1 16rem;min-width:0}
.graview-kind-stop-title h2{margin:0;outline-offset:2px;font-size:var(--graview-text-heading);line-height:1.3;overflow-wrap:anywhere}
.graview-kind-stop-title p{margin:2px 0 0;font-size:.875rem;color:var(--graview-ink-muted);overflow-wrap:anywhere}
.graview-kind-stop-acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.graview-kind-stop-primary,.graview-kind-stop-quiet{min-height:32px;padding:0 14px;border-radius:8px;font-size:.875rem}
.graview-kind-stop-primary{border:1px solid var(--graview-accent);background:var(--graview-accent);color:var(--graview-accent-ink);font-weight:600}
.graview-kind-stop-quiet{border:1px solid var(--graview-edge);background:transparent;color:var(--graview-ink)}
.graview-kind-stop-ask{flex:1 1 100%;min-width:0;padding:10px 12px;border:1px solid var(--graview-edge);border-radius:10px}
.graview-kind-stop-failed{flex:1 1 100%;margin:0;font-size:var(--graview-text-small);color:var(--graview-warn)}
.graview-kind-stop-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.graview-kind-stop-going-on{list-style:none;margin:0;padding:0;display:grid;gap:6px;font-size:.875rem}
.graview-kind-stop-going-on>li{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;min-width:0}
.graview-kind-stop-fact{min-height:28px;padding:0 10px;border:1px solid var(--graview-edge);border-radius:999px;background:transparent;color:var(--graview-ink)}
.graview-kind-stop-fact[data-tone=warn],.graview-kind-stop-warn{color:var(--graview-warn);font-weight:600}
.graview-kind-stop-quiet-text{color:var(--graview-ink-muted)}
.graview-kind-stop-rules{list-style:none;margin:0;padding:0;flex:1 1 100%;display:grid;gap:2px}
.graview-kind-stop-rule{display:inline-flex;align-items:center;gap:6px;min-height:28px;max-width:100%;padding:0 6px;border:1px solid transparent;border-radius:7px;background:none;color:var(--graview-ink);text-align:left;overflow-wrap:anywhere}
.graview-kind-stop-rule:hover{border-color:var(--graview-edge)}
.graview-kind-stop-chevron{display:inline-block;width:.8em}
.graview-kind-stop-chevron[data-open]{transform:rotate(90deg)}
.graview-kind-stop-problem-rows{list-style:none;margin:2px 0 6px 18px;padding:0;max-width:44rem}
.graview-kind-stop-link{min-height:28px;padding:0 4px;border:0;background:none;color:var(--graview-accent);text-decoration:underline;text-underline-offset:2px}
.graview-kind-stop-link:disabled{opacity:.6;cursor:default}
.graview-kind-stop-shape{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;font-size:var(--graview-text-small)}
.graview-kind-stop-switch{display:inline-flex;border:1px solid var(--graview-edge);border-radius:8px;overflow:hidden}
.graview-kind-stop-switch button{min-height:28px;padding:0 12px;border:0;background:transparent;color:var(--graview-ink-muted)}
.graview-kind-stop-switch button+button{border-left:1px solid var(--graview-edge)}
.graview-kind-stop-switch button[aria-pressed=true]{background:color-mix(in srgb,var(--graview-accent) 16%,transparent);color:var(--graview-ink);font-weight:600}
.graview-kind-stop-body{flex:1 0 auto;min-width:0}
.graview-kind-stop-empty{margin:24px 0;color:var(--graview-ink-muted)}
.graview-kind-stop-lens{min-width:0}

.graview-kind-stop-table-at{min-width:0}
.graview-kind-stop-table{width:100%;border-collapse:collapse;font-size:.875rem}
.graview-kind-stop-table th,.graview-kind-stop-table td{padding:7px 8px;text-align:left;vertical-align:top;border-top:1px solid var(--graview-edge);overflow-wrap:break-word}
.graview-kind-stop-table td{color:var(--graview-ink)}
.graview-kind-stop-table td>span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.graview-kind-stop-table td[data-short]{white-space:nowrap;font-variant-numeric:tabular-nums}
.graview-kind-stop-table thead th{border-top:0;font-size:var(--graview-text-small);font-weight:600;letter-spacing:.04em;color:var(--graview-ink-muted)}
.graview-kind-stop-name{font-weight:500;min-width:8rem;max-width:22rem}
.graview-kind-stop-name button{display:inline-block;min-width:24px;min-height:24px;padding:0;border:0;background:none;color:var(--graview-ink);font-weight:500;text-align:left;text-decoration:underline;text-decoration-color:var(--graview-edge);text-underline-offset:3px}
.graview-kind-stop-name button:hover{text-decoration-color:currentColor}
.graview-kind-stop-own-row{display:inline-block;max-width:100%;cursor:pointer}
.graview-kind-stop-flag{margin-left:6px;color:var(--graview-warn)}
.graview-kind-stop-group th{padding-top:12px;font-weight:600;color:var(--graview-ink)}
.graview-kind-stop-row-acts{width:1%;white-space:nowrap;text-align:right}
.graview-kind-stop-row-acts button{min-width:32px;min-height:28px;border:1px solid var(--graview-edge-bright,var(--graview-edge));border-radius:7px;background:none;color:var(--graview-ink);font-size:1.125rem;font-weight:700;line-height:1}
.graview-kind-stop-row-acts button:hover{background:color-mix(in srgb,var(--graview-ink) 8%,transparent)}
.graview-kind-stop-table td[data-empty] b{font-weight:400;color:var(--graview-ink-faint)}
.graview-kind-stop-table tr[data-graview-pick]{cursor:default}
.graview-kind-stop-more{margin:10px 0 0;font-size:.875rem}
.graview-kind-stop-table-at[data-graview-choosable]{outline:none}
[data-graview-choosable]:hover .graview-choose-all .graview-choose-box{opacity:1}
.graview-kind-stop-table .graview-choose-at{width:1%;padding-right:0;vertical-align:middle}
@container (max-width: 559px){
.graview-kind-stop{padding:12px}
.graview-kind-stop-acts{flex:1 1 100%}
.graview-kind-stop-primary{flex:1 1 auto}
.graview-kind-stop-table thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.graview-kind-stop-table,.graview-kind-stop-table tbody,.graview-kind-stop-table tr{display:block}
.graview-kind-stop-table tr{position:relative;padding:8px 40px 8px 0;border-top:1px solid var(--graview-edge)}
.graview-kind-stop-table th,.graview-kind-stop-table td{display:block;padding:1px 0;border:0}
.graview-kind-stop-table td>span{display:inline}
.graview-kind-stop-table td[data-short]{white-space:normal}
.graview-kind-stop-table td[data-label]::before{content:attr(data-label) " · ";color:var(--graview-ink-muted)}
.graview-kind-stop-row-acts{position:absolute;top:6px;right:0;width:auto}
.graview-kind-stop-table [data-graview-choose]{padding-left:34px}
.graview-kind-stop-table td.graview-choose-at{position:absolute;left:0;top:8px;width:auto;padding:0}
.graview-kind-stop-table thead .graview-choose-at{position:static}
}
@media (pointer: coarse){
.graview-kind-stop-table-at:not([data-graview-choosing]) .graview-choose-at{display:none}
.graview-kind-stop-table-at:not([data-graview-choosing]) [data-graview-choose]{padding-left:0}
}
@media (pointer: coarse){
.graview-kind-stop-primary,.graview-kind-stop-quiet,.graview-kind-stop-fact,.graview-kind-stop-rule,.graview-kind-stop-link,.graview-kind-stop-switch button,.graview-kind-stop-row-acts button{min-height:44px}
.graview-kind-stop-row-acts button{min-width:44px}
.graview-kind-stop-name button{min-height:44px}
}
@media (prefers-reduced-motion: reduce){.graview-kind-stop *{transition:none!important;animation:none!important}}
`;

