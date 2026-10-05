import { fieldWords, labelOf, valueWords, type AnyGraphNode, type AnySchema, type GraphReader } from "@graview/core";
import {
  evaluateExpr,
  fieldSpecOf,
  FIGURE_FORMATS,
  formatValue,
  LIST_AS,
  MAX_LIST_LIMIT,
  NodeSet,
  parseExpr,
  parseTemplate,
  renderTemplate,
  shapesOfSchema,
  VIEW_FIELD_FORMATS,
  VIEW_TONES,
  type Expr,
  type FieldSpec,
  type FigureFormat,
  type KindShape,
  type TemplatePart,
  type Value,
  type ViewBlock,
  type ViewSlot,
  type ViewSpecsByKind,
  type ViewTone,
} from "@graview/core/document";
import { useGraph, useGraview, ViewModeProvider, type ReactViewRegistry, type ViewComponent, type ViewProps } from "@graview/react/provider";
import { createContext, useContext, type MouseEvent, type ReactNode } from "react";
import { DefaultView } from "./default-view.js";
import { KindFigure } from "./figure.js";
import { Panel } from "./primitives/index.js";

/*
 * VIEWS AS DATA, DRAWN (FR-03).
 *
 * A view spec is a short list of blocks from a closed set — title, text,
 * badge, field, progress, group, when, divider, figure — bound to the
 * record by templates and conditions in the rule language. This draws them
 * into the framework's own view matrix, so the workbench and the pages face
 * resolve a spec exactly as they resolve a component:
 *
 *   card → one × summary   the card a record stands as beside the focus, and
 *                          a card of the pages face's gallery
 *   row  → one × glyph     the one line a record is drawn as among many: a
 *                          focused group's members, a list page's rows (FR-37)
 *   page → one × full      ABOVE the default record view, which keeps its
 *                          rename, fields and connections; on the pages
 *                          face, above the derived record page
 *
 * NOTHING HERE IS CODE. A block's words come from templates and the rule
 * language, evaluated under a step budget; nothing is parsed as markup,
 * nothing is evaluated as script, and the only styling is a fixed set of
 * classes over the theme's own tokens. The one link a view draws is a `url`
 * field's own value, and only when it is http(s). An expression that cannot
 * be judged draws "—"; a `when` that cannot be judged hides what it guards.
 */

export { SPEC_VIEW_CSS } from "./spec-css.js";

// ── blocks, parsed once ─────────────────────────────────────────────────────

type Parsed<T> = T | null;
type Tone = ViewTone | { readonly expr: Parsed<Expr> };

/** A block, parsed: templates and expressions are read once, when the spec is registered. */
export type SpecBlock =
  | { readonly t: "title"; readonly parts: Parsed<readonly TemplatePart[]> }
  | { readonly t: "text" | "badge"; readonly parts: Parsed<readonly TemplatePart[]>; readonly tone?: Tone }
  | { readonly t: "field"; readonly field: string; readonly as?: (typeof VIEW_FIELD_FORMATS)[number]; readonly label?: string }
  | { readonly t: "progress"; readonly value: Parsed<Expr>; readonly max: Parsed<Expr>; readonly label?: string }
  | { readonly t: "group"; readonly blocks: readonly SpecBlock[]; readonly direction: "row" | "column" }
  | { readonly t: "when"; readonly when: Parsed<Expr>; readonly show: readonly SpecBlock[] }
  | { readonly t: "divider" }
  | { readonly t: "figure" }
  | { readonly t: "headline"; readonly parts: Parsed<readonly TemplatePart[]> }
  | { readonly t: "number"; readonly value: Parsed<Expr>; readonly as?: FigureFormat; readonly currency?: string; readonly label?: string }
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

