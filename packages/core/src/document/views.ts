import { analyzeExpr } from "./expr/analyze.js";
import { ExprSyntaxError, parseExpr, type Expr } from "./expr/parse.js";
import { error, warning, type Finding } from "./findings.js";
import type { AnySchema } from "../schema/schema.js";
import type { GraviewDocument } from "./schema.js";
import { fieldSpecOf } from "./to-document.js";
import { parseTemplate, TemplateError, type TemplatePart } from "./template.js";

/*
 * VIEW SPECS — Tier 1 custom UI, as data (ADR 0004, docs/declaration-document.md).
 *
 *   "views": { "vendor": { "card": [ { "title": "{name}" }, { "badge": "{status}", "tone": … } ] } }
 *
 * A view spec is a short list of BLOCKS from a closed set, bound to the
 * record by the same templates and rule-language expressions the rest of the
 * document uses. There is no CSS, no HTML and no URL a block can carry: the
 * only link a view ever draws is a `url` FIELD's own value, and only when it
 * is http(s). The renderer (packages/client/src/views.tsx) styles blocks
 * with the theme's tokens and a fixed set of classes.
 *
 * Checked here into findings with JSON paths, so a model that writes
 * `{"badge": "{status}", "tone": "green"}` is told which tone set it meant.
 *
 * The document's view vocabulary is checked here; drawing it is FR-03's.
 */

export const VIEW_SLOTS = ["card", "row", "page"] as const;
export type ViewSlot = (typeof VIEW_SLOTS)[number];
export const VIEW_TONES = ["good", "warn", "bad", "neutral", "accent"] as const;
export type ViewTone = (typeof VIEW_TONES)[number];
export const VIEW_FIELD_FORMATS = ["money", "percent", "date", "relative", "count"] as const;
export type ViewFieldFormat = (typeof VIEW_FIELD_FORMATS)[number];
/** Groups and conditions nest; four deep is more than any card needs. */
export const MAX_VIEW_DEPTH = 4;
/** Blocks in one view, counting nested ones. */
export const MAX_VIEW_BLOCKS = 40;

export type ToneSpec = ViewTone | { readonly expr: string };

/** How a `figure` block says its number (FR-81). */
export const FIGURE_FORMATS = ["number", "money", "percent"] as const;
export type FigureFormat = (typeof FIGURE_FORMATS)[number];
/** How a `list` block draws each record it lists: with the kind's own card, or its own row (FR-81, FR-82). */
export const LIST_AS = ["card", "row"] as const;
/** The most records one list draws; a `limit` says fewer. */
export const MAX_LIST_LIMIT = 100;

/** A list's order: a key read from each record, ascending — or `{ by, direction }`, where "choices" is the order a choice field's choices are declared in. */
export type ListSort = string | { readonly by: string; readonly direction?: "asc" | "desc" | "choices" };
/** A list's grouping: a choice field, with a heading per choice where its value does not say it. */
export type ListGroup = string | { readonly by: string; readonly headings?: Readonly<Record<string, string>> };

export type ViewBlock =
  | { readonly title: string }
  | { readonly headline: string }
  | { readonly figure: string; readonly as?: FigureFormat; readonly currency?: string; readonly label?: string }
  | {
      readonly list: string;
      readonly sort?: ListSort;
      readonly limit?: number;
      readonly group?: ListGroup;
      readonly empty?: string;
      readonly as?: (typeof LIST_AS)[number];
    }
  | { readonly text: string; readonly tone?: ToneSpec }
  | { readonly badge: string; readonly tone?: ToneSpec }
  | { readonly field: string; readonly as?: ViewFieldFormat; readonly label?: string }
  | { readonly progress: { readonly value: string; readonly max: string }; readonly label?: string }
  | { readonly group: readonly ViewBlock[]; readonly direction?: "row" | "column" }
  | { readonly when: string; readonly show: readonly ViewBlock[] }
  | { readonly divider: true }
  | { readonly figure: true };

export type ViewSpecs = { readonly [slot in ViewSlot]?: readonly ViewBlock[] };

/**
 * THE HOME VIEW (FR-81): blocks about no one record, drawn as the home's
 * body on both faces. A document writes it as `views.home`, a list of
 * blocks — a kind's views are an object of slots, so a kind that happens to
 * be called `home` keeps its own — and a declaration as `home`.
 */
export type HomeView = readonly ViewBlock[];

