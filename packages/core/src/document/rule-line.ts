/*
 * A RULE, READ BACK AS ITS SHAPE (the parts are `../invariants/line.ts`).
 *
 * A rule in the rule language says what must hold; this says that back in
 * the declaration's own words and in symbols a person knows from
 * arithmetic: `margin >= first(all('assumptions')).targetMargin` is
 * "margin ≥ target margin", `present(owner)` is "owner ≠ —", `status ==
 * 'open' || status == 'fixing'` is "status ∈ {open, fixing}". And when a
 * record breaks it, the same line with that record's values, the
 * comparison turned the way it actually stands: "margin 44% < target
 * margin 50%".
 *
 * From the barrel on purpose, as `rules.ts` is: this sits beside the
 * evaluator in whatever chunk judges rules, and a page that only draws a
 * line carries none of it.
 */
import { fieldWords, humanizeField, labelOf, nounOf, pluralOf, type AnyGraphNode, type AnySchema, type FieldFormat, type RuleLine, type RulePart } from "../index.js";
import { finishedLine } from "../invariants/line.js";
import { dayAsRead, ISO_DAY } from "../days.js";
import { evaluateExpr, NodeSet, type EvalContext, type Value } from "./expr/evaluate.js";
import type { BinaryOp, Expr } from "./expr/parse.js";
import { formatMoney, type Formatter, type Money, type TemplatePart } from "./template.js";

/** The most of a text value a line says, its end cut to "…". */
const LONGEST_VALUE = 60;

/** What a line is said with: the declaration's words, and how its values are written. */
export interface LineWords {
  readonly schema: AnySchema;
  /** A field's format where the declaration says one. */
  readonly formatOf?: (kind: string, field: string) => FieldFormat | undefined;
  /** The app's currency and locale. */
  readonly money?: Money;
  /** The formats the rule's own sentence gives a name — `{margin|percent}` — for a value the declaration does not format. */
  readonly said?: ReadonlyMap<string, Formatter>;
}

/** A rule as its line is made from: the kind it judges and its parsed judgment. */
export interface LinedRule {
  readonly over: string;
  readonly require: Expr;
  readonly when?: Expr | undefined;
}

type Kind = string | null;
type Parts = RulePart[];

const name = (text: string): RulePart => ({ text, as: "name" });
const word = (text: string, said?: string): RulePart => (said === undefined ? { text, as: "word" } : { text, as: "word", said });
const value = (text: string, said?: string): RulePart => (said === undefined || said === text ? { text, as: "value" } : { text, as: "value", said });
const op = (text: string, said: string): RulePart => ({ text, as: "op", said });
const OPEN: RulePart = { text: "(", as: "open" };
const CLOSE: RulePart = { text: ")", as: "close" };
const NONE: RulePart = { text: "—", as: "value", said: "empty" };

const COMPARE: Readonly<Record<string, readonly [string, string]>> = {
  ">=": ["≥", "at least"],
  "<=": ["≤", "at most"],
  "<": ["<", "less than"],
  ">": [">", "more than"],
  "==": ["=", "is"],
  "!=": ["≠", "is not"],
};
/** The comparison that holds when this one does not. */
const TURNED: Readonly<Record<string, BinaryOp>> = { ">=": "<", "<=": ">", "<": ">=", ">": "<=", "==": "!=", "!=": "==" };
const ARITHMETIC: Partial<Record<BinaryOp, readonly [string, string]>> = { "+": ["+", "plus"], "-": ["−", "minus"], "*": ["×", "times"], "/": ["÷", "divided by"], "%": ["mod", "modulo"] };
const isComparison = (e: Expr): e is Extract<Expr, { t: "binary" }> => e.t === "binary" && e.op in COMPARE;

