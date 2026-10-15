import { analyzeExpr } from "./expr/analyze.js";
import { ExprSyntaxError, parseExpr, type Expr } from "./expr/parse.js";
import { error, warning, type Finding } from "./findings.js";
import type { GraviewDocument } from "./schema.js";
import { linkedEdges, localEdges } from "../schema/linked.js";
import type { TemplatePart } from "./template.js";
import { parseTemplate, TemplateError } from "./template-parse.js";

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
/**
 * HOW MANY BLOCKS A VIEW HOLDS: forty at its top, where a group or a
 * condition counts as one however much it holds — a home of four stat tiles
 * (a figure and a line each), four lines, five meters and three lists is
 * sixteen blocks, not the fifty-six its parts add up to, and was refused.
 * What a reader sees is the top's blocks; a group is one thing on the page.
 */
export const MAX_VIEW_BLOCKS = 40;
/**
 * And every block in it, counting the ones inside groups and conditions:
 * a ceiling against a view nobody could read or draw in time — each block
 * is worked out on every draw, a list's records each drawn by its own view.
 */
export const MAX_VIEW_BLOCKS_IN_ALL = 120;

export type ToneSpec = ViewTone | { readonly expr: string };

/** How a `figure` block says its number (FR-81). */
export const FIGURE_FORMATS = ["number", "money", "percent"] as const;
export type FigureFormat = (typeof FIGURE_FORMATS)[number];
/** How loudly a figure says its number: `large`, a stat tile's figure at the home's display size. */
export const FIGURE_EMPHASES = ["large"] as const;
export type FigureEmphasis = (typeof FIGURE_EMPHASES)[number];
/** How a `list` block draws each record it lists: with the kind's own card, or its own row (FR-81, FR-82). */
export const LIST_AS = ["card", "row"] as const;
/** The most records one list draws; a `limit` says fewer. */
export const MAX_LIST_LIMIT = 100;

/** A list's order: a key read from each record, ascending — or `{ by, direction }`, where "choices" is the order a choice field's choices are declared in. */
export type ListSort = string | { readonly by: string; readonly direction?: "asc" | "desc" | "choices" };
/** A list's grouping: a choice field, with a heading per choice where its value does not say it. */
export type ListGroup = string | { readonly by: string; readonly headings?: Readonly<Record<string, string>> };

/** A block of a view. Any block may say its `key`: what a face claims it by (`BlockSlots`), its own in its view. */
export type ViewBlock = OneBlock & { readonly key?: string };
type OneBlock =
  | { readonly title: string }
  | { readonly headline: string }
  | { readonly figure: string; readonly as?: FigureFormat; readonly currency?: string; readonly label?: string; readonly emphasis?: FigureEmphasis }
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
  | { readonly field: string; readonly as?: ViewFieldFormat; readonly currency?: string; readonly label?: string }
  /** A record's pictures (FR-162): the first, small (`thumb`), or every one, each opening full size (`gallery`). */
  | { readonly image: string; readonly as?: "thumb" | "gallery"; readonly label?: string }
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
  field: ["as", "currency", "label"],
  image: ["as", "label"],
  progress: ["label"],
  group: ["direction"],
  when: ["show"],
  divider: [],
  // `{"figure": true}` is the kind's picture; `{"figure": expr, …}` a number worked out (FR-81).
  figure: ["as", "currency", "label", "emphasis"],
};
const BLOCK_TYPES = Object.keys(BLOCK_KEYS);
const SHAPES =
  '{"title": "{name}"}, {"headline": "{count(all(\'offer\'))} offers"}, {"figure": expr, "as"?: "number"|"money"|"percent", "currency"?, "label"?, "emphasis"?: "large"}, {"list": expr, "sort"?, "limit"?, "group"?, "empty"?, "as"?: "card"|"row"}, {"text": "…", "tone"?}, {"badge": "{status}", "tone"?}, {"field": "quote", "as"?, "currency"?, "label"?}, {"image": "photos", "as"?: "thumb"|"gallery"}, {"progress": {"value": expr, "max": expr}, "label"?}, {"group": [blocks], "direction"?: "row"|"column"}, {"when": expr, "show": [blocks]}, {"divider": true}, {"figure": true}';

