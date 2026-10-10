import {
  labelOf,
  valueWords,
  type AnySchema,
  type Arrangeable,
  type ArrangeOffer,
  type Arrangement,
  type ArrangeGraph,
  type Condition,
  type DateBucket,
} from "@graview/core";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { directionWords, inSentence } from "./arrange-bar.js";

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

function farEndsOf(schema: AnySchema, graph: ArrangeGraph, offer: ArrangeOffer): readonly { id: string; label: string }[] {
  const kinds = offer.far ?? [];
  const seen = new Map<string, string>();
  const wanted = new Set(kinds);
  for (const node of graph.allNodes()) {
    if (!wanted.has(node.kind)) continue;
    seen.set(node.id, labelOf(schema.tryDefinition(node.kind), node));
  }
  const ends = [...seen.entries()].map(([id, text]) => ({ id, label: text }));
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
    } else {
      for (const option of offer.options ?? []) entries.push({ value: `${offer.key}:${option}`, label: valueWords(schema.tryDefinition(offers.kind), offer.key, option), group: offer.label, condition: { key: offer.key, value: option } });
    }
  }
  return entries;
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
  const entries = which === "filter" || (which === "all" && props.parts?.filter) ? filterEntries(schema, graph, offers) : [];

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
  const filterList = (done: () => void) => <FilterList entries={entries} has={has} testId={id} onToggle={(condition) => (toggle(condition), done())} />;

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
 * THE WAYS TO NARROW, under their offers' names. A condition already on is
 * pressed, and pressing it takes it off. A date's "before…" asks for its
 * day in the list itself, with the browser's own date control — added by
 * Enter or "Add", let go by Escape or "Never mind".
 */
function FilterList({ entries, has, testId, onToggle }: { readonly entries: readonly FilterEntry[]; readonly has: (condition: Condition) => boolean; readonly testId: string; readonly onToggle: (condition: Condition) => void }) {
  const [asking, setAsking] = useState<FilterEntry["ask"] | null>(null);
  if (asking) {
    return <AskDay ask={asking} testId={testId} onDay={(day) => onToggle({ key: asking.key, value: `${asking.op}:${day}` })} onCancel={() => setAsking(null)} />;
  }
  const groups = [...new Set(entries.map((entry) => entry.group))];
  return (
    <>
      {groups.map((group) => (
        <div key={group} role="group" aria-label={group}>
          <p aria-hidden="true">{group}</p>
          {entries
            .filter((entry) => entry.group === group)
            .map((entry) => (
              <Item key={entry.value} value={entry.value} on={entry.condition ? has(entry.condition) : false} onPress={() => (entry.condition ? onToggle(entry.condition) : setAsking(entry.ask!))}>
                {entry.label}
              </Item>
            ))}
        </div>
      ))}
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

const LIST_CSS = `
.graview-arrange-list{display:grid;align-content:start;width:min(300px,calc(100vw - 24px));height:auto;max-height:min(70vh,520px);overflow:auto;margin:0;padding:6px;border-radius:10px;border:1px solid var(--graview-edge);background:var(--graview-float);box-shadow:var(--graview-lift-high);color:var(--graview-ink);font-size:.875rem;line-height:1.3}
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