/** "Target margin" inside a line is "target margin"; "AI uses" stays as it is. */
function inLine(text: string): string {
  return text.length > 1 && text[1] === text[1]!.toUpperCase() && /[A-Z]/.test(text[1]!) ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

interface Definition {
  readonly edges?: Readonly<Record<string, { readonly to?: readonly string[] | "*"; readonly cardinality?: "one" | "many" }>>;
  readonly display?: { readonly labels?: Readonly<Record<string, string>>; readonly format?: Readonly<Record<string, (v: unknown) => string>> };
  readonly computed?: Readonly<Record<string, string | { readonly label?: string }>>;
  readonly noun?: string;
  readonly plural?: string;
}

/** The reader both lines share: the declaration's names for things, and its values in words. */
function reader(words: LineWords) {
  const { schema } = words;
  const definition = (kind: Kind): Definition | undefined => (kind === null ? undefined : (schema.tryDefinition(kind) as Definition | undefined));
  const relation = (kind: Kind, key: string) => {
    const edges = definition(kind)?.edges;
    return edges && Object.prototype.hasOwnProperty.call(edges, key) ? edges[key] : undefined;
  };
  const farOf = (kind: Kind, key: string): Kind => {
    const to = relation(kind, key)?.to;
    return Array.isArray(to) && to.length === 1 ? to[0]! : null;
  };
  /** The kinds whose `key` relation reaches `kind`: what `in('key')` holds. */
  const nearOf = (kind: Kind, key: string): Kind => {
    const from = (schema.edge(key)?.from ?? []).filter((one) => {
      const to = relation(one, key)?.to;
      return kind === null || to === "*" || (Array.isArray(to) && to.includes(kind));
    });
    return from.length === 1 ? from[0]! : null;
  };
  const fieldName = (kind: Kind, key: string): string =>
    relation(kind, key) ? humanizeField(key).toLowerCase() : inLine(fieldWords(definition(kind) as Parameters<typeof fieldWords>[0], key));
  const plural = (kind: string): string => inLine(pluralOf(schema, kind));
  const noun = (kind: string): string => inLine(nounOf(definition(kind), kind));
  const formatOf = (kind: Kind, key: string): FieldFormat | undefined => {
    const declared = kind === null ? undefined : words.formatOf?.(kind, key);
    if (declared?.format) return declared;
    const said = words.said?.get(key);
    return said ? { ...declared, format: said } : declared;
  };
  const recordName = (node: AnyGraphNode): string => labelOf(schema.tryDefinition(node.kind), node);

  /** A value in words: formatted as its field says, a day as a person reads it, a record by its name. */
  const valueWords = (v: Value | undefined, at?: { readonly kind: Kind; readonly key: string; readonly format?: FieldFormat | undefined }): RulePart => {
    if (v === null || v === undefined) return NONE;
    if (v instanceof NodeSet) {
      if (v.nodes.length === 0) return NONE;
      const names = v.nodes.slice(0, 3).map(recordName);
      const more = v.nodes.length - names.length;
      return value(more > 0 ? `${names.join(", ")} and ${more} more` : names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]!);
    }
    if (Array.isArray(v)) return value(`{${v.map((one) => valueWords(one as Value, at).text).join(", ")}}`, v.map((one) => valueWords(one as Value, at).text).join(" or "));
    if (typeof v === "object") return value(recordName(v as AnyGraphNode));
    if (typeof v === "boolean") return value(v ? "yes" : "no");
    const format = at?.format ?? (at ? formatOf(at.kind, at.key) : undefined);
    if (typeof v === "number") {
      if (format?.format === "money") return value(formatMoney(v, { ...words.money, ...(format.unit && /^[A-Z]{3}$/.test(format.unit) ? { currency: format.unit } : {}) }));
      if (format?.format === "percent") return value(`${Math.round(v * 100)}%`);
      const plain = v.toLocaleString("en-US", { maximumFractionDigits: 2 });
      return value(format?.unit && !/^[A-Z]{3}$/.test(format.unit) ? `${plain} ${format.unit}` : plain);
    }
    if (ISO_DAY.test(v) || format?.format === "date") return value(dayAsRead(v.slice(0, 10)));
    // A choice as the declaration says it, else spoken: 'to-order' is "to order".
    const shown = at && at.kind !== null ? definition(at.kind)?.display?.format?.[at.key] : undefined;
    if (shown) return value(shown(v));
    // A long text is said as its start: a line, and the message a chat reads, carry a value, not a field's whole contents.
    const said = v.length > LONGEST_VALUE ? `${v.slice(0, LONGEST_VALUE - 1).trimEnd()}…` : v;
    return value(/^[a-z][a-z0-9]*([-_][a-z0-9]+)*$/.test(said) ? said.replace(/[-_]+/g, " ") : said);
  };

  return { definition, relation, farOf, nearOf, fieldName, plural, noun, formatOf, valueWords };
}

type Reader = ReturnType<typeof reader>;