/** Whether a field holds pictures or documents: an `image` or `file`, or a list of them (FR-162). */
export const holdsFiles = (spec: { readonly type: string; readonly of?: string } | undefined): boolean => /^(image|file)$/.test(spec?.of ?? spec?.type ?? "");

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
export interface KindNames {
  readonly field: (name: string) => boolean;
  readonly relation: (name: string) => boolean;
  readonly figure: boolean;
  /** Whether a field holds pictures or documents (FR-162): what an `image` block shows. */
  readonly files?: (name: string) => boolean;
  /** A choice field's choices, in the order they are declared; undefined for any other name. */
  readonly choices?: (name: string) => readonly string[] | undefined;
  /** Where a relation leads: its target kinds, or every kind. */
  readonly targets?: (relation: string) => readonly string[] | "*" | undefined;
  /** Whether a field holds prose (a document's `text`): what a card or a row says as an excerpt, never whole. */
  readonly prose?: (name: string) => boolean;
}

/** What every kind holds, for a list's records: the kinds a walk or a sweep reaches. */
export interface Vocabulary {
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
  /** The blocks at the view's top, a group or a condition one each. */
  count: number;
  /** Every block, the ones inside groups and conditions too. */
  all: number;
  /** The slot the blocks are drawn in, for a kind's views. */
  readonly slot?: ViewSlot;
}

const NO_RECORD: KindNames = { field: () => false, relation: () => false, figure: false };
const about = (scope: Scope) => scope.kind ?? "the home";
export const own = (record: object | undefined, key: string) => record !== undefined && Object.hasOwn(record, key);

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