/** Every kind's view specs, by kind: a document's `views`, and a declaration's `viewSpecs`. */
export type ViewSpecsByKind = Readonly<Record<string, ViewSpecs>>;

/** What each block may say besides the key that names it. */
const BLOCK_KEYS: Readonly<Record<string, readonly string[]>> = {
  title: [],
  headline: [],
  list: ["sort", "limit", "group", "empty", "as"],
  text: ["tone"],
  badge: ["tone"],
  field: ["as", "label"],
  progress: ["label"],
  group: ["direction"],
  when: ["show"],
  divider: [],
  // `{"figure": true}` is the kind's picture; `{"figure": expr, …}` a number worked out (FR-81).
  figure: ["as", "currency", "label"],
};
const BLOCK_TYPES = Object.keys(BLOCK_KEYS);
const SHAPES =
  '{"title": "{name}"}, {"headline": "{count(all(\'offer\'))} offers"}, {"figure": expr, "as"?: "number"|"money"|"percent", "currency"?, "label"?}, {"list": expr, "sort"?, "limit"?, "group"?, "empty"?, "as"?: "card"|"row"}, {"text": "…", "tone"?}, {"badge": "{status}", "tone"?}, {"field": "quote", "as"?, "label"?}, {"progress": {"value": expr, "max": expr}, "label"?}, {"group": [blocks], "direction"?: "row"|"column"}, {"when": expr, "show": [blocks]}, {"divider": true}, {"figure": true}';

/** The view specs of a document that has been read, by kind; empty when it has none. The home view is no kind's: see `homeOf`. */
export function viewsOf(document: GraviewDocument): Readonly<Record<string, ViewSpecs>> {
  return Object.fromEntries(Object.entries(document.views ?? {}).filter(([, specs]) => !Array.isArray(specs))) as Readonly<Record<string, ViewSpecs>>;
}

/** A document's home view (`views.home`, a list of blocks), when it has one. */
export function homeOf(document: GraviewDocument): HomeView | undefined {
  const home = (document.views as Record<string, unknown> | undefined)?.["home"];
  return Array.isArray(home) ? (home as HomeView) : undefined;
}

/**
 * What a view may name on one kind: its fields, its relations, whether it
 * has a figure. Read from a document's kind or from a declared schema, so
 * the two are held to one vocabulary.
 */
interface KindNames {
  readonly field: (name: string) => boolean;
  readonly relation: (name: string) => boolean;
  readonly figure: boolean;
  /** A choice field's choices, in the order they are declared; undefined for any other name. */
  readonly choices?: (name: string) => readonly string[] | undefined;
  /** Where a relation leads: its target kinds, or every kind. */
  readonly targets?: (relation: string) => readonly string[] | "*" | undefined;
}

/** What every kind holds, for a list's records: the kinds a walk or a sweep reaches. */
interface Vocabulary {
  readonly namesOf: (kind: string) => KindNames | undefined;
  /** The kinds that declare a relation. */
  readonly sources: (edge: string) => readonly string[];
}

interface Scope {
  /** The kind the blocks are about, or null for blocks about no one record (the home, a blocks lens). */
  readonly kind: string | null;
  readonly spec: KindNames;
  readonly kinds: ReadonlySet<string>;
  readonly edges: ReadonlySet<string>;
  readonly vocabulary: Vocabulary;
  readonly findings: Finding[];
  count: number;
}

const NO_RECORD: KindNames = { field: () => false, relation: () => false, figure: false };
const about = (scope: Scope) => scope.kind ?? "the home";
const own = (record: object | undefined, key: string) => record !== undefined && Object.prototype.hasOwnProperty.call(record, key);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function names(expr: Expr, path: string, scope: Scope) {
  const shape = analyzeExpr(expr);
  for (const fn of shape.unknownFunctions) scope.findings.push(error("unknown-function", path, `"${fn}" is not a function the rule language knows`, "see docs/declaration-document.md#expression-language"));
  for (const n of shape.names) {
    if (scope.kind === null) {
      scope.findings.push(error("view-name", path, `"${n}" names nothing here: these blocks are about no one record`, "reach records with all('<kind>'), like count(all('offer')) or first(all('party') where role == 'client').name"));
      continue;
    }
    if (n === "id" || scope.spec.field(n) || scope.spec.relation(n)) continue;
    scope.findings.push(error("view-name", path, `${scope.kind} has no field or relation called "${n}"`));
  }
  for (const e of shape.edges) if (!scope.edges.has(e)) scope.findings.push(error("view-edge", path, `"${e}" is not a relation any kind declares`));
  for (const k of shape.sweeps) if (!scope.kinds.has(k)) scope.findings.push(error("view-kind", path, `"${k}" is not a kind this document declares`));
}