/** The field an expression reads, where it reads one: for its format and its literal's words. */
function fieldAt(e: Expr, kind: Kind, r: Reader): { readonly kind: Kind; readonly key: string } | undefined {
  if (e.t === "ident") return { kind, key: e.name };
  if (e.t === "member") {
    const owner = kindOf(e.object, kind, r);
    return { kind: owner, key: e.name };
  }
  if (e.t === "call" && (e.fn === "sum" || e.fn === "min" || e.fn === "max") && e.args.length === 2) {
    const of = kindOf(e.args[0]!, kind, r);
    const second = e.args[1]!;
    if (second.t === "ident") return { kind: of, key: second.name };
    if (second.t === "lit" && typeof second.value === "string") return { kind: of, key: second.value };
  }
  if (e.t === "binary" && (e.op === "+" || e.op === "-")) return fieldAt(e.left, kind, r) ?? fieldAt(e.right, kind, r);
  if (e.t === "call" && e.fn === "if" && e.args.length === 3) return fieldAt(e.args[1]!, kind, r) ?? fieldAt(e.args[2]!, kind, r);
  return undefined;
}

/** The kind of the records an expression reaches, where one kind is all it can reach. */
function kindOf(e: Expr, kind: Kind, r: Reader): Kind {
  switch (e.t) {
    case "ident":
      return r.relation(kind, e.name) ? r.farOf(kind, e.name) : null;
    case "member":
      return r.farOf(kindOf(e.object, kind, r), e.name);
    case "where":
      return kindOf(e.set, kind, r);
    case "binary":
      return e.op === "|" || e.op === "&" || e.op === "-" ? kindOf(e.left, kind, r) : null;
    case "call": {
      const word = (i: number) => {
        const arg = e.args[i];
        return arg?.t === "lit" && typeof arg.value === "string" ? arg.value : undefined;
      };
      if (e.fn === "all") return word(0) ?? null;
      if (e.fn === "out") return e.args.length === 2 ? r.farOf(kindOf(e.args[0]!, kind, r), word(1) ?? "") : r.farOf(kind, word(0) ?? "");
      if (e.fn === "in") return e.args.length === 2 ? r.nearOf(kindOf(e.args[0]!, kind, r), word(1) ?? "") : r.nearOf(kind, word(0) ?? "");
      if (e.fn === "first" || e.fn === "sort") return e.args[0] ? kindOf(e.args[0], kind, r) : null;
      return null;
    }
    default:
      return null;
  }
}

/** How tightly a reading binds, for where it needs brackets: a value 9, a comparison 4, and 2, or 1. */
function level(e: Expr): number {
  if (e.t === "binary") return e.op === "||" ? (oneOf(e) ? 4 : 1) : e.op === "&&" ? 2 : e.op in COMPARE || e.op === "in" ? 4 : e.op === "+" || e.op === "-" ? 5 : e.op === "*" || e.op === "/" || e.op === "%" ? 6 : 4.5;
  if (e.t === "unary" && e.op === "!") return 3;
  if (e.t === "where") return 3.5;
  return 9;
}

const literalOf = (e: Expr): e is Extract<Expr, { t: "lit" }> => e.t === "lit";
/** A call of one function. Branded, so a false answer does not narrow away every other call. */
declare const CALLED: unique symbol;
type Called = Extract<Expr, { t: "call" }> & { readonly [CALLED]: true };
const callOf = (e: Expr, fn: string): e is Called => e.t === "call" && e.fn === fn;

/** The sides of a run of `and`s, or of `or`s, in order. */
function sidesOf(e: Expr, joiner: "&&" | "||"): Expr[] {
  return e.t === "binary" && e.op === joiner ? [...sidesOf(e.left, joiner), ...sidesOf(e.right, joiner)] : [e];
}

/**
 * `a == 'x' || a == 'y'` is one question — is `a` one of these? — and is
 * read as one: "status ∈ {open, fixing}". The values, or nothing when the
 * disjunction is anything else.
 */