const safely = <T,>(f: () => T): T | null => {
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
  const headings = group && typeof group === "object" && (group as { headings?: unknown }).headings && typeof (group as { headings?: unknown }).headings === "object" ? ((group as { headings: Record<string, unknown> }).headings) : {};
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
 * part that does not is drawn as "—", and a block outside the vocabulary is
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
    // A list first: its `group` is how it is grouped, not a group block.
    if (has("list")) return [listOf(block)];
    if (has("headline")) return [{ t: "headline", parts: template(block["headline"]) }];
    if (has("figure") && typeof block["figure"] === "string") {
      const as = (FIGURE_FORMATS as readonly unknown[]).includes(block["as"]) ? (block["as"] as FigureFormat) : undefined;
      const currency = typeof block["currency"] === "string" && /^[A-Z]{3}$/.test(block["currency"]) ? block["currency"] : undefined;
      return [{ t: "number", value: expr(block["figure"]), ...(as ? { as } : {}), ...(currency ? { currency } : {}), ...(label ? { label } : {}) }];
    }
    if (has("title")) return [{ t: "title", parts: template(block["title"]) }];
    if (has("text")) return [{ t: "text", parts: template(block["text"]), ...(tone ? { tone } : {}) }];
    if (has("badge")) return [{ t: "badge", parts: template(block["badge"]), ...(tone ? { tone } : {}) }];
    if (has("field")) {
      const as = (VIEW_FIELD_FORMATS as readonly unknown[]).includes(block["as"]) ? (block["as"] as (typeof VIEW_FIELD_FORMATS)[number]) : undefined;
      return [{ t: "field", field: String(block["field"]), ...(as ? { as } : {}), ...(label ? { label } : {}) }];
    }
    if (has("progress")) {
      const p = (block["progress"] ?? {}) as { value?: unknown; max?: unknown };
      return [{ t: "progress", value: expr(p.value), max: expr(p.max), ...(label ? { label } : {}) }];
    }
    if (has("group")) return [{ t: "group", blocks: compileBlocks(block["group"] as readonly unknown[], depth + 1), direction: block["direction"] === "row" ? "row" : "column" }];
    if (has("when")) return [{ t: "when", when: expr(block["when"]), show: compileBlocks(block["show"] as readonly unknown[], depth + 1) }];
    if (has("divider")) return [{ t: "divider" }];
    if (has("figure")) return [{ t: "figure" }];
    return [];
  });
}

// ── drawing ─────────────────────────────────────────────────────────────────

/** Everything a spec reads to draw one record: nothing else reaches it. */
export interface SpecContext {
  /** The record the blocks are about; null for blocks about no one record — the home, a blocks lens (FR-81). */
  readonly node: AnyGraphNode | null;
  /** The level a headline is drawn at here, and the first top-level one where it is the page's own heading (the home's h1). */
  readonly heading?: number;
  readonly firstHeading?: number;
  /** The steps each expression may take; more for blocks that sweep whole kinds. */
  readonly budget?: number;
  /** For one-edge hops (`{fills.name}`); without it, a hop draws "—". */
  readonly graph?: GraphReader;
  readonly kinds: ReadonlyMap<string, KindShape>;
  /** The kind's declared fields, in the document's words: which may be a link, which is a date. */
  readonly fields: Readonly<Record<string, FieldSpec>>;
  /** How the declaration says a field and its values (`display.labels`, `display.format`). */
  readonly definition?: Parameters<typeof valueWords>[0];
  readonly today: string;
  readonly figure?: () => ReactNode;
}

const NOTHING = "—";
const FAILED = Symbol("failed");
/** The allowance a label's template gets: a card is drawn many times a frame. */
const BUDGET = 500;

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

function judge(expr: Parsed<Expr>, ctx: SpecContext): Value | typeof FAILED {
  if (!expr) return FAILED;
  try {
    return evaluateExpr(expr, { graph: ctx.graph ?? EMPTY_GRAPH, subject: ctx.node, kinds: ctx.kinds, today: ctx.today, budget: ctx.budget ?? BUDGET });
  } catch {
    return FAILED;
  }
}

function words(parts: Parsed<readonly TemplatePart[]>, ctx: SpecContext): string {
  if (!parts) return NOTHING;
  try {
    return renderTemplate(parts, { node: ctx.node, kinds: ctx.kinds, today: ctx.today, budget: ctx.budget ?? BUDGET, ...(ctx.graph ? { graph: ctx.graph } : {}) });
  } catch {
    return NOTHING;
  }
}

