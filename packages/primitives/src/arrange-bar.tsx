import { arrangeAllows, arrangeable, formatArrangement } from "@graview/core/arrange";
import {
  labelOf,
  valueWords,
  type AnySchema,
  type Arrangeable,
  type ArrangeOffer,
  type ArrangeOption,
  type Arrangement,
  type ArrangeGraph,
  type Condition,
  type DateBucket,
} from "@graview/core";
import type { CSSProperties, ReactNode } from "react";
import { VISUALLY_HIDDEN } from "./primitives/measure.js";
export { arrangementOf, withArrangement } from "./arrangement.js";

/**
 * ONE CONTROL ROW FOR EVERY SURFACE THAT ARRANGES.
 *
 * The list page had a group-by select of its own, the todo app's own page
 * had three, the lenses had none. The offers come from the declaration
 * (`arrangeable`), the chosen arrangement is a string in the stop, and
 * this draws the row between them: Sort by, Group by, the conditions as
 * chips with a way to add one, and the words a person types. Whatever
 * carries the arrangement — a page's search, a lens's `within` — hands the
 * current one in and takes the next one back; nothing here holds state.
 */

export interface ArrangeBarProps {
  readonly schema: AnySchema;
  readonly graph: ArrangeGraph;
  readonly kind: string;
  readonly arrangement: Arrangement;
  readonly onChange: (next: Arrangement) => void;
  /** What the surface declines, if anything. Everything is on unless declined. */
  readonly allow?: ArrangeOption;
  /** Whether to draw the words box. On unless declined. */
  readonly query?: boolean;
  /** How many the arrangement kept, of how many there were — said beside the row when given. */
  readonly kept?: { readonly shown: number; readonly of: number };
  /** Prefix for the row's test ids: `arrange` by default. */
  readonly testId?: string;
  readonly style?: CSSProperties;
}

/*
 * NOTHING HERE MAY WIDEN THE PAGE. A select is as wide as its longest
 * option, and at a reader's own text size — 32px root on a 390px phone —
 * "as declared (due date)" alone pushed the tasks page sideways. Every
 * control caps at the row's width and the row wraps; a long option is cut
 * inside its box rather than carried outside it.
 */
const control: CSSProperties = {
  font: "inherit",
  fontSize: "0.875rem",
  minHeight: 32,
  minWidth: 0,
  maxWidth: "100%",
  padding: "4px 8px",
  borderRadius: 8,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
  textOverflow: "ellipsis",
};
/*
 * A SELECT THAT KEEPS ITS FLOOR IN EVERY ENGINE. WebKit draws a native
 * select at its own height and ignores `min-height`: at phone width every
 * arrange bar's select was 22 pixels tall in WebKit and 32 elsewhere —
 * under the 24 a target needs, measured by a check that had only ever run
 * in Chromium (the third walk's lesson, in the fifth). With the native
 * appearance off the floor holds, and the chevron is drawn in the text's
 * color the way the places menu draws it.
 */
const choice: CSSProperties = {
  ...control,
  appearance: "none",
  WebkitAppearance: "none",
  paddingRight: 24,
  backgroundImage: "linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)",
  backgroundPosition: "calc(100% - 13px) 55%, calc(100% - 9px) 55%",
  backgroundSize: "4px 4px, 4px 4px",
  backgroundRepeat: "no-repeat",
};
const label: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 6,
  minWidth: 0,
  maxWidth: "100%",
  fontSize: "0.875rem",
  color: "var(--graview-ink-muted)",
};
const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 28,
  padding: "0 2px 0 10px",
  borderRadius: 999,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
  fontSize: "0.8125rem",
};

/** The far ends an edge condition may name, from the graph. */
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

