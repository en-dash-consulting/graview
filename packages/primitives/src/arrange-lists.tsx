import {
  labelOf,
  LOCAL_LAYERS,
  type AnySchema,
  type Arrangeable,
  type ArrangeOffer,
  type Arrangement,
  type ArrangeGraph,
  type ArrangeNode,
  type Condition,
  type DateBucket,
} from "@graview/core";
import { valueWords } from "@graview/core/words";
import { conditionHolds, matches } from "@graview/core/arrange";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { directionWords, inSentence, TYPED_FROM } from "./arrange-bar.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/**
 * THE ARRANGING LINE'S LISTS: what "Sort", "Group", "Filter" and "Arrange"
 * open. Fetched when a list is first opened, or when the pointer or the
 * keyboard comes to the line: a page carries only the line up front.
 */

/**
 * The far ends a menu offers to narrow by. A menu is for choosing, not for
 * reading a catalog: past FAR_ENDS it holds the most connected (the ones a
 * person most likely means), and the search reaches the rest — a select of
 * 1,177 songs was 1,177 elements in every row that offered it (docs/scale.md).
 */
export const FAR_ENDS = 40;

/** How many distinct values a word field may hold and still be offered as a list to pick from. */
const WORD_VALUES = 60;

/** Every value one field holds across a kind. */
function heldValues(graph: ArrangeGraph, kind: string, key: string): readonly unknown[] {
  return graph.allNodes().filter((node) => node.kind === kind).map((node) => (node as unknown as Record<string, unknown>)[key]);
}

/** Four round numbers through the spread of what a list holds: £10,000, £15,000, £25,000 — never £23,995. */
export function roundSteps(values: readonly number[]): readonly number[] {
  if (values.length < 2) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const spread = sorted[sorted.length - 1]! - sorted[0]!;
  if (spread <= 0) return [];
  // Rounded to the spread, not the value: prices to the £5,000, years to the year.
  const unit = Math.max(1, 10 ** Math.floor(Math.log10(spread / 4)));
  const step = spread / 4 >= unit * 5 ? unit * 5 : unit;
  const round = (value: number) => Math.round(value / step) * step;
  return [...new Set([0.2, 0.4, 0.6, 0.8].map((at) => round(sorted[Math.floor(at * (sorted.length - 1))]!)))].filter((value) => value > 0);
}

/** Every record at an offer's far end, by name. */
function everyFarEnd(schema: AnySchema, graph: ArrangeGraph, offer: ArrangeOffer): { id: string; label: string }[] {
  const wanted = new Set(offer.far ?? []);
  const seen = new Map<string, string>();
  for (const node of graph.allNodes()) if (wanted.has(node.kind)) seen.set(node.id, labelOf(schema.tryDefinition(node.kind), node));
  return [...seen.entries()].map(([id, text]) => ({ id, label: text }));
}

function farEndsOf(schema: AnySchema, graph: ArrangeGraph, offer: ArrangeOffer): readonly { id: string; label: string }[] {
  const ends = everyFarEnd(schema, graph, offer);
  const kept =
    ends.length <= FAR_ENDS
      ? ends
      : ends
          .map((end) => ({ end, ties: graph.out(end.id).length + graph.in(end.id).length }))
          .sort((a, b) => b.ties - a.ties || a.end.label.localeCompare(b.end.label))
          .slice(0, FAR_ENDS)
          .map((entry) => entry.end);
  return kept.sort((a, b) => a.label.localeCompare(b.label));
}

/** One way to narrow, as the Filter list offers it: a condition one press adds, or a day still to ask for. */
export interface FilterEntry {
  /** `key:value` — what the entry's button carries as its `value`, for a harness to find it by. */
  readonly value: string;
  readonly label: string;
  /** The offer it is under: its heading in the list. */
  readonly group: string;
  /** The offer's key. */
  readonly key?: string;
  readonly condition?: Condition;
  readonly ask?: { readonly key: string; readonly op: string; readonly label: string };
}

