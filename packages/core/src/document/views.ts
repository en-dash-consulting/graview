import { analyzeExpr } from "./expr/analyze.js";
import { ExprSyntaxError, parseExpr, type Expr } from "./expr/parse.js";
import { error, type Finding } from "./findings.js";
import type { GraviewDocument, KindSpec } from "./schema.js";
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

export type ViewBlock =
  | { readonly title: string }
  | { readonly text: string; readonly tone?: ToneSpec }
  | { readonly badge: string; readonly tone?: ToneSpec }
  | { readonly field: string; readonly as?: ViewFieldFormat; readonly label?: string }
  | { readonly progress: { readonly value: string; readonly max: string }; readonly label?: string }
  | { readonly group: readonly ViewBlock[]; readonly direction?: "row" | "column" }
  | { readonly when: string; readonly show: readonly ViewBlock[] }
  | { readonly divider: true }
  | { readonly figure: true };

export type ViewSpecs = { readonly [slot in ViewSlot]?: readonly ViewBlock[] };

/** What each block may say besides the key that names it. */
const BLOCK_KEYS: Readonly<Record<string, readonly string[]>> = {
  title: [],
  text: ["tone"],
  badge: ["tone"],
  field: ["as", "label"],
  progress: ["label"],
  group: ["direction"],
  when: ["show"],
  divider: [],
  figure: [],
};
const BLOCK_TYPES = Object.keys(BLOCK_KEYS);
const SHAPES =
  '{"title": "{name}"}, {"text": "…", "tone"?}, {"badge": "{status}", "tone"?}, {"field": "quote", "as"?, "label"?}, {"progress": {"value": expr, "max": expr}, "label"?}, {"group": [blocks], "direction"?: "row"|"column"}, {"when": expr, "show": [blocks]}, {"divider": true}, {"figure": true}';

/** The view specs of a document that has been read; empty when it has none. */
export function viewsOf(document: GraviewDocument): Readonly<Record<string, ViewSpecs>> {
  return (document.views ?? {}) as Readonly<Record<string, ViewSpecs>>;
}

interface Scope {
  readonly kind: string;
  readonly spec: KindSpec;
  readonly kinds: ReadonlySet<string>;
  readonly edges: ReadonlySet<string>;
  readonly findings: Finding[];
  count: number;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function names(expr: Expr, path: string, scope: Scope) {
  const shape = analyzeExpr(expr);
  for (const fn of shape.unknownFunctions) scope.findings.push(error("unknown-function", path, `"${fn}" is not a function the rule language knows`, "see docs/declaration-document.md#expression-language"));
  for (const n of shape.names) {
    if (n === "id" || scope.spec.fields[n] || scope.spec.edges?.[n]) continue;
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
  const types = keys.filter((k) => BLOCK_TYPES.includes(k));
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
    case "text":
    case "badge":
      template(value, `${path}.${type}`, scope);
      if ("tone" in raw) tone(raw["tone"], `${path}.tone`, scope);
      return;
    case "field": {
      if (typeof value !== "string" || !scope.spec.fields[value]) {
        const edge = typeof value === "string" && scope.spec.edges?.[value];
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
      if ("label" in raw) label(raw["label"], `${path}.label`, scope);
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
    case "divider":
    case "figure":
      if (value !== true) scope.findings.push(error("view-block", `${path}.${type}`, `write {"${type}": true}`));
      if (type === "figure" && !scope.spec.figure) scope.findings.push(error("view-figure", `${path}.figure`, `${scope.kind} has no figure to show`, 'give the kind a "figure", or leave this block out'));
      return;
  }
}

function label(value: unknown, path: string, scope: Scope): void {
  if (typeof value !== "string" || value.length === 0 || value.length > 60) scope.findings.push(error("view-label", path, "a label is a few words, at most 60 characters"));
}

/** Findings about a document's `views`, each at its JSON path. */
export function validateViews(document: GraviewDocument): Finding[] {
  const findings: Finding[] = [];
  const kinds = new Set(Object.keys(document.kinds));
  const edges = new Set(Object.values(document.kinds).flatMap((k) => Object.keys(k.edges ?? {})));
  for (const [kind, specs] of Object.entries(viewsOf(document))) {
    const spec = document.kinds[kind];
    if (!spec) {
      findings.push(error("view-kind", `views.${kind}`, `"${kind}" is not a kind this document declares`));
      continue;
    }
    for (const slot of VIEW_SLOTS) {
      const list = specs[slot];
      if (list === undefined) continue;
      const scope: Scope = { kind, spec, kinds, edges, findings, count: 0 };
      blocks(list, `views.${kind}.${slot}`, 1, scope);
      if (scope.count > MAX_VIEW_BLOCKS) findings.push(error("view-size", `views.${kind}.${slot}`, `this ${slot} has ${scope.count} blocks; a view has at most ${MAX_VIEW_BLOCKS}`, "show less, or move detail to the page"));
    }
  }
  return findings;
}