function template(source: unknown, path: string, scope: Scope, text = false): void {
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
  for (const part of parts) {
    if (!part.expr) continue;
    names(part.expr, path, scope);
    /*
     * A CARD OR A ROW SAYS A LONG TEXT'S START. A card that printed a
     * thirty-line summary made a row of cards a wall of text; it is clamped
     * where it is drawn, and the check says how to say less on purpose.
     */
    if (text && !part.format && part.expr.t === "ident" && (scope.slot === "card" || scope.slot === "row") && scope.spec.prose?.(part.expr.name)) {
      const field = part.expr.name;
      scope.findings.push(warning("view-whole-text", path, `${scope.kind} ${scope.slot} shows ${field} whole; it will be clamped. Use {${field}|excerpt} or move it to the page.`, `write {${field}|excerpt}, or {${field}|excerpt: 80} for fewer characters`));
    }
  }
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
  if (depth === 1) scope.count++;
  scope.all++;
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
  // A block's `key` is what a face claims it by: any block may say one, and the check holds it (`viewKeys`).
  for (const k of keys) if (k !== type && k != "key" && !BLOCK_KEYS[type]!.includes(k)) scope.findings.push(error("unknown-key", `${path}.${k}`, `"${k}" is not part of a ${type} block`, BLOCK_KEYS[type]!.length > 0 ? `a ${type} block may also say ${BLOCK_KEYS[type]!.map((x) => `"${x}"`).join(", ")}` : `a ${type} block says nothing else`));
  const value = raw[type];
  switch (type) {
    case "title":
    case "headline":
    case "text":
    case "badge":
      template(value, `${path}.${type}`, scope, type === "text");
      if ("tone" in raw) tone(raw["tone"], `${path}.tone`, scope);
      return;
    // A field, or a field's pictures and documents (FR-162).
    case "image":
    case "field": {
      const image = type === "image";
      if (typeof value !== "string" || !(image ? scope.spec.files?.(value) : scope.spec.field(value))) {
        const edge = typeof value === "string" && scope.spec.relation(value);
        scope.findings.push(error(`view-${type}`, `${path}.${type}`, `${scope.kind} has no ${image ? "image or file " : ""}field ${typeof value === "string" ? `"${value}"` : "by that name"}`, edge ? `"${value}" is a relation; show it with {"text": "{${value}.name}"}` : undefined));
      }
      const ways: readonly unknown[] = image ? ["thumb", "gallery"] : VIEW_FIELD_FORMATS;
      if ("as" in raw && !ways.includes(raw["as"])) scope.findings.push(error("view-format", `${path}.as`, `"${String(raw["as"])}" is not a way to show ${image ? "pictures" : "a field"}`, `use one of ${ways.join(", ")}`));
      if (!image) currency(raw, path, scope, "field");
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
      for (const k of ["as", "currency", "label", "emphasis"]) if (k in raw) scope.findings.push(error("unknown-key", `${path}.${k}`, `"${k}" belongs to a figure that works a number out; {"figure": true} is the kind's picture`, `write {"figure": "count(all('offer'))", "as": "number"}`));
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
  currency(raw, path, scope, "figure");
  // A figure's label is a template, like a headline (FR-99): "{name}, net".
  if ("label" in raw) template(raw["label"], `${path}.label`, scope);
  if ("emphasis" in raw && !(FIGURE_EMPHASES as readonly unknown[]).includes(raw["emphasis"])) {
    scope.findings.push(error("view-emphasis", `${path}.emphasis`, `"${String(raw["emphasis"])}" is not how loudly a figure is said`, `use ${FIGURE_EMPHASES.map((e) => `"${e}"`).join(", ")}, or leave it out for the figure's own size`));
  }
}

/** A currency on money (FR-100): its three-letter code, on a figure or a field shown as money. Without one, the app's `brand.currency`. */
function currency(raw: Record<string, unknown>, path: string, scope: Scope, what: string): void {
  if (!("currency" in raw)) return;
  if (typeof raw["currency"] !== "string" || !/^[A-Z]{3}$/.test(raw["currency"])) scope.findings.push(error("view-currency", `${path}.currency`, 'a currency is its three-letter code, like "USD" or "EUR"'));
  else if (raw["as"] !== "money") scope.findings.push(error("view-currency", `${path}.currency`, `a currency belongs on a ${what} shown as money`, 'add "as": "money"'));
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
          // The kinds whose relation reaches where the walk starts: in('under') from a change, the kinds that declare it to a change.
          const from = walked !== undefined ? visit(first!) : scope.kind !== null ? [scope.kind] : undefined;
          const sources =
            relation !== undefined
              ? scope.vocabulary.sources(relation).filter((kind) => {
                  const to = scope.vocabulary.namesOf(kind)?.targets?.(relation);
                  return !from || to === "*" || from.some((one) => to?.includes(one));
                })
              : [];
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
        } else if (choices) {
          for (const choice of Object.keys(headings)) if (!choices.includes(choice)) scope.findings.push(error("list-group", `${path}.group.headings.${choice}`, `"${choice}" is not one of ${by}'s choices`, `use ${choices.join(", ")}`));
        }
      }
    }
  }
  if ("empty" in raw && (typeof raw["empty"] !== "string" || raw["empty"].length === 0 || raw["empty"].length > 200)) scope.findings.push(error("list-empty", `${path}.empty`, "what an empty list says is a sentence, at most 200 characters"));
  if ("as" in raw && !(LIST_AS as readonly unknown[]).includes(raw["as"])) scope.findings.push(error("list-as", `${path}.as`, `a list draws each record as its "card" or its "row", not "${String(raw["as"])}"`));
}

function label(value: unknown, path: string, scope: Scope): void {
  if (typeof value !== "string" || value.length === 0 || value.length > 60) scope.findings.push(error("view-label", path, "a label is a few words, at most 60 characters"));
}

/**
 * EVERY BLOCK OF EVERY VIEW, nested ones after their own: each kind's slots
 * (a document's `views` or a declaration's `viewSpecs` at `at`), the home
 * and each blocks lens, handed to `visit` with its path and the view it is
 * in. What the check asks of blocks beyond their vocabulary walks this.
 */