/**
 * Every way to narrow the kind, known up front — a choice's options, `is`'s
 * words, an edge's far ends, a boolean's yes and no, a few round numbers, a
 * word field's few values — so one press adds a condition. A date wants a
 * day, so it is offered as "before…", "after…" and "on…", which ask for it.
 */
export function filterEntries(schema: AnySchema, graph: ArrangeGraph, offers: Arrangeable): readonly FilterEntry[] {
  const entries: FilterEntry[] = [];
  for (const offer of offers.filters) {
    const from = entries.length;
    if (offer.about === "is") {
      for (const word of offer.options ?? []) entries.push({ value: `is:${word}`, label: word, group: offer.label, condition: { key: "is", value: word } });
    } else if (offer.about === "edge") {
      entries.push({ value: `${offer.key}:*`, label: "anything", group: offer.label, condition: { key: offer.key, value: "*" } });
      entries.push({ value: `${offer.key}:none`, label: "nothing", group: offer.label, condition: { key: offer.key, value: "none" } });
      for (const end of farEndsOf(schema, graph, offer)) entries.push({ value: `${offer.key}:${end.id}`, label: end.label, group: offer.label, condition: { key: offer.key, value: end.id } });
    } else if (offer.type === "date") {
      for (const op of ["before", "after", "on"]) entries.push({ value: `${offer.key}:${op}`, label: `${op}…`, group: offer.label, ask: { key: offer.key, op, label: offer.label } });
    } else if (offer.type === "number") {
      // A few round steps through what the list holds: one press, never a number typed blind.
      const definition = schema.tryDefinition(offers.kind);
      const steps = roundSteps(heldValues(graph, offers.kind, offer.key).filter((value): value is number => typeof value === "number"));
      for (const op of ["at-most", "at-least"] as const) {
        for (const step of op === "at-most" ? steps : [...steps].reverse()) {
          entries.push({ value: `${offer.key}:${op}:${step}`, label: `${op === "at-most" ? "at most" : "at least"} ${valueWords(definition, offer.key, step)}`, group: offer.label, condition: { key: offer.key, value: `${op}:${step}` } });
        }
      }
    } else if (offer.type === "text") {
      // A word field by the values it holds — a make, a color — when they are few enough to be a list rather than a name each.
      const held = [...new Set(heldValues(graph, offers.kind, offer.key).filter((value): value is string => typeof value === "string" && value.length > 0 && !value.includes(",")))].sort((a, b) => a.localeCompare(b));
      if (held.length >= 2 && held.length <= WORD_VALUES) {
        for (const word of held) entries.push({ value: `${offer.key}:${word}`, label: word, group: offer.label, condition: { key: offer.key, value: word } });
      }
    } else if (offer.type === "boolean") {
      entries.push({ value: `${offer.key}:true`, label: "yes", group: offer.label, condition: { key: offer.key, value: "true" } });
      entries.push({ value: `${offer.key}:false`, label: "no", group: offer.label, condition: { key: offer.key, value: "false" } });
    } else if (offer.about === "via") {
      // A choice at the far end, in the words its own kind says it in.
      const far = schema.tryDefinition(offer.far?.[0] ?? "");
      for (const option of offer.options ?? []) entries.push({ value: `${offer.key}:${option}`, label: valueWords(far, offer.key.split(".")[1]!, option), group: offer.label, condition: { key: offer.key, value: option } });
    } else {
      for (const option of offer.options ?? []) entries.push({ value: `${offer.key}:${option}`, label: valueWords(schema.tryDefinition(offers.kind), offer.key, option), group: offer.label, condition: { key: offer.key, value: option } });
    }
    for (let at = from; at < entries.length; at++) entries[at] = { ...entries[at]!, key: offer.key };
  }
  return entries;
}

/** One heading of the Filter list: its offer, what it lists, and — for a relation with many records at its far end — every one of them, found by typing. */
export interface FilterSection {
  readonly key: string;
  readonly label: string;
  readonly entries: readonly FilterEntry[];
  readonly typed?: readonly { readonly id: string; readonly label: string }[];
  /** For a number, the entries a number typed in the list's box makes: "at most 30 min", "at least 30 min". */
  readonly atNumber?: (value: number) => readonly FilterEntry[];
}

