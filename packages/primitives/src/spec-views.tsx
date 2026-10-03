import { fieldWords, labelOf, valueWords, type AnyGraphNode, type AnySchema, type GraphReader } from "@graview/core";
import {
  evaluateExpr,
  fieldSpecOf,
  formatValue,
  parseExpr,
  parseTemplate,
  renderTemplate,
  shapesOfSchema,
  VIEW_FIELD_FORMATS,
  VIEW_TONES,
  type Expr,
  type FieldSpec,
  type KindShape,
  type TemplatePart,
  type Value,
  type ViewBlock,
  type ViewSlot,
  type ViewSpecsByKind,
  type ViewTone,
} from "@graview/core/document";
import { useGraview, type ReactViewRegistry, type ViewComponent, type ViewProps } from "@graview/react";
import type { ReactNode } from "react";
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
  | { readonly t: "figure" };

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
  readonly node: AnyGraphNode;
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
    return evaluateExpr(expr, { graph: ctx.graph ?? EMPTY_GRAPH, subject: ctx.node, kinds: ctx.kinds, today: ctx.today, budget: BUDGET });
  } catch {
    return FAILED;
  }
}

function words(parts: Parsed<readonly TemplatePart[]>, ctx: SpecContext): string {
  if (!parts) return NOTHING;
  try {
    return renderTemplate(parts, { node: ctx.node, kinds: ctx.kinds, today: ctx.today, ...(ctx.graph ? { graph: ctx.graph } : {}) });
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

function Block({ block, ctx }: { readonly block: SpecBlock; readonly ctx: SpecContext }): ReactNode {
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
      // An OWN field only: a name on the prototype is not a field of the record.
      const raw = Object.prototype.hasOwnProperty.call(ctx.node, block.field) ? ctx.node[block.field] : undefined;
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
  }
}

/** Blocks, drawn for one record. Pure: everything they read is in `ctx`. */
export function SpecBlocks({ blocks, ctx }: { readonly blocks: readonly SpecBlock[]; readonly ctx: SpecContext }): ReactNode {
  return blocks.map((block, i) => <Block key={i} block={block} ctx={ctx} />);
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
    <div className={`graview-spec graview-spec-${slot}`} data-graview-spec={slot} data-graview-kind={node.kind} {...(selected ? { "data-selected": "" } : {})}>
      <SpecBlocks blocks={blocks} ctx={ctx} />
    </div>
  );
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
