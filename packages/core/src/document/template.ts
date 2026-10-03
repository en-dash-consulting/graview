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
 */

export const FORMATTERS = ["money", "percent", "date", "relative", "upper", "lower", "count"] as const;
export type Formatter = (typeof FORMATTERS)[number];

export interface TemplatePart {
  readonly text?: string;
  readonly expr?: Expr;
  readonly source?: string;
  readonly format?: Formatter;
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
    const bar = inner.lastIndexOf("|");
    const source = (bar >= 0 ? inner.slice(0, bar) : inner).trim();
    const format = bar >= 0 ? inner.slice(bar + 1).trim() : undefined;
    if (format !== undefined && !(FORMATTERS as readonly string[]).includes(format)) {
      throw new TemplateError(`"${format}" is not a formatter; use one of ${FORMATTERS.join(", ")}`);
    }
    parts.push({ expr: parseExpr(source), source, ...(format ? { format: format as Formatter } : {}) });
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
export function formatValue(value: Value, format: Formatter | undefined, today: string): string {
  return show(value, format, today);
}

function show(value: Value, format: Formatter | undefined, today: string): string {
  if (value === null) return "—";
  if (value instanceof NodeSet) return format === "count" ? String(value.nodes.length) : value.nodes.map((n) => String(n["name"] ?? n["title"] ?? n.id)).join(", ");
  if (Array.isArray(value)) return format === "count" ? String(value.length) : value.map((v) => show(v as Value, undefined, today)).join(", ");
  if (typeof value === "object") return String((value as AnyGraphNode)["name"] ?? (value as AnyGraphNode)["title"] ?? (value as AnyGraphNode).id);
  switch (format) {
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
          budget: 500,
          ...(ctx.bindings ? { bindings: ctx.bindings } : {}),
        });
        return show(value, part.format, today);
      } catch (error) {
        if (error instanceof ExprEvalError) return "—";
        throw error;
      }
    })
    .join("");
}