function expression(source: unknown, path: string, scope: Scope): void {
  if (typeof source !== "string" || source.length === 0 || source.length > 2000) {
    scope.findings.push(error("view-expression", path, "an expression is a line of the rule language, like \"status == 'booked'\""));
    return;
  }
  try {
    names(parseExpr(source), path, scope);
  } catch (e) {
    if (!(e instanceof ExprSyntaxError)) throw e;
    scope.findings.push(error("expression", path, `${e.sentence} (at character ${e.at + 1})`));
  }
}

function template(source: unknown, path: string, scope: Scope): void {
  if (typeof source !== "string" || source.length === 0 || source.length > 300) {
    scope.findings.push(error("view-template", path, 'a template is words with {field} in braces, like "{name}" or "{quote|money}", at most 300 characters'));
    return;
  }
  let parts: readonly TemplatePart[];
  try {
    parts = parseTemplate(source);
  } catch (e) {
    if (e instanceof TemplateError || e instanceof ExprSyntaxError) {
      scope.findings.push(error("template", path, e.sentence));
      return;
    }
    throw e;
  }
  for (const part of parts) if (part.expr) names(part.expr, path, scope);
}

function tone(value: unknown, path: string, scope: Scope): void {
  if (typeof value === "string") {
    if (!(VIEW_TONES as readonly string[]).includes(value)) scope.findings.push(error("view-tone", path, `"${value}" is not a tone`, `use one of ${VIEW_TONES.join(", ")}, or {"expr": "if(status == 'booked', 'good', 'neutral')"}`));
    return;
  }
  if (isObject(value) && Object.keys(value).length === 1 && "expr" in value) {
    expression(value["expr"], `${path}.expr`, scope);
    return;
  }
  scope.findings.push(error("view-tone", path, "a tone is a word or {\"expr\": …}", `one of ${VIEW_TONES.join(", ")}`));
}

function blocks(list: unknown, path: string, depth: number, scope: Scope): void {
  if (!Array.isArray(list)) {
    scope.findings.push(error("view-shape", path, "a view is a list of blocks"));
    return;
  }
  if (depth > MAX_VIEW_DEPTH) {
    scope.findings.push(error("view-depth", path, `blocks nest at most ${MAX_VIEW_DEPTH} deep`, "flatten a group or a condition"));
    return;
  }
  list.forEach((block, i) => oneBlock(block, `${path}.${i}`, depth, scope));
}