function toneWord(tone: Tone | undefined, ctx: SpecContext): ViewTone | undefined {
  if (tone === undefined) return undefined;
  if (typeof tone === "string") return tone;
  const value = judge(tone.expr, ctx);
  return isTone(value) ? value : "neutral";
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

function fieldText(key: string, value: unknown, ctx: SpecContext, as: (typeof VIEW_FIELD_FORMATS)[number] | undefined): string {
  if (value === null || value === undefined || value === "") return NOTHING;
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (as) return formatValue(value as Value, as, ctx.today);
  const spec = ctx.fields[key];
  if (ctx.definition?.display?.format?.[key]) return valueWords(ctx.definition, key, value);
  if (spec?.type === "date") return formatValue(value as Value, "date", ctx.today);
  if (spec?.type === "enum" && typeof value === "string") return valueWords(ctx.definition, key, value);
  if (typeof value === "number") return value.toLocaleString("en-US");
  if (Array.isArray(value)) return value.map((one) => String(one)).join(", ");
  if (typeof value === "object") return NOTHING;
  return String(value);
}

function Block({ block, ctx, first = false }: { readonly block: SpecBlock; readonly ctx: SpecContext; readonly first?: boolean }): ReactNode {
  switch (block.t) {
    case "title":
      return <strong className="graview-spec-title">{words(block.parts, ctx)}</strong>;
    case "text": {
      const tone = toneWord(block.tone, ctx);
      return (
        <p className="graview-spec-text" {...(tone ? { "data-graview-tone": tone } : {})}>
          {words(block.parts, ctx)}
        </p>
      );
    }
    case "badge":
      return (
        <span className="graview-spec-badge" data-graview-tone={toneWord(block.tone, ctx) ?? "neutral"}>
          {words(block.parts, ctx)}
        </span>
      );
    case "field": {
      // About no one record, there is no field to show (the check says so).
      if (!ctx.node) return null;
      // A computed field is worked out like any expression, under the same budget (FR-83); else an OWN field only: a name on the prototype is not a field of the record.
      const worked = ctx.kinds.get(ctx.node.kind)?.computed?.has(block.field);
      const judged = worked ? judge({ t: "ident", name: block.field, at: 0 }, ctx) : undefined;
      const raw = worked
        ? judged === FAILED || judged === undefined
          ? undefined
          : judged !== null && typeof judged === "object"
            ? formatValue(judged, undefined, ctx.today)
            : judged
        : Object.prototype.hasOwnProperty.call(ctx.node, block.field)
          ? ctx.node[block.field]
          : undefined;
      const label = block.label ?? fieldWords(ctx.definition, block.field);
      const href = ctx.fields[block.field]?.type === "url" && block.as === undefined ? safeHref(raw) : undefined;
      const shown = safely(() => fieldText(block.field, raw, ctx, block.as)) ?? NOTHING;
      return (
        <span className="graview-spec-field" data-graview-field={block.field}>
          <span className="graview-spec-label">{label}</span>
          <span className="graview-spec-value">
            {href ? (
              <a className="graview-spec-link" href={href} rel="noopener noreferrer" target="_blank">
                {shown}
              </a>
            ) : (
              shown
            )}
          </span>
        </span>
      );
    }
    case "progress": {
      const value = judge(block.value, ctx);
      const max = judge(block.max, ctx);
      const label = block.label ?? "Progress";
      if (!(typeof value === "number" && typeof max === "number" && Number.isFinite(value) && Number.isFinite(max) && max > 0)) {
        return (
          <span className="graview-spec-progress">
            <span className="graview-spec-label">{label}</span>
            <span className="graview-spec-value">{NOTHING}</span>
          </span>
        );
      }
      const now = Math.max(0, Math.min(value, max));
      const said = `${formatValue(value, undefined, ctx.today)} of ${formatValue(max, undefined, ctx.today)}`;
      return (
        <span className="graview-spec-progress">
          <span className="graview-spec-label">{label}</span>
          <span className="graview-spec-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={now} aria-valuetext={said}>
            <span className="graview-spec-fill" style={{ width: `${Math.round((now / max) * 100)}%` }} />
          </span>
          <span className="graview-spec-value">{said}</span>
        </span>
      );
    }
    case "group":
      return (
        <span className="graview-spec-group" data-direction={block.direction}>
          <SpecBlocks blocks={block.blocks} ctx={ctx} />
        </span>
      );
    case "when":
      // A condition that cannot be judged hides what it guards, like a rule's `when`.
      return judge(block.when, ctx) === true ? <SpecBlocks blocks={block.show} ctx={ctx} /> : null;
    case "divider":
      return <hr className="graview-spec-divider" />;
    case "figure":
      return ctx.figure ? (
        <span className="graview-spec-figure" aria-hidden="true">
          {ctx.figure()}
        </span>
      ) : null;
    case "headline": {
      const level = Math.min(6, Math.max(1, (first ? ctx.firstHeading : undefined) ?? ctx.heading ?? 3));
      const Tag = `h${level}` as "h1";
      return (
        <Tag className="graview-spec-headline" data-level={level}>
          {words(block.parts, ctx)}
        </Tag>
      );
    }
    case "number":
      return <SpecNumber block={block} ctx={ctx} />;
    case "list":
      return <SpecList block={block} ctx={ctx} />;
  }
}

/** Blocks, drawn for one record — or for none. Pure: everything they read is in `ctx`. */
export function SpecBlocks({ blocks, ctx }: { readonly blocks: readonly SpecBlock[]; readonly ctx: SpecContext }): ReactNode {
  const first = blocks.findIndex((block) => block.t === "headline");
  return blocks.map((block, i) => <Block key={i} block={block} ctx={ctx} first={i === first} />);
}

// ── figures and lists (FR-81, FR-82) ────────────────────────────────────────

/** A number worked out, said the way its block asks: a figure, as large as the page says anything, with what it is. */
function SpecNumber({ block, ctx }: { readonly block: Extract<SpecBlock, { t: "number" }>; readonly ctx: SpecContext }) {
  const value = judge(block.value, ctx);
  const said = value === FAILED || value === null || typeof value === "object" ? NOTHING : sayNumber(value, block.as, block.currency, ctx.today);
  return (
    <span className="graview-spec-number">
      <span className="graview-spec-number-value">{said}</span>
      {block.label ? <span className="graview-spec-label">{block.label}</span> : null}
    </span>
  );
}

/** A figure's words: a number in figures, money (in a currency when it names one) or a fraction as a percent. */
export function sayNumber(value: string | number | boolean, as: FigureFormat | undefined, currency: string | undefined, today: string): string {
  if (typeof value !== "number") return String(value);
  if (as === "money" && currency) {
    return safely(() => value.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: Number.isInteger(value) ? 0 : 2, minimumFractionDigits: Number.isInteger(value) ? 0 : 2 })) ?? formatValue(value, "money", today);
  }
  if (as === "money" || as === "percent") return formatValue(value, as, today);
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * HOW DEEP LISTS NEST. A card that lists related records draws each with
 * its own card, which may list its own — and a relation that comes back
 * round (a package's offers' packages' offers…) would draw for ever. Past
 * this depth a list says its records' names, each a link, and draws no
 * view of them; every expression keeps its own step budget besides.
 */
export const MAX_LIST_DEPTH = 3;
const ListDepth = createContext(0);

/**
 * WHERE A LISTED RECORD LEADS. The routed face hands an address and a way
 * to go there; with none — the scene — a record is a `data-graview-pick`
 * target, which the scene routes to that record as it does every view's.
 */
export interface SpecLinkTo {
  readonly href: (node: AnyGraphNode) => string;
  readonly go: (node: AnyGraphNode) => void;
}
export const SpecLinks = createContext<SpecLinkTo | null>(null);

/** The steps a list or a figure about no one record may take: it sweeps whole kinds. */
const SWEEP_BUDGET = 5_000;

function Listed({ node, as, depth }: { readonly node: AnyGraphNode; readonly as: "card" | "row"; readonly depth: number }) {
  const { store, views } = useGraview();
  const label = labelOf(store.schema.tryDefinition(node.kind), node);
  const View = views.lookup(node.kind as never, { cardinality: "one", fidelity: as === "card" ? "summary" : "glyph" }) as ViewComponent<AnySchema> | undefined;
  return (
    <li className="graview-spec-item" data-graview-listed={node.id} data-as={as}>
      {depth <= MAX_LIST_DEPTH && View ? (
        // A listed card is a card on a page as in the scene: drawn as the scene draws it.
        <ViewModeProvider mode="scene">
          <ListDepth.Provider value={depth}>
            <View node={node as never} cardinality="one" fidelity={as === "card" ? "summary" : "glyph"} mode="scene" selected={false} />
          </ListDepth.Provider>
        </ViewModeProvider>
      ) : (
        <span className="graview-spec-item-name">{label}</span>
      )}
      <ListedLink node={node} label={label} />
    </li>
  );
}

/** The whole item is the way to its record: a link stretched over it, under any link the item draws itself. */
function ListedLink({ node, label }: { readonly node: AnyGraphNode; readonly label: string }) {
  const links = useContext(SpecLinks);
  if (links) {
    return (
      <a
        className="graview-spec-item-link"
        href={links.href(node)}
        aria-label={label}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          links.go(node);
        }}
      />
    );
  }
  return <button type="button" className="graview-spec-item-link" data-graview-pick={node.id} aria-label={label} />;
}

