import type { AnyGraphNode, GraphReader } from "../index.js";
import { evaluateExpr, ExprEvalError, NodeSet, type KindShape, type Value } from "./expr/evaluate.js";
import { parseExpr, type Expr } from "./expr/parse.js";

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

/** Where the formatter begins: the last bar that is not inside quotes and not half of `||`. */
function filterBar(inner: string): number {
  let quote: string | undefined;
  let bar = -1;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]!;
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = undefined;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    else if (c === "|") {
      if (inner[i + 1] === "|") i++;
      else bar = i;
    }
  }
  return bar;
}

/** One quoted word, then a comma or the end. */
const QUOTED = /\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*(,|$)/y;

/** A formatter and what it is told: `money`, `plural: 'person', 'people'`. */
function readFormatter(text: string): { readonly format: Formatter; readonly args: readonly string[] } {
  const colon = text.indexOf(":");
  const name = (colon >= 0 ? text.slice(0, colon) : text).trim();
  if (!(FORMATTERS as readonly string[]).includes(name)) throw new TemplateError(`"${name}" is not a formatter; use one of ${FORMATTERS.join(", ")}`);
  const args: string[] = [];
  if (colon >= 0) {
    const rest = text.slice(colon + 1);
    let at = 0;
    while (at < rest.length) {
      QUOTED.lastIndex = at;
      const m = QUOTED.exec(rest);
      if (!m) throw new TemplateError(`"${name}" is told quoted words, like ${name}: 'offer'`);
      args.push((m[1] ?? m[2] ?? "").replace(/\\(.)/g, "$1"));
      at = QUOTED.lastIndex;
      if (m[3] === "") break;
    }
  }
  if (name === "plural" && (args.length < 1 || args.length > 2)) {
    throw new TemplateError("plural is told its noun, like {count | plural: 'offer'}, and its plural where English does not make it: plural: 'person', 'people'");
  }
  if (name !== "plural" && args.length > 0) throw new TemplateError(`"${name}" takes nothing after it`);
  return { format: name as Formatter, args };
}

export class TemplateError extends Error {
  constructor(readonly sentence: string) {
    super(sentence);
  }
}

export function parseTemplate(template: string): readonly TemplatePart[] {
  const parts: TemplatePart[] = [];
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf("{", i);
    if (open < 0) {
      parts.push({ text: template.slice(i) });
      break;
    }
    if (open > i) parts.push({ text: template.slice(i, open) });
    const close = template.indexOf("}", open);
    if (close < 0) throw new TemplateError(`a "{" at character ${open + 1} is never closed`);
    const inner = template.slice(open + 1, close);
    const bar = filterBar(inner);
    const source = (bar >= 0 ? inner.slice(0, bar) : inner).trim();
    const formatter = bar >= 0 ? readFormatter(inner.slice(bar + 1)) : undefined;
    parts.push({
      expr: parseExpr(source),
      source,
      ...(formatter ? { format: formatter.format } : {}),
      ...(formatter && formatter.args.length > 0 ? { formatArgs: formatter.args } : {}),
    });
    i = close + 1;
  }
  return parts;
}

const EMPTY_GRAPH: GraphReader = {
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
export function formatValue(value: Value, format: Formatter | undefined, today: string, args: readonly string[] = []): string {
  return show(value, format, today, args);
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

function show(value: Value, format: Formatter | undefined, today: string, args: readonly string[] = []): string {
  if (format === "plural") {
    const count = value instanceof NodeSet ? value.nodes.length : Array.isArray(value) ? value.length : typeof value === "number" ? value : null;
    if (count === null || args[0] === undefined) return "—";
    return count === 1 ? args[0] : (args[1] ?? pluralOf(args[0]));
  }
  if (value === null) return "—";
  if (value instanceof NodeSet) return format === "count" ? String(value.nodes.length) : format === "and" ? joined(value.nodes.map(called)) : value.nodes.map(called).join(", ");
  if (Array.isArray(value)) {
    if (format === "count") return String(value.length);
    const each = value.map((v) => show(v as Value, undefined, today));
    return format === "and" ? joined(each) : each.join(", ");
  }
  if (typeof value === "object") return called(value as AnyGraphNode);
  switch (format) {
    case "words":
      return typeof value === "number" ? inWords(value) : String(value);
    case "money":
      return typeof value === "number" ? value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(value) ? 0 : 2 }) : String(value);
    case "percent":
      return typeof value === "number" ? `${Math.round(value * 100)}%` : String(value);
    case "upper":
      return String(value).toUpperCase();
    case "lower":
      return String(value).toLowerCase();
    case "date":
      return String(value).slice(0, 10);
    case "relative": {
      const t = Date.parse(String(value).length === 10 ? `${value}T00:00:00Z` : String(value));
      if (Number.isNaN(t)) return String(value);
      const days = Math.round((t - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
      return days === 0 ? "today" : days === 1 ? "tomorrow" : days === -1 ? "yesterday" : days > 0 ? `in ${days} days` : `${-days} days ago`;
    }
    default:
      return String(value);
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
        return show(value, part.format, today, part.formatArgs);
      } catch (error) {
        if (error instanceof ExprEvalError) return "—";
        throw error;
      }
    })
    .join("");
}
