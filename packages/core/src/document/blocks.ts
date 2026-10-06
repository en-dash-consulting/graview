import type { AnyGraphNode, GraphReader } from "../index.js";
import type { AnySchema } from "../schema/schema.js";
import { fieldWords, valueWords } from "../schema/define-node.js";
import { evaluateExpr, NodeSet, type KindShape, type Value } from "./expr/evaluate.js";
import { parseExpr, type Expr } from "./expr/parse.js";
import type { FieldSpec } from "./schema.js";
import { EMPTY_GRAPH, formatMoney, formatValue, parseTemplate, type Money, type TemplatePart } from "./template.js";
import { fieldSpecOf } from "./to-document.js";
import { FIGURE_FORMATS, LIST_AS, MAX_LIST_LIMIT, VIEW_FIELD_FORMATS, VIEW_TONES, type FigureFormat, type ViewBlock, type ViewTone } from "./views.js";

/*
 * BLOCKS, RESOLVED — what a list of blocks says, worked out once, for every
 * surface that says it (FR-89).
 *
 * The faces draw blocks (`@graview/primitives`' SpecBlocks, SpecPlace); a
 * chat asks what a place shows without a browser (`describePlace`). Both
 * read THIS: a block's words, its figure, which records its list lists, in
 * which order and under which headings, what an empty list says, and what
 * could not be worked out. A face turns a resolved block into elements; the
 * describer turns it into sentences. There is no second reading of a block
 * to drift from the first.
 *
 * Nothing here is code: templates and the rule language under a step
 * budget. An expression that cannot be judged says "—" and is a problem; a
 * `when` that cannot be judged hides what it guards.
 */

type Parsed<T> = T | null;
type Tone = ViewTone | { readonly expr: Parsed<Expr> };

/** A block, parsed: templates and expressions are read once, when the blocks are registered. */
export type SpecBlock =
  | { readonly t: "title"; readonly parts: Parsed<readonly TemplatePart[]> }
  | { readonly t: "text" | "badge"; readonly parts: Parsed<readonly TemplatePart[]>; readonly tone?: Tone }
  | { readonly t: "field"; readonly field: string; readonly as?: (typeof VIEW_FIELD_FORMATS)[number]; readonly currency?: string; readonly label?: string }
  /** A figure's and a meter's label is a template, read like a headline (FR-99). */
  | { readonly t: "progress"; readonly value: Parsed<Expr>; readonly max: Parsed<Expr>; readonly label?: Parsed<readonly TemplatePart[]> }
  | { readonly t: "group"; readonly blocks: readonly SpecBlock[]; readonly direction: "row" | "column" }
  | { readonly t: "when"; readonly when: Parsed<Expr>; readonly show: readonly SpecBlock[] }
  | { readonly t: "divider" }
  | { readonly t: "figure" }
  | { readonly t: "headline"; readonly parts: Parsed<readonly TemplatePart[]> }
  | { readonly t: "number"; readonly value: Parsed<Expr>; readonly as?: FigureFormat; readonly currency?: string; readonly label?: Parsed<readonly TemplatePart[]> }
  | {
      readonly t: "list";
      /** The records, in their order: a `sort` by a key is part of the expression, `sort(<list>, <key>, <direction>)`. */
      readonly source: Parsed<Expr>;
      /** A sort by a choice field's declared order, done after the expression. */
      readonly choiceOrder?: string;
      readonly limit?: number;
      readonly group?: { readonly by: string; readonly headings: Readonly<Record<string, string>> };
      readonly empty?: string;
      readonly as: (typeof LIST_AS)[number];
    };

const safely = <T>(f: () => T): T | null => {
  try {
    return f();
  } catch {
    return null;
  }
};

const isTone = (value: unknown): value is ViewTone => typeof value === "string" && (VIEW_TONES as readonly string[]).includes(value);

function toneOf(tone: unknown): Tone | undefined {
  if (tone === undefined) return undefined;
  if (isTone(tone)) return tone;
  if (tone && typeof tone === "object" && typeof (tone as { expr?: unknown }).expr === "string") return { expr: safely(() => parseExpr((tone as { expr: string }).expr)) };
  // A tone outside the kit is the check's to refuse; drawn, it is quiet.
  return "neutral";
}

const MAX_DEPTH = 4;