function oneBlock(raw: unknown, path: string, depth: number, scope: Scope): void {
  scope.count++;
  if (!isObject(raw)) {
    scope.findings.push(error("view-block", path, "a block is an object naming what it shows", `one of ${SHAPES}`));
    return;
  }
  const keys = Object.keys(raw);
  // A list's `group` is how it is grouped, not a group block of its own.
  const types = keys.filter((k) => BLOCK_TYPES.includes(k) && !(k === "group" && keys.includes("list")));
  if (types.length === 0) {
    scope.findings.push(error("view-block", path, `${keys.length > 0 ? keys.map((k) => `"${k}"`).join(", ") : "an empty object"} is not a block Graview knows`, `one of ${SHAPES}`));
    return;
  }
  if (types.length > 1) {
    scope.findings.push(error("view-block", path, `a block is one thing, and this says ${types.map((k) => `"${k}"`).join(" and ")}`, "split it into two blocks"));
    return;
  }
  const type = types[0]!;
  for (const k of keys) if (k !== type && !BLOCK_KEYS[type]!.includes(k)) scope.findings.push(error("unknown-key", `${path}.${k}`, `"${k}" is not part of a ${type} block`, BLOCK_KEYS[type]!.length > 0 ? `a ${type} block may also say ${BLOCK_KEYS[type]!.map((x) => `"${x}"`).join(", ")}` : `a ${type} block says nothing else`));
  const value = raw[type];
  switch (type) {
    case "title":
    case "headline":
    case "text":
    case "badge":
      template(value, `${path}.${type}`, scope);
      if ("tone" in raw) tone(raw["tone"], `${path}.tone`, scope);
      return;
    case "field": {
      if (typeof value !== "string" || !scope.spec.field(value)) {
        const edge = typeof value === "string" && scope.spec.relation(value);
        scope.findings.push(error("view-field", `${path}.field`, `${scope.kind} has no field ${typeof value === "string" ? `"${value}"` : "by that name"}`, edge ? `"${value}" is a relation; show it with {"text": "{${value}.name}"}` : undefined));
      }
      if ("as" in raw && !(VIEW_FIELD_FORMATS as readonly unknown[]).includes(raw["as"])) scope.findings.push(error("view-format", `${path}.as`, `"${String(raw["as"])}" is not a way to show a field`, `use one of ${VIEW_FIELD_FORMATS.join(", ")}`));
      if ("label" in raw) label(raw["label"], `${path}.label`, scope);
      return;
    }
    case "progress": {
      if (!isObject(value) || Object.keys(value).some((k) => k !== "value" && k !== "max") || !("value" in value) || !("max" in value)) {
        scope.findings.push(error("view-progress", `${path}.progress`, 'progress is {"value": expression, "max": expression}'));
      } else {
        expression(value["value"], `${path}.progress.value`, scope);
        expression(value["max"], `${path}.progress.max`, scope);
      }
      // A meter's label is a template, like a figure's (FR-99).
      if ("label" in raw) template(raw["label"], `${path}.label`, scope);
      return;
    }
    case "group":
      if ("direction" in raw && raw["direction"] !== "row" && raw["direction"] !== "column") scope.findings.push(error("view-direction", `${path}.direction`, `a group runs "row" or "column", not "${String(raw["direction"])}"`));
      blocks(value, `${path}.group`, depth + 1, scope);
      return;
    case "when":
      expression(value, `${path}.when`, scope);
      if (!("show" in raw)) scope.findings.push(error("view-when", path, 'a condition says what it shows: {"when": expr, "show": [blocks]}'));
      else blocks(raw["show"], `${path}.show`, depth + 1, scope);
      return;
    case "figure":
      if (typeof value === "string") return figureBlock(raw, path, scope);
      for (const k of ["as", "currency", "label"]) if (k in raw) scope.findings.push(error("unknown-key", `${path}.${k}`, `"${k}" belongs to a figure that works a number out; {"figure": true} is the kind's picture`, `write {"figure": "count(all('offer'))", "as": "number"}`));
      if (value !== true) scope.findings.push(error("view-block", `${path}.figure`, `a figure is a number worked out, {"figure": "sum(all('offer'), net)", "as": "money"}, or the kind's picture, {"figure": true}`));
      else if (!scope.spec.figure) scope.findings.push(error("view-figure", `${path}.figure`, `${about(scope)} has no figure to show`, scope.kind === null ? `work a number out: {"figure": "count(all('offer'))"}` : 'give the kind a "figure", or leave this block out'));
      return;
    case "list":
      return listBlock(raw, path, scope);
    case "divider":
      if (value !== true) scope.findings.push(error("view-block", `${path}.${type}`, `write {"${type}": true}`));
      return;
  }
}

/** A figure that works a number out (FR-81): an expression, a formatter, a currency for money, a label. */
function figureBlock(raw: Record<string, unknown>, path: string, scope: Scope): void {
  expression(raw["figure"], `${path}.figure`, scope);
  if ("as" in raw && !(FIGURE_FORMATS as readonly unknown[]).includes(raw["as"])) scope.findings.push(error("view-format", `${path}.as`, `"${String(raw["as"])}" is not a way to say a figure`, `use one of ${FIGURE_FORMATS.join(", ")}`));
  if ("currency" in raw) {
    if (typeof raw["currency"] !== "string" || !/^[A-Z]{3}$/.test(raw["currency"])) scope.findings.push(error("view-currency", `${path}.currency`, 'a currency is its three-letter code, like "USD" or "EUR"'));
    else if (raw["as"] !== "money") scope.findings.push(error("view-currency", `${path}.currency`, "a currency belongs on a figure shown as money", 'add "as": "money"'));
  }
  // A figure's label is a template, like a headline (FR-99): "{name}, net".
  if ("label" in raw) template(raw["label"], `${path}.label`, scope);
}