function oneOf(e: Expr): { readonly subject: Expr; readonly values: readonly Expr[] } | undefined {
  if (e.t !== "binary" || e.op !== "||") return undefined;
  const sides: Expr[] = [];
  sides.push(...sidesOf(e, "||"));
  let subject: Expr | undefined;
  const values: Expr[] = [];
  for (const side of sides) {
    if (side.t !== "binary" || side.op !== "==" || !literalOf(side.right) || typeof side.right.value !== "string") return undefined;
    if (subject && JSON.stringify(strip(subject)) !== JSON.stringify(strip(side.left))) return undefined;
    subject = side.left;
    values.push(side.right);
  }
  return subject ? { subject, values } : undefined;
}
/** A tree without its positions, to compare two readings of the same name. */
const strip = (e: Expr): unknown => JSON.parse(JSON.stringify(e, (key, v) => (key === "at" ? undefined : v)));

/** The parts that read an expression, in the kind it is read from. */
function say(e: Expr, kind: Kind, r: Reader, partner?: { readonly kind: Kind; readonly key: string }): Parts {
  const within = (x: Expr, at: number, k: Kind = kind): Parts => (level(x) < at ? [OPEN, ...say(x, k, r), CLOSE] : say(x, k, r));
  switch (e.t) {
    case "lit":
      return [r.valueWords(e.value, partner)];
    case "list":
      return [r.valueWords(e.items.map((item) => (item.t === "lit" ? item.value : null)) as Value, partner)];
    case "ident":
      return [name(r.fieldName(kind, e.name))];
    case "member": {
      // The one sheet of assumptions is not a path to say every time: its target margin is the target margin.
      const singleton = callOf(e.object, "first") && e.object.args[0] && callOf(e.object.args[0], "all");
      const owner = kindOf(e.object, kind, r);
      if (singleton && owner) {
        const own = kind !== null && r.fieldName(kind, e.name) === r.fieldName(owner, e.name) && (r.definition(kind) as { fields?: { shape?: object } } | undefined)?.fields?.shape && Object.prototype.hasOwnProperty.call((r.definition(kind) as { fields: { shape: object } }).fields.shape, e.name);
        return own ? [name(`${r.noun(owner)}'s ${r.fieldName(owner, e.name)}`)] : [name(r.fieldName(owner, e.name))];
      }
      const object = say(e.object, kind, r);
      const last = object[object.length - 1];
      if (object.length === 1 && last?.as === "name") return [name(`${last.text}'s ${r.fieldName(owner, e.name)}`)];
      return [...object, word("'s"), name(r.fieldName(owner, e.name))];
    }
    case "unary": {
      if (e.op === "-") return [op("−", "minus"), ...within(e.operand, 7)];
      return negated(e.operand, kind, r);
    }
    case "where": {
      const of = kindOf(e.set, kind, r);
      const filter = say(e.filter, of, r);
      // A yes/no field needs no "with": "steps not done", "plots tended".
      const plain = filter.every((part) => part.as === "name" || (part.as === "word" && part.text === "not"));
      return [...within(e.set, 4), ...(plain ? [] : [word("with")]), ...(level(e.filter) <= 2 ? [OPEN, ...filter, CLOSE] : filter)];
    }
    case "binary":
      return binary(e, kind, r);
    case "call":
      return call(e, kind, r);
  }
}

/** `not …`, read as the thing it denies: `!present(x)` is "x = —", `!(a == b)` is "a ≠ b". */
function negated(e: Expr, kind: Kind, r: Reader): Parts {
  if (isComparison(e)) return binary({ ...e, op: TURNED[e.op]! }, kind, r);
  if (callOf(e, "present") || callOf(e, "exists")) return [...say(e.args[0]!, kind, r), op("=", "is"), NONE];
  if (e.t === "ident") return [word("not"), name(r.fieldName(kind, e.name))];
  return [word("not"), OPEN, ...say(e, kind, r), CLOSE];
}

