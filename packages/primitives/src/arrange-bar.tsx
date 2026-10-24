import { arrangeAllows, arrangeable, formatArrangement } from "@graview/core/arrange";
import {
  dayAsRead,
  labelOf,
  numberAsRead,
  type AnySchema,
  type Arrangeable,
  type ArrangeOffer,
  type ArrangeOption,
  type Arrangement,
  type ArrangeGraph,
  type ArrangeNode,
  type Condition,
} from "@graview/core";
import { valueWords } from "@graview/core/words";
import { retryingImport } from "@graview/core/retry";
import { lazyModule, POPOVER_STYLE, usePopover } from "@graview/react/provider";
import { Suspense, useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { VISUALLY_HIDDEN } from "./primitives/measure.js";
export { arrangementOf, withArrangement } from "./arrangement.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/**
 * ONE QUIET LINE FOR EVERY SURFACE THAT ARRANGES.
 *
 * The offers come from the declaration (`arrangeable`), the chosen
 * arrangement is a string in the stop, and this draws the line between
 * them: how many there are, then "Sort", "Group" and "Filter" as words with
 * a chevron, each opening a short list of its own (`usePopover("arrange")`),
 * and each condition kept as words with a × that takes it off. A default
 * says nothing ("Sort", never "as they come"); a choice says itself
 * ("Sorted by due date ↓", "Grouped by the list it is on").
 *
 * It replaced a row of form-sized selects — "Sort by [as they come]",
 * "Group by [nothing]", a full-width "Only…" — that put three boxes and two
 * non-choices between a list's title and its first record. Nothing here is
 * a box until it is hovered or has the keyboard; where the line is narrow
 * (a phone) it is the count, one "Arrange" holding the sort and the
 * grouping, and "Filter", which opens as a sheet along the window's foot.
 *
 * Whatever carries the arrangement — a page's search, a lens's `within` —
 * hands the current one in and takes the next one back; nothing here holds
 * state but which list is open.
 */

export interface ArrangeBarProps {
  readonly schema: AnySchema;
  readonly graph: ArrangeGraph;
  readonly kind: string;
  readonly arrangement: Arrangement;
  readonly onChange: (next: Arrangement) => void;
  /** What the surface declines, if anything. Everything is on unless declined; `false` leaves the count alone. */
  readonly allow?: ArrangeOption;
  /** Whether to draw the words box. On unless declined. */
  readonly query?: boolean;
  /** How many the arrangement kept, of how many there were: "4 of 16" where it narrowed. */
  readonly kept?: { readonly shown: number; readonly of: number };
  /** What one record and many are called: the line then opens with the count in words ("16 tasks", "4 of 16 tasks"). */
  readonly noun?: { readonly one: string; readonly many: string };
  /** Prefix for the line's test ids: `arrange` by default. */
  readonly testId?: string;
  /**
   * What the line offers to filter by, by key, in order: a declaration's
   * `pages.lists.<kind>.filters`. Unsaid, every way but a relation to a kind
   * with many records (`offeredFilters`).
   */
  readonly filters?: readonly string[];
  /**
   * The records the list holds before it is narrowed. Given, its choice
   * fields stand under the line as chips, each with how many records it
   * would keep, and one press keeps them.
   */
  readonly chips?: { readonly nodes: readonly ArrangeNode[]; readonly flagged?: ReadonlySet<string>; readonly today?: string };
  /** What the kind can be arranged by, where the surface says more than its declaration alone: a list's `throughEdges`. */
  readonly offers?: Arrangeable;
  /**
   * THE RECORDS BEHIND THE HORIZON, and the way to them: "+1458 past" on
   * the line itself. A rescue team with one callout under way and 1,458
   * behind it had a list of one, no line, and on a phone the district that
   * says "+1458 past" folded away (the tenth walk).
   */
  readonly past?: { readonly count: number; readonly widen: () => void };
  /** What ends the line, after its chips: a list's "Export CSV" (Roadmap f-view-export-csv). */
  readonly end?: ReactNode;
  readonly style?: CSSProperties;
}

/*
 * WHAT A LIST OFFERS TO FILTER BY AS AN APP GROWS. Here, beside the line
 * that asks it, rather than with the arranging a lens in the scene carries.
 */

/** From how many records at a relation's far end it is found by typing a few letters rather than listed whole. */
export const TYPED_FROM = 9;

/** From how many records at a relation's far end a list leaves it out of its filters unless the declaration names it. */
export const MANY_AT_THE_FAR_END = 40;

/** The choice fields a list shows as chips when the declaration names none: the first two it offers. */
export const CHIP_FIELDS = 2;

/** How many records each kind holds, for the far ends of a kind's relations. */
export function farCounts(graph: ArrangeGraph): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const node of graph.allNodes()) counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
  return counts;
}