/**
 * THE KINDS A LIST'S RECORDS ARE, read from its source without running it:
 * `all('offer')` lists offers; `out('includes')` the targets of the
 * relation from the kind the view is about; `in('answers')` the kinds that
 * declare it; a relation by name its targets; `where`, `sort`, `first` and
 * `either` the kinds of what they are handed. Undefined when the source
 * does not say — then its names are not held to one kind.
 */
function listedKinds(expr: Expr, scope: Scope): readonly string[] | undefined {
  const every = [...scope.kinds];
  const targetsFrom = (kinds: readonly string[], relation: string): readonly string[] | undefined => {
    const found = new Set<string>();
    for (const kind of kinds) {
      const to = scope.vocabulary.namesOf(kind)?.targets?.(relation);
      if (to === "*") return every;
      for (const target of to ?? []) found.add(target);
    }
    return found.size > 0 ? [...found] : undefined;
  };
  const visit = (e: Expr): readonly string[] | undefined => {
    switch (e.t) {
      case "ident":
        return scope.kind !== null && scope.spec.relation(e.name) ? targetsFrom([scope.kind], e.name) : undefined;
      case "member": {
        const from = visit(e.object);
        return from ? targetsFrom(from, e.name) : undefined;
      }
      case "where":
        return visit(e.set);
      case "call": {
        const first = e.args[0];
        const word = first?.t === "lit" && typeof first.value === "string" ? first.value : undefined;
        if (e.fn === "all") return word !== undefined && scope.kinds.has(word) ? [word] : undefined;
        // A walk from every member of a set (FR-101): out(S, 'edge') reaches what the relation leads to from S's kinds.
        const walked = e.args.length === 2 && e.args[1]?.t === "lit" && typeof e.args[1].value === "string" ? e.args[1].value : undefined;
        if (e.fn === "out" && walked !== undefined) {
          const from = visit(first!);
          return from ? targetsFrom(from, walked) : undefined;
        }
        if (e.fn === "out") return word !== undefined && scope.kind !== null ? targetsFrom([scope.kind], word) : undefined;
        if (e.fn === "in") {
          const relation = walked ?? word;
          const sources = relation !== undefined ? scope.vocabulary.sources(relation) : [];
          return sources.length > 0 ? sources : undefined;
        }
        if ((e.fn === "sort" || e.fn === "first") && first) return visit(first);
        if (e.fn === "either") {
          const each = e.args.map(visit);
          return each.every((one) => one !== undefined) ? [...new Set(each.flatMap((one) => one ?? []))] : undefined;
        }
        return undefined;
      }
      default:
        return undefined;
    }
  };
  return visit(expr);
}

/** A per-record expression of a list (its sort key), its names held to the kinds the list reaches. */
function memberExpression(source: string, path: string, kinds: readonly string[] | undefined, scope: Scope): void {
  let parsed: Expr;
  try {
    parsed = parseExpr(source);
  } catch (e) {
    if (!(e instanceof ExprSyntaxError)) throw e;
    scope.findings.push(error("expression", path, `${e.sentence} (at character ${e.at + 1})`));
    return;
  }
  const shape = analyzeExpr(parsed);
  for (const fn of shape.unknownFunctions) scope.findings.push(error("unknown-function", path, `"${fn}" is not a function the rule language knows`, "see docs/declaration-document.md#expression-language"));
  for (const e of shape.edges) if (!scope.edges.has(e)) scope.findings.push(error("view-edge", path, `"${e}" is not a relation any kind declares`));
  if (!kinds) return;
  for (const n of shape.names) {
    if (n === "id" || kinds.some((kind) => scope.vocabulary.namesOf(kind)?.field(n) || scope.vocabulary.namesOf(kind)?.relation(n))) continue;
    scope.findings.push(error("view-name", path, `${kinds.join(" and ")} ${kinds.length === 1 ? "has" : "have"} no field or relation called "${n}"`));
  }
}