/**
 * A LIST OF RECORDS: the records its expression names — the kinds swept,
 * or a walk from the record (`out('includes')`, `in('answers')`) — in their
 * order, a few, grouped by a choice in its declared order, each drawn with
 * its own card or row and each a link. Read from the graph the view is
 * handed, which for a seat is what that seat may see (FR-55): a record it
 * may not see is not listed, not counted, and opens no group of its own.
 */
function SpecList({ block, ctx }: { readonly block: Extract<SpecBlock, { t: "list" }>; readonly ctx: SpecContext }) {
  const depth = useContext(ListDepth) + 1;
  const { store } = useGraview();
  const value = judge(block.source, ctx);
  if (value === FAILED) return <p className="graview-spec-text">{NOTHING}</p>;
  let nodes: readonly AnyGraphNode[] = value instanceof NodeSet ? value.nodes : value !== null && typeof value === "object" && !Array.isArray(value) ? [value as AnyGraphNode] : [];
  if (block.choiceOrder) nodes = inChoiceOrder(nodes, block.choiceOrder, store.schema as AnySchema);
  const all = nodes.length;
  nodes = nodes.slice(0, block.limit ?? MAX_LIST_LIMIT);
  if (nodes.length === 0) return block.empty ? <p className="graview-spec-text graview-spec-empty">{block.empty}</p> : null;
  const more = all - nodes.length;
  const listOf = (members: readonly AnyGraphNode[]) =>
    depth > MAX_LIST_DEPTH ? (
      // Too deep to draw views: the names, each a link.
      <ul className="graview-spec-list" data-as="names">
        {members.map((node) => (
          <li key={node.id} className="graview-spec-item" data-graview-listed={node.id} data-as="name">
            <span className="graview-spec-item-name">{labelOf(store.schema.tryDefinition(node.kind), node)}</span>
            <ListedLink node={node} label={labelOf(store.schema.tryDefinition(node.kind), node)} />
          </li>
        ))}
      </ul>
    ) : (
      <ul className="graview-spec-list" data-as={block.as}>
        {members.map((node) => (
          <Listed key={node.id} node={node} as={block.as} depth={depth} />
        ))}
      </ul>
    );
  const tail = block.limit === undefined && more > 0 ? <p className="graview-spec-text graview-spec-more">{`and ${more} more`}</p> : null;
  if (!block.group) {
    return (
      <div className="graview-spec-listing">
        {listOf(nodes)}
        {tail}
      </div>
    );
  }
  const groups = groupsOf(nodes, block.group, store.schema as AnySchema);
  const level = Math.min(6, (ctx.heading ?? 3) + 1);
  const Heading = `h${level}` as "h2";
  return (
    <div className="graview-spec-listing">
      {groups.map((group) => (
        <section key={group.value ?? ""} className="graview-spec-list-group" data-graview-group={group.value ?? ""}>
          {group.heading ? <Heading className="graview-spec-list-heading">{group.heading}</Heading> : null}
          {listOf(group.members)}
        </section>
      ))}
      {tail}
    </div>
  );
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

const sentenceCase = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);