/** How many records stand at an offer's far end: every record of its far kinds. */
export const farCount = (offer: ArrangeOffer, counts: ReadonlyMap<string, number>): number => (offer.far ?? []).reduce((sum, kind) => sum + (counts.get(kind) ?? 0), 0);

/**
 * WHAT A LIST OFFERS TO FILTER BY, AS AN APP GROWS.
 *
 * Every way the declaration allows is too many once a relation's far end
 * holds ninety features: the menu listed every one of them. `named` — a
 * declaration's `pages.lists.<kind>.filters` — is what the list offers, in
 * that order. Unsaid, every way but a relation to a kind with many records
 * (`MANY_AT_THE_FAR_END`), which is offered instead by what its far end is
 * (a choice field over the edge, `about: "via"`); a via offer is not
 * offered otherwise — the relation itself says it.
 */
export function offeredFilters(offers: Arrangeable, graph: ArrangeGraph, named?: readonly string[]): readonly ArrangeOffer[] {
  if (named) return named.flatMap((key) => offers.filters.filter((offer) => offer.key === key));
  const counts = farCounts(graph);
  const many = new Set(offers.filters.filter((offer) => offer.about === "edge" && farCount(offer, counts) > MANY_AT_THE_FAR_END).map((offer) => offer.key));
  return offers.filters.filter((offer) => (offer.about === "edge" ? !many.has(offer.key) : offer.about === "via" ? many.has(offer.key.split(".")[0]!) : true));
}

/** The choice fields of what a list offers that it shows as chips: the ones named, else the first `CHIP_FIELDS`. */
export function chipOffers(offered: readonly ArrangeOffer[], named?: readonly string[]): readonly ArrangeOffer[] {
  const choices = offered.filter((offer) => offer.about === "field" && offer.type === "choice" && (offer.options?.length ?? 0) > 0);
  return named ? choices : choices.slice(0, CHIP_FIELDS);
}

/** Below this width of its own the line is a phone's: the count and one "Arrange". */
export const ARRANGE_NARROW = 520;