function eachBlock(views: unknown, at: string, home: unknown, lenses: unknown, visit: (raw: Record<string, unknown>, path: string, view: string) => void): void {
  const blocks = (list: unknown, path: string, view: string): void => {
    if (!Array.isArray(list)) return;
    list.forEach((raw: unknown, i) => {
      if (!isObject(raw)) return;
      const where = `${path}.${i}`;
      visit(raw, where, view);
      // A list's `group` is how it is grouped, not blocks.
      if (!("list" in raw)) blocks(raw["group"], `${where}.group`, view);
      blocks(raw["show"], `${where}.show`, view);
    });
  };
  const view = (list: unknown, path: string) => blocks(list, path, path);
  if (isObject(views)) {
    for (const [kind, specs] of Object.entries(views)) {
      if (Array.isArray(specs)) view(specs, `${at}.${kind}`);
      else if (isObject(specs)) for (const slot of VIEW_SLOTS) view(specs[slot], `${at}.${kind}.${slot}`);
    }
  }
  view(home, "home");
  if (Array.isArray(lenses)) lenses.forEach((lens: unknown, i) => isObject(lens) && lens["name"] === "blocks" && isObject(lens["options"]) && view(lens["options"]["blocks"], `lenses.${i}.options.blocks`));
}

/**
 * BRACES IN WORDS THAT ARE NO TEMPLATE (FR-99). A field's label, what an
 * empty list says and a group's heading are drawn as written, so a `{name}`
 * in one would be drawn with its braces; each is said, at its block's path,
 * as a `view-braces` warning. Asked by the check (`compileDocument`,
 * `checkApp`) and not by a page compiling what its host already checked,
 * so the page does not carry it. `views` is a document's `views` or a
 * declaration's `viewSpecs` at `at`; `home` a declaration's home view.
 */
export function viewBraces(views: unknown, at: string, home?: unknown, lenses?: unknown): Finding[] {
  const found: Finding[] = [];
  const words = (value: unknown, path: string, what: string) => {
    if (typeof value === "string" && /[{}]/.test(value)) found.push(warning("view-braces", path, `${what} is words, not a template, so "${value}" would be drawn with its braces`, 'say it without braces, or say the value in a text block: {"text": "… {name} …"}'));
  };
  eachBlock(views, at, home, lenses, (raw, at) => {
    if ("field" in raw || "image" in raw) words(raw["label"], `${at}.label`, "a field's label");
    if ("list" in raw) {
      const headings = isObject(raw["group"]) ? raw["group"]["headings"] : undefined;
      if (isObject(headings)) for (const [choice, heading] of Object.entries(headings)) words(heading, `${at}.group.headings.${choice}`, "a group's heading");
      words(raw["empty"], `${at}.empty`, "what an empty list says");
    }
  });
  return found;
}

/** What a block's own key may be: a word or a few joined by hyphens or underscores, never a dot — a derived key (`list.2`) has one, so the two never meet. */
const BLOCK_KEY = /^[a-z][\w-]{0,63}$/i;

/**
 * A BLOCK'S KEY IS ITS OWN IN ITS VIEW. A face claims a block by its key
 * (`BlockSlots`), so two blocks of one view that say the same key would
 * both be claimed — the second silently drawn as the first. Each view's
 * keys, nested ones with them, are held to one each, and to the shape a key
 * has. Asked by the check (`compileDocument`, `checkApp`), like
 * `viewBraces`, and not by a page compiling what its host already checked.
 */
export function viewKeys(views: unknown, at: string, home?: unknown, lenses?: unknown): Finding[] {
  const found: Finding[] = [];
  const seen = new Map<string, string>();
  eachBlock(views, at, home, lenses, (raw, where, view) => {
    if (!("key" in raw)) return;
    const key = raw["key"];
    const first = seen.get(`${view} ${String(key)}`);
    if (typeof key !== "string" || !BLOCK_KEY.test(key)) found.push(error("view-key", `${where}.key`, 'a key is a word or a few joined by hyphens, like "works-on"'));
    else if (first) found.push(error("view-key", `${where}.key`, `"${key}" is the key of ${first} too: a face claims a block by its key, so each in a view has its own`));
    else seen.set(`${view} ${key}`, where);
  });
  return found;
}