/** Blocks about no one record — the home's body, a blocks lens — drawn under the provider, from the graph its seat may see. */
export function SpecPlace({ blocks, heading = 2, firstHeading, slot }: { readonly blocks: readonly SpecBlock[]; readonly heading?: number; readonly firstHeading?: number; readonly slot: "home" | "place" }) {
  const { store } = useGraview();
  useGraph();
  const ctx: SpecContext = {
    node: null,
    graph: store.graph as unknown as GraphReader,
    kinds: shapesFor(store.schema as AnySchema),
    fields: {},
    today: today(),
    heading,
    ...(firstHeading !== undefined ? { firstHeading } : {}),
    budget: SWEEP_BUDGET,
  };
  return (
    <div className={`graview-spec graview-spec-${slot}`} data-graview-spec={slot}>
      <SpecBlocks blocks={blocks} ctx={ctx} />
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

const SHAPES = new WeakMap<object, Map<string, KindShape>>();
const FIELDS = new WeakMap<object, Map<string, Readonly<Record<string, FieldSpec>>>>();

/** What each kind holds, for names and hops: read once per schema. */
function shapesFor(schema: AnySchema): Map<string, KindShape> {
  let shapes = SHAPES.get(schema);
  if (!shapes) SHAPES.set(schema, (shapes = shapesOfSchema(schema)));
  return shapes;
}

/** A kind's fields in the document's words, read once per schema. */
function fieldsFor(schema: AnySchema, kind: string): Readonly<Record<string, FieldSpec>> {
  let byKind = FIELDS.get(schema);
  if (!byKind) FIELDS.set(schema, (byKind = new Map()));
  let fields = byKind.get(kind);
  if (!fields) {
    const shape = (schema.tryDefinition(kind) as { fields?: { shape?: Record<string, unknown> } } | undefined)?.fields?.shape ?? {};
    const read: Record<string, FieldSpec> = {};
    for (const [key, field] of Object.entries(shape)) {
      const spec = fieldSpecOf(field);
      if (spec) read[key] = spec;
    }
    byKind.set(kind, (fields = read));
  }
  return fields;
}

/** The drawing context for a record, from the provider every view is drawn under. */
export function useSpecContext(node: AnyGraphNode): SpecContext {
  const { store, brand } = useGraview();
  const schema = store.schema as AnySchema;
  const definition = schema.tryDefinition(node.kind) as SpecContext["definition"];
  return {
    node,
    graph: store.graph as unknown as GraphReader,
    kinds: shapesFor(schema),
    fields: fieldsFor(schema, node.kind),
    ...(definition ? { definition } : {}),
    today: today(),
    figure: () => <KindFigure kind={node.kind} schema={schema} {...(brand ? { brand } : {})} size={22} />,
  };
}

/** One slot of a spec, drawn for one record. */
export function SpecView({ slot, blocks, node, selected }: { readonly slot: ViewSlot; readonly blocks: readonly SpecBlock[]; readonly node: AnyGraphNode; readonly selected?: boolean }) {
  const ctx = useSpecContext(node);
  return (
    <div
      className={`graview-spec graview-spec-${slot}`}
      data-graview-spec={slot}
      data-graview-kind={node.kind}
      // A row that lists records or says a figure is more than one line, and is drawn as a block rather than a pill.
      {...(slot === "row" && blocks.some(isTall) ? { "data-graview-tall": "" } : {})}
      {...(selected ? { "data-selected": "" } : {})}
    >
      <SpecBlocks blocks={blocks} ctx={slot === "page" ? { ...ctx, heading: 2 } : ctx} />
    </div>
  );
}

/** Whether a block takes more than one line: a list, a headline or a figure, or a group or condition holding one. */
function isTall(block: SpecBlock): boolean {
  if (block.t === "list" || block.t === "headline" || block.t === "number") return true;
  if (block.t === "group") return block.blocks.some(isTall);
  if (block.t === "when") return block.show.some(isTall);
  return false;
}

/** A card: the framework's own Panel, so selection, a broken rule and the theme read as they do on a default card. */
function SpecCard({ blocks, node, selected, flagged }: { readonly blocks: readonly SpecBlock[]; readonly node: AnyGraphNode; readonly selected: boolean; readonly flagged: boolean }) {
  const ctx = useSpecContext(node);
  const [first, ...rest] = blocks;
  const titled = first?.t === "title";
  return (
    <Panel {...(titled ? { title: words(first.parts, ctx) } : {})} selected={selected} tone={flagged ? "warning" : "muted"} fit>
      <div className="graview-spec graview-spec-card" data-graview-spec="card" data-graview-kind={node.kind}>
        <SpecBlocks blocks={titled ? rest : blocks} ctx={ctx} />
      </div>
    </Panel>
  );
}

/** A row: one line, named for assistive technology by the record's own label. */
function SpecRow({ blocks, node, selected }: { readonly blocks: readonly SpecBlock[]; readonly node: AnyGraphNode; readonly selected: boolean }) {
  const { store } = useGraview();
  return (
    <div title={labelOf(store.schema.tryDefinition(node.kind), node)} style={{ minWidth: 0, maxWidth: "100%" }}>
      <SpecView slot="row" blocks={blocks} node={node} selected={selected} />
    </div>
  );
}

/**
 * A kind's specs, registered into the view matrix over whatever is there:
 * `card` at one × summary, `row` at one × glyph, and `page` at one × full,
 * drawn above the framework's own view for that cell. A kind the schema
 * does not declare is skipped — `graview check` says so. Returns the
 * registry, as `register` does.
 */
export function registerViewSpecs<S extends AnySchema>(registry: ReactViewRegistry<S>, schema: S, specs: ViewSpecsByKind | undefined): ReactViewRegistry<S> {
  if (!specs) return registry;
  const declared = new Set(schema.kinds as readonly string[]);
  for (const [kind, slots] of Object.entries(specs)) {
    if (!declared.has(kind) || !slots) continue;
    const at = kind as never;
    if (slots.card) {
      const blocks = compileBlocks(slots.card);
      const Card: ViewComponent<S> = (props: ViewProps<S>) =>
        props.node ? <SpecCard blocks={blocks} node={props.node as AnyGraphNode} selected={props.selected} flagged={props.flagged?.includes(props.node.id) ?? false} /> : null;
      registry.register(at, { cardinality: "one", fidelity: "summary" }, Card);
    }
    if (slots.row) {
      const blocks = compileBlocks(slots.row);
      const Row: ViewComponent<S> = (props: ViewProps<S>) => (props.node ? <SpecRow blocks={blocks} node={props.node as AnyGraphNode} selected={props.selected} /> : null);
      registry.register(at, { cardinality: "one", fidelity: "glyph" }, Row);
    }
    if (slots.page) {
      const blocks = compileBlocks(slots.page);
      const Page: ViewComponent<S> = (props: ViewProps<S>) =>
        props.node ? (
          <div className="graview-spec-host">
            <SpecView slot="page" blocks={blocks} node={props.node as AnyGraphNode} />
            <DefaultView<S> {...props} />
          </div>
        ) : null;
      registry.register(at, { cardinality: "one", fidelity: "full" }, Page);
    }
  }
  return registry;
}