/** Two entries for a number typed rather than stepped to: at most it, and at least it. */
function numberEntries(schema: AnySchema, kind: string, offer: ArrangeOffer, value: number): readonly FilterEntry[] {
  const definition = schema.tryDefinition(kind);
  return (["at-most", "at-least"] as const).map((op) => ({
    value: `${offer.key}:${op}:${value}`,
    label: `${op === "at-most" ? "at most" : "at least"} ${valueWords(definition, offer.key, value)}`,
    group: offer.label,
    key: offer.key,
    condition: { key: offer.key, value: `${op}:${value}` },
  }));
}

/** A number as a person types it into the list's box: "30", "2.5", "1,200". */
export function typedNumber(words: string): number | null {
  const plain = words.trim().replace(/(?<=\d),(?=\d{3}\b)/g, "");
  return /^-?\d+(\.\d+)?$/.test(plain) ? Number(plain) : null;
}

/**
 * THE FILTER LIST'S SECTIONS. A relation with more than a handful of
 * records at its far end (`TYPED_FROM`) lists only "anything" and
 * "nothing"; its records are found by typing a few letters of a name, and
 * at most eight are listed — ninety feature names in one menu was a list
 * nobody could read.
 */
export function filterSections(schema: AnySchema, graph: ArrangeGraph, offers: Arrangeable): readonly FilterSection[] {
  const entries = filterEntries(schema, graph, offers);
  return offers.filters.flatMap((offer): FilterSection[] => {
    const own = entries.filter((entry) => entry.key === offer.key);
    // A number is offered whatever steps its records make: it can be typed (the tenth walk).
    if (offer.type === "number" && offer.about !== "edge") return [{ key: offer.key, label: offer.label, entries: own, atNumber: (value) => numberEntries(schema, offers.kind, offer, value) }];
    if (own.length === 0) return [];
    if (offer.about !== "edge") return [{ key: offer.key, label: offer.label, entries: own }];
    const far = everyFarEnd(schema, graph, offer);
    if (far.length < TYPED_FROM) return [{ key: offer.key, label: offer.label, entries: own }];
    return [{ key: offer.key, label: offer.label, entries: own.filter((entry) => entry.value === `${offer.key}:*` || entry.value === `${offer.key}:none`), typed: [...far].sort((a, b) => a.label.localeCompare(b.label)) }];
  });
}

/** At most this many records a typed relation lists for what was typed. */
export const TYPED_MATCHES = 8;

/** The far records whose names hold what was typed, those that begin with it first, at most `TYPED_MATCHES`. */
export function typedMatches(far: readonly { readonly id: string; readonly label: string }[], typed: string): { readonly shown: readonly { readonly id: string; readonly label: string }[]; readonly more: number } {
  const words = typed.trim().toLocaleLowerCase();
  if (!words) return { shown: [], more: 0 };
  const found = far.filter((end) => end.label.toLocaleLowerCase().includes(words));
  const ranked = [...found].sort((a, b) => Number(!a.label.toLocaleLowerCase().startsWith(words)) - Number(!b.label.toLocaleLowerCase().startsWith(words)));
  return { shown: ranked.slice(0, TYPED_MATCHES), more: Math.max(0, ranked.length - TYPED_MATCHES) };
}

const BUCKETS: readonly DateBucket[] = ["day", "week", "month", "year", "decade"];

export interface ListsProps {
  readonly which: "sort" | "group" | "filter" | "all";
  readonly parts?: { readonly sort: boolean; readonly group: boolean; readonly filter: boolean };
  readonly schema: AnySchema;
  readonly graph: ArrangeGraph;
  readonly offers: Arrangeable;
  readonly arrangement: Arrangement;
  readonly set: (patch: Partial<Arrangement>) => void;
  readonly toggle: (condition: Condition) => void;
  readonly has: (condition: Condition) => boolean;
  readonly testId: string;
  readonly done: () => void;
}