/** Blocks about no one record — the home, a blocks lens — checked at `at`. */
export function subjectless(list: unknown, at: string, vocabulary: Vocabulary, kinds: ReadonlySet<string>, edges: ReadonlySet<string>, findings: Finding[], what: string): void {
  const scope: Scope = { kind: null, spec: NO_RECORD, kinds, edges, vocabulary, findings, count: 0, all: 0 };
  if (Array.isArray(list) && list.length === 0) findings.push(error("view-shape", at, `${what} has no blocks`, 'give it one: {"headline": "…"}'));
  blocks(list, at, 1, scope);
  sized(scope, at, what, "show less");
}

/** A view held to its size: forty blocks at its top, a group or a condition one of them, and 120 in all. */
function sized(scope: Scope, at: string, what: string, fix: string): void {
  if (scope.count > MAX_VIEW_BLOCKS) {
    scope.findings.push(error("view-size", at, `${what} has ${scope.count} blocks at its top; a view has at most ${MAX_VIEW_BLOCKS} there, a group or a condition counting as one`, `${fix}, or gather some into a group`));
  } else if (scope.all > MAX_VIEW_BLOCKS_IN_ALL) {
    scope.findings.push(error("view-size", at, `${what} has ${scope.all} blocks counting the ones inside its groups and conditions; a view has at most ${MAX_VIEW_BLOCKS_IN_ALL} in all`, fix));
  }
}

/** The lenses drawn from blocks, by their index in `lenses`: their blocks, checked where they are written. */
export function blockLenses(lenses: unknown, vocabulary: Vocabulary, kinds: ReadonlySet<string>, edges: ReadonlySet<string>, findings: Finding[]): void {
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
export function validateAll(
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
      const scope: Scope = { kind, spec, kinds, edges, vocabulary, findings, count: 0, all: 0, slot };
      blocks(list, `${at}.${kind}.${slot}`, 1, scope);
      sized(scope, `${at}.${kind}.${slot}`, `this ${slot}`, "show less, or move detail to the page");
    }
  }
  return findings;
}

/** Findings about a document's `views` — every kind's, and the home's — and its blocks lenses, each at its JSON path. */
export function validateViews(document: GraviewDocument): Finding[] {
  const kinds = new Set(Object.keys(document.kinds));
  // A relation to another app's kind (FR-171) is no relation of this graph: a view shows it as a field, `{ "field": "forHouse" }`, drawn with its own card.
  const edges = new Set(Object.values(document.kinds).flatMap((k) => Object.keys(localEdges(k.edges))));
  const namesOf = (kind: string): KindNames | undefined => {
    const spec = own(document.kinds, kind) ? document.kinds[kind] : undefined;
    // A computed field is shown like a stored one (FR-83).
    return spec
      ? {
          field: (n) => own(spec.fields, n) || own(spec.computed, n) || linkedEdges(spec.edges).has(n),
          relation: (n) => own(localEdges(spec.edges), n),
          figure: spec.figure !== undefined,
          files: (n) => own(spec.fields, n) && holdsFiles(spec.fields[n]),
          choices: (n) => (own(spec.fields, n) && spec.fields[n]!.type === "enum" ? spec.fields[n]!.options : undefined),
          targets: (n) => (own(localEdges(spec.edges), n) ? spec.edges![n]!.to : undefined),
          prose: (n) => own(spec.fields, n) && spec.fields[n]!.type === "text",
        }
      : undefined;
  };
  const vocabulary: Vocabulary = { namesOf, sources: (edge) => Object.keys(document.kinds).filter((kind) => own(document.kinds[kind]!.edges, edge)) };
  const findings = validateAll(document.views, "views", namesOf, kinds, edges, "document", vocabulary);
  blockLenses(document.lenses, vocabulary, kinds, edges, findings);
  return findings;
}