function binary(e: Extract<Expr, { t: "binary" }>, kind: Kind, r: Reader): Parts {
  const within = (x: Expr, at: number): Parts => (level(x) < at ? [OPEN, ...say(x, kind, r), CLOSE] : say(x, kind, r));
  if (e.op === "&&" || e.op === "||") {
    const many = oneOf(e);
    if (many) {
      const at = fieldAt(many.subject, kind, r);
      return [...say(many.subject, kind, r), op("∈", "is one of"), r.valueWords(many.values.map((v) => (v as { value: Value }).value) as Value, at)];
    }
    const l = e.op === "&&" ? 2 : 1;
    return [...within(e.left, l), word(e.op === "&&" ? "and" : "or"), ...within(e.right, l + 0.5)];
  }
  if (e.op in COMPARE) {
    // A yes/no field said as itself: `done == true` is "done", `done != true` is "not done".
    if (literalOf(e.right) && typeof e.right.value === "boolean" && (e.op === "==" || e.op === "!=")) {
      const yes = (e.op === "==") === e.right.value;
      return yes ? say(e.left, kind, r) : negated(e.left, kind, r);
    }
    const [symbol, said] = COMPARE[e.op]!;
    const leftAt = fieldAt(e.left, kind, r);
    const rightAt = fieldAt(e.right, kind, r);
    return [...sayAt(e.left, kind, r, rightAt), op(symbol, said), ...sayAt(e.right, kind, r, leftAt)];
  }
  if (e.op === "in") return [...within(e.left, 5), op("∈", "is one of"), ...sayAt(e.right, kind, r, fieldAt(e.left, kind, r))];
  const arithmetic = ARITHMETIC[e.op];
  if (arithmetic) {
    const l = level(e);
    return [...within(e.left, l), op(arithmetic[0], arithmetic[1]), ...within(e.right, l + 0.5)];
  }
  const sets: Partial<Record<BinaryOp, string>> = { "|": "or", "&": "and also", "-": "except" };
  return [...within(e.left, 5), word(sets[e.op] ?? e.op), ...within(e.right, 5)];
}

/** A side of a comparison: a literal said in the words of the field on the other side. */
function sayAt(e: Expr, kind: Kind, r: Reader, partner: { readonly kind: Kind; readonly key: string } | undefined): Parts {
  return e.t === "lit" || e.t === "list" ? say(e, kind, r, partner) : level(e) < 5 ? [OPEN, ...say(e, kind, r), CLOSE] : say(e, kind, r);
}

function call(e: Extract<Expr, { t: "call" }>, kind: Kind, r: Reader): Parts {
  const arg = (i: number) => e.args[i]!;
  const quoted = (i: number) => {
    const a = e.args[i];
    return a?.t === "lit" && typeof a.value === "string" ? a.value : undefined;
  };
  const set = (i: number): Parts => {
    const x = arg(i);
    return level(x) < 9 && x.t !== "where" ? [OPEN, ...say(x, kind, r), CLOSE] : say(x, kind, r);
  };
  switch (e.fn) {
    case "out": {
      const key = quoted(e.args.length - 1) ?? "";
      const words = name(humanizeField(key).toLowerCase());
      return e.args.length === 2 ? [words, word("of"), ...set(0)] : [words];
    }
    case "in": {
      const key = quoted(e.args.length - 1) ?? "";
      const near = e.args.length === 2 ? r.nearOf(kindOf(arg(0), kind, r), key) : r.nearOf(kind, key);
      const words = name(near ? r.plural(near) : humanizeField(key).toLowerCase());
      return e.args.length === 2 ? [words, word("of"), ...set(0)] : [words];
    }
    case "all": {
      const of = quoted(0);
      return [name(of ? r.plural(of) : "everything")];
    }
    case "count":
      return [word("number of"), ...set(0)];
    case "exists":
      return [...set(0), op("≠", "is not"), NONE];
    case "present":
      return [...say(arg(0), kind, r), op("≠", "is not"), NONE];
    case "some":
    case "every": {
      const of = kindOf(arg(0), kind, r);
      const condition = arg(1);
      return [...(e.fn === "some" ? [word("some")] : []), ...set(0), word(e.fn === "some" ? "with" : "all with"), ...(level(condition) <= 2 ? [OPEN, ...say(condition, of, r), CLOSE] : say(condition, of, r))];
    }
    case "sum":
    case "min":
    case "max": {
      const of = kindOf(arg(0), kind, r);
      const second = arg(1);
      const what: Parts = second.t === "lit" && typeof second.value === "string" ? [name(r.fieldName(of, second.value))] : level(second) < 9 ? [OPEN, ...say(second, of, r), CLOSE] : say(second, of, r);
      return [word(e.fn === "sum" ? "total" : e.fn === "min" ? "least" : "most"), ...what, word("of"), ...set(0)];
    }
    case "first": {
      const inner = arg(0);
      if (callOf(inner, "all")) {
        const of = (inner.args[0] as { value?: unknown } | undefined)?.value;
        if (typeof of === "string") return [name(`the ${r.noun(of)}`)];
      }
      return [word("first of"), ...set(0)];
    }
    case "sort":
      return [...set(0), word("by"), ...say(arg(1), kindOf(arg(0), kind, r), r)];
    case "len":
      return [word("length of"), ...say(arg(0), kind, r)];
    case "lower":
      return say(arg(0), kind, r);
    case "contains":
    case "startsWith":
      return [...say(arg(0), kind, r), word(e.fn === "contains" ? "contains" : "starts with"), ...sayAt(arg(1), kind, r, fieldAt(arg(0), kind, r))];
    case "today":
      return [value("today")];
    case "now":
      return [value("now")];
    case "date":
      return literalOf(arg(0)) && typeof (arg(0) as { value: unknown }).value === "string" ? [value(dayAsRead(String((arg(0) as { value: string }).value)))] : say(arg(0), kind, r);
    case "days":
    case "hours": {
      const unit = e.fn;
      const [from, to] = [arg(0), arg(1)];
      if (callOf(to, "today") || callOf(to, "now")) return [word(`${unit} since`), ...say(from, kind, r)];
      if (callOf(from, "today") || callOf(from, "now")) return [word(`${unit} until`), ...say(to, kind, r)];
      return [word(`${unit} from`), ...say(from, kind, r), word("to"), ...say(to, kind, r)];
    }
    case "if":
      return [OPEN, ...say(arg(1), kind, r), word("if"), ...say(arg(0), kind, r), word(","), word("else"), ...say(arg(2), kind, r), CLOSE];
    case "either":
      return e.args.flatMap((one, i) => (i === 0 ? say(one, kind, r) : [word(","), word("else"), ...say(one, kind, r)]));
    default:
      return [word(e.fn), OPEN, ...e.args.flatMap((one, i) => (i === 0 ? say(one, kind, r) : [word(","), ...say(one, kind, r)])), CLOSE];
  }
}