/** A condition in words: "Due before Oct 1, 2026", "The list it is on: Today", "Past". */
export function sayCondition(schema: AnySchema, graph: ArrangeGraph, offers: Arrangeable, condition: Condition): string {
  const offer = offers.filters.find((candidate) => candidate.key === condition.key);
  if (!offer) return `${condition.key}: ${condition.value}`;
  if (offer.about === "is") return condition.value.charAt(0).toUpperCase() + condition.value.slice(1);
  if (offer.about === "via") return `${offer.label}: ${valueWords(schema.tryDefinition(offer.far?.[0] ?? ""), offer.key.split(".")[1]!, condition.value)}`;
  if (offer.about === "edge") {
    if (condition.value === "*") return `${offer.label}: anything`;
    if (condition.value === "none") return `${offer.label}: nothing`;
    const node = graph.getNode(condition.value);
    return `${offer.label}: ${node ? labelOf(schema.tryDefinition(node.kind), node) : condition.value}`;
  }
  if (offer.type === "date") {
    const [op, date] = condition.value.split(":");
    // The day as a person reads it ("Due before Sep 1, 2026" in en-US), as the chip's card says it.
    return `${offer.label} ${op} ${date ? dayAsRead(date) : ""}`.trim();
  }
  if (offer.type === "boolean") return `${offer.label}: ${condition.value === "true" ? "yes" : "no"}`;
  if (offer.type === "number") {
    const at = condition.value.lastIndexOf(":");
    const op = condition.value.slice(0, Math.max(0, at));
    if (op === "at-most" || op === "at-least") {
      return `${offer.label}: ${op === "at-most" ? "at most" : "at least"} ${valueWords(schema.tryDefinition(offers.kind), offer.key, Number(condition.value.slice(at + 1)))}`;
    }
  }
  if (offer.type === "text") return `${offer.label}: ${condition.value}`;
  return `${offer.label}: ${valueWords(schema.tryDefinition(offers.kind), offer.key, condition.value)}`;
}

/** A field's reading inside a sentence: "due date", "the list it is on" — an initialism ("SUV") kept as it is. */
export const inSentence = (words: string): string => (/^[A-Z][a-z]/.test(words) ? words.charAt(0).toLowerCase() + words.slice(1) : words);

/** The two directions of a sort, in the words its values read in. */
export function directionWords(offer: ArrangeOffer | undefined): { readonly asc: string; readonly desc: string } {
  if (offer?.type === "date") return { asc: "Earliest first", desc: "Latest first" };
  if (offer?.type === "number") return { asc: "Lowest first", desc: "Highest first" };
  if (offer?.type === "boolean") return { asc: "No first", desc: "Yes first" };
  if (offer?.type === "choice") return { asc: "In their order", desc: "In reverse order" };
  return { asc: "A to Z", desc: "Z to A" };
}

/** The lists the line opens, fetched when first wanted (`arrange-lists.tsx`). */
const LISTS = lazyModule(retryingImport(() => import("./arrange-lists.js")));
const Lists = LISTS.part((module: typeof import("./arrange-lists.js"), props: import("./arrange-lists.js").ListsProps) => <module.ArrangeLists {...props} />, { what: "This list", quiet: true });
const Chips = LISTS.part((module: typeof import("./arrange-lists.js"), props: import("./arrange-lists.js").ChipsProps) => <module.ArrangeChips {...props} />, { what: "This list", quiet: true });
/** The lists, fetched now: for a test, or a page that knows a list is about to open. */
export const preloadArrangeLists = (): Promise<unknown> => LISTS.load();

/** What each bar last sent, by its test id and kind (see `ArrangeBar`). */
const SENT = new Map<string, { words: Set<string>; latest: Arrangement | null; at: number }>();