/**
 * A LIST, PARSED (FR-81, FR-82). Its order by a key is the language's own
 * `sort(…)` around its source, so it is judged under the same budget as
 * every other expression; an order by a choice field's declared choices is
 * done after, from the declaration.
 */
function listOf(block: Record<string, unknown>): SpecBlock {
  const source = typeof block["list"] === "string" ? safely(() => parseExpr(block["list"] as string)) : null;
  const sort = block["sort"];
  const by = typeof sort === "string" ? sort : sort && typeof sort === "object" && typeof (sort as { by?: unknown }).by === "string" ? (sort as { by: string }).by : undefined;
  const direction = sort && typeof sort === "object" ? (sort as { direction?: unknown }).direction : undefined;
  let ordered = source;
  let choiceOrder: string | undefined;
  if (source && by !== undefined) {
    if (direction === "choices") choiceOrder = by;
    else {
      const key = safely(() => parseExpr(by));
      ordered = key ? { t: "call", fn: "sort", args: [source, key, { t: "lit", value: direction === "desc" ? "desc" : "asc", at: 0 }], at: 0 } : null;
    }
  }
  const limit = typeof block["limit"] === "number" && Number.isInteger(block["limit"]) && block["limit"] >= 1 ? Math.min(block["limit"], MAX_LIST_LIMIT) : undefined;
  const group = block["group"];
  const groupBy = typeof group === "string" ? group : group && typeof group === "object" && typeof (group as { by?: unknown }).by === "string" ? (group as { by: string }).by : undefined;
  const headings = group && typeof group === "object" && (group as { headings?: unknown }).headings && typeof (group as { headings?: unknown }).headings === "object" ? (group as { headings: Record<string, unknown> }).headings : {};
  return {
    t: "list",
    source: ordered,
    ...(choiceOrder ? { choiceOrder } : {}),
    ...(limit ? { limit } : {}),
    ...(groupBy ? { group: { by: groupBy, headings: Object.fromEntries(Object.entries(headings).filter((entry): entry is [string, string] => typeof entry[1] === "string")) } } : {}),
    ...(typeof block["empty"] === "string" ? { empty: block["empty"] } : {}),
    as: block["as"] === "card" ? "card" : "row",
  };
}

/**
 * Parse a spec's blocks. A spec `graview check` passed parses cleanly; a
 * part that does not is said as "—", and a block outside the vocabulary is
 * not drawn at all.
 */
export function compileBlocks(blocks: readonly ViewBlock[] | readonly unknown[], depth = 1): readonly SpecBlock[] {
  if (!Array.isArray(blocks) || depth > MAX_DEPTH) return [];
  return (blocks as readonly unknown[]).flatMap((raw): SpecBlock[] => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const block = raw as Record<string, unknown>;
    const template = (source: unknown) => (typeof source === "string" ? safely(() => parseTemplate(source)) : null);
    const expr = (source: unknown) => (typeof source === "string" ? safely(() => parseExpr(source)) : null);
    const tone = toneOf(block["tone"]);
    const label = typeof block["label"] === "string" ? block["label"] : undefined;
    const has = (key: string) => Object.prototype.hasOwnProperty.call(block, key);
    const currency = typeof block["currency"] === "string" && /^[A-Z]{3}$/.test(block["currency"]) ? block["currency"] : undefined;
    // A list first: its `group` is how it is grouped, not a group block.
    if (has("list")) return [listOf(block)];
    if (has("headline")) return [{ t: "headline", parts: template(block["headline"]) }];
    if (has("figure") && typeof block["figure"] === "string") {
      const as = (FIGURE_FORMATS as readonly unknown[]).includes(block["as"]) ? (block["as"] as FigureFormat) : undefined;
      return [{ t: "number", value: expr(block["figure"]), ...(as ? { as } : {}), ...(currency ? { currency } : {}), ...(label ? { label: template(label) } : {}) }];
    }
    if (has("title")) return [{ t: "title", parts: template(block["title"]) }];
    if (has("text")) return [{ t: "text", parts: template(block["text"]), ...(tone ? { tone } : {}) }];
    if (has("badge")) return [{ t: "badge", parts: template(block["badge"]), ...(tone ? { tone } : {}) }];
    if (has("field")) {
      const as = (VIEW_FIELD_FORMATS as readonly unknown[]).includes(block["as"]) ? (block["as"] as (typeof VIEW_FIELD_FORMATS)[number]) : undefined;
      return [{ t: "field", field: String(block["field"]), ...(as ? { as } : {}), ...(currency ? { currency } : {}), ...(label ? { label } : {}) }];
    }
    if (has("progress")) {
      const p = (block["progress"] ?? {}) as { value?: unknown; max?: unknown };
      return [{ t: "progress", value: expr(p.value), max: expr(p.max), ...(label ? { label: template(label) } : {}) }];
    }
    if (has("group")) return [{ t: "group", blocks: compileBlocks(block["group"] as readonly unknown[], depth + 1), direction: block["direction"] === "row" ? "row" : "column" }];
    if (has("when")) return [{ t: "when", when: expr(block["when"]), show: compileBlocks(block["show"] as readonly unknown[], depth + 1) }];
    if (has("divider")) return [{ t: "divider" }];
    if (has("figure")) return [{ t: "figure" }];
    return [];
  });
}