/** A rule's line from the declaration alone: what must hold, and which records it judges. */
export function ruleLineOf(rule: LinedRule, words: LineWords): RuleLine {
  const r = reader(words);
  const kind = rule.over === "graph" ? null : rule.over;
  return finishedLine({
    ...(kind === null ? {} : { kind }),
    parts: say(rule.require, kind, r),
    ...(rule.when ? { when: say(rule.when, kind, r) } : {}),
  });
}

/**
 * THE SAME LINE FOR ONE RECORD THAT BREAKS IT: each part of the judgment
 * that does not hold, with the values the record has, the comparison turned
 * the way it stands. A part it cannot read with values is said as the rule
 * says it, after "not". Never throws: a line that cannot be worked out is
 * the rule's own line.
 */
export function brokenLineOf(rule: LinedRule, words: LineWords, ctx: EvalContext): RuleLine {
  const r = reader(words);
  const kind = rule.over === "graph" ? null : rule.over;
  const subject = ctx.subject;
  const held = (e: Expr): Value | undefined => {
    try {
      return evaluateExpr(e, { ...ctx, budget: 2_000 });
    } catch {
      return undefined;
    }
  };
  const valued = (e: Expr, partner?: { readonly kind: Kind; readonly key: string }): Parts => {
    const parts = sayAt(e, kind, r, partner);
    if (e.t === "lit" || e.t === "list" || callOf(e, "today") || callOf(e, "now") || callOf(e, "date")) return parts;
    const v = held(e);
    if (v === undefined) return parts;
    const at = fieldAt(e, kind, r);
    const shown = r.valueWords(v, at ? { ...at, format: r.formatOf(at.kind, at.key) ?? (partner ? r.formatOf(partner.kind, partner.key) : undefined) } : partner);
    return v instanceof NodeSet ? [...parts, word(":"), shown] : [...parts, shown];
  };
  const why = (e: Expr): Parts => {
    if (e.t === "binary" && e.op === "&&") {
      const sides: Expr[] = [];
      sides.push(...sidesOf(e, "&&"));
      const broken = sides.filter((side) => held(side) !== true);
      return (broken.length > 0 ? broken : sides).flatMap((side, i) => [...(i > 0 ? [word("and")] : []), ...(level(side) <= 2 ? [OPEN, ...why(side), CLOSE] : why(side))]);
    }
    if (e.t === "binary" && e.op === "||") {
      const many = oneOf(e);
      if (many) {
        const at = fieldAt(many.subject, kind, r);
        return [...valued(many.subject), op("∉", "is not one of"), r.valueWords(many.values.map((v) => (v as { value: Value }).value) as Value, at)];
      }
      const sides: Expr[] = [];
      sides.push(...sidesOf(e, "||"));
      return sides.flatMap((side, i) => [...(i > 0 ? [word("and")] : []), ...(level(side) <= 2 ? [OPEN, ...why(side), CLOSE] : why(side))]);
    }
    if (e.t === "binary" && e.op in COMPARE) {
      if (literalOf(e.right) && typeof e.right.value === "boolean" && (e.op === "==" || e.op === "!=")) {
        // It was not what was asked: `done == true` broken is "not done".
        const yes = (e.op === "==") === e.right.value;
        return yes ? negated(e.left, kind, r) : say(e.left, kind, r);
      }
      const turned = TURNED[e.op]!;
      const [symbol, said] = COMPARE[turned]!;
      const leftAt = fieldAt(e.left, kind, r);
      const rightAt = fieldAt(e.right, kind, r);
      // Absent where there is nothing to compare: `quote != null` broken is "quote = —".
      if (literalOf(e.right) && e.right.value === null) return [...(turned === "==" ? sayAt(e.left, kind, r, rightAt) : valued(e.left, rightAt)), op(symbol, said), NONE];
      // `status != 'booked'` broken is "status = booked": the value would only say the word again.
      const plain = turned === "==" && (literalOf(e.right) || literalOf(e.left));
      return [...(plain ? sayAt(e.left, kind, r, rightAt) : valued(e.left, rightAt)), op(symbol, said), ...(plain ? sayAt(e.right, kind, r, leftAt) : valued(e.right, leftAt))];
    }
    if (e.t === "binary" && e.op === "in") return [...valued(e.left), op("∉", "is not one of"), ...sayAt(e.right, kind, r, fieldAt(e.left, kind, r))];
    if (e.t === "unary" && e.op === "!") {
      const inner = e.operand;
      if (isComparison(inner)) return why({ ...inner, op: TURNED[inner.op]! });
      // It is there after all: "applied 3 Oct 2026 ≠ —", "purchases with status ≠ done: Tile and Grout ≠ —".
      if (callOf(inner, "present") || callOf(inner, "exists")) return [...valued(inner.args[0]!), op("≠", "is not"), NONE];
      if (inner.t === "ident") return say(inner, kind, r);
      return [word("not"), OPEN, ...negated(inner, kind, r), CLOSE];
    }
    if (callOf(e, "present") || callOf(e, "exists")) return [...say(e.args[0]!, kind, r), op("=", "is"), NONE];
    if (callOf(e, "some")) return [...say(e, kind, r).slice(1), op("=", "is"), NONE];
    if (callOf(e, "every") && e.args.length === 2) {
      // The members that do not, by name.
      const set = held(e.args[0]!);
      if (set instanceof NodeSet) {
        const failing = set.nodes.filter((member) => {
          try {
            return evaluateExpr(e.args[1]!, { ...ctx, subject: member, budget: 2_000 }) !== true;
          } catch {
            return true;
          }
        });
        return [...say(e, kind, r), word(","), word("not"), r.valueWords(new NodeSet(failing))];
      }
    }
    if (e.t === "ident") return [word("not"), name(r.fieldName(kind, e.name))];
    return [word("not"), OPEN, ...say(e, kind, r), CLOSE];
  };
  let parts: Parts;
  try {
    parts = why(rule.require);
  } catch {
    parts = [word("not"), OPEN, ...say(rule.require, kind, r), CLOSE];
  }
  return finishedLine({
    ...(kind === null ? {} : { kind }),
    parts,
    ...(subject ? { record: labelOf(words.schema.tryDefinition(subject.kind), subject) } : {}),
  });
}

/** The formats a rule's own sentence gives its names: `{margin|percent}` says margin is a percent. */
export function formatsSaid(says: readonly TemplatePart[] | undefined): ReadonlyMap<string, Formatter> {
  const said = new Map<string, Formatter>();
  for (const part of says ?? []) {
    if (part.expr?.t === "ident" && part.format && (part.format === "money" || part.format === "percent" || part.format === "date")) said.set(part.expr.name, part.format);
  }
  return said;
}