/** A condition in words: "Due date before 2026-10-01", "The list it is on: Today", "Past". */
export function sayCondition(schema: AnySchema, graph: ArrangeGraph, offers: Arrangeable, condition: Condition): string {
  const offer = offers.filters.find((candidate) => candidate.key === condition.key);
  if (!offer) return `${condition.key}: ${condition.value}`;
  if (offer.about === "is") return condition.value.charAt(0).toUpperCase() + condition.value.slice(1);
  if (offer.about === "edge") {
    if (condition.value === "*") return `${offer.label}: anything`;
    if (condition.value === "none") return `${offer.label}: nothing`;
    const node = graph.getNode(condition.value);
    return `${offer.label}: ${node ? labelOf(schema.tryDefinition(node.kind), node) : condition.value}`;
  }
  if (offer.type === "date") {
    const [op, date] = condition.value.split(":");
    return `${offer.label} ${op} ${date ?? ""}`.trim();
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

/** What each bar last sent, by its test id and kind (see `ArrangeBar`). */
const SENT = new Map<string, { words: Set<string>; latest: Arrangement | null; at: number }>();

export function ArrangeBar(props: ArrangeBarProps) {
  const { schema, graph, kind, arrangement: given, onChange } = props;
  const offers = arrangeable(schema, kind);
  const id = props.testId ?? "arrange";
  const sorts = arrangeAllows(props.allow, "sort");
  const groups = arrangeAllows(props.allow, "group");
  const filters = arrangeAllows(props.allow, "filter");
  const words = props.query !== false;
  if (!sorts && !groups && !filters && !words) return null;

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
  // What the controls show: what the bar last sent while what comes back is its echo.
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
  const add = (condition: Condition) => set({ filter: [...conditions.filter((c) => !(c.key === condition.key && c.value === condition.value)), condition] });

  return (
    <div
      data-testid={`${id}-bar`}
      role="group"
      aria-label="Arrange"
      style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 14px", minWidth: 0, maxWidth: "100%", ...props.style }}
    >
      {words ? (
        <label style={label}>
          <span className="graview-visually-hidden" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            Find
          </span>
          <input
            type="search"
            data-testid={`${id}-query`}
            value={arrangement.query ?? ""}
            placeholder="Find…"
            onChange={(event) => set({ query: event.target.value.length > 0 ? event.target.value : undefined })}
            style={{ ...control, width: "min(100%, 220px)" }}
          />
        </label>
      ) : null}
      {sorts && offers.sorts.length > 1 ? (
        <label style={label}>
          Sort by
          <select
            data-testid={`${id}-sort`}
            value={arrangement.sort?.by ?? ""}
            onChange={(event) =>
              set({
                sort: event.target.value ? { by: event.target.value, direction: arrangement.sort?.direction ?? "asc" } : undefined,
              })
            }
            style={{ ...choice, maxWidth: "min(100%, 60vw)" }}
          >
            <option value="">{offers.natural ? `as declared (${offers.sorts.find((o) => o.key === offers.natural!.by)?.label.toLowerCase() ?? offers.natural.by})` : "as they come"}</option>
            {offers.sorts.map((offer) => (
              <option key={offer.key} value={offer.key}>
                {offer.label}
              </option>
            ))}
          </select>
          {arrangement.sort ? (
            <button
              type="button"
              data-testid={`${id}-direction`}
              aria-label={arrangement.sort.direction === "asc" ? "Ascending; press for descending" : "Descending; press for ascending"}
              title={arrangement.sort.direction === "asc" ? "Ascending" : "Descending"}
              onClick={() => set({ sort: { by: arrangement.sort!.by, direction: arrangement.sort!.direction === "asc" ? "desc" : "asc" } })}
              style={{ ...control, minWidth: 32, cursor: "pointer" }}
            >
              {arrangement.sort.direction === "asc" ? "↑" : "↓"}
            </button>
          ) : null}
        </label>
      ) : null}
      {groups && offers.groups.length > 0 ? (
        <label style={label}>
          Group by
          <select
            data-testid={`${id}-group`}
            value={arrangement.group?.by ?? ""}
            onChange={(event) => set({ group: event.target.value ? { by: event.target.value } : undefined })}
            style={{ ...choice, maxWidth: "min(100%, 60vw)" }}
          >
            <option value="">nothing</option>
            {offers.groups.map((offer) => (
              <option key={offer.key} value={offer.key}>
                {offer.label}
              </option>
            ))}
          </select>
          {arrangement.group && offers.groups.find((offer) => offer.key === arrangement.group!.by)?.buckets ? (
            <select
              data-testid={`${id}-bucket`}
              aria-label="How wide a group is"
              value={arrangement.group.bucket ?? "day"}
              onChange={(event) => set({ group: { by: arrangement.group!.by, bucket: event.target.value as DateBucket } })}
              style={choice}
            >
              <option value="day">by day</option>
              <option value="week">by week</option>
              <option value="month">by month</option>
              <option value="year">by year</option>
              <option value="decade">by decade</option>
            </select>
          ) : null}
        </label>
      ) : null}
      {filters && offers.filters.length > 0 ? (
        <AddCondition schema={schema} graph={graph} offers={offers} testId={id} onAdd={add} />
      ) : null}
      {filters
        ? conditions.map((condition, at) => (
            <span key={`${condition.key}:${condition.value}`} style={chip} data-testid={`${id}-condition`}>
              {sayCondition(schema, graph, offers, condition)}
              <button
                type="button"
                aria-label={`Remove: ${sayCondition(schema, graph, offers, condition)}`}
                onClick={() => without(at)}
                // A control big enough to hit: 24px is the floor the face is held to, and a bare "×" glyph is 16 by 13.
                style={{ font: "inherit", border: 0, background: "transparent", color: "inherit", cursor: "pointer", padding: 0, lineHeight: 1, minWidth: 24, minHeight: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999 }}
              >
                ×
              </button>
            </span>
          ))
        : null}
      {props.kept && props.kept.shown !== props.kept.of ? (
        <span data-testid={`${id}-kept`} style={{ ...label, marginLeft: "auto" }}>
          {props.kept.shown} of {props.kept.of}
        </span>
      ) : null}
    </div>
  );
}

/**
 * "Add a condition": one select naming the offer, then — for what needs a
 * value — a second control for it. Two presses, and the chip appears.
 */
function AddCondition({
  schema,
  graph,
  offers,
  testId,
  onAdd,
}: {
  schema: AnySchema;
  graph: ArrangeGraph;
  offers: Arrangeable;
  testId: string;
  onAdd: (condition: Condition) => void;
}) {
  /*
   * Every offer's values are known up front — a choice's options, `is`'s
   * words, an edge's far ends, a boolean's yes and no — so the whole set is
   * one grouped select and one press adds a chip. A date wants typing, so
   * it is listed as three entries that ask for the date when chosen.
   */
  const entries: { value: string; label: string; group: string; condition?: Condition; ask?: { key: string; op: string; label: string } }[] = [];
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
  const groups = [...new Set(entries.map((entry) => entry.group))];
  return (
    <label style={label}>
      {/* Said once, by the choice itself ("Only…"), not by a label beside a choice that says it again. */}
      <span style={VISUALLY_HIDDEN}>Only</span>
      <select
        data-testid={`${testId}-add`}
        value=""
        onChange={(event) => {
          const entry = entries.find((candidate) => candidate.value === event.target.value);
          if (!entry) return;
          if (entry.condition) onAdd(entry.condition);
          else if (entry.ask) {
            const date = typeof window !== "undefined" ? window.prompt(`${entry.ask.label} ${entry.ask.op} which day? (YYYY-MM-DD)`) : null;
            if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) onAdd({ key: entry.ask.key, value: `${entry.ask.op}:${date}` });
          }
        }}
        style={choice}
      >
        <option value="">Only…</option>
        {groups.map((group) => (
          <optgroup key={group} label={group}>
            {entries
              .filter((entry) => entry.group === group)
              .map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** A small caption for what an arrangement did, for a surface with no room for the row. */
export function arrangementCaption(arrangement: Arrangement): ReactNode {
  const parts: string[] = [];
  if (arrangement.query) parts.push(`“${arrangement.query}”`);
  if (arrangement.filter?.length) parts.push(`${arrangement.filter.length} condition${arrangement.filter.length === 1 ? "" : "s"}`);
  if (arrangement.group) parts.push(`by ${arrangement.group.by}`);
  if (arrangement.sort) parts.push(`sorted by ${arrangement.sort.by}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