/** One list, or on a narrow line all three; the keyboard to the choice made once it is drawn. */
export function ArrangeLists(props: ListsProps) {
  const { which, schema, graph, offers, arrangement, set, toggle, has, done } = props;
  const id = props.testId;
  const here = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Arrived after the list opened: the keyboard is on the pane, so it goes to the choice made, else the first entry.
    const pane = here.current?.closest<HTMLElement>("[data-graview-popover]");
    if (!pane || document.activeElement !== pane) return;
    (pane.querySelector<HTMLElement>('[aria-pressed="true"]') ?? pane.querySelector<HTMLElement>("button, input"))?.focus({ preventScroll: true });
  }, []);
  const sortOffer = arrangement.sort ? offers.sorts.find((offer) => offer.key === arrangement.sort!.by) : undefined;
  const groupOffer = arrangement.group ? offers.groups.find((offer) => offer.key === arrangement.group!.by) : undefined;
  const ways = directionWords(sortOffer);
  const natural = offers.natural ? offers.sorts.find((offer) => offer.key === offers.natural!.by) : undefined;
  const sections = which === "filter" || (which === "all" && props.parts?.filter) ? filterSections(schema, graph, offers) : [];

  const sortList = (done: () => void) => (
    <>
      <p>Sort by</p>
      <Item testId={`${id}-sort-default`} value="" on={!arrangement.sort} onPress={() => (set({ sort: undefined }), done())}>
        {natural ? `As declared (${inSentence(natural.label)})` : "As they were added"}
      </Item>
      {offers.sorts.map((offer) => (
        <Item key={offer.key} value={offer.key} on={arrangement.sort?.by === offer.key} onPress={() => (set({ sort: { by: offer.key, direction: arrangement.sort?.direction ?? "asc" } }), done())}>
          {offer.label}
        </Item>
      ))}
      {arrangement.sort ? (
        <div role="group" aria-label="Order" data-testid={`${id}-direction`}>
          <p aria-hidden="true">Order</p>
          {(["asc", "desc"] as const).map((direction) => (
            <Item key={direction} testId={`${id}-direction-${direction}`} value={direction} on={arrangement.sort!.direction === direction} onPress={() => (set({ sort: { by: arrangement.sort!.by, direction } }), done())}>
              {ways[direction]}
            </Item>
          ))}
        </div>
      ) : null}
    </>
  );
  const groupList = (done: () => void) => (
    <>
      <p>Group by</p>
      <Item testId={`${id}-group-none`} value="" on={!arrangement.group} onPress={() => (set({ group: undefined }), done())}>
        Not grouped
      </Item>
      {offers.groups.map((offer) => (
        <Item key={offer.key} value={offer.key} on={arrangement.group?.by === offer.key} onPress={() => (set({ group: { by: offer.key } }), done())}>
          {offer.label}
        </Item>
      ))}
      {arrangement.group && groupOffer?.buckets ? (
        <div role="group" aria-label="How wide a group is" data-testid={`${id}-bucket`}>
          <p aria-hidden="true">Each group</p>
          {BUCKETS.map((bucket) => (
            <Item key={bucket} testId={`${id}-bucket-${bucket}`} value={bucket} on={(arrangement.group!.bucket ?? "day") === bucket} onPress={() => (set({ group: { by: arrangement.group!.by, bucket } }), done())}>
              {`A ${bucket}`}
            </Item>
          ))}
        </div>
      ) : null}
    </>
  );
  const filterList = (done: () => void) => <FilterList sections={sections} has={has} testId={id} onToggle={(condition) => (toggle(condition), done())} />;

  const parts = props.parts ?? { sort: true, group: true, filter: true };
  return (
    <div ref={here} style={{ display: "contents" }}>
      <style>{LIST_CSS}</style>
      {which === "sort" ? sortList(done) : which === "group" ? groupList(done) : which === "filter" ? filterList(done) : (
        <>
          {parts.sort ? <div role="group" aria-label="Sort">{sortList(done)}</div> : null}
          {parts.group ? <div role="group" aria-label="Group">{groupList(done)}</div> : null}
          {parts.filter ? <div role="group" aria-label="Filter">{filterList(done)}</div> : null}
        </>
      )}
    </div>
  );
}