// ── resolving ───────────────────────────────────────────────────────────────

/** Everything blocks read to say what they say about one record — or none. */
export interface BlockContext {
  /** The record the blocks are about; null for blocks about no one record — the home, a blocks lens (FR-81). */
  readonly node: AnyGraphNode | null;
  /** The level a headline is said at here, and the first top-level one where it is the page's own heading (the home's h1). */
  readonly heading?: number;
  readonly firstHeading?: number;
  /** The steps each expression may take; more for blocks that sweep whole kinds. */
  readonly budget?: number;
  /** The graph the blocks read: for a seat, what that seat may see. Without it, a hop says "—". */
  readonly graph?: GraphReader;
  /** The declaration, for the order a choice field's choices are declared in. */
  readonly schema?: AnySchema;
  readonly kinds: ReadonlyMap<string, KindShape>;
  /** The kind's declared fields, in the document's words: which may be a link, which is a date. */
  readonly fields: Readonly<Record<string, FieldSpec>>;
  /** How the declaration says a field and its values (`display.labels`, `display.format`). */
  readonly definition?: Parameters<typeof valueWords>[0];
  readonly today: string;
  /** The app's currency and locale (`brand.currency`, `brand.locale`): what money is said in where a block names no currency (FR-100). */
  readonly money?: Money;
}

/** A block worked out: what a face draws and a describer says. `problem` is what could not be worked out, in words. */
export type ResolvedBlock =
  | { readonly t: "title"; readonly text: string; readonly problem?: string }
  | { readonly t: "text"; readonly text: string; readonly tone?: ViewTone; readonly problem?: string }
  | { readonly t: "badge"; readonly text: string; readonly tone: ViewTone; readonly problem?: string }
  | { readonly t: "field"; readonly field: string; readonly label: string; readonly text: string; readonly href?: string; readonly problem?: string }
  | { readonly t: "progress"; readonly label: string; readonly value?: number; readonly max?: number; readonly text: string; readonly problem?: string }
  | { readonly t: "group"; readonly direction: "row" | "column"; readonly blocks: readonly ResolvedBlock[] }
  /** A condition: what it shows, when it holds; nothing when it does not or cannot be judged. */
  | { readonly t: "when"; readonly shown: boolean; readonly blocks: readonly ResolvedBlock[]; readonly problem?: string }
  | { readonly t: "divider" }
  /** The kind's picture: drawn by a face, said by nothing. */
  | { readonly t: "figure" }
  | { readonly t: "headline"; readonly level: number; readonly text: string; readonly problem?: string }
  | { readonly t: "number"; readonly text: string; readonly label?: string; readonly problem?: string }
  | ResolvedList;

/** A list worked out: its records in order, a few, under a heading per choice — read from the graph the context was handed. */
export interface ResolvedList {
  readonly t: "list";
  readonly as: "card" | "row";
  /** True when its source could not be judged: drawn as "—". */
  readonly failed: boolean;
  /** Every record listed, in order, after the limit. */
  readonly members: readonly AnyGraphNode[];
  /** The groups, in their declared order, when the list is grouped. A choice no record here takes has no heading at all. */
  readonly groups?: readonly { readonly value: string | null; readonly heading?: string; readonly members: readonly AnyGraphNode[] }[];
  /** The level a group's heading is drawn at. */
  readonly headingLevel: number;
  /** What it says when it lists nothing, when it says anything. */
  readonly empty?: string;
  /** How many more there were, said "and N more" when no limit was asked for. */
  readonly more: number;
  readonly problem?: string;
}