/** A list of records (FR-81) — chosen by an expression, or a walk from the record (FR-82) — in an order, a few, grouped, each drawn as its card or its row. */
function listBlock(raw: Record<string, unknown>, path: string, scope: Scope): void {
  const source = raw["list"];
  expression(source, `${path}.list`, scope);
  let kinds: readonly string[] | undefined;
  if (typeof source === "string") {
    try {
      kinds = listedKinds(parseExpr(source), scope);
    } catch {
      kinds = undefined;
    }
  }
  /** A choice field's choices across the kinds listed — or, when the source does not say, on any kind. */
  const choicesOf = (field: string): readonly string[] | undefined => {
    if (!kinds) return [...scope.kinds].map((kind) => scope.vocabulary.namesOf(kind)?.choices?.(field)).find((choices) => choices !== undefined);
    const each = kinds.map((kind) => scope.vocabulary.namesOf(kind)?.choices?.(field));
    return each.every((choices) => choices !== undefined) ? [...new Set(each.flatMap((choices) => choices ?? []))] : undefined;
  };
  const named = kinds ? kinds.join(" and ") : "any kind";

  if ("sort" in raw) {
    const sort = raw["sort"];
    if (typeof sort === "string") memberExpression(sort, `${path}.sort`, kinds, scope);
    else if (isObject(sort) && typeof sort["by"] === "string" && Object.keys(sort).every((k) => k === "by" || k === "direction")) {
      const direction = sort["direction"];
      if (direction !== undefined && direction !== "asc" && direction !== "desc" && direction !== "choices") {
        scope.findings.push(error("list-sort", `${path}.sort.direction`, `a list is sorted "asc", "desc" or "choices", not "${String(direction)}"`, '"choices" puts a choice field in the order its choices are declared'));
      } else if (direction === "choices") {
        if (choicesOf(sort["by"]) === undefined) scope.findings.push(error("list-sort", `${path}.sort.by`, `"${sort["by"]}" is not a choice field of ${named}, so it has no declared order`, 'sort by a choice field, or say "asc" or "desc"'));
      } else memberExpression(sort["by"], `${path}.sort.by`, kinds, scope);
    } else scope.findings.push(error("list-sort", `${path}.sort`, 'a sort is a key, like "net", or {"by": key, "direction": "asc" | "desc" | "choices"}'));
  }
  if ("limit" in raw) {
    const limit = raw["limit"];
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) scope.findings.push(error("list-limit", `${path}.limit`, `a limit is a whole number from 1 to ${MAX_LIST_LIMIT}`));
  }
  if ("group" in raw) {
    const group = raw["group"];
    const by = typeof group === "string" ? group : isObject(group) && typeof group["by"] === "string" ? group["by"] : undefined;
    const shaped = typeof group === "string" || (isObject(group) && Object.keys(group).every((k) => k === "by" || k === "headings"));
    if (!shaped || by === undefined) {
      scope.findings.push(error("list-group", `${path}.group`, 'a group is a choice field, like "type", or {"by": "type", "headings": {"pain": "What hurts"}}'));
    } else {
      const choices = choicesOf(by);
      if (choices === undefined) scope.findings.push(error("list-group", `${path}.group`, `"${by}" is not a choice field of ${named}, so it has no choices to group by`, "group by a field whose type is enum"));
      if (isObject(group) && "headings" in group) {
        const headings = group["headings"];
        if (!isObject(headings) || Object.values(headings).some((words) => typeof words !== "string" || words.length === 0 || words.length > 80)) {
          scope.findings.push(error("list-group", `${path}.group.headings`, 'headings are words per choice, like {"pain": "What hurts"}, at most 80 characters each'));
        } else {
          if (choices) for (const choice of Object.keys(headings)) if (!choices.includes(choice)) scope.findings.push(error("list-group", `${path}.group.headings.${choice}`, `"${choice}" is not one of ${by}'s choices`, `use ${choices.join(", ")}`));
          for (const [choice, words] of Object.entries(headings)) braces(words, `${path}.group.headings.${choice}`, scope, "a group's heading");
        }
      }
    }
  }
  if ("empty" in raw && (typeof raw["empty"] !== "string" || raw["empty"].length === 0 || raw["empty"].length > 200)) scope.findings.push(error("list-empty", `${path}.empty`, "what an empty list says is a sentence, at most 200 characters"));
  else braces(raw["empty"], `${path}.empty`, scope, "what an empty list says");
  if ("as" in raw && !(LIST_AS as readonly unknown[]).includes(raw["as"])) scope.findings.push(error("list-as", `${path}.as`, `a list draws each record as its "card" or its "row", not "${String(raw["as"])}"`));
}

function label(value: unknown, path: string, scope: Scope): void {
  if (typeof value !== "string" || value.length === 0 || value.length > 60) scope.findings.push(error("view-label", path, "a label is a few words, at most 60 characters"));
  else braces(value, path, scope, "a field's label");
}

