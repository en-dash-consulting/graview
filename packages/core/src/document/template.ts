import type { AnyGraphNode, GraphReader } from "../graph/types.js";
import { evaluateExpr, ExprEvalError, NodeSet, type KindShape, type Value } from "./expr/evaluate.js";
import type { Expr } from "./expr/parse.js";
import { DATE_VALUE, dayAsRead, dayOfMoment, ISO_DAY, ISO_MOMENT, isoToday, momentAsRead, numberAsRead, timeAsRead } from "../days.js";
import { capitalize, listed } from "../capital.js";
import { excerpt } from "../excerpt.js";
import { formatMoney, type Money } from "./money.js";
import { humanizeValue, optionInSentence } from "../schema/humanize.js";

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
 *
 * `excerpt` says the start of a long text on a card or a row: its first
 * sentence, or about 140 characters cut at a word (`excerpt: 80` for
 * fewer); the record's page says it whole.
 *
 * `time` says a moment's time of day ("10:47 AM") and `datetime` its day
 * and time ("Oct 16, 2026, 10:47 AM EDT"); `date` its day alone. A moment
 * kept with a zone ("…-04:00", "…Z") is said on the app's clock
 * (`brand.timeZone`), or a person's a host passed, never on the server's;
 * one kept without a zone, as it was written.
 *
 * `capital` may follow any of them, or stand alone: it upper-cases the first
 * letter of what was said, for a count in words that starts a headline —
 * "{count(all('finding')) | words | capital} findings" says "Fifty-seven findings".
 *
 * A record is said by its kind's label wherever one is declared — `{out('affects') | and}`
 * says "src/files.ts and tsconfig.json" of modules labeled "{path}" — else by its
 * name, title or label field, else its id.
 */

export const FORMATTERS = ["money", "percent", "date", "time", "datetime", "relative", "upper", "lower", "count", "words", "and", "plural", "excerpt"] as const;
export type Formatter = (typeof FORMATTERS)[number];

export interface TemplatePart {
  readonly text?: string;
  readonly expr?: Expr;
  readonly source?: string;
  readonly format?: Formatter;
  /** What the formatter is told: `plural`'s noun, and its plural where English does not make it. */
  readonly formatArgs?: readonly string[];
  /** `| capital`, alone or after another formatter: the words said with their first letter upper-cased, as a sentence starts. */
  readonly capital?: true;
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
export function formatValue(value: Value, format: Formatter | undefined, today: string, args: readonly string[] = [], money?: Money, name: Namer = called): string {
  return show(value, format, today, args, money, name);
}

/** What a part says once its formatter has said it: `| capital` upper-cases its first letter. */
export const capitalized = (part: TemplatePart, said: string): string => (part.capital ? capitalize(said) : said);

/** The formatters whose words are the framework's own, said in lower case: a count in words, a plural, "3 days ago". */
const OWN_WORDS: ReadonlySet<Formatter> = new Set(["words", "plural", "relative"]);

/**
 * A HEADLINE THAT OPENS WITH WORDS THE FRAMEWORK WROTE STARTS WITH A
 * CAPITAL. "{count(all('indicator')) | words} indicators" said "seventy-two
 * indicators" at the top of a page, unless its author knew to add
 * `| capital`. The rule is narrow on purpose: only a headline, only when it
 * opens on an interpolation formatted `words`, `plural` or `relative` —
 * words no person typed — and only when that first word is all lower case.
 * Text the author wrote first stays as written, and so does a record's own
 * name ("iPhone", "eBay"), which is the person's spelling, not a sentence's.
 */
export function headlineSaid(parts: readonly TemplatePart[], said: string): string {
  const first = parts[0];
  if (!first || first.text !== undefined || !first.format || !OWN_WORDS.has(first.format)) return said;
  return /^[a-z][a-z'’-]*(?=\s|$|[,.;:!?])/.test(said) ? capitalize(said) : said;
}

/** How a template says a record: the words its kind's label makes. */
export type Namer = (node: AnyGraphNode) => string;

/** What a record is called by the kinds of a schema: its kind's declared label, else as `called` says it. */
export function namerOf(schema: { tryDefinition(kind: string): unknown } | undefined): Namer {
  if (!schema) return called;
  return (node) => {
    const label = (schema.tryDefinition(node.kind) as { label?: (node: AnyGraphNode) => string } | undefined)?.label;
    return label ? label(node) : called(node);
  };
}

/*
 * How an app says money (FR-100) is `money.ts`'s, which a record's face
 * reads without the template machinery: re-exported here, where templates
 * and blocks have always found it.
 */
export { formatMoney, type Money } from "./money.js";

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** A whole number from zero to ninety-nine in words; anything else in figures. */
function inWords(n: number, locale?: string): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) return numberAsRead(n, locale);
  if (n < 20) return ONES[n]!;
  return n % 10 === 0 ? TENS[n / 10]! : `${TENS[Math.floor(n / 10)]}-${ONES[n % 10]}`;
}