export function ArrangeBar(props: ArrangeBarProps) {
  const { schema, graph, kind, arrangement: given, onChange } = props;
  // A list hands its own (through its relations to their far ends, `throughEdges`); a lens's are its kind's.
  const offers = props.offers ?? arrangeable(schema, kind);
  const id = props.testId ?? "arrange";
  const canSort = arrangeAllows(props.allow, "sort") && offers.sorts.length > 1;
  const canGroup = arrangeAllows(props.allow, "group") && offers.groups.length > 0;
  /*
   * WHAT IS OFFERED, AS THE APP GROWS: the ways the declaration names, or
   * all but a relation to many records; its choice fields stand as chips
   * when the list hands its records, and Filter holds the rest.
   */
  const offered = arrangeAllows(props.allow, "filter") ? offeredFilters(offers, graph, props.filters) : [];
  const chipped = props.chips ? chipOffers(offered, props.filters) : [];
  const menu = offered.filter((offer) => !chipped.includes(offer));
  const canFilter = menu.length > 0;
  const words = props.query !== false && props.allow !== false;
  const count = countWords(props.noun, props.kept);
  const past = props.past && props.past.count > 0 ? props.past : null;
  if (!canSort && !canGroup && !canFilter && !words && !count && !past) return null;

  /*
   * TWO CHANGES BEFORE ONE RENDER ARE TWO CHANGES. The bar merged each change
   * onto the arrangement it was drawn with, and the arrangement comes back
   * through the address or the view a render later — so a grouping chosen
   * and a word typed before the page redrew sent the word on top of the old
   * grouping, and the grouping was lost (on a slow phone, every time). The
   * bar merges onto what it last sent while what comes back is its own echo,
   * and follows what comes back once something else changed it.
   */
  const said = (one: Arrangement) => JSON.stringify(formatArrangement(one));
  /*
   * Kept per bar, not per mount: a busy page redrew the bar between a choice
   * and the next keystroke, and a bar that forgot what it had sent took the
   * stale arrangement back. For a moment after its own change it trusts what
   * it sent; after that, what comes back is either its echo or news.
   */
  const memory = `${id}|${kind}`;
  const sent = { current: SENT.get(memory) ?? { words: new Set<string>(), latest: null as Arrangement | null, at: 0 } };
  SENT.set(memory, sent.current);
  if (sent.current.latest && Date.now() - sent.current.at > 1500 && !sent.current.words.has(said(given))) {
    sent.current = { words: new Set(), latest: null, at: 0 };
    SENT.set(memory, sent.current);
  }
  // What the line shows: what the bar last sent while what comes back is its echo.
  const arrangement = sent.current.latest ?? given;
  const set = (patch: Partial<Arrangement>) => {
    // What the bar last sent, read now — not the arrangement this render was drawn with.
    const next: Record<string, unknown> = { ...(sent.current.latest ?? given), ...patch };
    for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
    sent.current.latest = next as Arrangement;
    sent.current.at = Date.now();
    sent.current.words.add(said(next as Arrangement));
    onChange(next as Arrangement);
  };
  const conditions = arrangement.filter ?? [];
  const without = (at: number) => {
    const rest = conditions.filter((_, index) => index !== at);
    set({ filter: rest.length > 0 ? rest : undefined });
  };
  const has = (condition: Condition) => conditions.some((c) => c.key === condition.key && c.value === condition.value);
  // A condition already kept is taken off by pressing it again: the list says which are on.
  const toggle = (condition: Condition) =>
    has(condition)
      ? without(conditions.findIndex((c) => c.key === condition.key && c.value === condition.value))
      : set({ filter: [...conditions, condition] });

  const sortOffer = arrangement.sort ? offers.sorts.find((offer) => offer.key === arrangement.sort!.by) : undefined;
  const groupOffer = arrangement.group ? offers.groups.find((offer) => offer.key === arrangement.group!.by) : undefined;
  const ways = directionWords(sortOffer);
  // The lists themselves come when one is first opened (`ArrangeLists`): the line is all a page carries up front.
  const listProps = { schema, graph, offers: { ...offers, filters: menu }, arrangement, set, toggle, has, testId: id };
  // A chip keeps one value of its field: pressed again it lets go; another of the same field takes its place.
  const choose = (key: string, value: string) =>
    has({ key, value })
      ? without(conditions.findIndex((c) => c.key === key && c.value === value))
      : set({ filter: [...conditions.filter((c) => c.key !== key), { key, value }] });
  const sortTrigger = arrangement.sort ? (
    <>
      Sorted by {inSentence(sortOffer?.label ?? arrangement.sort.by)}
      <span aria-hidden="true">{arrangement.sort.direction === "desc" ? " ↓" : " ↑"}</span>
    </>
  ) : (
    "Sort"
  );
  const bucket = arrangement.group?.bucket && groupOffer?.buckets ? `, a ${arrangement.group.bucket} each` : "";
  const groupTrigger = arrangement.group ? `Grouped by ${inSentence(groupOffer?.label ?? arrangement.group.by)}${bucket}` : "Group";

  return (
    <div data-testid={`${id}-bar`} role="group" aria-label="Arrange" className="graview-arrange" style={props.style} onPointerEnter={LISTS.prefetch} onFocus={LISTS.prefetch}>
      <style>{ARRANGE_CSS}</style>
      <div className="graview-arrange-line">
        {count ? (
          <span className="graview-arrange-count" data-testid={`${id}-count`}>
            {count.kept ? <span data-testid={`${id}-kept`}>{count.kept}</span> : null}
            {count.words}
          </span>
        ) : null}
        {past ? (
          <button
            type="button"
            className="graview-arrange-open"
            data-testid={`${id}-past`}
            title={`${numberAsRead(past.count)} more behind the horizon — press to widen the view to the past`}
            onClick={(event) => {
              /*
               * Pressed, it is gone — the past is in view and has nothing more
               * to say — and the keys go on along the line it stood on rather
               * than to nothing (the place's line, drawn again with the past).
               */
              const place = event.currentTarget.closest<HTMLElement>("[data-graview-view]");
              const pressed = event.currentTarget;
              past.widen();
              let frames = 0;
              const land = () => {
                if (document.activeElement !== pressed && document.activeElement !== document.body && pressed.isConnected) return;
                const next = place?.querySelector<HTMLElement>('[role="group"][aria-label="Arrange"] :is(button, input)');
                if (next && next !== pressed && next.isConnected) return next.focus({ preventScroll: true });
                if (++frames < 120) requestAnimationFrame(land);
              };
              requestAnimationFrame(land);
            }}
          >
            +{numberAsRead(past.count)} past
          </button>
        ) : null}
        {/* What is on, beside the count, each a chip that takes itself off. */}
        {conditions.map((condition, at) => {
          const words = sayCondition(schema, graph, offers, condition);
          return (
            <span key={`${condition.key}:${condition.value}`} className="graview-arrange-token" data-testid={`${id}-condition`}>
              {words}
              <button type="button" aria-label={`Remove: ${words}`} title="Remove" onClick={() => without(at)}>
                ×
              </button>
            </span>
          );
        })}
        {canSort ? (
          <span className="graview-arrange-part graview-arrange-one">
            <Choice
              testId={`${id}-sort`}
              value={arrangement.sort?.by ?? ""}
              set={arrangement.sort !== undefined}
              label="Sort"
              name={arrangement.sort ? `Sorted by ${inSentence(sortOffer?.label ?? arrangement.sort.by)}, ${ways[arrangement.sort.direction].toLowerCase()}` : "Sort"}
              list={(done) => <Lists which="sort" done={done} {...listProps} />}
            >
              {sortTrigger}
            </Choice>
          </span>
        ) : null}
        {canGroup ? (
          <span className="graview-arrange-part graview-arrange-one">
            <Choice testId={`${id}-group`} value={arrangement.group?.by ?? ""} set={arrangement.group !== undefined} label="Group" name={groupTrigger} list={(done) => <Lists which="group" done={done} {...listProps} />}>
              {groupTrigger}
            </Choice>
          </span>
        ) : null}
        {canFilter ? (
          <span className="graview-arrange-part">
            <Choice testId={`${id}-add`} value="" set={false} label="Filter" name={conditions.length > 0 ? `Filter — ${conditions.length} on` : "Filter"} list={(done) => <Lists which="filter" done={done} {...listProps} />}>
              Filter
            </Choice>
          </span>
        ) : null}
        {canSort || canGroup ? (
          <span className="graview-arrange-part graview-arrange-all">
            <Choice
              testId={`${id}-all`}
              value=""
              set={false}
              label="Arrange"
              name="Arrange: sort and group"
              list={(done) => <Lists which="all" done={done} parts={{ sort: canSort, group: canGroup, filter: false }} {...listProps} />}
            >
              Arrange
            </Choice>
          </span>
        ) : null}
        {words ? (
          <label className="graview-arrange-words-at">
            <span style={VISUALLY_HIDDEN}>Find</span>
            <input
              type="search"
              className="graview-arrange-words"
              data-testid={`${id}-query`}
              value={arrangement.query ?? ""}
              placeholder="Find…"
              onChange={(event) => set({ query: event.target.value.length > 0 ? event.target.value : undefined })}
            />
          </label>
        ) : null}
        {/* On the line itself, wrapping after its words: a list's first record stays near the top. */}
        {chipped.length > 0 && props.chips ? (
          // The chips come with the lists' module, fetched as the list is first drawn: a lens's line never carries them.
          <Suspense fallback={null}>
            <Chips offers={chipped} chips={props.chips} schema={schema} graph={graph} kind={kind} arrangement={arrangement} has={has} choose={choose} testId={id} />
          </Suspense>
        ) : null}
        {props.end}
      </div>
    </div>
  );
}