const NOTHING = "—";
/** The allowance a card's template gets: a card is drawn many times a frame. */
const BUDGET = 500;

type Judged = { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly problem: string };

function judge(expr: Parsed<Expr>, ctx: BlockContext): Judged {
  if (!expr) return { ok: false, problem: "an expression that does not parse" };
  try {
    return { ok: true, value: evaluateExpr(expr, { graph: ctx.graph ?? EMPTY_GRAPH, subject: ctx.node, kinds: ctx.kinds, today: ctx.today, budget: ctx.budget ?? BUDGET }) };
  } catch (e) {
    return { ok: false, problem: e instanceof Error ? e.message : String(e) };
  }
}

/** A template's words, each part judged as `renderTemplate` judges it — and what could not be, said. */
function say(parts: Parsed<readonly TemplatePart[]>, ctx: BlockContext): { readonly text: string; readonly problem?: string } {
  if (!parts) return { text: NOTHING, problem: "a template that does not parse" };
  let problem: string | undefined;
  const text = parts
    .map((part) => {
      if (part.text !== undefined) return part.text;
      const judged = judge(part.expr ?? null, ctx);
      if (!judged.ok) {
        problem ??= `{${part.source ?? ""}}: ${judged.problem}`;
        return NOTHING;
      }
      return formatValue(judged.value, part.format, ctx.today, part.formatArgs, ctx.money);
    })
    .join("");
  return problem ? { text, problem } : { text };
}

function toneWord(tone: Tone | undefined, ctx: BlockContext): ViewTone | undefined {
  if (tone === undefined) return undefined;
  if (typeof tone === "string") return tone;
  const judged = judge(tone.expr, ctx);
  return judged.ok && isTone(judged.value) ? judged.value : "neutral";
}