/** The plural English makes of a noun: offers, parties, boxes. */
function pluralOf(noun: string): string {
  if (/[^aeiou]y$/i.test(noun)) return `${noun.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(noun)) return `${noun}es`;
  return `${noun}s`;
}

/** What a record is called in a sentence where no label is declared: its name, title or label, else its id. */
const called: Namer = (n: AnyGraphNode): string => String(n["name"] ?? n["title"] ?? n["label"] ?? n.id);

function show(value: Value, format: Formatter | undefined, today: string, args: readonly string[] = [], money?: Money, name: Namer = called): string {
  if (format === "plural") {
    const count = value instanceof NodeSet ? value.nodes.length : Array.isArray(value) ? value.length : typeof value === "number" ? value : null;
    if (count === null || args[0] === undefined) return "—";
    return count === 1 ? args[0] : (args[1] ?? pluralOf(args[0]));
  }
  if (value === null) return "—";
  if (value instanceof NodeSet) return format === "count" ? String(value.nodes.length) : format === "and" ? listed(value.nodes.map(name)) : value.nodes.map(name).join(", ");
  if (Array.isArray(value)) {
    if (format === "count") return String(value.length);
    const each = value.map((v) => show(v as Value, undefined, today, [], money, name));
    return format === "and" ? listed(each) : each.join(", ");
  }
  if (typeof value === "object") return name(value as AnyGraphNode);
  switch (format) {
    case "words":
      return typeof value === "number" ? inWords(value, money?.locale) : String(value);
    case "money":
      return typeof value === "number" ? formatMoney(value, money, args[0] === "0" ? 0 : undefined) : String(value);
    case "percent":
      return typeof value === "number" ? numberAsRead(value, money?.locale, { style: "percent", maximumFractionDigits: 0 }) : String(value);
    case "upper":
      return String(value).toUpperCase();
    case "lower":
      return String(value).toLowerCase();
    case "excerpt":
      return excerpt(String(value), Number(args[0]) || undefined);
    case "date":
      // A day as a person reads it ("Aug 28, 2026" in en-US), as a card's glance says it: an instant's, the day it is on the app's clock.
      return dayAsRead(dayOfMoment(String(value), money?.timeZone) ?? String(value).slice(0, 10), money?.locale);
    case "time":
      // A time of day ("10:47 AM"); a day has none, and is said as a day.
      return typeof value === "string" && ISO_DAY.test(value) ? dayAsRead(value, money?.locale) : timeAsRead(String(value), money?.locale, money?.timeZone);
    case "datetime":
      return typeof value === "string" && ISO_DAY.test(value) ? dayAsRead(value, money?.locale) : momentAsRead(String(value), money?.locale, money?.timeZone);
    case "relative": {
      // Counted in the app's days: an instant late in its evening is still today there.
      const day = dayOfMoment(String(value), money?.timeZone);
      const t = day === undefined ? Date.parse(String(value)) : Date.parse(`${day}T00:00:00Z`);
      if (Number.isNaN(t)) return String(value);
      const days = Math.round((t - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
      return days === 0 ? "today" : days === 1 ? "tomorrow" : days === -1 ? "yesterday" : days > 0 ? `in ${days} days` : `${-days} days ago`;
    }
    default:
      // A day or a moment said into a sentence — "was due {due}" — is said as a person reads it, never as it is kept.
      return typeof value === "string" && DATE_VALUE.test(value) ? dayAsRead(value, money?.locale) : typeof value === "string" && ISO_MOMENT.test(value) ? momentAsRead(value, money?.locale, money?.timeZone) : String(value);
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
  /** The app's currency, locale and time zone: for `{x | money}` (FR-100), and the clock an instant is said on. */

  readonly money?: Money;
  /** How a record is said; unsaid, by the labels of the schema the graph carries (`namerOf`). */
  readonly name?: Namer;
}

/** Render a parsed template. A part that cannot be judged renders as "—" rather than failing the whole sentence. */
/** A choice's value in a template: each option by its label, else spoken — as a chip says it when it is the template, in lower case among other words. */
export function optionsSaid(value: string | readonly unknown[], labels: Readonly<Record<string, string>>, alone: boolean): string {
  return (Array.isArray(value) ? value : [value]).map((one) => labels[String(one)] ?? (alone ? humanizeValue(String(one)) : optionInSentence(String(one)))).join(", ");
}

export function renderTemplate(parts: readonly TemplatePart[], ctx: RenderContext): string {
  const today = ctx.today ?? isoToday();
  const name = ctx.name ?? namerOf((ctx.graph as { readonly schema?: { tryDefinition(kind: string): unknown } } | undefined)?.schema);
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
        // A choice field named bare (`{status}`) is said by its option's label, else its id spoken — alone as a chip says it, among other words in lower case — never the id.
        const labels = !part.format && part.expr!.t === "ident" && ctx.node ? ctx.kinds.get(ctx.node.kind)?.choices?.get(part.expr!.name) : undefined;
        if (labels && (typeof value === "string" || Array.isArray(value))) return capitalized(part, optionsSaid(value, labels, parts.length === 1));
        return capitalized(part, show(value, part.format, today, part.formatArgs, ctx.money, name));
      } catch (error) {
        if (error instanceof ExprEvalError) return "—";
        throw error;
      }
    })
    .join("");
}
