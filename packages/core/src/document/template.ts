import type { AnyGraphNode, GraphReader } from "../graph/types.js";
import { evaluateExpr, ExprEvalError, NodeSet, type KindShape, type Value } from "./expr/evaluate.js";
import type { Expr } from "./expr/parse.js";
import { dayAsRead, ISO_DAY } from "../days.js";

/*
 * TEMPLATES: "{name}", "{status} · {quote|money}", "{fills.name}".
 *
 * Inside the braces is an expression of the rule language; after a bar, a
 * formatter from a closed set. A label has no graph to walk (the framework
 * hands a label function only the node), so labels may only name fields;
 * a rule's sentence has the graph and may walk an edge.
 *
 * Three formatters say things the way a page does (FR-83): `words` spells a
 * whole number ("three"), `and` joins a set or a list ("A, B and C"), and
 * `plural: 'offer'` is the noun for a count ("offer", "offers"), with the
 * plural given where English does not make it: `plural: 'person', 'people'`.
 *
 *   "Answers {count(out('answers')) | words} of the {count(all('note')) | words} {count(all('note')) | plural: 'thing'} we heard"
 */

export const FORMATTERS = ["money", "percent", "date", "relative", "upper", "lower", "count", "words", "and", "plural"] as const;
export type Formatter = (typeof FORMATTERS)[number];

export interface TemplatePart {
  readonly text?: string;
  readonly expr?: Expr;
  readonly source?: string;
  readonly format?: Formatter;
  /** What the formatter is told: `plural`'s noun, and its plural where English does not make it. */
  readonly formatArgs?: readonly string[];
}

/*
 * Reading a template is a module of its own (template-parse.ts), imported
 * from there and not through here: a page handed a compiled app (FR-123)
 * renders templates already parsed, and a bundler places every module this
 * one reaches in the chunk that imports it — the reader and the expression
 * parser with it.
 */

/** A graph with nothing in it: what an expression walks when it is handed none. */
export const EMPTY_GRAPH: GraphReader = {
  getNode: () => undefined,
  allNodes: () => [],
  allEdges: () => [],
  nodesOfKind: () => [],
  edgesOfKind: () => [],
  out: () => [],
  in: () => [],
  neighbors: () => [],
  has: () => false,
};

/** A value as words, through a formatter: the one place templates and view specs say a value. */
export function formatValue(value: Value, format: Formatter | undefined, today: string, args: readonly string[] = [], money?: Money): string {
  return show(value, format, today, args, money);
}

/**
 * HOW AN APP SAYS MONEY (FR-100): the currency a sum is in when a block
 * names none, and the locale its figures are written for — the app's
 * `brand.currency` and `brand.locale`. Without a currency a sum is a
 * number in figures, as it always was.
 */
export interface Money {
  readonly currency?: string;
  readonly locale?: string;
}

/** A sum of money in words: "$21,000", "21.000 €" — whole sums without cents, others with two. */
export function formatMoney(value: number, money: Money = {}): string {
  const whole = Number.isInteger(value);
  const digits = { maximumFractionDigits: whole ? 0 : 2, minimumFractionDigits: whole ? 0 : 2 };
  try {
    return new Intl.NumberFormat(money.locale ?? "en-US", money.currency ? { style: "currency", currency: money.currency, ...digits } : digits).format(value);
  } catch {
    // A currency or locale the runtime does not know is said as a plain number, never a thrown page.
    return value.toLocaleString("en-US", digits);
  }
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** A whole number from zero to ninety-nine in words; anything else in figures. */
function inWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n < 20) return ONES[n]!;
  return n % 10 === 0 ? TENS[n / 10]! : `${TENS[Math.floor(n / 10)]}-${ONES[n % 10]}`;
}

/** "A", "A and B", "A, B and C". */
function joined(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The plural English makes of a noun: offers, parties, boxes. */
function pluralOf(noun: string): string {
  if (/[^aeiou]y$/i.test(noun)) return `${noun.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(noun)) return `${noun}es`;
  return `${noun}s`;
}

/** What a record is called in a sentence: its name, title or label, else its id. */
const called = (n: AnyGraphNode): string => String(n["name"] ?? n["title"] ?? n["label"] ?? n.id);

function show(value: Value, format: Formatter | undefined, today: string, args: readonly string[] = [], money?: Money): string {
  if (format === "plural") {
    const count = value instanceof NodeSet ? value.nodes.length : Array.isArray(value) ? value.length : typeof value === "number" ? value : null;
    if (count === null || args[0] === undefined) return "—";
    return count === 1 ? args[0] : (args[1] ?? pluralOf(args[0]));
  }
  if (value === null) return "—";
  if (value instanceof NodeSet) return format === "count" ? String(value.nodes.length) : format === "and" ? joined(value.nodes.map(called)) : value.nodes.map(called).join(", ");
  if (Array.isArray(value)) {
    if (format === "count") return String(value.length);
    const each = value.map((v) => show(v as Value, undefined, today, [], money));
    return format === "and" ? joined(each) : each.join(", ");
  }
  if (typeof value === "object") return called(value as AnyGraphNode);
  switch (format) {
    case "words":
      return typeof value === "number" ? inWords(value) : String(value);
    case "money":
      return typeof value === "number" ? formatMoney(value, money) : String(value);
    case "percent":
      return typeof value === "number" ? `${Math.round(value * 100)}%` : String(value);
    case "upper":
      return String(value).toUpperCase();
    case "lower":
      return String(value).toLowerCase();
    case "date":
      // A day as a person reads it ("28 Aug 2026"), as a card's glance says it.
      return dayAsRead(String(value).slice(0, 10));
    case "relative": {
      const t = Date.parse(String(value).length === 10 ? `${value}T00:00:00Z` : String(value));
      if (Number.isNaN(t)) return String(value);
      const days = Math.round((t - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
      return days === 0 ? "today" : days === 1 ? "tomorrow" : days === -1 ? "yesterday" : days > 0 ? `in ${days} days` : `${-days} days ago`;
    }
    default:
      // A day said into a sentence — "was due {due}" — is said as a person reads it, never as it is kept.
      return typeof value === "string" && ISO_DAY.test(value) ? dayAsRead(value) : String(value);
  }
}

export interface RenderContext {
  readonly node: AnyGraphNode | null;
  readonly kinds: ReadonlyMap<string, KindShape>;
  readonly graph?: GraphReader;
  readonly bindings?: Readonly<Record<string, Value>>;
  readonly today?: string;
  /** The steps each part may take; 500 unless the surface says (a home sweeps whole kinds). */
  readonly budget?: number;
  /** The app's currency and locale, for `{x | money}` (FR-100). */
  readonly money?: Money;
}

/** Render a parsed template. A part that cannot be judged renders as "—" rather than failing the whole sentence. */
export function renderTemplate(parts: readonly TemplatePart[], ctx: RenderContext): string {
  const today = ctx.today ?? new Date().toISOString().slice(0, 10);
  return parts
    .map((part) => {
      if (part.text !== undefined) return part.text;
      try {
        const value = evaluateExpr(part.expr!, {
          graph: ctx.graph ?? EMPTY_GRAPH,
          subject: ctx.node,
          kinds: ctx.kinds,
          today,
          budget: ctx.budget ?? 500,
          ...(ctx.bindings ? { bindings: ctx.bindings } : {}),
        });
        return show(value, part.format, today, part.formatArgs, ctx.money);
      } catch (error) {
        if (error instanceof ExprEvalError) return "—";
        throw error;
      }
    })
    .join("");
}