/** The count in words, and the part of it that says what the arrangement kept when it kept fewer. */
function countWords(
  noun: ArrangeBarProps["noun"],
  kept: ArrangeBarProps["kept"],
): { readonly words: string; readonly kept?: string } | null {
  if (!kept) return null;
  const narrowed = kept.shown !== kept.of;
  if (!noun) return narrowed ? { words: "", kept: `${kept.shown} of ${kept.of}` } : null;
  const word = kept.of === 1 ? noun.one : noun.many;
  return narrowed ? { words: ` ${word}`, kept: `${kept.shown} of ${kept.of}` } : { words: `${kept.of} ${word}` };
}

/**
 * One word on the line that opens a short list: the trigger is text and a
 * chevron, a box only while hovered, open or holding the keyboard. Its
 * list opens in the top layer (the popover family's habits: one open at a
 * time, the keyboard goes in — to the choice already made — Escape or a
 * press away closes it and gives the keyboard back), and the arrow keys
 * walk it.
 */
function Choice({
  testId,
  value,
  set,
  label,
  name,
  list,
  children,
}: {
  readonly testId: string;
  /** What is chosen, as the trigger's `value`: what a harness reads, as it read a select's. */
  readonly value: string;
  /** Whether it says a choice rather than an invitation. */
  readonly set: boolean;
  /** What the list is called. */
  readonly label: string;
  /** What a screen reader hears for the trigger. */
  readonly name: string;
  readonly list: (done: () => void) => ReactNode;
  readonly children: ReactNode;
}) {
  const popover = usePopover("arrange", { align: "start" });
  const pane = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!popover.open) return;
    // In at the choice already made, when there is one; else the first entry (the family's own rule).
    pane.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }, [popover.open]);
  return (
    <>
      <button
        type="button"
        className="graview-arrange-open"
        data-testid={testId}
        data-set={set ? "" : undefined}
        value={value}
        aria-label={name}
        {...popover.trigger}
        onClick={popover.toggle}
      >
        {children}
        <Chevron />
      </button>
      {popover.open ? (
        <div
          {...popover.pane}
          ref={(element) => {
            popover.pane.ref(element);
            pane.current = element;
          }}
          role="group"
          aria-label={label}
          data-testid="arrange-list"
          data-arrange={testId}
          className="graview-arrange-list"
          style={POPOVER_STYLE}
          onKeyDown={walk}
        >
          {list(() => popover.setOpen(false))}
        </div>
      ) : null}
    </>
  );
}