/** One entry of a list: its words, and whether it is the choice made. */
function Item({ value, on, onPress, testId, children }: { readonly value: string; readonly on: boolean; readonly onPress: () => void; readonly testId?: string; readonly children: ReactNode }) {
  return (
    <button type="button" className="graview-arrange-item" value={value} data-value={value} aria-pressed={on} onClick={onPress} {...(testId ? { "data-testid": testId } : {})}>
      {children}
    </button>
  );
}

/**
 * THE WAYS TO NARROW, under their offers' names — each a heading that
 * opens it, so the list opens short however much the app holds; a box at
 * the top, which stays as the list scrolls, finds any of them, and any
 * record at a relation's far end, by a few letters. A condition already on
 * is pressed, and pressing it takes it off; a heading says how many of its
 * own are on. A date's "before…" asks for its day in the list itself, with
 * the browser's own date control — added by Enter or "Add", let go by
 * Escape or "Never mind".
 */
function FilterList({ sections, has, testId, onToggle }: { readonly sections: readonly FilterSection[]; readonly has: (condition: Condition) => boolean; readonly testId: string; readonly onToggle: (condition: Condition) => void }) {
  const [asking, setAsking] = useState<FilterEntry["ask"] | null>(null);
  const [find, setFind] = useState("");
  // One heading is opened already: there is nothing to choose between.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(sections.length === 1 ? [sections[0]!.key] : []));
  const [typed, setTyped] = useState<Readonly<Record<string, string>>>({});
  if (asking) {
    return <AskDay ask={asking} testId={testId} onDay={(day) => onToggle({ key: asking.key, value: `${asking.op}:${day}` })} onCancel={() => setAsking(null)} />;
  }
  const item = (entry: FilterEntry) => (
    <Item key={entry.value} value={entry.value} on={entry.condition ? has(entry.condition) : false} onPress={() => (entry.condition ? onToggle(entry.condition) : setAsking(entry.ask!))}>
      {entry.label}
    </Item>
  );
  const far = (section: FilterSection, words: string) => {
    const on = (section.typed ?? []).filter((end) => has({ key: section.key, value: end.id }));
    const found = typedMatches(section.typed ?? [], words);
    const shown = [...on, ...found.shown.filter((end) => !on.includes(end))];
    return (
      <>
        {shown.map((end) => item({ value: `${section.key}:${end.id}`, label: end.label, group: section.label, key: section.key, condition: { key: section.key, value: end.id } }))}
        {words.trim() && found.shown.length === 0 ? <span className="graview-arrange-none">None is called that.</span> : null}
        {found.more > 0 ? <span className="graview-arrange-none">{`${found.more} more — type more of the name`}</span> : null}
      </>
    );
  };
  const looking = find.trim().toLocaleLowerCase();
  return (
    <>
      <label className="graview-arrange-find">
        <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Find a filter</span>
        <input type="search" data-testid={`${testId}-filter-find`} value={find} placeholder="Find a filter, a name or a number…" onChange={(event) => setFind(event.target.value)} />
      </label>
      {sections.map((section) => {
        const on = section.entries.filter((entry) => entry.condition && has(entry.condition)).length + (section.typed ?? []).filter((end) => has({ key: section.key, value: end.id })).length;
        if (looking) {
          // What was typed, across every heading: the heading's own entries whose words hold it, or all of them when the heading's does.
          const whole = section.label.toLocaleLowerCase().includes(looking);
          /*
           * A NUMBER TYPED IS A NUMBER TO NARROW BY (the tenth walk): "30"
           * offers "Length: at most 30 min" and "at least" first, in one key,
           * where stepping to it was a heading and a walk down its steps.
           */
          const typed = section.atNumber && typedNumber(looking) !== null ? section.atNumber(typedNumber(looking)!) : [];
          const entries = [...typed, ...(whole ? section.entries : section.entries.filter((entry) => entry.label.toLocaleLowerCase().includes(looking) && !typed.some((one) => one.value === entry.value)))];
          const ends = section.typed ? typedMatches(section.typed, looking) : { shown: [], more: 0 };
          if (entries.length === 0 && ends.shown.length === 0) return null;
          return (
            <div key={section.key} role="group" aria-label={section.label} data-section={section.key}>
              <p aria-hidden="true">{section.label}</p>
              {entries.map(item)}
              {section.typed ? far(section, looking) : null}
            </div>
          );
        }
        // A number with no steps of its own is found by typing it, and has nothing to open.
        if (section.entries.length === 0 && !section.typed) return null;
        const opened = open.has(section.key);
        return (
          <div key={section.key} role="group" aria-label={section.label} data-section={section.key}>
            <button
              type="button"
              className="graview-arrange-section"
              data-testid={`${testId}-section`}
              data-key={section.key}
              aria-expanded={opened}
              onClick={() => setOpen((was) => (was.has(section.key) ? new Set([...was].filter((key) => key !== section.key)) : new Set([...was, section.key])))}
            >
              <span>{section.label}</span>
              {on > 0 ? <span className="graview-arrange-on">{`${on} on`}</span> : null}
            </button>
            {opened ? (
              <>
                {section.typed ? (
                  <input
                    type="search"
                    className="graview-arrange-far"
                    data-testid={`${testId}-far-find`}
                    data-key={section.key}
                    aria-label={`${section.label}: type a name`}
                    placeholder={`Type a name (${section.typed.length})…`}
                    autoFocus
                    value={typed[section.key] ?? ""}
                    onChange={(event) => setTyped({ ...typed, [section.key]: event.target.value })}
                  />
                ) : null}
                {section.entries.map(item)}
                {section.typed ? far(section, typed[section.key] ?? "") : null}
              </>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

/*
 * WHICH DAY, ASKED IN THE FILTER ITSELF. "Due before…" opened the browser's
 * own prompt — "which day? (YYYY-MM-DD)" — a box over the whole page that
 * asked a person to type the stored format. The day is asked in the list
 * that wanted it, with the browser's own date control, and added by Enter
 * or "Add"; Escape or "Never mind" lets it go.
 */
function AskDay({ ask, testId, onDay, onCancel }: { readonly ask: { key: string; op: string; label: string }; readonly testId: string; readonly onDay: (day: string) => void; readonly onCancel: () => void }) {
  const [day, setDay] = useState("");
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day) && Number(day.slice(0, 4)) >= 1000;
  const add = () => {
    if (valid) onDay(day);
  };
  return (
    <div role="group" aria-label={`${ask.label} ${ask.op} which day`} data-testid={`${testId}-ask-day`} className="graview-arrange-ask">
      <p aria-hidden="true">{`${ask.label} ${ask.op}`}</p>
      <input
        type="date"
        data-testid={`${testId}-day`}
        aria-label={`${ask.label} ${ask.op} which day`}
        autoFocus
        value={day}
        onChange={(event) => setDay(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          } else if (event.key === "Escape") {
            // Back to the list, not out of it: the popover's own Escape is for the list.
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation();
            onCancel();
          }
        }}
      />
      <span>
        <button type="button" data-testid={`${testId}-day-add`} disabled={!valid} onClick={add}>
          Add
        </button>
        <button type="button" onClick={onCancel}>
          Never mind
        </button>
      </span>
    </div>
  );
}

/*
 * OPAQUE, HELD TO THE WINDOW, A SHEET ON A PHONE. The list is laid over the
 * panel's own color, so a brand's translucent float never lets the records
 * show through; it stops at most 520 pixels tall and scrolls inside itself,
 * its box to find a filter standing at its top; on a phone it is a sheet
 * along the window's foot, the width of the window.
 */
const LIST_CSS = `
.graview-arrange-list{display:grid;align-content:start;width:min(300px,calc(100vw - 24px));height:auto;max-height:min(70vh,520px);overflow:auto;overscroll-behavior:contain;margin:0;padding:0 6px 6px;border-radius:10px;border:1px solid var(--graview-edge);background:linear-gradient(var(--graview-float),var(--graview-float)),var(--graview-panel);box-shadow:var(--graview-lift-high);color:var(--graview-ink);font-size:.875rem;line-height:1.3}
.graview-arrange-list>*:first-child:not(.graview-arrange-find){margin-top:6px}
@media (max-width:519px){.graview-arrange-list{left:0!important;right:0!important;top:auto!important;bottom:0!important;width:100%!important;max-height:min(80dvh,560px)!important;border-radius:14px 14px 0 0;padding-bottom:calc(10px + env(safe-area-inset-bottom))}}
.graview-arrange-find{position:sticky;top:0;z-index:${LOCAL_LAYERS.raised};display:block;margin:0 -6px 2px;padding:6px;background:linear-gradient(var(--graview-float),var(--graview-float)),var(--graview-panel);border-bottom:1px solid var(--graview-edge)}
.graview-arrange-find input,.graview-arrange-far{box-sizing:border-box;width:100%;min-height:32px;margin:0;padding:0 8px;border:1px solid var(--graview-edge);border-radius:7px;background:var(--graview-panel);font:inherit;color:var(--graview-ink)}
.graview-arrange-far{width:calc(100% - 16px);margin:2px 8px 4px}
.graview-arrange-section{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:32px;margin:0;padding:6px 8px;border:0;border-radius:7px;background:none;font:inherit;font-weight:600;text-align:left;color:var(--graview-ink);cursor:pointer}
.graview-arrange-section::after{content:"";flex:0 0 7px;height:7px;margin-left:auto;border:solid var(--graview-ink-muted);border-width:0 1.5px 1.5px 0;transform:rotate(-45deg)}
.graview-arrange-section[aria-expanded=true]::after{transform:rotate(45deg)}
.graview-arrange-section:hover{background:color-mix(in srgb,var(--graview-ink) 7%,transparent)}
.graview-arrange-on{font-weight:400;color:var(--graview-accent)}
.graview-arrange-none{display:block;padding:4px 8px 6px 28px;color:var(--graview-ink-muted)}
.graview-arrange-list [role=group]{display:grid}
.graview-arrange-list p{margin:8px 8px 2px;font-size:.6875rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--graview-ink-muted)}
.graview-arrange-item{display:flex;align-items:flex-start;gap:8px;width:100%;min-height:30px;margin:0;padding:6px 8px;border:0;border-radius:7px;background:none;font:inherit;text-align:left;color:var(--graview-ink);cursor:pointer;overflow-wrap:anywhere}
.graview-arrange-item::before{content:"";flex:0 0 12px}
.graview-arrange-item[aria-pressed=true]{font-weight:600}
.graview-arrange-item[aria-pressed=true]::before{content:"✓";color:var(--graview-accent)}
.graview-arrange-item:hover{background:color-mix(in srgb,var(--graview-ink) 7%,transparent)}
.graview-arrange-ask{display:grid;gap:8px;padding:0 8px 8px}
.graview-arrange-ask p{margin:8px 0 0}
.graview-arrange-ask input{box-sizing:border-box;width:100%;min-height:32px;padding:0 8px;border:1px solid var(--graview-edge);border-radius:7px;background:var(--graview-panel);font:inherit;color:var(--graview-ink)}
.graview-arrange-ask span{display:flex;gap:8px}
.graview-arrange-ask button{min-height:30px;padding:0 12px;border:1px solid var(--graview-edge);border-radius:7px;background:var(--graview-panel);font:inherit;color:var(--graview-ink);cursor:pointer}
.graview-arrange-ask button:disabled{opacity:.5;cursor:default}
`;

/**
 * A CHOICE FIELD AS CHIPS, ALWAYS IN VIEW: each value with how many records
 * it would keep among the rest of what is asked — "Open 12", "Building 4" —
 * so a status filter is one press, not a menu, a heading and an entry. A
 * value no record would keep is left off, unless it is the one pressed.
 */
export function ArrangeChips({ offers, chips, schema, graph, kind, arrangement, has, choose, testId }: ChipsProps) {
  return (
    <>
      <style>{CHIP_CSS}</style>
      <ChipRows offers={offers} chips={chips} schema={schema} graph={graph} kind={kind} arrangement={arrangement} has={has} choose={choose} testId={testId} />
    </>
  );
}

/** What the chips are handed: the offers they stand for, the records they count, and the line's own ways to say what is on. */
export interface ChipsProps {
  readonly offers: readonly ArrangeOffer[];
  readonly chips: { readonly nodes: readonly ArrangeNode[]; readonly flagged?: ReadonlySet<string>; readonly today?: string };
  readonly schema: AnySchema;
  readonly graph: ArrangeGraph;
  readonly kind: string;
  readonly arrangement: Arrangement;
  readonly has: (condition: Condition) => boolean;
  readonly choose: (key: string, value: string) => void;
  readonly testId: string;
}

function ChipRows({ offers, chips, schema, graph, kind, arrangement, has, choose, testId }: ChipsProps) {
  const ctx = { schema, graph, ...(chips.flagged ? { flagged: chips.flagged } : {}), ...(chips.today ? { today: chips.today } : {}) };
  const definition = schema.tryDefinition(kind);
  const asked = chips.nodes.filter((node) => !arrangement.query || matches(ctx, node, arrangement.query));
  return (
    <div className="graview-arrange-chips" data-testid={`${testId}-chips`}>
      {offers.map((offer) => {
        const others = (arrangement.filter ?? []).filter((condition) => condition.key !== offer.key);
        const counts = new Map<string, number>();
        for (const node of asked) {
          if (!others.every((condition) => conditionHolds(ctx, node, condition))) continue;
          const value = String((node as unknown as Record<string, unknown>)[offer.key]);
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        return (
          <div key={offer.key} role="group" aria-label={offer.label} className="graview-arrange-chip-row" data-field={offer.key}>
            <span className="graview-arrange-chip-label" aria-hidden="true">
              {offer.label}
            </span>
            {(offer.options ?? [])
              .filter((option) => (counts.get(option) ?? 0) > 0 || has({ key: offer.key, value: option }))
              .map((option) => {
                const words = valueWords(definition, offer.key, option);
                const many = counts.get(option) ?? 0;
                return (
                  <button
                    key={option}
                    type="button"
                    className="graview-arrange-chip"
                    data-testid={`${testId}-chip`}
                    data-value={`${offer.key}:${option}`}
                    aria-pressed={has({ key: offer.key, value: option })}
                    aria-label={`${offer.label}: ${words}, ${many}`}
                    onClick={() => choose(offer.key, option)}
                  >
                    {words}
                    <span className="graview-arrange-chip-count" aria-hidden="true">
                      {many}
                    </span>
                  </button>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}

const CHIP_CSS = `
.graview-arrange-chips,.graview-arrange-chip-row{display:contents}
@container (max-width:519px){.graview-arrange-chips{display:flex;flex:1 1 10rem;align-items:center;gap:6px;min-width:0;overflow-x:auto;scrollbar-width:none}.graview-arrange-chip-label{margin:0}.graview-arrange-chip{flex:0 0 auto;white-space:nowrap}}
.graview-arrange-chip-label{margin:0 0 0 8px;font-size:.8125rem;color:var(--graview-ink-muted)}
.graview-arrange-chip{display:inline-flex;align-items:center;gap:6px;min-height:28px;max-width:100%;box-sizing:border-box;margin:0;padding:0 10px;border:1px solid var(--graview-edge);border-radius:999px;background:var(--graview-panel);font:inherit;font-size:.8125rem;line-height:1.2;color:var(--graview-ink);cursor:pointer;overflow-wrap:anywhere;text-align:left}
.graview-arrange-chip:hover{border-color:var(--graview-edge-bright,var(--graview-edge))}
.graview-arrange-chip[aria-pressed=true]{border-color:var(--graview-accent);background:color-mix(in srgb,var(--graview-accent) 12%,var(--graview-panel));font-weight:600}
.graview-arrange-chip-count{color:var(--graview-ink-muted);font-variant-numeric:tabular-nums;font-weight:400}
`;