/** Braces in words that are no template would be drawn as written (FR-99): said at the block's path, never drawn raw unannounced. */
function braces(value: unknown, path: string, scope: Scope, what: string): void {
  if (typeof value === "string" && /[{}]/.test(value)) {
    scope.findings.push(warning("view-braces", path, `${what} is words, not a template, so "${value}" would be drawn with its braces`, 'say it without braces, or say the value in a text block: {"text": "… {name} …"}'));
  }
}

/** Blocks about no one record — the home, a blocks lens — checked at `at`. */
function subjectless(list: unknown, at: string, vocabulary: Vocabulary, kinds: ReadonlySet<string>, edges: ReadonlySet<string>, findings: Finding[], what: string): void {
  const scope: Scope = { kind: null, spec: NO_RECORD, kinds, edges, vocabulary, findings, count: 0 };
  if (Array.isArray(list) && list.length === 0) findings.push(error("view-shape", at, `${what} has no blocks`, 'give it one: {"headline": "…"}'));
  blocks(list, at, 1, scope);
  if (scope.count > MAX_VIEW_BLOCKS) findings.push(error("view-size", at, `${what} has ${scope.count} blocks; a view has at most ${MAX_VIEW_BLOCKS}`, "show less"));
}

/** The lenses drawn from blocks, by their index in `lenses`: their blocks, checked where they are written. */
function blockLenses(lenses: unknown, vocabulary: Vocabulary, kinds: ReadonlySet<string>, edges: ReadonlySet<string>, findings: Finding[]): void {
  if (!Array.isArray(lenses)) return;
  lenses.forEach((lens, index) => {
    if (!isObject(lens) || lens["name"] !== "blocks" || !isObject(lens["options"]) || !("blocks" in lens["options"])) return;
    /*
     * WARNINGS, NOT ERRORS: before FR-81 a lens called "blocks" was a lens
     * the framework did not ship — a warning — and a document carrying one
     * compiled. It still does; a block the lens cannot draw is left out of
     * the picture, and the check says which at its path.
     */
    const found: Finding[] = [];
    subjectless(lens["options"]["blocks"], `lenses.${index}.options.blocks`, vocabulary, kinds, edges, found, `the lens "${String(lens["title"] ?? index)}"`);
    for (const finding of found) findings.push({ ...finding, severity: "warning" });
  });
}

/** Every kind's specs, checked against what each kind holds, at `<at>.<kind>.<slot>`; and a list of blocks at `<at>.home`, the home view. */
function validateAll(
  specsByKind: unknown,
  at: string,
  namesOf: (kind: string) => KindNames | undefined,
  kinds: ReadonlySet<string>,
  edges: ReadonlySet<string>,
  declares: string,
  vocabulary: Vocabulary,
): Finding[] {
  const findings: Finding[] = [];
  if (specsByKind === undefined) return findings;
  if (!isObject(specsByKind)) {
    findings.push(error("view-shape", at, 'views are an object of kinds, each with a "card", a "row" or a "page"'));
    return findings;
  }
  for (const [kind, specs] of Object.entries(specsByKind)) {
    // A list of blocks at `home` is the home view (FR-81); an object there is the slots of a kind called home.
    if (kind === "home" && Array.isArray(specs)) {
      subjectless(specs, `${at}.home`, vocabulary, kinds, edges, findings, "the home");
      continue;
    }
    const spec = namesOf(kind);
    if (!spec) {
      findings.push(error("view-kind", `${at}.${kind}`, `"${kind}" is not a kind this ${declares} declares`));
      continue;
    }
    if (!isObject(specs)) {
      findings.push(error("view-shape", `${at}.${kind}`, 'a kind\'s views are {"card": [blocks], "row": [blocks], "page": [blocks]}'));
      continue;
    }
    for (const key of Object.keys(specs)) {
      if (!(VIEW_SLOTS as readonly string[]).includes(key)) findings.push(error("view-slot", `${at}.${kind}.${key}`, `"${key}" is not a place a view is drawn`, `use ${VIEW_SLOTS.map((slot) => `"${slot}"`).join(", ")}`));
    }
    for (const slot of VIEW_SLOTS) {
      const list = specs[slot];
      if (list === undefined) continue;
      const scope: Scope = { kind, spec, kinds, edges, vocabulary, findings, count: 0 };
      blocks(list, `${at}.${kind}.${slot}`, 1, scope);
      if (scope.count > MAX_VIEW_BLOCKS) findings.push(error("view-size", `${at}.${kind}.${slot}`, `this ${slot} has ${scope.count} blocks; a view has at most ${MAX_VIEW_BLOCKS}`, "show less, or move detail to the page"));
    }
  }
  return findings;
}