/** The arrow keys walk a list's entries, Home and End go to its ends. */
function walk(event: KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const stops = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), input")];
  if (stops.length === 0) return;
  const at = stops.indexOf(document.activeElement as HTMLElement);
  // A date box keeps its own arrows: they change the day.
  if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === "date" && (event.key === "ArrowUp" || event.key === "ArrowDown")) return;
  event.preventDefault();
  const next =
    event.key === "Home" ? 0 : event.key === "End" ? stops.length - 1 : event.key === "ArrowDown" ? (at + 1) % stops.length : (at - 1 + stops.length) % stops.length;
  stops[next]!.focus();
}


/** The way a list opens: a chevron drawn, as the place control draws it. */
function Chevron() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" focusable="false" style={{ flex: "0 0 auto", opacity: 0.7 }}>
      <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/*
 * NOTHING HERE MAY WIDEN THE PAGE, and nothing is a box at rest. The line
 * wraps; a long choice wraps inside its words. The line is its own
 * container, so a narrow lens in a wide window is narrow too. 28 pixels
 * is each target's floor (24 is the face's), in every engine: there is no
 * native select left for WebKit to draw at its own height.
 */
const ARRANGE_CSS = `
.graview-arrange{container-type:inline-size;box-sizing:border-box;width:100%;min-width:0;max-width:100%}
.graview-arrange-line{display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px;min-width:0;font-size:.875rem;line-height:1.35;color:var(--graview-ink-muted)}
.graview-arrange-count{margin-right:2px;color:var(--graview-ink-muted)}
.graview-arrange-part{display:inline-flex;align-items:center;min-width:0}
.graview-arrange-count~.graview-arrange-part::before{content:"·" / "";margin-right:6px;color:var(--graview-ink-muted)}
.graview-arrange-open{display:inline-flex;align-items:center;gap:5px;min-height:28px;min-width:0;max-width:100%;margin:0;padding:0 6px;border:1px solid transparent;border-radius:7px;background:none;box-shadow:none;font:inherit;letter-spacing:normal;text-transform:none;text-align:left;color:var(--graview-ink-muted);cursor:pointer}
.graview-arrange-open[data-set]{color:var(--graview-ink)}
.graview-arrange-open:hover,.graview-arrange-open[aria-expanded=true]{border-color:var(--graview-edge);color:var(--graview-ink)}
.graview-arrange :focus-visible,.graview-arrange-list :focus-visible{outline:2px solid var(--graview-accent);outline-offset:1px}
.graview-arrange-all{display:none}
@container (max-width: ${ARRANGE_NARROW - 1}px){.graview-arrange-one{display:none}.graview-arrange-all{display:inline-flex}}
.graview-arrange-token{display:inline-flex;align-items:center;gap:0;min-width:0;min-height:26px;box-sizing:border-box;padding:0 2px 0 10px;border:1px solid var(--graview-edge);border-radius:999px;background:var(--graview-panel);color:var(--graview-ink);overflow-wrap:anywhere}
.graview-arrange-token button{display:inline-flex;align-items:center;justify-content:center;min-width:24px;min-height:24px;margin:0;padding:0;border:0;border-radius:6px;background:none;font:inherit;line-height:1;color:var(--graview-ink-muted);cursor:pointer}
.graview-arrange-token button:hover{color:var(--graview-ink);background:color-mix(in srgb,var(--graview-ink) 7%,transparent)}
.graview-arrange-words-at{display:inline-flex;min-width:0;max-width:100%}
.graview-arrange-words{box-sizing:border-box;width:min(100%,12rem);min-height:28px;margin:0;padding:0 8px;border:1px solid transparent;border-radius:7px;background:transparent;font:inherit;color:var(--graview-ink)}
.graview-arrange-words:hover,.graview-arrange-words:focus{border-color:var(--graview-edge)}
`;


/** A small caption for what an arrangement did, for a surface with no room for the line. */
export function arrangementCaption(arrangement: Arrangement): ReactNode {
  const parts: string[] = [];
  if (arrangement.query) parts.push(`“${arrangement.query}”`);
  if (arrangement.filter?.length) parts.push(`${arrangement.filter.length} condition${arrangement.filter.length === 1 ? "" : "s"}`);
  if (arrangement.group) parts.push(`by ${arrangement.group.by}`);
  if (arrangement.sort) parts.push(`sorted by ${arrangement.sort.by}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