/** Only http(s) is ever a link; anything else — `javascript:`, `data:`, a typo — is shown as words. */
export function safeHref(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function fieldText(key: string, value: unknown, ctx: BlockContext, as: (typeof VIEW_FIELD_FORMATS)[number] | undefined, currency?: string): string {
  if (value === null || value === undefined || value === "") return NOTHING;
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (as) return formatValue(value as Value, as, ctx.today, [], currency ? { ...ctx.money, currency } : ctx.money);
  const spec = ctx.fields[key];
  if (ctx.definition?.display?.format?.[key]) return valueWords(ctx.definition, key, value);
  if (spec?.type === "date") return formatValue(value as Value, "date", ctx.today);
  if (spec?.type === "enum" && typeof value === "string") return valueWords(ctx.definition, key, value);
  if (typeof value === "number") return value.toLocaleString("en-US");
  if (Array.isArray(value)) return value.map((one) => String(one)).join(", ");
  if (typeof value === "object") return NOTHING;
  return String(value);
}

/** A figure's words: a number in figures, money (in the currency it names, else the app's — FR-100) or a fraction as a percent. */
export function sayNumber(value: string | number | boolean, as: FigureFormat | undefined, currency: string | undefined, today: string, money?: Money): string {
  if (typeof value !== "number") return String(value);
  if (as === "money") return formatMoney(value, currency ? { ...money, currency } : money);
  if (as === "percent") return formatValue(value, as, today);
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

const withProblem = <T extends object>(block: T, problem: string | undefined): T => (problem ? { ...block, problem } : block);

function resolveOne(block: SpecBlock, ctx: BlockContext, first: boolean): ResolvedBlock {
  switch (block.t) {
    case "title": {
      const said = say(block.parts, ctx);
      return withProblem({ t: "title", text: said.text }, said.problem);
    }
    case "text": {
      const said = say(block.parts, ctx);
      const tone = toneWord(block.tone, ctx);
      return withProblem({ t: "text", text: said.text, ...(tone ? { tone } : {}) }, said.problem);
    }
    case "badge": {
      const said = say(block.parts, ctx);
      return withProblem({ t: "badge", text: said.text, tone: toneWord(block.tone, ctx) ?? "neutral" }, said.problem);
    }
    case "field": {
      const label = block.label ?? fieldWords(ctx.definition, block.field);
      // About no one record, there is no field to show (the check says so).
      if (!ctx.node) return { t: "field", field: block.field, label, text: NOTHING, problem: `"${block.field}" names a field, and these blocks are about no one record` };
      // A computed field is worked out like any expression, under the same budget (FR-83); else an OWN field only: a name on the prototype is not a field of the record.
      const worked = ctx.kinds.get(ctx.node.kind)?.computed?.has(block.field);
      let raw: unknown;
      let problem: string | undefined;
      if (worked) {
        const judged = judge({ t: "ident", name: block.field, at: 0 }, ctx);
        if (!judged.ok) problem = judged.problem;
        else raw = judged.value !== null && typeof judged.value === "object" ? formatValue(judged.value, undefined, ctx.today) : judged.value;
      } else raw = Object.prototype.hasOwnProperty.call(ctx.node, block.field) ? ctx.node[block.field] : undefined;
      const href = ctx.fields[block.field]?.type === "url" && block.as === undefined ? safeHref(raw) : undefined;
      const text = safely(() => fieldText(block.field, raw, ctx, block.as, block.currency)) ?? NOTHING;
      return withProblem({ t: "field", field: block.field, label, text, ...(href ? { href } : {}) }, problem);
    }
    case "progress": {
      const value = judge(block.value, ctx);
      const max = judge(block.max, ctx);
      const said = block.label ? say(block.label, ctx) : { text: "Progress" };
      const label = said.text;
      const problem = !value.ok ? value.problem : !max.ok ? max.problem : said.problem;
      if (!(value.ok && max.ok && typeof value.value === "number" && typeof max.value === "number" && Number.isFinite(value.value) && Number.isFinite(max.value) && max.value > 0)) {
        return withProblem({ t: "progress", label, text: NOTHING }, problem);
      }
      return withProblem({ t: "progress", label, value: value.value, max: max.value, text: `${formatValue(value.value, undefined, ctx.today)} of ${formatValue(max.value, undefined, ctx.today)}` }, problem);
    }
    case "group":
      return { t: "group", direction: block.direction, blocks: resolveBlocks(block.blocks, ctx) };
    case "when": {
      // A condition that cannot be judged hides what it guards, like a rule's `when`.
      const judged = judge(block.when, ctx);
      const shown = judged.ok && judged.value === true;
      return withProblem({ t: "when", shown, blocks: shown ? resolveBlocks(block.show, ctx) : [] }, judged.ok ? undefined : judged.problem);
    }
    case "divider":
      return { t: "divider" };
    case "figure":
      return { t: "figure" };
    case "headline": {
      const said = say(block.parts, ctx);
      const level = Math.min(6, Math.max(1, (first ? ctx.firstHeading : undefined) ?? ctx.heading ?? 3));
      return withProblem({ t: "headline", level, text: said.text }, said.problem);
    }
    case "number": {
      const judged = judge(block.value, ctx);
      const text = !judged.ok || judged.value === null || typeof judged.value === "object" ? NOTHING : sayNumber(judged.value, block.as, block.currency, ctx.today, ctx.money);
      const said = block.label ? say(block.label, ctx) : undefined;
      return withProblem({ t: "number", text, ...(said ? { label: said.text } : {}) }, judged.ok ? said?.problem : judged.problem);
    }
    case "list":
      return resolveList(block, ctx);
  }
}

/** Blocks worked out for one record — or for none. Pure: everything they read is in `ctx`. */
export function resolveBlocks(blocks: readonly SpecBlock[], ctx: BlockContext): readonly ResolvedBlock[] {
  const first = blocks.findIndex((block) => block.t === "headline");
  return blocks.map((block, i) => resolveOne(block, ctx, i === first));
}

/**
 * A LIST OF RECORDS: the records its expression names — the kinds swept,
 * or a walk from the record (`out('includes')`, `in('answers')`) — in their
 * order, a few, grouped by a choice in its declared order. Read from the
 * graph the context is handed, which for a seat is what that seat may see
 * (FR-55): a record it may not see is not listed, not counted, and opens no
 * group of its own.
 */
function resolveList(block: Extract<SpecBlock, { t: "list" }>, ctx: BlockContext): ResolvedList {
  const headingLevel = Math.min(6, (ctx.heading ?? 3) + 1);
  const judged = judge(block.source, ctx);
  if (!judged.ok) return { t: "list", as: block.as, failed: true, members: [], headingLevel, more: 0, problem: judged.problem };
  const value = judged.value;
  let nodes: readonly AnyGraphNode[] = value instanceof NodeSet ? value.nodes : value !== null && typeof value === "object" && !Array.isArray(value) ? [value as AnyGraphNode] : [];
  if (block.choiceOrder && ctx.schema) nodes = inChoiceOrder(nodes, block.choiceOrder, ctx.schema);
  const all = nodes.length;
  nodes = nodes.slice(0, block.limit ?? MAX_LIST_LIMIT);
  const more = block.limit === undefined ? all - nodes.length : 0;
  return {
    t: "list",
    as: block.as,
    failed: false,
    members: nodes,
    ...(block.group && ctx.schema && nodes.length > 0 ? { groups: groupsOf(nodes, block.group, ctx.schema) } : {}),
    headingLevel,
    ...(nodes.length === 0 && block.empty ? { empty: block.empty } : {}),
    more,
  };
}

/** A choice field's choices on a kind, in the order they are declared; empty when it is not one. */
function choicesOf(schema: AnySchema, kind: string, field: string): readonly string[] {
  const shape = (schema.tryDefinition(kind) as { fields?: { shape?: Record<string, unknown> } } | undefined)?.fields?.shape;
  const spec = shape && Object.prototype.hasOwnProperty.call(shape, field) ? fieldSpecOf(shape[field]) : undefined;
  return spec?.type === "enum" ? (spec.options ?? []) : [];
}

const valueOf = (node: AnyGraphNode, field: string): unknown => (Object.prototype.hasOwnProperty.call(node, field) ? node[field] : undefined);

/** Records in the order a choice field's choices are declared; a value among none of them last, in the order given. */
function inChoiceOrder(nodes: readonly AnyGraphNode[], field: string, schema: AnySchema): readonly AnyGraphNode[] {
  const rank = (node: AnyGraphNode) => {
    const at = choicesOf(schema, node.kind, field).indexOf(String(valueOf(node, field)));
    return at < 0 ? Number.MAX_SAFE_INTEGER : at;
  };
  return nodes.map((node, i) => ({ node, i, rank: rank(node) })).sort((a, b) => a.rank - b.rank || a.i - b.i).map((one) => one.node);
}

const sentenceCase = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);

/**
 * The records under a heading per choice, in the declared order; a choice
 * with no record here has no heading at all, so a heading never says that
 * something the reader cannot see exists. A value among no choice goes
 * last, unheaded.
 */
function groupsOf(nodes: readonly AnyGraphNode[], group: { readonly by: string; readonly headings: Readonly<Record<string, string>> }, schema: AnySchema): readonly { readonly value: string | null; readonly heading?: string; readonly members: readonly AnyGraphNode[] }[] {
  const order: string[] = [];
  for (const node of nodes) for (const choice of choicesOf(schema, node.kind, group.by)) if (!order.includes(choice)) order.push(choice);
  const out: { value: string | null; heading?: string; members: AnyGraphNode[] }[] = [];
  for (const choice of order) {
    const members = nodes.filter((node) => valueOf(node, group.by) === choice);
    if (members.length === 0) continue;
    const definition = schema.tryDefinition(members[0]!.kind) as Parameters<typeof valueWords>[0];
    out.push({ value: choice, heading: group.headings[choice] ?? sentenceCase(valueWords(definition, group.by, choice)), members });
  }
  const rest = nodes.filter((node) => !order.includes(String(valueOf(node, group.by))));
  if (rest.length > 0) out.push({ value: null, members: rest });
  return out;
}

/** Whether a block takes more than one line: a list, a headline or a figure, or a group or condition holding one. */
export function isTallBlock(block: SpecBlock): boolean {
  if (block.t === "list" || block.t === "headline" || block.t === "number") return true;
  if (block.t === "group") return block.blocks.some(isTallBlock);
  if (block.t === "when") return block.show.some(isTallBlock);
  return false;
}

/** A kind's declared fields in the document's words, read from its schema. */
export function fieldSpecsOf(schema: AnySchema, kind: string): Readonly<Record<string, FieldSpec>> {
  const shape = (schema.tryDefinition(kind) as { fields?: { shape?: Record<string, unknown> } } | undefined)?.fields?.shape ?? {};
  const read: Record<string, FieldSpec> = {};
  for (const [key, field] of Object.entries(shape)) {
    const spec = fieldSpecOf(field);
    if (spec) read[key] = spec;
  }
  return read;
}