/** Findings about a document's `views` — every kind's, and the home's — and its blocks lenses, each at its JSON path. */
export function validateViews(document: GraviewDocument): Finding[] {
  const kinds = new Set(Object.keys(document.kinds));
  const edges = new Set(Object.values(document.kinds).flatMap((k) => Object.keys(k.edges ?? {})));
  const namesOf = (kind: string): KindNames | undefined => {
    const spec = own(document.kinds, kind) ? document.kinds[kind] : undefined;
    // A computed field is shown like a stored one (FR-83).
    return spec
      ? {
          field: (n) => own(spec.fields, n) || own(spec.computed, n),
          relation: (n) => own(spec.edges, n),
          figure: spec.figure !== undefined,
          choices: (n) => (own(spec.fields, n) && spec.fields[n]!.type === "enum" ? spec.fields[n]!.options : undefined),
          targets: (n) => (own(spec.edges, n) ? spec.edges![n]!.to : undefined),
        }
      : undefined;
  };
  const vocabulary: Vocabulary = { namesOf, sources: (edge) => Object.keys(document.kinds).filter((kind) => own(document.kinds[kind]!.edges, edge)) };
  const findings = validateAll(document.views, "views", namesOf, kinds, edges, "document", vocabulary);
  blockLenses(document.lenses, vocabulary, kinds, edges, findings);
  return findings;
}

type DeclaredKind = { readonly fields?: { readonly shape?: Readonly<Record<string, unknown>> }; readonly edges?: Readonly<Record<string, { readonly to?: readonly string[] | "*" }>>; readonly figure?: string; readonly computed?: Readonly<Record<string, unknown>> };

/**
 * Findings about a declaration's view specs (FR-03), each at
 * `viewSpecs.<kind>.<slot>.<block>`: the vocabulary a document's `views`
 * is held to, read against the declared schema — its fields, its relations,
 * and its figures (the kind's own, or the brand's). With `home`, the
 * declaration's home view at `home.<block>`; with `lenses`, the blocks of
 * each lens drawn from blocks at `lenses.<i>.options.blocks` (FR-81).
 */
export function validateViewSpecs(
  schema: AnySchema,
  specs: unknown,
  options: {
    readonly figures?: Readonly<Record<string, string>>;
    readonly at?: string;
    readonly home?: unknown;
    readonly lenses?: unknown;
  } = {},
): Finding[] {
  const declared = schema.kinds as readonly string[];
  const kinds = new Set(declared);
  const definitionOf = (kind: string) => schema.tryDefinition(kind) as DeclaredKind | undefined;
  const edges = new Set(declared.flatMap((kind) => Object.keys(definitionOf(kind)?.edges ?? {})));
  const namesOf = (kind: string): KindNames | undefined => {
    if (!kinds.has(kind)) return undefined;
    const definition = definitionOf(kind);
    const fields = definition?.fields?.shape ?? {};
    const relations = definition?.edges ?? {};
    const computed = definition?.computed ?? {};
    return {
      field: (n) => n !== "id" && n !== "kind" && (own(fields, n) || own(computed, n)),
      relation: (n) => own(relations, n),
      figure: definition?.figure !== undefined || options.figures?.[kind] !== undefined,
      choices: (n) => {
        if (!own(fields, n)) return undefined;
        const spec = fieldSpecOf(fields[n]);
        return spec?.type === "enum" ? spec.options : undefined;
      },
      targets: (n) => (own(relations, n) ? relations[n]!.to : undefined),
    };
  };
  const vocabulary: Vocabulary = { namesOf, sources: (edge) => declared.filter((kind) => own(definitionOf(kind)?.edges, edge)) };
  const findings = validateAll(specs, options.at ?? "viewSpecs", namesOf, kinds, edges, "app", vocabulary);
  if (options.home !== undefined) subjectless(options.home, "home", vocabulary, kinds, edges, findings, "the home");
  blockLenses(options.lenses, vocabulary, kinds, edges, findings);
  return findings;
}
