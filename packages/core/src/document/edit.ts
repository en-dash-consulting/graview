import { z } from "zod";
import type { Expr } from "./expr/parse.js";
import { ExprSyntaxError, parseExpr } from "./expr/parse.js";
import { printExpr } from "./expr/print.js";
import { error, type Finding } from "./findings.js";
import { coerce } from "./migrate.js";
import { outsideRange, rangeWords } from "./range.js";
import { farEnd } from "./far-end.js";
import {
  ActSpec,
  EDGE_NAME,
  EdgeSpec,
  FIELD_NAME,
  FIELD_TYPES,
  FieldSpec,
  KindSpec,
  NAME,
  RuleSpec,
  type FieldType,
  type GraviewDocument,
} from "./schema.js";
import { SHIPPED_LENSES, isShippedLens, SHIPPED_LENS_NAMES } from "../places.js";
import { placeSlug } from "../views/types.js";
import { computedOf, validateComputed } from "./computed.js";
import type { TemplatePart } from "./template.js";
import { parseTemplate, templateBraces, TemplateError } from "./template-parse.js";
import { validateViews, VIEW_SLOTS } from "./views.js";
import { brandFindings } from "./brand-check.js";
import { accentProblem } from "../theme/accent.js";

/*
 * STRUCTURAL EDITS — a closed vocabulary for changing what an app declares.
 *
 * A JSON Patch says WHERE in the document to change something; an edit says
 * WHAT the change is ("rename vendor's quote to price"), and so it can do
 * everything the change means: a rename sets `renamedFrom` so the records'
 * values move, AND rewrites every place that names the old name — rule
 * expressions (parsed, renamed in the tree, printed back: never a regular
 * expression over the text), templates, acts, the lifecycle, policy, lenses,
 * pages and views. A removal takes with it what can no longer stand (an act
 * that only wrote the removed field, a rule that judged it, a view block
 * that showed it) and says so. The result is a document; the caller
 * compiles, checks and previews it like any other.
 *
 * `fill` on add-field gives existing records a value: it is carried beside
 * the document (EditOutcome.fills) to the migration planner, which applies
 * it in the same migration op as the rest of the change (planMigration's
 * `fills`). It never enters the document.
 */

export interface Fill {
  readonly kind: string;
  readonly field: string;
  /** A constant for every record that has no value. */
  readonly value?: unknown;
  /** Or: copy from another field of the same record (after the change's renames). */
  readonly from?: string;
}

export type EditOutcome =
  | { readonly ok: true; readonly document: GraviewDocument; readonly said: readonly string[]; readonly fills: readonly Fill[] }
  | { readonly ok: false; readonly findings: readonly Finding[] };

/** The ops, for tool schemas and the guide. */
export const EDIT_OPS = [
  "add-kind",
  "rename-kind",
  "remove-kind",
  "add-field",
  "rename-field",
  "retype-field",
  "set-options",
  "set-range",
  "set-required",
  "set-default",
  "remove-field",
  "add-relation",
  "rename-relation",
  "remove-relation",
  "add-act",
  "remove-act",
  "add-rule",
  "remove-rule",
  "set-brand",
  "set-name",
  "set-description",
  "set-label",
  "set-describe",
  "set-view",
  "set-glance",
  "add-lens",
  "remove-lens",
  "set-home",
  "arrange-pages",
  "set-computed",
] as const;
export type EditOp = (typeof EDIT_OPS)[number];

/** One edit as `editDocument` takes it: an op from EDIT_OPS and that op's own keys. */
export type DocumentEdit = { readonly op: EditOp } & { readonly [key: string]: unknown };

/** Words the rule language keeps: a field or relation renamed to one could not be named in a rule. */
const KEYWORDS = new Set(["and", "or", "not", "in", "where", "true", "false", "null"]);
const MAX_EDITS = 50;

// ── shapes ─────────────────────────────────────────────────────────────────

const kindName = z.string().regex(NAME, 'kind names are lower-case words joined by hyphens, like "guest-list"');
const fieldName = z.string().regex(FIELD_NAME, 'field names are one word or camelCase, like "dueDate"');
const edgeName = z.string().regex(EDGE_NAME, 'relation names are one camelCase word, like "tendedBy"');
const actName = z.string().regex(NAME, 'act names are lower-case words joined by hyphens, like "mark-paid"');
const lensTitle = z.string().min(1).max(80);

const SHAPES: Record<EditOp, z.ZodType> = {
  "add-kind": z.object({ op: z.literal("add-kind"), kind: kindName, act: z.boolean().optional() }).passthrough(),
  "rename-kind": z.object({ op: z.literal("rename-kind"), kind: kindName, to: kindName, noun: z.string().min(1).max(40).optional(), plural: z.string().min(1).max(40).optional() }).strict(),
  "remove-kind": z.object({ op: z.literal("remove-kind"), kind: kindName }).strict(),
  "add-field": z.object({ op: z.literal("add-field"), kind: kindName, field: fieldName, fill: z.unknown().optional(), spec: z.record(z.string(), z.unknown()).optional() }).passthrough(),
  "rename-field": z.object({ op: z.literal("rename-field"), kind: kindName, field: fieldName, to: fieldName }).strict(),
  "retype-field": z.object({ op: z.literal("retype-field"), kind: kindName, field: fieldName, type: z.enum(FIELD_TYPES), options: z.array(z.string().min(1).max(80)).min(1).max(100).optional(), of: z.enum(["string", "number", "date"]).optional(), format: z.enum(["money", "percent", "duration"]).optional() }).strict(),
  "set-options": z.object({ op: z.literal("set-options"), kind: kindName, field: fieldName, add: z.array(z.string().min(1).max(80)).optional(), remove: z.array(z.string().min(1).max(80)).optional() }).strict(),
  "set-range": z.object({ op: z.literal("set-range"), kind: kindName, field: fieldName, min: z.union([z.number(), z.null()]).optional(), max: z.union([z.number(), z.null()]).optional(), step: z.union([z.number().positive(), z.null()]).optional() }).strict(),
  "set-required": z.object({ op: z.literal("set-required"), kind: kindName, field: fieldName, required: z.boolean() }).strict(),
  "set-default": z.object({ op: z.literal("set-default"), kind: kindName, field: fieldName, default: z.unknown() }).strict(),
  "remove-field": z.object({ op: z.literal("remove-field"), kind: kindName, field: fieldName }).strict(),
  "add-relation": z.object({ op: z.literal("add-relation"), kind: kindName, relation: edgeName }).passthrough(),
  "rename-relation": z.object({ op: z.literal("rename-relation"), kind: kindName, relation: edgeName, to: edgeName }).strict(),
  "remove-relation": z.object({ op: z.literal("remove-relation"), kind: kindName, relation: edgeName }).strict(),
  "add-act": z.object({ op: z.literal("add-act"), act: actName, replace: z.boolean().optional() }).passthrough(),
  "remove-act": z.object({ op: z.literal("remove-act"), act: actName }).strict(),
  "add-rule": z.object({ op: z.literal("add-rule"), rule: actName, replace: z.boolean().optional() }).passthrough(),
  "remove-rule": z.object({ op: z.literal("remove-rule"), rule: actName }).strict(),
  "set-brand": z
    .object({
      op: z.literal("set-brand"),
      accent: z.union([z.string(), z.null()]).optional(),
      name: z.union([z.string().min(1).max(60), z.null()]).optional(),
      currency: z.union([z.string(), z.null()]).optional(),
      locale: z.union([z.string(), z.null()]).optional(),
      // The rest of the brand (FR-124, FR-125): each as the document holds it, null to clear it.
      logo: z.union([z.string().min(1), z.object({ src: z.string().min(1), alt: z.string().min(1).max(120).optional() }).strict(), z.null()]).optional(),
      favicon: z.union([z.string().min(1), z.null()]).optional(),
      typography: z.union([z.object({ display: z.union([z.string().min(1).max(200), z.null()]).optional(), body: z.union([z.string().min(1).max(200), z.null()]).optional(), mono: z.union([z.string().min(1).max(200), z.null()]).optional() }).strict(), z.null()]).optional(),
      shape: z.union([z.object({ radius: z.union([z.number().min(0).max(32), z.null()]).optional(), density: z.union([z.number().min(0.75).max(1.5), z.null()]).optional() }).strict(), z.null()]).optional(),
      accents: z.union([z.record(z.string(), z.union([z.number().min(0).max(360), z.null()])), z.null()]).optional(),
      scheme: z.union([z.enum(["light", "dark", "auto"]), z.null()]).optional(),
    })
    .strict(),
  "set-name": z.object({ op: z.literal("set-name"), name: z.string().min(1).max(80) }).strict(),
  "set-description": z.object({ op: z.literal("set-description"), description: z.union([z.string().min(1).max(500), z.null()]) }).strict(),
  "set-label": z.object({ op: z.literal("set-label"), kind: kindName, field: fieldName.optional(), label: z.union([z.string().min(1).max(300), z.null()]) }).strict(),
  "set-describe": z.object({ op: z.literal("set-describe"), kind: kindName, describe: z.union([z.string().min(1).max(300), z.null()]) }).strict(),
  // A kind's slot; the front page (`slot: "home"`, no kind); or a blocks lens's blocks, by its title (FR-84).
  "set-view": z.object({ op: z.literal("set-view"), kind: kindName.optional(), slot: z.enum([...VIEW_SLOTS, "home"]).optional(), lens: lensTitle.optional(), blocks: z.union([z.array(z.unknown()).min(1), z.null()]) }).strict(),
  "set-glance": z.object({ op: z.literal("set-glance"), kind: kindName, fields: z.array(fieldName).max(20) }).strict(),
  "add-lens": z
    .object({
      op: z.literal("add-lens"),
      title: lensTitle,
      lens: z.string().min(1).max(40).optional(),
      on: kindName.optional(),
      bindings: z.record(z.string(), z.unknown()).optional(),
      options: z.record(z.string(), z.unknown()).optional(),
      at: z.number().int().min(0).optional(),
      replace: lensTitle.optional(),
    })
    .strict(),
  "remove-lens": z.object({ op: z.literal("remove-lens"), title: lensTitle, on: kindName.optional() }).strict(),
  "set-home": z.object({ op: z.literal("set-home"), blocks: z.union([z.array(z.unknown()).min(1), z.null()]) }).strict(),
  "arrange-pages": z
    .object({
      op: z.literal("arrange-pages"),
      order: z.union([z.array(kindName).max(40), z.null()]).optional(),
      hide: z.union([z.array(kindName).max(40), z.null()]).optional(),
      first: z.union([z.string().min(1).max(80), z.null()]).optional(),
    })
    .strict(),
  "set-computed": z
    .object({
      op: z.literal("set-computed"),
      kind: kindName,
      name: fieldName,
      expr: z.union([z.string().min(1).max(2000), z.null()]).optional(),
      label: z.union([z.string().min(1).max(60), z.null()]).optional(),
      description: z.union([z.string().min(1).max(500), z.null()]).optional(),
    })
    .strict(),
};

// ── the document as something to change ──────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
type Doc = any;
type Kinds = ReadonlySet<string> | "*";
const NONE: Kinds = new Set<string>();

const clone = <T>(v: T): T => structuredClone(v);
const asArray = (v: unknown): string[] => (v === undefined ? [] : Array.isArray(v) ? (v as string[]) : [v as string]);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const refName = (v: unknown): string | undefined => (typeof v === "string" && /^\$[A-Za-z][A-Za-z0-9]*$/.test(v) ? v.slice(1) : undefined);
const kebab = (camel: string) => camel.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const words = (name: string) => kebab(name).replace(/-/g, " ");

function hasKind(kinds: Kinds, kind: string): boolean {
  return kinds === "*" || kinds.has(kind);
}
function kindsIn(doc: Doc, kinds: Kinds): string[] {
  return kinds === "*" ? Object.keys(doc.kinds) : [...kinds].filter((k) => doc.kinds[k]);
}
function union(a: Kinds, b: Kinds): Kinds {
  if (a === "*" || b === "*") return "*";
  return new Set([...a, ...b]);
}

/** The kinds a relation, followed from `kinds`, arrives at. */
function targets(doc: Doc, kinds: Kinds, edge: string): Kinds {
  let out: Kinds = new Set<string>();
  for (const k of kindsIn(doc, kinds)) {
    const e = doc.kinds[k].edges?.[edge];
    if (e) out = union(out, e.to === "*" ? "*" : new Set<string>(e.to));
  }
  return out;
}
/** Every kind that declares a relation by this name. */
function sources(doc: Doc, edge: string): Kinds {
  return new Set(Object.keys(doc.kinds).filter((k) => doc.kinds[k].edges?.[edge]));
}

/** The kinds of record an expression yields, standing at `ctx` — or none, for a plain value. */
function kindsOf(doc: Doc, e: Expr, ctx: Kinds): Kinds {
  switch (e.t) {
    case "ident":
      return targets(doc, ctx, e.name);
    case "member":
      return targets(doc, kindsOf(doc, e.object, ctx), e.name);
    case "where":
      return kindsOf(doc, e.set, ctx);
    case "call": {
      const lit = e.args[0]?.t === "lit" && typeof e.args[0].value === "string" ? e.args[0].value : undefined;
      // A walk from every member of a set (FR-101): its relation is its second word.
      const walked = e.args.length === 2 && e.args[1]?.t === "lit" && typeof e.args[1].value === "string" ? e.args[1].value : undefined;
      if (e.fn === "out" && walked) return targets(doc, kindsOf(doc, e.args[0]!, ctx), walked);
      if (e.fn === "in" && walked) return sources(doc, walked);
      if (e.fn === "out" && lit) return targets(doc, "*", lit);
      if (e.fn === "in" && lit) return sources(doc, lit);
      if (e.fn === "all" && lit) return new Set([lit]);
      if (e.fn === "if" && e.args.length === 3) return union(kindsOf(doc, e.args[1]!, ctx), kindsOf(doc, e.args[2]!, ctx));
      // A set handed through: its first, in an order, or the first of several that is not empty.
      if ((e.fn === "first" || e.fn === "sort") && e.args[0]) return kindsOf(doc, e.args[0], ctx);
      if (e.fn === "either") return e.args.reduce<Kinds>((all, arg) => union(all, kindsOf(doc, arg, ctx)), NONE);
      return NONE;
    }
    default:
      return NONE;
  }
}

/** Where a name stands in an expression, and what it can mean there. */
interface Site {
  /** "name": a bare or dotted field-or-relation; "field": sum()'s field; "edge": out/in('…'); "kind": all('…'). */
  readonly role: "name" | "field" | "edge" | "kind";
  /** The kinds of record the name is read from (for name and field). */
  readonly kinds: Kinds;
  readonly name: string;
}

/**
 * Every name in an expression, with what it is read from, mapped through `rename`.
 * Returns the same tree when nothing changed. The kinds are worked out from the
 * document as it stands BEFORE the rename.
 */
function mapNames(doc: Doc, e: Expr, ctx: Kinds, rename: (site: Site) => string): Expr {
  const go = (x: Expr, at: Kinds): Expr => {
    switch (x.t) {
      case "lit":
        return x;
      case "ident": {
        const name = rename({ role: "name", kinds: at, name: x.name });
        return name === x.name ? x : { ...x, name };
      }
      case "list": {
        const items = x.items.map((i) => go(i, at));
        return items.every((i, n) => i === x.items[n]) ? x : { ...x, items };
      }
      case "member": {
        const object = go(x.object, at);
        const name = rename({ role: "name", kinds: kindsOf(doc, x.object, at), name: x.name });
        return object === x.object && name === x.name ? x : { ...x, object, name };
      }
      case "unary": {
        const operand = go(x.operand, at);
        return operand === x.operand ? x : { ...x, operand };
      }
      case "binary": {
        const left = go(x.left, at);
        const right = go(x.right, at);
        return left === x.left && right === x.right ? x : { ...x, left, right };
      }
      case "where": {
        const set = go(x.set, at);
        const filter = go(x.filter, kindsOf(doc, x.set, at));
        return set === x.set && filter === x.filter ? x : { ...x, set, filter };
      }
      case "call": {
        const first = x.args[0];
        const literal = first?.t === "lit" && typeof first.value === "string" ? first.value : undefined;
        let args: Expr[];
        if ((x.fn === "out" || x.fn === "in" || x.fn === "all") && literal !== undefined && x.args.length === 1) {
          const name = rename({ role: x.fn === "all" ? "kind" : "edge", kinds: NONE, name: literal });
          args = name === literal ? [...x.args] : [{ ...first!, value: name } as Expr];
        } else if ((x.fn === "out" || x.fn === "in") && x.args.length === 2 && x.args[1]!.t === "lit" && typeof x.args[1]!.value === "string") {
          // out(S, 'edge'): the set is read where the walk stands, and its relation renamed like any walk's (FR-101).
          const relation = x.args[1]! as Extract<Expr, { t: "lit" }>;
          const name = rename({ role: "edge", kinds: NONE, name: relation.value as string });
          args = [go(first!, at), name === relation.value ? relation : { ...relation, value: name }];
        } else if (((x.fn === "every" || x.fn === "some") && x.args.length === 2) || (x.fn === "sort" && x.args.length >= 2)) {
          // Read once per member, with the member as its subject: its names are the members'.
          args = [go(x.args[0]!, at), go(x.args[1]!, kindsOf(doc, x.args[0]!, at)), ...x.args.slice(2).map((a) => go(a, at))];
        } else if ((x.fn === "sum" || x.fn === "min" || x.fn === "max") && x.args.length === 2) {
          const second = x.args[1]!;
          const members = kindsOf(doc, x.args[0]!, at);
          let field: Expr = second;
          if (second.t === "ident" || (second.t === "lit" && typeof second.value === "string")) {
            const was = second.t === "ident" ? second.name : (second.value as string);
            const name = rename({ role: "field", kinds: members, name: was });
            if (name !== was) field = second.t === "ident" ? { ...second, name } : { ...second, value: name };
          } else field = go(second, members); // sum(out('includes'), list * units): each member's own list and units
          args = [go(x.args[0]!, at), field];
        } else args = x.args.map((a) => go(a, at));
        return args.every((a, n) => a === x.args[n]) ? x : { ...x, args };
      }
    }
  };
  return go(e, ctx);
}

/** A rename, and how it reads at a site. */
type Rename = { readonly t: "field"; readonly kind: string; readonly from: string; readonly to: string } | { readonly t: "edge"; readonly from: string; readonly to: string } | { readonly t: "kind"; readonly from: string; readonly to: string };

function renamer(doc: Doc, r: Rename): (site: Site) => string {
  return (site) => {
    if (r.t === "kind") return site.role === "kind" && site.name === r.from ? r.to : site.name;
    if (r.t === "edge") {
      if (site.role === "edge") return site.name === r.from ? r.to : site.name;
      if (site.role === "name" && site.name === r.from && kindsIn(doc, site.kinds).some((k) => doc.kinds[k].edges?.[r.from])) return r.to;
      return site.name;
    }
    // A field, or a computed field (FR-83): read by the same bare name.
    if ((site.role === "name" || site.role === "field") && site.name === r.from && hasKind(site.kinds, r.kind) && (doc.kinds[r.kind]?.fields?.[r.from] || doc.kinds[r.kind]?.computed?.[r.from] !== undefined)) return r.to;
    return site.name;
  };
}

/** Does this expression read the field / relation / kind at all? */
function mentions(doc: Doc, e: Expr, ctx: Kinds, r: Rename): boolean {
  return mapNames(doc, e, ctx, renamer(doc, r)) !== e;
}

/** An expression's text with the rename applied, or the same text when it does not mention it. */
function rewriteExpr(doc: Doc, source: string, ctx: Kinds, r: Rename): string {
  let e: Expr;
  try {
    e = parseExpr(source);
  } catch (err) {
    if (err instanceof ExprSyntaxError) return source; // the check will say so
    throw err;
  }
  const next = mapNames(doc, e, ctx, renamer(doc, r));
  return next === e ? source : printExpr(next);
}

function parts(source: string): readonly TemplatePart[] | null {
  try {
    return parseTemplate(source);
  } catch (err) {
    if (err instanceof TemplateError || err instanceof ExprSyntaxError) return null;
    throw err;
  }
}

/**
 * A template with the rename applied inside its braces; the words around them
 * are kept, and so is what each brace says after its bar — `| money`,
 * `| plural: 'front'` — exactly as it was written.
 */
function rewriteTemplate(doc: Doc, source: string, ctx: Kinds, r: Rename, prose?: (text: string) => string): string {
  const ps = parts(source);
  if (!ps) return source;
  const braces = templateBraces(source);
  let changed = false;
  let brace = 0;
  const out = ps.map((p) => {
    if (p.text !== undefined) {
      const t = prose ? prose(p.text) : p.text;
      if (t !== p.text) changed = true;
      return t;
    }
    const { inner, bar } = braces[brace++]!;
    const next = mapNames(doc, p.expr!, ctx, renamer(doc, r));
    if (next === p.expr) return `{${inner}}`;
    changed = true;
    const tail = bar >= 0 ? inner.slice(bar) : "";
    const lead = /^\s*/.exec(inner)![0];
    const gap = bar >= 0 ? /\s*$/.exec(inner.slice(0, bar))![0] : /\s*$/.exec(inner)![0];
    return `{${lead}${printExpr(next)}${gap}${tail}}`;
  });
  return changed ? out.join("") : source;
}

function templateMentions(doc: Doc, source: string | undefined, ctx: Kinds, r: Rename): boolean {
  if (!source) return false;
  const ps = parts(source);
  return !!ps && ps.some((p) => p.expr && mentions(doc, p.expr, ctx, r));
}
function exprMentions(doc: Doc, source: string | undefined, ctx: Kinds, r: Rename): boolean {
  if (!source) return false;
  try {
    return mentions(doc, parseExpr(source), ctx, r);
  } catch (err) {
    if (err instanceof ExprSyntaxError) return false;
    throw err;
  }
}

/** Whole-word, case-keeping replacement in prose (titles, descriptions, the words of a sentence). Prose is not code. */
function proseSwap(from: string, to: string): (text: string) => string {
  const a = words(from);
  const b = words(to);
  const re = new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  return (text) => text.replace(re, (m) => (m[0] === m[0]!.toUpperCase() ? b.charAt(0).toUpperCase() + b.slice(1) : b));
}

// ── what an act touches ──────────────────────────────────────────────────────

const subjectKinds = (act: Doc): Kinds => (act.on ? new Set(asArray(act.on)) : NONE);

/** The kinds each `set` in an act writes to: its subject, a record it made, the other end of what it connects (FR-115), or (for a `$ref` target) any kind. */
function setTargets(act: Doc, doc?: Doc): { set: Record<string, unknown>; kinds: Kinds; where: "sets" | "setsOther" | "writes" | "effect" | "create"; index?: number }[] {
  const out: { set: Record<string, unknown>; kinds: Kinds; where: "sets" | "setsOther" | "writes" | "effect" | "create"; index?: number }[] = [];
  const made = new Map<string, string>();
  if (act.creates) made.set("new", act.creates);
  (act.effects ?? []).forEach((e: Doc) => {
    if (e.create && e.as) made.set(e.as, e.create);
  });
  if (act.sets) out.push({ set: act.sets, kinds: subjectKinds(act), where: "sets" });
  if (act.setsOther) {
    const relation = act.connects ?? act.severs;
    const end = doc && relation ? farEnd(doc.kinds, relation, asArray(act.on)) : undefined;
    out.push({ set: act.setsOther, kinds: end && end.kinds !== "*" ? new Set(end.kinds) : "*", where: "setsOther" });
  }
  (act.effects ?? []).forEach((e: Doc, index: number) => {
    if (e.create) out.push({ set: e.set ?? {}, kinds: new Set([e.create]), where: "create", index });
    else if (e.set) {
      const target = refName(e.target ?? "$subject");
      out.push({ set: e.set, kinds: target === "subject" ? subjectKinds(act) : made.has(target ?? "") ? new Set([made.get(target!)!]) : "*", where: "effect", index });
    }
  });
  return out;
}

// ── the edits ────────────────────────────────────────────────────────────────

class Editor {
  readonly said: string[] = [];
  /** The agent tools this change renames or reshapes: a model that listed them before calls what is gone. */
  readonly toolsMoved = new Set<string>();
  readonly findings: Finding[] = [];
  readonly fills: Fill[] = [];
  /** Where each kind, field and relation of the current draft came from in the base document (undefined: new in this change). */
  private readonly kindOrigin = new Map<string, string | undefined>();
  private readonly fieldOrigin = new Map<string, string | undefined>();
  private readonly edgeOrigin = new Map<string, string | undefined>();

  constructor(
    readonly doc: Doc,
    base: GraviewDocument,
  ) {
    for (const [kind, spec] of Object.entries(base.kinds)) {
      this.kindOrigin.set(kind, kind);
      for (const f of Object.keys(spec.fields)) this.fieldOrigin.set(`${kind}.${f}`, f);
      for (const e of Object.keys(spec.edges ?? {})) this.edgeOrigin.set(`${kind}.${e}`, e);
    }
  }

  private fail(i: number, path: string, message: string, fix?: string) {
    this.findings.push(error("edit", `edits.${i}${path ? `.${path}` : ""}`, message, fix));
  }

  /**
   * THE BRAND, KEY BY KEY (FR-100, FR-124, FR-125): what an edit names is
   * set, null clears it, and what it does not name stays as it was. Each
   * is judged as `graview check` judges it — a mark that could act or load,
   * a face off the list — and an accent that does not read as given is
   * refused with the pair, the ratio and a shade that would (FR-126).
   */
  private setBrand(i: number, e: Doc) {
    const brand: Record<string, any> = clone(this.doc.brand ?? {});
    const at = `edits.${i}`;
    const judged = brandFindings(
      { ...(typeof e.logo === "string" || isObject(e.logo) ? { logo: e.logo } : {}), ...(typeof e.favicon === "string" ? { favicon: e.favicon } : {}), ...(isObject(e.typography) ? { typography: Object.fromEntries(Object.entries(e.typography).filter(([, v]) => typeof v === "string")) as Doc } : {}) },
      { at },
    );
    if (judged.length > 0) return void this.findings.push(...judged);
    if (e.accent === null) {
      delete brand["accent"];
      this.said.push("The app goes back to Graview's colors.");
    } else if (e.accent !== undefined) {
      if (!/^#[0-9a-fA-F]{6}$/.test(e.accent)) return this.fail(i, "accent", 'an accent is a color like "#c2577a"');
      const refused = accentProblem(e.accent);
      if (refused) return this.fail(i, "accent", refused.sentence, refused.suggestion ? `{"op": "set-brand", "accent": "${refused.suggestion}"}` : "pick a color of another hue");
      brand["accent"] = e.accent;
      this.said.push(`The app's accent color becomes ${e.accent}.`);
    }
    if (e.currency === null) {
      delete brand["currency"];
      this.said.push("Money is said with no currency.");
    } else if (e.currency !== undefined) {
      if (!/^[A-Z]{3}$/.test(e.currency)) return this.fail(i, "currency", 'a currency is its three-letter code, like "USD" or "EUR"');
      brand["currency"] = e.currency;
      this.said.push(`Money is said in ${e.currency}.`);
    }
    if (e.locale === null) delete brand["locale"];
    else if (e.locale !== undefined) {
      if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(e.locale)) return this.fail(i, "locale", 'a locale is a language tag, like "en-US" or "de-DE"');
      brand["locale"] = e.locale;
      this.said.push(`Money is written for ${e.locale}.`);
    }
    if (e.name === null) {
      delete brand["name"];
      this.said.push("The wordmark says the app's name.");
    } else if (e.name !== undefined) {
      brand["name"] = e.name;
      this.said.push(`The app's wordmark says ${e.name}.`);
    }
    for (const [key, what] of [["logo", "logo"], ["favicon", "page icon"]] as const) {
      if (e[key] === undefined) continue;
      const had = brand[key] !== undefined;
      if (e[key] === null) delete brand[key];
      else brand[key] = e[key];
      this.said.push(e[key] === null ? `The app has no ${what}.` : had ? `The ${what} changes.` : `The app gets a ${what}.`);
    }
    const merge = (key: "typography" | "shape" | "accents", say: (part: string, value: unknown) => string, cleared: string) => {
      if (e[key] === undefined) return;
      if (e[key] === null) {
        delete brand[key];
        this.said.push(cleared);
        return;
      }
      const into: Record<string, unknown> = { ...(brand[key] ?? {}) };
      for (const [part, value] of Object.entries(e[key] as Record<string, unknown>)) {
        if (value === null) delete into[part];
        else into[part] = value;
        this.said.push(say(part, value));
      }
      if (Object.keys(into).length === 0) delete brand[key];
      else brand[key] = into;
    };
    const ROLE: Record<string, string> = { display: "Headings", body: "Body text", mono: "Code" };
    merge("typography", (role, value) => (value === null ? `${ROLE[role]} go${role === "display" ? "" : "es"} back to Graview's face.` : `${ROLE[role]} ${role === "display" ? "are" : "is"} now set in ${value}.`), "Words go back to Graview's faces.");
    merge("shape", (part, value) => (part === "radius" ? (value === null ? "Corners go back to Graview's own." : `Corners are now ${value}px.`) : value === null ? "Spacing goes back to Graview's own." : `Spacing is now ${value} times Graview's own.`), "Corners and spacing go back to Graview's own.");
    if (isObject(e.accents)) {
      const unknown = Object.keys(e.accents).find((kind) => !this.doc.kinds[kind]);
      if (unknown) return this.fail(i, "accents", `"${unknown}" is not a kind this app has; it has ${Object.keys(this.doc.kinds).join(", ")}`);
    }
    merge("accents", (kind, hue) => (hue === null ? `${cap(kind)} goes back to its own hue.` : `${cap(kind)} is drawn at hue ${hue}°.`), "Every kind goes back to its own hue.");
    if (e.scheme !== undefined) {
      if (e.scheme === null || e.scheme === "auto") delete brand["scheme"];
      else brand["scheme"] = e.scheme;
      this.said.push(e.scheme === "light" || e.scheme === "dark" ? `The app opens ${e.scheme} when the reader has not chosen.` : "The app follows the reader's system for light and dark.");
    }
    if (Object.keys(brand).length === 0) delete this.doc.brand;
    else this.doc.brand = brand;
  }

  private kind(i: number, kind: string): Doc | undefined {
    const spec = this.doc.kinds[kind];
    if (!spec) this.fail(i, "kind", `"${kind}" is not a kind this app has; it has ${Object.keys(this.doc.kinds).join(", ")}`);
    return spec;
  }

  private field(i: number, kind: string, field: string): Doc | undefined {
    const spec = this.kind(i, kind);
    if (!spec) return undefined;
    const f = spec.fields[field];
    if (!f) this.fail(i, "field", `${kind} has no field "${field}"; it has ${Object.keys(spec.fields).join(", ")}`);
    return f;
  }

  private freeName(i: number, kind: string, name: string, what: "field" | "relation"): boolean {
    const spec = this.doc.kinds[kind];
    if (KEYWORDS.has(name)) {
      this.fail(i, "to", `"${name}" is a word the rule language keeps, so a rule could not name a ${what} by it`);
      return false;
    }
    if (name === "id" || name === "kind") {
      this.fail(i, "to", `a ${what} cannot be called "${name}" — the framework keeps it; try "type" or "category"`);
      return false;
    }
    if (spec.fields[name] || spec.edges?.[name]) {
      this.fail(i, "to", `${kind} already has a ${spec.fields[name] ? "field" : "relation"} called "${name}"`);
      return false;
    }
    return true;
  }

  apply(i: number, edit: Record<string, unknown>) {
    const op = edit["op"];
    if (typeof op !== "string" || !(EDIT_OPS as readonly string[]).includes(op)) {
      this.fail(i, "op", `${op === undefined ? "an edit names its op" : `"${String(op)}" is not an edit Graview knows`}`, `one of ${EDIT_OPS.join(", ")}`);
      return;
    }
    const parsed = SHAPES[op as EditOp].safeParse(edit);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.map(String).join(".");
        this.fail(i, path, issue.code === "unrecognized_keys" ? `${issue.keys.map((k) => `"${k}"`).join(", ")} ${issue.keys.length === 1 ? "is" : "are"} not part of ${op}` : issue.message);
      }
      return;
    }
    const e = parsed.data as Doc;
    switch (op as EditOp) {
      case "add-kind":
        return this.addKind(i, e);
      case "rename-kind":
        return this.renameKind(i, e);
      case "remove-kind":
        return this.removeKind(i, e.kind);
      case "add-field":
        return this.addField(i, e);
      case "rename-field":
        return this.renameField(i, e.kind, e.field, e.to);
      case "retype-field":
        return this.retypeField(i, e);
      case "set-options":
        return this.setOptions(i, e);
      case "set-range":
        return this.setRange(i, e);
      case "set-required": {
        const f = this.field(i, e.kind, e.field);
        if (!f) return;
        if (e.required) f.required = true;
        else delete f.required;
        this.said.push(`${e.kind}'s ${e.field} is ${e.required ? "now required" : "no longer required"}.`);
        return;
      }
      case "set-default": {
        const f = this.field(i, e.kind, e.field);
        if (!f) return;
        if (e.default === null || e.default === undefined) {
          delete f.default;
          this.said.push(`${e.kind}'s ${e.field} has no default now.`);
        } else {
          if (f.type === "enum" && !(f.options ?? []).includes(e.default)) return this.fail(i, "default", `"${String(e.default)}" is not one of ${e.field}'s options (${(f.options ?? []).join(", ")})`);
          const outside = outsideRange(e.default, f, e.field);
          if (outside) return this.fail(i, "default", outside);
          f.default = e.default;
          this.said.push(`${e.kind}'s ${e.field} starts as ${JSON.stringify(e.default)} on new records.`);
        }
        return;
      }
      case "remove-field":
        return this.removeField(i, e.kind, e.field);
      case "add-relation":
        return this.addRelation(i, e);
      case "rename-relation":
        return this.renameRelation(i, e.kind, e.relation, e.to);
      case "remove-relation":
        return this.removeRelation(i, e.kind, e.relation);
      case "add-act":
        return this.addAct(i, e);
      case "remove-act":
        return this.removeAct(i, e.act);
      case "add-rule":
        return this.addRule(i, e);
      case "remove-rule": {
        if (!this.doc.rules?.[e.rule]) return this.fail(i, "rule", `there is no rule "${e.rule}"${this.doc.rules ? `; the rules are ${Object.keys(this.doc.rules).join(", ")}` : ""}`);
        const title = this.doc.rules[e.rule].title ?? e.rule;
        delete this.doc.rules[e.rule];
        this.said.push(`The rule "${title}" is removed.`);
        return;
      }
      case "set-brand":
        return this.setBrand(i, e);
      case "set-name": {
        this.doc.name = e.name;
        this.said.push(`The app is now called "${e.name}".`);
        return;
      }
      case "set-description": {
        if (e.description === null) delete this.doc.description;
        else this.doc.description = e.description;
        this.said.push(e.description === null ? "The app has no line under its name." : `The line under the app's name reads "${e.description}".`);
        return;
      }
      case "set-label": {
        const spec = this.kind(i, e.kind);
        if (!spec) return;
        if (e.field) {
          const f = this.field(i, e.kind, e.field);
          if (!f) return;
          if (e.label === null) delete f.label;
          else if (e.label.length > 60) return this.fail(i, "label", "a field's label is a few words, at most 60 characters");
          else f.label = e.label;
          this.said.push(e.label === null ? `${e.kind}'s ${e.field} is shown by its name.` : `${e.kind}'s ${e.field} is shown as "${e.label}".`);
        } else {
          if (e.label === null) delete spec.label;
          else spec.label = e.label;
          this.said.push(e.label === null ? `A ${e.kind} is called by its first word field again.` : `A ${e.kind} is called "${e.label}".`);
        }
        return;
      }
      case "set-describe": {
        const spec = this.kind(i, e.kind);
        if (!spec) return;
        if (e.describe === null) delete spec.describe;
        else spec.describe = e.describe;
        this.said.push(e.describe === null ? `A ${e.kind} has no summary line.` : `A ${e.kind}'s summary line reads "${e.describe}".`);
        return;
      }
      case "set-view":
        return this.setView(i, e);
      case "set-glance": {
        // What a glance at one says (FR-39): fields of this kind, each once, in the order given; none takes the choice away.
        const spec = this.kind(i, e.kind);
        if (!spec) return;
        const fields: string[] = e.fields;
        const seen = new Set<string>();
        for (const [n, field] of fields.entries()) {
          if (!spec.fields[field]) return this.fail(i, `fields.${n}`, `a glance at ${e.kind} is to say "${field}", and ${e.kind} has no field called that`, `use one of: ${Object.keys(spec.fields).join(", ")}`);
          if (seen.has(field)) return this.fail(i, `fields.${n}`, `"${field}" is in the glance twice; name each field once`);
          seen.add(field);
        }
        const noun: string = spec.noun ?? words(e.kind);
        const a = /^[aeiou]/i.test(noun) ? "an" : "a";
        if (fields.length === 0) {
          delete spec.glance;
          this.said.push(`A glance at ${a} ${noun} goes back to what Graview chooses.`);
        } else {
          spec.glance = [...fields];
          this.said.push(`A glance at ${a} ${noun} says ${listOf(fields)}, in that order.`);
        }
        return;
      }
      case "add-lens":
        return this.addLens(i, e);
      case "remove-lens":
        return this.removeLens(i, e);
      case "set-home":
        return this.setHome(i, e.blocks);
      case "arrange-pages":
        return this.arrangePages(i, e);
      case "set-computed":
        return this.setComputed(i, e);
    }
  }

  // ── views, the front page, lenses, the arrangement, what is worked out (FR-84) ──

  /** Blocks checked where they will stand: an error refuses the edit at that path, so a chat is told before anything is previewed. */
  private blocksHold(i: number, at: string): boolean {
    const found = validateViews(this.doc as GraviewDocument).filter((f) => f.severity === "error" || f.path.startsWith("lenses."));
    const here = found.filter((f) => f.path === at || f.path.startsWith(`${at}.`));
    for (const f of here) this.fail(i, `blocks${f.path.slice(at.length)}`, f.message, f.fix);
    return here.length === 0;
  }

  private setView(i: number, e: Doc) {
    if (e.lens !== undefined) {
      if (e.kind !== undefined || e.slot !== undefined) return this.fail(i, "lens", "a lens's blocks are set by its title alone; leave out kind and slot");
      const index = this.lensIndex(i, e.lens);
      if (index < 0) return;
      const lens = this.doc.lenses[index];
      if (lens.name !== "blocks") return this.fail(i, "lens", `"${e.lens}" is drawn by the ${String(lens.name)} lens, not from blocks`, "add-lens with replace to draw it from blocks instead");
      if (e.blocks === null) return this.fail(i, "blocks", "a blocks lens is its blocks; remove-lens takes it away");
      const was = lens.options?.blocks;
      lens.options = { ...(lens.options ?? {}), blocks: e.blocks };
      if (!this.blocksHold(i, `lenses.${index}.options.blocks`)) return;
      this.said.push(`The lens "${e.lens}" is drawn from ${blockWords(e.blocks)}${was ? " now" : ""}.`);
      return;
    }
    if (e.slot === "home") {
      if (e.kind !== undefined) return this.fail(i, "kind", "the front page is no kind's; leave out kind");
      return this.setHome(i, e.blocks);
    }
    if (e.kind === undefined || e.slot === undefined) return this.fail(i, e.kind === undefined ? "kind" : "slot", 'set-view names a kind and a slot ("card", "row" or "page"), the front page (slot "home"), or a lens by its title');
    if (!this.kind(i, e.kind)) return;
    const views = (this.doc.views ??= {});
    if (Array.isArray(views[e.kind])) return this.fail(i, "kind", `"${e.kind}" here is the front page's blocks, not a kind's views`);
    const noun = nounOf(this.doc, e.kind);
    if (e.blocks === null) {
      if (views[e.kind]) delete views[e.kind][e.slot];
      if (views[e.kind] && Object.keys(views[e.kind]).length === 0) delete views[e.kind];
      if (Object.keys(views).length === 0) delete this.doc.views;
      this.said.push(`${cap(withA(noun))} ${e.slot} goes back to Graview's own look.`);
      return;
    }
    (views[e.kind] ??= {})[e.slot] = e.blocks;
    if (!this.blocksHold(i, `views.${e.kind}.${e.slot}`)) return;
    this.said.push(`${cap(withA(noun))} ${e.slot} gets a look of its own: ${blockWords(e.blocks)}.`);
  }

  private setHome(i: number, blocks: unknown[] | null) {
    const views = (this.doc.views ??= {});
    if (views.home !== undefined && !Array.isArray(views.home)) return this.fail(i, "blocks", "this app has a kind called home, whose views stand where the front page's blocks would");
    const had = Array.isArray(views.home);
    if (blocks === null) {
      delete views.home;
      if (Object.keys(views).length === 0) delete this.doc.views;
      this.said.push(had ? "The front page goes back to Graview's own." : "The front page was already Graview's own.");
      return;
    }
    views.home = blocks;
    if (!this.blocksHold(i, "views.home")) return;
    this.said.push(had ? `The front page changes: ${blockWords(blocks)}.` : `The front page gets a view of its own: ${blockWords(blocks)}.`);
  }

  /** The lens a title names (and an `on`, when two lenses share a title), or -1 having said why. */
  private lensIndex(i: number, title: string, on?: string, path = "title"): number {
    const lenses: Doc[] = this.doc.lenses ?? [];
    const matches = lenses.flatMap((lens, index) => (isObject(lens) && typeof lens["title"] === "string" && (lens["title"] === title || placeSlug(lens["title"]) === placeSlug(title)) && (on === undefined || lensStandsOn(lens, on)) ? [index] : []));
    if (matches.length === 1) return matches[0]!;
    const titles = lenses.flatMap((lens) => (isObject(lens) && typeof lens["title"] === "string" ? [`"${lens["title"]}"`] : []));
    if (matches.length === 0) this.fail(i, path, `there is no lens "${title}"${titles.length ? `; the lenses are ${titles.join(", ")}` : ""}`);
    else this.fail(i, "on", `${matches.length} lenses are called "${title}"; say which kind it stands on with "on"`);
    return -1;
  }

  private addLens(i: number, e: Doc) {
    const name: string = e.lens ?? "blocks";
    if (!isShippedLens(name)) return this.fail(i, "lens", `"${name}" is not a lens Graview draws`, `one of ${SHIPPED_LENS_NAMES.join(", ")}`);
    if (e.on !== undefined && !this.kind(i, e.on)) return;
    const lenses: Doc[] = (this.doc.lenses ??= []);
    let at = lenses.length;
    let was: Doc | undefined;
    if (e.replace !== undefined) {
      at = this.lensIndex(i, e.replace, e.on, "replace");
      if (at < 0) return;
      was = lenses[at];
    }
    const lens: Doc = { name, title: e.title, ...(e.on !== undefined ? { on: e.on } : {}), ...(e.bindings !== undefined ? { bindings: e.bindings } : {}), ...(e.options !== undefined ? { options: e.options } : {}) };
    // A title is an address: one lens a title on a kind.
    const clash = lenses.findIndex((other, index) => index !== at && isObject(other) && typeof other["title"] === "string" && placeSlug(other["title"]) === placeSlug(e.title) && (e.on === undefined || other["on"] === undefined || other["on"] === e.on));
    if (clash >= 0) return this.fail(i, "title", `there is already a lens called "${String(lenses[clash]["title"])}"`, 'give it its own title, or say "replace" with the title of the lens it takes the place of');
    if (name === "blocks") {
      if (e.on === undefined) return this.fail(i, "on", "a lens drawn from blocks says which kind it is a place of", 'say "on": "<kind>"');
      if (!Array.isArray(e.options?.blocks) || e.options.blocks.length === 0) return this.fail(i, "options.blocks", 'a lens drawn from blocks has blocks: "options": {"blocks": [{"headline": "…"}, {"list": "all(\'<kind>\')", "as": "card"}]}');
    }
    if (name === "columns" && !this.columnsHold(i, e.bindings)) return;
    if (was) lenses[at] = lens;
    else lenses.splice(e.at === undefined ? lenses.length : Math.min(e.at, lenses.length), 0, lens);
    const index = was ? at : lenses.indexOf(lens);
    if (name === "blocks" && !this.blocksHold(i, `lenses.${index}.options.blocks`)) return;
    const over = lens.on ?? kindsBound(lens)[0];
    const where = over ? `, over ${pluralWords(this.doc, over)}` : "";
    if (!was) {
      this.said.push(`A lens "${e.title}" is added${where}.`);
      return;
    }
    const retitled = was["title"] !== e.title;
    // Where the app opens follows a lens it named, by its new title (FR-80).
    let follows = "";
    if (retitled && namesLens(this.doc.pages?.first, String(was["title"]))) {
      this.doc.pages.first = e.title;
      follows = "; the app still opens on it";
    }
    this.said.push(retitled ? `The lens "${String(was["title"])}" is now "${e.title}"${where}${follows}.` : `The lens "${e.title}" changes${where}.`);
  }

  /**
   * A STATUS BOARD'S BINDINGS (FR-97), held before it is added: each kind it
   * binds is a kind, and its `column` is a field of that kind whose values
   * are choices — the columns. Refused at the binding's path otherwise, so a
   * chat is told which word to change rather than shown an empty board.
   */
  private columnsHold(i: number, bindings: unknown): boolean {
    const example = '"bindings": {"<kind>": {"column": "<a choice field, like status>"}}';
    if (!isObject(bindings) || Object.keys(bindings).length === 0) return (this.fail(i, "bindings", "a board binds a kind's choice field to its columns", example), false);
    for (const [kind, roles] of Object.entries(bindings)) {
      if (!isObject(this.doc.kinds[kind])) return (this.fail(i, `bindings.${kind}`, `"${kind}" is not a kind this app has; it has ${Object.keys(this.doc.kinds).join(", ")}`), false);
      const field = isObject(roles) ? roles["column"] : undefined;
      const fields = this.doc.kinds[kind].fields as Record<string, Doc>;
      if (typeof field !== "string") return (this.fail(i, `bindings.${kind}.column`, `the board does not say which field of ${kind} its columns are`, example), false);
      if (!(field in fields)) return (this.fail(i, `bindings.${kind}.column`, `${kind} has no field "${field}"; it has ${Object.keys(fields).join(", ")}`), false);
      if (fields[field]["type"] !== "enum") {
        const choices = Object.keys(fields).filter((one) => fields[one]["type"] === "enum");
        return (this.fail(i, `bindings.${kind}.column`, `${kind}'s ${field} is not a choice, so it has no columns`, choices.length > 0 ? `bind one of ${choices.join(", ")}` : `give ${kind} a choice field first: add-field with "type": "enum" and its "options", in the order the columns go`), false);
      }
      const others = Object.keys(roles as Doc).filter((role) => role !== "column");
      if (others.length > 0) return (this.fail(i, `bindings.${kind}.${others[0]}`, `a board binds only "column"`), false);
    }
    return true;
  }

  private removeLens(i: number, e: Doc) {
    const index = this.lensIndex(i, e.title, e.on);
    if (index < 0) return;
    const said = this.removeLensAt(index);
    this.said.push(`${cap(said.replace(/ \(the app opens at its home again\)$/, ""))} is removed${said.endsWith("again)") ? "; the app opens at its home again" : ""}.`);
  }

  private arrangePages(i: number, e: Doc) {
    if (e.order === undefined && e.hide === undefined && e.first === undefined) return this.fail(i, "", 'arrange-pages says at least one of "order", "hide" or "first"');
    const kinds = Object.keys(this.doc.kinds);
    for (const part of ["order", "hide"] as const) {
      for (const [n, kind] of (e[part] ?? []).entries()) {
        if (!kinds.includes(kind)) return this.fail(i, `${part}.${n}`, `"${kind}" is not a kind this app has; it has ${kinds.join(", ")}`);
        if (e[part].indexOf(kind) !== n) return this.fail(i, `${part}.${n}`, `"${kind}" is named twice`);
      }
    }
    if (typeof e.first === "string" && !this.opens(e.first)) {
      const titles = (this.doc.lenses ?? []).flatMap((lens: Doc) => (isObject(lens) && typeof lens["title"] === "string" ? [`"${lens["title"]}"`] : []));
      return this.fail(i, "first", `"${e.first}" is not a place, a kind or "home"`, `name a place (${titles.join(", ") || "none is declared"}), a kind (${kinds.join(", ")}) or "home"`);
    }
    const pages = (this.doc.pages ??= {});
    const said: string[] = [];
    if (e.order !== undefined) {
      if (e.order === null || e.order.length === 0) {
        delete pages.order;
        said.push("the kinds go back to the order they were declared in");
      } else {
        pages.order = [...e.order];
        said.push(`${listOf(e.order.map((k: string) => pluralWords(this.doc, k)))} come first, in that order`);
      }
    }
    if (e.hide !== undefined) {
      if (e.hide === null || e.hide.length === 0) {
        delete pages.hide;
        said.push("the front page shows every kind");
      } else {
        pages.hide = [...e.hide];
        said.push(`the front page leaves off ${listOf(e.hide.map((k: string) => pluralWords(this.doc, k)))}`);
      }
    }
    if (e.first !== undefined) {
      if (e.first === null || e.first.trim().toLowerCase() === "home") {
        if (e.first === null) delete pages.first;
        else pages.first = e.first;
        said.push("the app opens at its home");
      } else {
        pages.first = e.first;
        said.push(`the app opens on "${e.first}"`);
      }
    }
    if (Object.keys(pages).length === 0) delete this.doc.pages;
    this.said.push(`${cap(listOf(said))}.`);
  }

  /** Whether `first` names something the app can open on: home, a kind or its plural, a titled lens. */
  private opens(first: string): boolean {
    const word = first.trim();
    if (word.toLowerCase() === "home" || word === "/") return true;
    if (this.doc.kinds[word]) return true;
    if (Object.keys(this.doc.kinds).some((k) => placeSlug(pluralWords(this.doc, k)) === placeSlug(word))) return true;
    return (this.doc.lenses ?? []).some((lens: Doc) => isObject(lens) && typeof lens["title"] === "string" && namesLens(word, lens["title"]));
  }

  private setComputed(i: number, e: Doc) {
    const spec = this.kind(i, e.kind);
    if (!spec) return;
    const name: string = e.name;
    const plural = cap(pluralWords(this.doc, e.kind));
    const existing = spec.computed?.[name];
    if (e.expr === null) {
      if (existing === undefined) return this.fail(i, "name", `${e.kind} works out nothing called "${name}"${spec.computed ? `; it works out ${Object.keys(spec.computed).join(", ")}` : ""}`);
      const gone = this.dropComputed(e.kind, name).slice(1);
      this.said.push(`${plural} no longer work out "${name}"${gone.length ? `; ${listOf(gone)} ${gone.length === 1 ? "goes" : "go"} with it` : ""}.`);
      return;
    }
    if (existing === undefined) {
      if (e.expr === undefined) return this.fail(i, "expr", `to work out "${name}", give its expression, like "list * units"`);
      if (spec.fields[name] || spec.edges?.[name]) return this.fail(i, "name", `${e.kind} already has a ${spec.fields[name] ? "field" : "relation"} called "${name}"`);
      if (KEYWORDS.has(name)) return this.fail(i, "name", `"${name}" is a word the rule language keeps; pick another name`);
      if (Object.keys(spec.computed ?? {}).length >= 20) return this.fail(i, "name", "a kind works out at most 20 computed fields");
    }
    const was: Doc = existing === undefined ? {} : typeof existing === "string" ? { expr: existing } : { ...existing };
    const next: Doc = { ...was };
    if (e.expr !== undefined) next.expr = e.expr;
    for (const key of ["label", "description"] as const) {
      if (e[key] === null) delete next[key];
      else if (e[key] !== undefined) next[key] = e[key];
    }
    try {
      parseExpr(next.expr);
    } catch (err) {
      if (err instanceof ExprSyntaxError) return this.fail(i, "expr", `${err.sentence} (at character ${err.at + 1})`);
      throw err;
    }
    // Kept short where it was said short: a bare expression is the same field as { expr }.
    (spec.computed ??= {})[name] = next.label === undefined && next.description === undefined ? next.expr : next;
    const findings = validateComputed(
      new Map(Object.entries(this.doc.kinds).map(([kind, k]: [string, Doc]) => [kind, { fields: new Set(Object.keys(k.fields)), edges: new Set(Object.keys(k.edges ?? {})), computed: computedOf(k) }])),
      (kind, n) => `kinds.${kind}.computed.${n}`,
    ).filter((f) => f.severity === "error" && f.path === `kinds.${e.kind}.computed.${name}`);
    for (const f of findings) this.fail(i, "expr", f.message, f.fix);
    if (findings.length > 0) return;
    if (existing === undefined) this.said.push(`${plural} work out "${name}": ${next.expr}${next.label ? `, shown as "${next.label}"` : ""}.`);
    else if (was.expr !== next.expr) this.said.push(`How ${pluralWords(this.doc, e.kind)} work out "${name}" changes: ${next.expr}.`);
    else this.said.push(`${plural}' "${name}" is ${next.label ? `shown as "${next.label}"` : "shown by its name"}${next.description ? `, described as "${next.description}"` : ""}.`);
  }

  // ── kinds ──

  private addKind(i: number, e: Doc) {
    const { op: _op, kind, act, ...rest } = e;
    if (this.doc.kinds[kind]) return this.fail(i, "kind", `there is already a kind "${kind}"`);
    const parsed = KindSpec.safeParse(rest);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) this.fail(i, issue.path.map(String).join("."), issue.code === "unrecognized_keys" ? `${issue.keys.map((k) => `"${k}"`).join(", ")} ${issue.keys.length === 1 ? "is" : "are"} not part of a kind` : issue.message);
      return;
    }
    const spec = { ...parsed.data } as Doc;
    delete spec.renamedFrom;
    this.doc.kinds[kind] = spec;
    this.kindOrigin.set(kind, undefined);
    this.said.push(`A new kind, ${kind}, with ${Object.keys(spec.fields).join(", ")}.`);
    // A kind nobody can make is a kind nobody can use: give it its "add" act unless asked not to.
    const makes = Object.values(this.doc.acts ?? {}).some((a: Doc) => a.creates === kind || (a.effects ?? []).some((x: Doc) => x.create === kind));
    if (act !== false && !makes) {
      let name = `add-${kind}`;
      for (let n = 2; this.doc.acts?.[name]; n++) name = `add-${kind}-${n}`;
      const noun = spec.noun ?? words(kind);
      (this.doc.acts ??= {})[name] = { title: `Add ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`, description: `Add a new ${noun}.`, creates: kind };
      this.said.push(`A new act, "${name}", to add one.`);
    }
  }

  private renameKind(i: number, e: Doc) {
    const spec = this.kind(i, e.kind);
    if (!spec) return;
    if (this.doc.kinds[e.to]) return this.fail(i, "to", `there is already a kind "${e.to}"`);
    const from: string = e.kind;
    const to: string = e.to;
    const touched = this.rewriteAll({ t: "kind", from, to });
    // The acts the framework derives for every kind are named for it, so they move with it.
    this.toolsMoved.add(`edit-${from} is now edit-${to}`);
    this.toolsMoved.add(`remove-${from} is now remove-${to}`);
    // The kind itself, in order, continuing its records.
    const kinds: Doc = {};
    for (const [k, v] of Object.entries(this.doc.kinds)) kinds[k === from ? to : k] = v;
    this.doc.kinds = kinds;
    const origin = this.kindOrigin.get(from);
    this.kindOrigin.delete(from);
    this.kindOrigin.set(to, origin);
    if (origin) spec.renamedFrom = origin;
    else delete spec.renamedFrom;
    for (const map of [this.fieldOrigin, this.edgeOrigin])
      for (const [key, v] of [...map]) if (key.startsWith(`${from}.`)) {
        map.delete(key);
        map.set(`${to}.${key.slice(from.length + 1)}`, v);
      }
    for (const f of this.fills) if (f.kind === from) (f as { kind: string }).kind = to;
    if (e.noun) spec.noun = e.noun;
    else if (spec.noun === words(from) || spec.noun === from) spec.noun = words(to);
    const pluralWas: string = spec.plural ?? `${words(from)}s`;
    if (e.plural) spec.plural = e.plural;
    else if (spec.plural && (spec.plural === `${words(from)}s` || spec.plural === `${from}s`)) spec.plural = `${words(to)}s`;
    // Where the app opens, when it named the kind by its plural, follows the plural (FR-80).
    const pluralNow: string = spec.plural ?? `${words(to)}s`;
    if (typeof this.doc.pages?.first === "string" && placeSlug(this.doc.pages.first) === placeSlug(pluralWas) && placeSlug(pluralWas) !== placeSlug(pluralNow)) {
      this.doc.pages.first = pluralNow;
      touched.push("where the app opens");
    }
    // Acts named for the kind follow it: add-vendor → add-supplier.
    for (const name of Object.keys(this.doc.acts ?? {})) {
      const act = this.doc.acts[name];
      if (!(asArray(act.on).includes(to) || act.creates === to || (act.effects ?? []).some((x: Doc) => x.create === to))) continue;
      const next = swapToken(name, from, to);
      if (next !== name && !this.doc.acts[next] && NAME.test(next)) {
        this.renameAct(name, next);
        touched.push(`act ${name} → ${next}`);
      }
    }
    this.said.push(`The ${from} kind is renamed to ${to}; its records are kept${touched.length ? `, and ${listOf(touched)} follow${touched.length === 1 ? "s" : ""}` : ""}.`);
  }

  private removeKind(i: number, kind: string) {
    if (!this.kind(i, kind)) return;
    if (Object.keys(this.doc.kinds).length === 1) return this.fail(i, "kind", "an app keeps at least one kind");
    const gone: string[] = [];
    /*
     * The relations it declares go with it — and so does what walks them
     * from elsewhere: a rule over a category that counts `in('fills')` cannot
     * be judged once no kind has fills. Dropped while the kind still stands,
     * so the walk knows where each name leads.
     */
    for (const edge of Object.keys(this.doc.kinds[kind].edges ?? {})) {
      const went: string[] = [];
      this.dropRelation(kind, edge, went);
      for (const what of went) if (!gone.includes(what)) gone.push(what);
    }
    const removedPlural: string = this.doc.kinds[kind].plural ?? `${words(kind)}s`;
    delete this.doc.kinds[kind];
    this.kindOrigin.delete(kind);
    // Relations that only led to it go with it.
    for (const [k, spec] of Object.entries(this.doc.kinds) as [string, Doc][]) {
      for (const [edge, e] of Object.entries(spec.edges ?? {}) as [string, Doc][]) {
        if (e.to === "*" || !e.to.includes(kind)) continue;
        const left = e.to.filter((t: string) => t !== kind);
        if (left.length > 0) e.to = left;
        else {
          this.dropRelation(k, edge, gone);
          gone.push(`the "${edge}" relation from ${k}`);
        }
      }
    }
    for (const [name, act] of Object.entries(this.doc.acts ?? {}) as [string, Doc][]) {
      const on = asArray(act.on);
      if (act.creates === kind || (act.effects ?? []).some((x: Doc) => x.create === kind) || (on.includes(kind) && on.length === 1)) {
        this.removeActQuietly(name);
        gone.push(`act ${name}`);
      } else if (on.includes(kind)) act.on = on.filter((k) => k !== kind);
    }
    for (const [name, rule] of Object.entries(this.doc.rules ?? {}) as [string, Doc][]) {
      if (rule.over === kind || exprMentions(this.doc, rule.when, rule.over === "graph" ? NONE : new Set([rule.over]), { t: "kind", from: kind, to: "\u0000" }) || exprMentions(this.doc, rule.require, rule.over === "graph" ? NONE : new Set([rule.over]), { t: "kind", from: kind, to: "\u0000" })) {
        delete this.doc.rules[name];
        gone.push(`rule ${name}`);
      }
    }
    if (this.doc.views?.[kind] && !Array.isArray(this.doc.views[kind])) {
      delete this.doc.views[kind];
      if (Object.keys(this.doc.views).length === 0) delete this.doc.views;
    }
    for (const g of this.doc.policy?.grants ?? []) if (Array.isArray(g.kinds)) g.kinds = g.kinds.filter((k: string) => k !== kind);
    if (this.doc.policy?.sees) {
      this.doc.policy.sees = this.doc.policy.sees.map((s: Doc) => ({ ...s, kinds: s.kinds.filter((k: string) => k !== kind) })).filter((s: Doc) => s.kinds.length > 0);
      if (this.doc.policy.sees.length === 0) delete this.doc.policy.sees;
    }
    /*
     * What sweeps the kind (`all('offer')`) goes as what names a removed
     * field does: computed fields that work it out, blocks on the front page,
     * in other kinds' views and in blocks lenses. A lens that stood on the
     * kind, or drew by it, goes, and `pages.first` with it when it named it.
     */
    const swept: Rename = { t: "kind", from: kind, to: "\u0000" };
    for (const [other, spec] of Object.entries(this.doc.kinds) as [string, Doc][]) {
      for (const [name, c] of Object.entries(spec.computed ?? {}) as [string, Doc][]) {
        if (exprMentions(this.doc, typeof c === "string" ? c : c.expr, new Set([other]), swept)) gone.push(...this.dropComputed(other, name));
      }
    }
    gone.push(...this.pruneViews(swept), ...this.pruneLenses(swept));
    // The arrangement names kinds (FR-80): a kind that is gone is no longer ordered or hidden, nor where the app opens.
    if (this.doc.pages) {
      for (const part of ["order", "hide"] as const) {
        const named = this.doc.pages[part];
        if (Array.isArray(named)) this.doc.pages[part] = named.filter((k: string) => k !== kind);
      }
      const first = this.doc.pages.first;
      if (typeof first === "string" && (first === kind || placeSlug(first) === placeSlug(removedPlural))) {
        delete this.doc.pages.first;
        gone.push("where the app opens (it opens at its home again)");
      }
      if (Object.keys(this.doc.pages).length === 0) delete this.doc.pages;
    }
    for (const f of [...this.fills]) if (f.kind === kind) this.fills.splice(this.fills.indexOf(f), 1);
    this.said.push(`The ${kind} kind is removed, and every ${kind} with it${gone.length ? `; so are ${listOf(gone)}` : ""}.`);
  }

  // ── fields ──

  private addField(i: number, e: Doc) {
    const spec = this.kind(i, e.kind);
    if (!spec) return;
    const { op: _op, kind, field, fill, spec: given, ...inline } = e;
    if (spec.fields[field] || spec.edges?.[field]) return this.fail(i, "field", `${kind} already has a ${spec.fields[field] ? "field" : "relation"} called "${field}"`);
    if (KEYWORDS.has(field)) return this.fail(i, "field", `"${field}" is a word the rule language keeps; pick another name`);
    const parsed = FieldSpec.safeParse({ ...(given ?? {}), ...inline });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) this.fail(i, issue.path.map(String).join("."), issue.code === "unrecognized_keys" ? `${issue.keys.map((k) => `"${k}"`).join(", ")} ${issue.keys.length === 1 ? "is" : "are"} not part of a field` : issue.message);
      return;
    }
    const f = { ...parsed.data } as Doc;
    delete f.renamedFrom;
    if (f.type === "enum" && f.default !== undefined && !f.options.includes(f.default)) return this.fail(i, "default", `"${String(f.default)}" is not one of the options`);
    spec.fields[field] = f;
    this.fieldOrigin.set(`${kind}.${field}`, undefined);
    let filled = "";
    if (fill !== undefined && fill !== null) {
      if (isObject(fill) && typeof fill["from"] === "string") {
        const src = spec.fields[fill["from"]];
        if (!src || fill["from"] === field) return this.fail(i, "fill.from", `${kind} has no other field "${fill["from"]}" to copy from`);
        this.fills.push({ kind, field, from: fill["from"] });
        filled = `, copied from ${fill["from"]} on the records already there`;
      } else {
        const t: FieldType = typeof fill === "number" ? "number" : typeof fill === "boolean" ? "boolean" : Array.isArray(fill) ? "list" : "string";
        if (coerce(fill, t, f) === undefined) return this.fail(i, "fill", `${JSON.stringify(fill)} is not a ${f.type}${f.type === "enum" ? ` option (${f.options.join(", ")})` : ""}`);
        this.fills.push({ kind, field, value: coerce(fill, t, f) });
        filled = `, set to ${JSON.stringify(fill)} on the records already there`;
      }
    }
    this.said.push(`${kind} gains a field, ${field} (${f.type}${f.required ? ", required" : ""})${filled}.`);
  }

  private renameField(i: number, kind: string, field: string, to: string) {
    const f = this.field(i, kind, field);
    if (!f) return;
    if (to === field) return;
    if (!this.freeName(i, kind, to, "field")) return;
    const r: Rename = { t: "field", kind, from: field, to };
    const touched = this.rewriteAll(r);
    // An act's arguments are named for the fields it writes: the derived edit, and any act that writes this one.
    this.toolsMoved.add(`edit-${kind} asks for ${to} where it asked for ${field}`);
    const spec = this.doc.kinds[kind];
    const fields: Doc = {};
    for (const [k, v] of Object.entries(spec.fields)) fields[k === field ? to : k] = v;
    spec.fields = fields;
    const origin = this.fieldOrigin.get(`${kind}.${field}`);
    this.fieldOrigin.delete(`${kind}.${field}`);
    this.fieldOrigin.set(`${kind}.${to}`, origin);
    // A field new in this change has no records to move; one that was there continues under its new name.
    if (origin && this.kindOrigin.get(kind)) f.renamedFrom = origin;
    else delete f.renamedFrom;
    if (spec.lifecycle?.field === field) spec.lifecycle.field = to;
    if (spec.glance?.includes(field)) {
      spec.glance = spec.glance.map((name: string) => (name === field ? to : name));
      touched.push(`${kind}'s glance`);
    }
    for (const x of this.fills) {
      if (x.kind === kind && x.field === field) (x as { field: string }).field = to;
      if (x.kind === kind && x.from === field) (x as { from: string }).from = to;
    }
    const prose = proseSwap(field, to);
    // A label is what the field is called on screen because its name does not say it: a rename leaves it as written ("List price, per unit" is not "Price price, per unit").
    if (f.description) f.description = prose(f.description);
    this.said.push(`${kind}'s ${field} is renamed to ${to}; its values are kept${touched.length ? `, and ${listOf(touched)} now say${touched.length === 1 ? "s" : ""} ${to}` : ""}.`);
  }

  private retypeField(i: number, e: Doc) {
    const f = this.field(i, e.kind, e.field);
    if (!f) return;
    if (e.type === "enum" && !e.options && !f.options) return this.fail(i, "options", `to make ${e.field} a choice, list its "options"`);
    const was = f.type;
    f.type = e.type;
    if (e.type === "enum") f.options = e.options ?? f.options;
    else delete f.options;
    if (e.type === "list") f.of = e.of ?? f.of ?? "string";
    else delete f.of;
    if (e.format) f.format = e.format;
    else if (e.type !== "number" && e.type !== "integer") delete f.format;
    // A range is a number's (FR-114): a field that is no longer one lets it go.
    if (e.type !== "number" && e.type !== "integer") for (const key of ["min", "max", "step"]) delete f[key];
    if (f.default !== undefined && coerce(f.default, was, f) === undefined) delete f.default;
    else if (f.default !== undefined) f.default = coerce(f.default, was, f);
    this.said.push(`${e.kind}'s ${e.field} changes from ${was} to ${e.type}; values that convert are kept.`);
  }

  /** A number's range (FR-114): a key given sets it, `null` clears it, one left out stays. */
  private setRange(i: number, e: Doc) {
    const f = this.field(i, e.kind, e.field);
    if (!f) return;
    if (f.type !== "number" && f.type !== "integer") return this.fail(i, "field", `${e.field} is ${f.type === "integer" ? "an" : "a"} ${f.type}, not a number; a range belongs on a number or integer field`);
    const next: Doc = { ...f };
    for (const key of ["min", "max", "step"]) {
      if (e[key] === null) delete next[key];
      else if (e[key] !== undefined) next[key] = e[key];
    }
    if (next.min !== undefined && next.max !== undefined && next.min > next.max) return this.fail(i, "max", `the most (${next.max}) is below the least (${next.min})`);
    const outside = next.default !== undefined ? outsideRange(next.default, next, e.field) : undefined;
    if (outside) return this.fail(i, "default", `${e.field}'s default, ${outside.replace(/ is /, ", is ")}; change the default first`);
    for (const key of ["min", "max", "step"]) {
      if (next[key] === undefined) delete f[key];
      else f[key] = next[key];
    }
    this.said.push(`${e.kind}'s ${e.field} takes ${rangeWords(f)}.`);
  }

  private setOptions(i: number, e: Doc) {
    const f = this.field(i, e.kind, e.field);
    if (!f) return;
    if (f.type !== "enum") return this.fail(i, "field", `${e.field} is a ${f.type}, not a choice; use retype-field to make it one`);
    const add: string[] = (e.add ?? []).filter((o: string) => !f.options.includes(o));
    const remove: string[] = e.remove ?? [];
    const unknown = remove.filter((o) => !f.options.includes(o));
    if (unknown.length) return this.fail(i, "remove", `${e.field} does not offer ${unknown.map((o) => `"${o}"`).join(", ")}; it offers ${f.options.join(", ")}`);
    const options = [...f.options.filter((o: string) => !remove.includes(o)), ...add];
    if (options.length === 0) return this.fail(i, "remove", "a choice keeps at least one option");
    f.options = options;
    const out: string[] = [];
    if (add.length) out.push(`now also offers ${add.map((o) => `"${o}"`).join(", ")}`);
    if (remove.length) out.push(`no longer offers ${remove.map((o) => `"${o}"`).join(", ")}`);
    if (f.default !== undefined && remove.includes(f.default)) {
      delete f.default;
      out.push("has no default now");
    }
    // An act that sets a dropped option cannot stand.
    for (const [name, act] of Object.entries(this.doc.acts ?? {}) as [string, Doc][]) {
      for (const t of setTargets(act, this.doc)) if (hasKind(t.kinds, e.kind) && typeof t.set[e.field] === "string" && remove.includes(t.set[e.field] as string)) {
        this.removeActQuietly(name);
        out.push(`the act ${name} (it set that option) is removed`);
        break;
      }
    }
    this.said.push(`${e.kind}'s ${e.field} ${listOf(out)}.`);
  }

  private removeField(i: number, kind: string, field: string) {
    const spec = this.kind(i, kind);
    if (!spec) return;
    if (!spec.fields[field]) return void this.field(i, kind, field);
    if (Object.keys(spec.fields).length === 1) return this.fail(i, "field", `${kind} keeps at least one field; remove the kind instead`);
    const r: Rename = { t: "field", kind, from: field, to: "\u0000" };
    if (this.lensesDrawnBy(i, r)) return;
    const gone = this.dropMentions(r);
    delete spec.fields[field];
    this.fieldOrigin.delete(`${kind}.${field}`);
    if (spec.lifecycle?.field === field) {
      delete spec.lifecycle;
      gone.push(`${kind}'s lifecycle`);
    }
    // A glance says the fields that are left; one that said only this one is unsaid again.
    if (spec.glance?.includes(field)) {
      spec.glance = spec.glance.filter((name: string) => name !== field);
      if (spec.glance.length === 0) {
        delete spec.glance;
        gone.push(`${kind}'s glance`);
      }
    }
    for (const x of [...this.fills]) if (x.kind === kind && (x.field === field || x.from === field)) this.fills.splice(this.fills.indexOf(x), 1);
    this.said.push(`${kind} loses its ${field} field, and every value in it${gone.length ? `; ${listOf(gone)} ${gone.length === 1 ? "goes" : "go"} with it` : ""}.`);
  }

  // ── relations ──

  private addRelation(i: number, e: Doc) {
    const spec = this.kind(i, e.kind);
    if (!spec) return;
    const { op: _op, kind, relation, ...rest } = e;
    if (spec.fields[relation] || spec.edges?.[relation]) return this.fail(i, "relation", `${kind} already has a ${spec.fields[relation] ? "field" : "relation"} called "${relation}"`);
    if (KEYWORDS.has(relation)) return this.fail(i, "relation", `"${relation}" is a word the rule language keeps; pick another name`);
    const parsed = EdgeSpec.safeParse({ ...rest, to: typeof rest.to === "string" && rest.to !== "*" ? [rest.to] : rest.to });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) this.fail(i, issue.path.map(String).join("."), issue.code === "unrecognized_keys" ? `${issue.keys.map((k) => `"${k}"`).join(", ")} ${issue.keys.length === 1 ? "is" : "are"} not part of a relation` : issue.message);
      return;
    }
    const edge = { ...parsed.data } as Doc;
    delete edge.renamedFrom;
    if (edge.to !== "*") for (const t of edge.to) if (!this.doc.kinds[t]) return this.fail(i, "to", `"${t}" is not a kind this app has`);
    (spec.edges ??= {})[relation] = edge;
    this.edgeOrigin.set(`${kind}.${relation}`, undefined);
    this.said.push(`${kind} gains a relation, "${relation}", to ${edge.to === "*" ? "any record" : edge.to.join(" or ")}.`);
  }

  private renameRelation(i: number, kind: string, relation: string, to: string) {
    const spec = this.kind(i, kind);
    if (!spec) return;
    if (!spec.edges?.[relation]) return this.fail(i, "relation", `${kind} has no relation "${relation}"${spec.edges ? `; it has ${Object.keys(spec.edges).join(", ")}` : ""}`);
    // A relation is one name across the app (links are stored by it), so every kind that declares it follows.
    const holders = [...(sources(this.doc, relation) as Set<string>)];
    for (const k of holders) if (!this.freeName(i, k, to, "relation")) return;
    if (Object.values(this.doc.kinds).some((s: Doc) => s.edges?.[to])) return this.fail(i, "to", `another kind already has a relation called "${to}"`);
    const touched = this.rewriteAll({ t: "edge", from: relation, to });
    for (const k of holders) {
      const s = this.doc.kinds[k];
      const edges: Doc = {};
      for (const [n, v] of Object.entries(s.edges)) edges[n === relation ? to : n] = v;
      s.edges = edges;
      const origin = this.edgeOrigin.get(`${k}.${relation}`);
      this.edgeOrigin.delete(`${k}.${relation}`);
      this.edgeOrigin.set(`${k}.${to}`, origin);
      if (origin) edges[to].renamedFrom = origin;
      else delete edges[to].renamedFrom;
    }
    this.said.push(`The "${relation}" relation is renamed to "${to}"; its links are kept${touched.length ? `, and ${listOf(touched)} follow${touched.length === 1 ? "s" : ""}` : ""}.`);
  }

  private removeRelation(i: number, kind: string, relation: string) {
    const spec = this.kind(i, kind);
    if (!spec) return;
    if (!spec.edges?.[relation]) return this.fail(i, "relation", `${kind} has no relation "${relation}"`);
    const others = [...(sources(this.doc, relation) as Set<string>)].filter((k) => k !== kind);
    if (others.length === 0 && this.lensesDrawnBy(i, { t: "edge", from: relation, to: "\u0000" })) return;
    const gone: string[] = [];
    this.dropRelation(kind, relation, gone);
    this.said.push(`The "${relation}" relation from ${kind} is removed, with every link of that kind${gone.length ? `; ${listOf(gone)} ${gone.length === 1 ? "goes" : "go"} with it` : ""}.`);
  }

  private dropRelation(kind: string, relation: string, gone: string[]) {
    const others = [...(sources(this.doc, relation) as Set<string>)].filter((k) => k !== kind);
    // Only when no other kind keeps a relation of the same name do its mentions go too.
    if (others.length === 0) gone.push(...this.dropMentions({ t: "edge", from: relation, to: "\u0000" }));
    delete this.doc.kinds[kind].edges[relation];
    if (Object.keys(this.doc.kinds[kind].edges).length === 0) delete this.doc.kinds[kind].edges;
    this.edgeOrigin.delete(`${kind}.${relation}`);
  }

  // ── acts and rules ──

  private addAct(i: number, e: Doc) {
    const { op: _op, act, replace, ...rest } = e;
    if (this.doc.acts?.[act] && !replace) return this.fail(i, "act", `there is already an act "${act}"`, "pass replace: true to change it, or pick another name");
    const parsed = ActSpec.safeParse(rest);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) this.fail(i, issue.path.map(String).join("."), issue.code === "unrecognized_keys" ? `${issue.keys.map((k) => `"${k}"`).join(", ")} ${issue.keys.length === 1 ? "is" : "are"} not part of an act` : issue.message);
      return;
    }
    const existed = Boolean(this.doc.acts?.[act]);
    (this.doc.acts ??= {})[act] = parsed.data;
    this.said.push(existed ? `The act "${parsed.data.title ?? act}" changes.` : `A new act: ${parsed.data.title ?? act}.`);
  }

  private removeAct(i: number, act: string) {
    if (!this.doc.acts?.[act]) return this.fail(i, "act", `there is no act "${act}"${this.doc.acts ? `; the acts are ${Object.keys(this.doc.acts).join(", ")}` : ""}`);
    const title = this.doc.acts[act].title ?? act;
    const gone = this.removeActQuietly(act);
    this.said.push(`The act "${title}" is removed${gone.length ? `; so ${gone.length === 1 ? "is" : "are"} ${listOf(gone)}` : ""}.`);
  }

  /** Remove an act and what names it: grants list it no more, repairs no longer offer it. */
  private removeActQuietly(act: string): string[] {
    const gone: string[] = [];
    delete this.doc.acts[act];
    if (Object.keys(this.doc.acts).length === 0) delete this.doc.acts;
    if (this.doc.policy) {
      this.doc.policy.grants = this.doc.policy.grants
        .map((g: Doc) => (Array.isArray(g.mutations) ? { ...g, mutations: g.mutations.filter((m: string) => m !== act) } : g))
        .filter((g: Doc) => g.mutations === "*" || g.mutations.length > 0);
    }
    for (const [name, rule] of Object.entries(this.doc.rules ?? {}) as [string, Doc][]) {
      if (!rule.repairs) continue;
      const kept = rule.repairs.filter((r: Doc) => r.act !== act);
      if (kept.length !== rule.repairs.length) gone.push(`the "${rule.repairs.find((r: Doc) => r.act === act)?.label ?? act}" repair of rule ${name}`);
      if (kept.length > 0) rule.repairs = kept;
      else delete rule.repairs;
    }
    return gone;
  }

  private addRule(i: number, e: Doc) {
    const { op: _op, rule, replace, ...rest } = e;
    if (this.doc.rules?.[rule] && !replace) return this.fail(i, "rule", `there is already a rule "${rule}"`, "pass replace: true to change it, or pick another name");
    const parsed = RuleSpec.safeParse(rest);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) this.fail(i, issue.path.map(String).join("."), issue.code === "unrecognized_keys" ? `${issue.keys.map((k) => `"${k}"`).join(", ")} ${issue.keys.length === 1 ? "is" : "are"} not part of a rule` : issue.message);
      return;
    }
    const existed = Boolean(this.doc.rules?.[rule]);
    (this.doc.rules ??= {})[rule] = parsed.data;
    this.said.push(existed ? `The rule "${parsed.data.title ?? rule}" changes.` : `A new rule: ${parsed.data.title ?? rule}.`);
  }

  /** An act gets a new name, and every grant and repair that named it follows. */
  private renameAct(from: string, to: string) {
    this.toolsMoved.add(`${from} is now ${to}`);
    const acts: Doc = {};
    for (const [k, v] of Object.entries(this.doc.acts)) acts[k === from ? to : k] = v;
    this.doc.acts = acts;
    for (const g of this.doc.policy?.grants ?? []) if (Array.isArray(g.mutations)) g.mutations = g.mutations.map((m: string) => (m === from ? to : m));
    for (const rule of Object.values(this.doc.rules ?? {}) as Doc[]) for (const r of rule.repairs ?? []) if (r.act === from) r.act = to;
  }

  // ── every place a name is said ──

  /**
   * Apply a rename everywhere it is said, except the declaration itself (the caller
   * moves that). Returns the places that changed, as words.
   */
  private rewriteAll(r: Rename): string[] {
    const doc = this.doc;
    const touched: string[] = [];
    const prose = r.t === "field" ? proseSwap(r.from, r.to) : r.t === "kind" ? proseSwap(r.from, r.to) : undefined;
    const exprAt = (source: string | undefined, ctx: Kinds): string | undefined => (source === undefined ? undefined : rewriteExpr(doc, source, ctx, r));
    const tmplAt = (source: string | undefined, ctx: Kinds, words?: (t: string) => string): string | undefined => (source === undefined ? undefined : rewriteTemplate(doc, source, ctx, r, words));

    // Kinds: templates, the lifecycle, where relations lead.
    for (const [kind, spec] of Object.entries(doc.kinds) as [string, Doc][]) {
      const here = new Set([kind]);
      for (const key of ["label", "describe"] as const) {
        const next = tmplAt(spec[key], here);
        if (next !== spec[key]) {
          spec[key] = next;
          touched.push(`${kind}'s ${key}`);
        }
      }
      if (r.t === "kind") for (const e of Object.values(spec.edges ?? {}) as Doc[]) if (Array.isArray(e.to) && e.to.includes(r.from)) e.to = e.to.map((t: string) => (t === r.from ? r.to : t));
      // What it works out (FR-83): each expression read from this kind's records, renamed in the tree.
      for (const [name, c] of Object.entries(spec.computed ?? {}) as [string, Doc][]) {
        const was = typeof c === "string" ? c : c.expr;
        const next = exprAt(was, here)!;
        if (next === was) continue;
        spec.computed[name] = typeof c === "string" ? next : { ...c, expr: next };
        touched.push(`${kind}'s ${name}`);
      }
    }

    // Acts: what they act on and make, the fields they write, guards, refusals, computed values.
    const renamedArgs = new Map<string, Map<string, string>>();
    for (const [name, act] of Object.entries(doc.acts ?? {}) as [string, Doc][]) {
      const before = JSON.stringify(act);
      const on = subjectKinds(act);
      if (r.t === "kind") {
        if (act.on !== undefined) act.on = Array.isArray(act.on) ? act.on.map((k: string) => (k === r.from ? r.to : k)) : act.on === r.from ? r.to : act.on;
        if (act.creates === r.from) act.creates = r.to;
        for (const e of act.effects ?? []) if (e.create === r.from) e.create = r.to;
      }
      if (r.t === "edge") {
        if (act.connects === r.from) act.connects = r.to;
        if (act.severs === r.from) act.severs = r.to;
        if (Array.isArray(act.replaces)) act.replaces = act.replaces.map((e: string) => (e === r.from ? r.to : e));
        for (const e of act.effects ?? []) {
          if (e.connect === r.from) e.connect = r.to;
          if (e.sever === r.from) e.sever = r.to;
        }
      }
      if (r.t === "field") {
        const args = new Map<string, string>();
        for (const t of setTargets(act, doc)) {
          if (!hasKind(t.kinds, r.kind) || !(r.from in t.set)) continue;
          if (t.kinds === "*" && Object.entries(doc.kinds).some(([k, s]: [string, Doc]) => k !== r.kind && s.fields[r.from])) continue;
          const renamed: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(t.set)) renamed[k === r.from ? r.to : k] = k === r.from && v === `$${r.from}` ? `$${r.to}` : v;
          if (t.set[r.from] === `$${r.from}`) args.set(r.from, r.to);
          if (t.where === "sets") act.sets = renamed;
          else if (t.where === "setsOther") act.setsOther = renamed;
          else act.effects[t.index!].set = renamed;
        }
        if (act.writes && (hasKind(on, r.kind) || act.creates === r.kind) && act.writes.includes(r.from)) {
          act.writes = act.writes.map((w: string) => (w === r.from ? r.to : w));
          args.set(r.from, r.to);
        }
        // `creates` asks for every field of the kind by name: its argument follows the field.
        if (act.creates === r.kind) args.set(r.from, r.to);
        if (act.args?.[r.from] && args.has(r.from) && !act.args[r.to]) {
          const next: Doc = {};
          for (const [k, v] of Object.entries(act.args)) next[k === r.from ? r.to : k] = v;
          act.args = next;
        }
        if (args.size) {
          renamedArgs.set(name, args);
          this.toolsMoved.add(`${name} asks for ${[...args.values()].join(", ")} where it asked for ${[...args.keys()].join(", ")}`);
        }
      }
      const argRename = renamedArgs.get(name);
      // A guard reads the subject's fields and the act's arguments by the same bare names.
      const guard = exprAt(act.allowedWhen, on);
      if (guard !== undefined) act.allowedWhen = argRename?.has(r.from) && r.t === "field" && !hasKind(on, r.kind) ? rewriteBinding(guard, r.from, r.to) : guard;
      if (act.refusal !== undefined) act.refusal = tmplAt(act.refusal, on);
      for (const t of setTargets(act, doc)) for (const [k, v] of Object.entries(t.set)) if (isObject(v) && typeof v["expr"] === "string") (t.set as Doc)[k] = { expr: exprAt(v["expr"], t.kinds === "*" ? on : t.kinds) };
      if (JSON.stringify(act) !== before) {
        if (prose) {
          if (act.title) act.title = prose(act.title);
          if (act.description) act.description = prose(act.description);
          if (act.fromTheOtherEnd) act.fromTheOtherEnd = prose(act.fromTheOtherEnd);
        }
        touched.push(`act ${name}`);
      }
    }
    // Acts named for a renamed field follow it: set-quote → set-price.
    if (r.t === "field") {
      for (const name of [...renamedArgs.keys()]) {
        const next = swapToken(name, kebab(r.from), kebab(r.to));
        if (next !== name && !doc.acts[next] && NAME.test(next)) {
          this.renameAct(name, next);
          const at = touched.indexOf(`act ${name}`);
          if (at >= 0) touched[at] = `act ${name} (now ${next})`;
          renamedArgs.set(next, renamedArgs.get(name)!);
        }
      }
    }

    // Rules.
    for (const [name, rule] of Object.entries(doc.rules ?? {}) as [string, Doc][]) {
      const before = JSON.stringify(rule);
      const ctx: Kinds = rule.over === "graph" ? NONE : new Set([rule.over]);
      if (rule.when !== undefined) rule.when = exprAt(rule.when, ctx);
      rule.require = exprAt(rule.require, ctx);
      const mentioned = JSON.stringify(rule) !== before;
      if (rule.says !== undefined) rule.says = tmplAt(rule.says, ctx, mentioned ? prose : undefined);
      if (r.t === "kind" && rule.over === r.from) rule.over = r.to;
      for (const rep of rule.repairs ?? []) {
        if (r.t === "kind") rep.act = rep.act === `edit-${r.from}` ? `edit-${r.to}` : rep.act === `remove-${r.from}` ? `remove-${r.to}` : rep.act;
        const args = renamedArgs.get(rep.act);
        if (args && rep.args) for (const [a, b] of args) if (a in rep.args) {
          rep.args[b] = rep.args[a];
          delete rep.args[a];
        }
      }
      if (JSON.stringify(rule) !== before) {
        if (prose && mentioned) {
          if (rule.title) rule.title = prose(rule.title);
          if (rule.description) rule.description = prose(rule.description);
        }
        touched.push(`rule ${name}`);
      }
    }

    // Policy: the kinds grants and sights name, and the derived acts of a renamed kind.
    if (r.t === "kind" && doc.policy) {
      const before = JSON.stringify(doc.policy);
      const swap = (k: string) => (k === r.from ? r.to : k);
      for (const g of doc.policy.grants) {
        if (Array.isArray(g.kinds)) g.kinds = g.kinds.map(swap);
        if (Array.isArray(g.mutations)) g.mutations = g.mutations.map((m: string) => (m === `edit-${r.from}` ? `edit-${r.to}` : m === `remove-${r.from}` ? `remove-${r.to}` : m));
      }
      for (const s of doc.policy.sees ?? []) s.kinds = s.kinds.map(swap);
      if (JSON.stringify(doc.policy) !== before) touched.push("the policy");
    }

    // Views: each kind's slots, and the home's blocks, which are about no one record (FR-81).
    if (doc.views) {
      if (r.t === "kind" && doc.views[r.from] && !Array.isArray(doc.views[r.from])) {
        const views: Doc = {};
        for (const [k, v] of Object.entries(doc.views)) views[k === r.from ? r.to : k] = v;
        doc.views = views;
      }
      for (const [kind, slots] of Object.entries(doc.views) as [string, Doc][]) {
        if (kind === "home" && Array.isArray(slots)) {
          const before = JSON.stringify(slots);
          doc.views.home = mapBlocks(slots, (b) => rewriteBlock(doc, b, NONE, r, null));
          if (JSON.stringify(doc.views.home) !== before) touched.push("the front page");
          continue;
        }
        const was = r.t === "kind" && kind === r.to ? r.from : kind;
        const ctx = new Set([was]);
        for (const slot of VIEW_SLOTS) {
          if (!Array.isArray(slots[slot])) continue;
          const before = JSON.stringify(slots[slot]);
          slots[slot] = mapBlocks(slots[slot], (b) => rewriteBlock(doc, b, ctx, r, was));
          if (JSON.stringify(slots[slot]) !== before) touched.push(`the ${kind} ${slot}`);
        }
      }
    }

    // Lenses: the kinds they stand on, what they bind, what they are told, and what a blocks lens says.
    for (const lens of doc.lenses ?? []) {
      const before = JSON.stringify(lens);
      rewriteLens(doc, lens, r);
      if (JSON.stringify(lens) !== before) touched.push(lens["title"] ? `the lens "${String(lens["title"])}"` : `the ${String(lens["name"] ?? "")} lens`);
    }

    // Pages name kinds: in the order, the kinds the home leaves off, and where the app opens (FR-80).
    if (r.t === "kind" && doc.pages) {
      const before = JSON.stringify(doc.pages);
      for (const part of ["order", "hide"] as const) if (Array.isArray(doc.pages[part])) doc.pages[part] = doc.pages[part].map((k: string) => (k === r.from ? r.to : k));
      if (doc.pages.first === r.from) doc.pages.first = r.to;
      if (JSON.stringify(doc.pages) !== before) touched.push("the pages");
    }
    return touched;
  }

  /**
   * Remove what mentions a field or relation that is going: acts that write or walk
   * it, rules that judge it, view blocks that show it; templates that show it fall
   * back to Graview's own. Returns what went, as words.
   */
  private dropMentions(r: Rename, worked = false): string[] {
    const doc = this.doc;
    const gone: string[] = [];
    for (const [kind, spec] of Object.entries(doc.kinds) as [string, Doc][]) {
      for (const key of ["label", "describe"] as const) {
        if (templateMentions(doc, spec[key], new Set([kind]), r)) {
          delete spec[key];
          gone.push(`${kind}'s ${key}`);
        }
      }
    }
    // What a kind works out from it cannot be worked out, and goes — with what reads that in turn (FR-83).
    for (const [kind, spec] of Object.entries(doc.kinds) as [string, Doc][]) {
      for (const [name, c] of Object.entries(spec.computed ?? {}) as [string, Doc][]) {
        if (r.t === "field" && r.kind === kind && r.from === name) continue;
        if (exprMentions(doc, typeof c === "string" ? c : c.expr, new Set([kind]), r)) gone.push(...this.dropComputed(kind, name));
      }
    }
    for (const [name, act] of Object.entries(doc.acts ?? {}) as [string, Doc][]) {
      const on = subjectKinds(act);
      let uses = exprMentions(doc, act.allowedWhen, on, r) || templateMentions(doc, act.refusal, on, r);
      if (r.t === "edge") uses ||= act.connects === r.from || act.severs === r.from || (act.effects ?? []).some((e: Doc) => e.connect === r.from || e.sever === r.from);
      // A relation it only replaced goes from the list; one that replaced nothing else goes with it (FR-115).
      if (r.t === "edge" && !uses && Array.isArray(act.replaces) && act.replaces.includes(r.from)) {
        act.replaces = act.replaces.filter((e: string) => e !== r.from);
        if (act.replaces.length === 0) delete act.replaces;
      }
      if (r.t === "field" && !worked) {
        // An act that sets other things too loses only this field; one that did nothing else goes.
        for (const t of setTargets(act, doc)) {
          if (!hasKind(t.kinds, r.kind) || t.kinds === "*") continue;
          if (r.from in t.set) delete t.set[r.from];
          for (const v of Object.values(t.set)) if (isObject(v) && typeof v["expr"] === "string" && exprMentions(doc, v["expr"], t.kinds, r)) uses = true;
        }
        if (act.writes && (hasKind(on, r.kind) || act.creates === r.kind) && act.writes.includes(r.from)) {
          act.writes = act.writes.filter((w: string) => w !== r.from);
          if (act.writes.length === 0) delete act.writes;
        }
        if (act.args?.[r.from] && act.creates !== r.kind) delete act.args[r.from];
        if (act.args && Object.keys(act.args).length === 0) delete act.args;
        if (act.sets && Object.keys(act.sets).length === 0) delete act.sets;
        if (act.setsOther && Object.keys(act.setsOther).length === 0) delete act.setsOther;
        const doesSomething = act.creates || act.writes || act.sets || act.connects || act.severs || act.removes || (act.effects ?? []).some((e: Doc) => e.create || e.connect || e.sever || e.remove || (e.set && Object.keys(e.set).length > 0));
        if (!doesSomething) uses = true;
        else if (act.effects) {
          act.effects = act.effects.filter((e: Doc) => !(e.set && !e.create && Object.keys(e.set).length === 0));
          if (act.effects.length === 0) delete act.effects;
        }
      }
      if (uses) {
        gone.push(`act ${name}`, ...this.removeActQuietly(name));
      }
    }
    for (const [name, rule] of Object.entries(doc.rules ?? {}) as [string, Doc][]) {
      const ctx: Kinds = rule.over === "graph" ? NONE : new Set([rule.over]);
      if (exprMentions(doc, rule.when, ctx, r) || exprMentions(doc, rule.require, ctx, r) || templateMentions(doc, rule.says, ctx, r)) {
        delete doc.rules[name];
        gone.push(`rule ${name}`);
      }
    }
    if (doc.rules && Object.keys(doc.rules).length === 0) delete doc.rules;
    gone.push(...this.pruneViews(r));
    gone.push(...this.pruneLenses(r));
    return gone;
  }

  /** Computed fields being dropped, so a cycle among them ends. */
  private readonly dropping = new Set<string>();

  /** A computed field goes, and everything that reads it: views, glances, templates, rules, and computed fields of its own. */
  private dropComputed(kind: string, name: string): string[] {
    const key = `${kind}.${name}`;
    if (this.dropping.has(key) || this.doc.kinds[kind]?.computed?.[name] === undefined) return [];
    this.dropping.add(key);
    const gone = [`${kind}'s ${name}`, ...this.dropMentions({ t: "field", kind, from: name, to: "\u0000" }, true)];
    const spec = this.doc.kinds[kind];
    if (spec) {
      delete spec.computed[name];
      if (Object.keys(spec.computed).length === 0) delete spec.computed;
      if (spec.glance?.includes(name)) {
        spec.glance = spec.glance.filter((field: string) => field !== name);
        if (spec.glance.length === 0) delete spec.glance;
      }
    }
    this.dropping.delete(key);
    return gone;
  }

  /** View blocks that show what is going: every kind's slots, the home, and each blocks lens's blocks are pruned (see pruneBlock). */
  private pruneViews(r: Rename): string[] {
    const doc = this.doc;
    const gone: string[] = [];
    if (!doc.views) return gone;
    for (const [kind, slots] of Object.entries(doc.views) as [string, Doc][]) {
      if (kind === "home" && Array.isArray(slots)) {
        const before = JSON.stringify(slots);
        doc.views.home = mapBlocks(slots, (b) => pruneBlock(doc, b, NONE, r, null));
        if (JSON.stringify(doc.views.home) !== before) gone.push("part of the front page");
        if (doc.views.home.length === 0) delete doc.views.home;
        continue;
      }
      for (const slot of VIEW_SLOTS) {
        if (!Array.isArray(slots[slot])) continue;
        const before = JSON.stringify(slots[slot]);
        slots[slot] = mapBlocks(slots[slot], (b) => pruneBlock(doc, b, new Set([kind]), r, kind));
        if (JSON.stringify(slots[slot]) !== before) gone.push(`part of the ${kind} ${slot}`);
        if (slots[slot].length === 0) delete slots[slot];
      }
      if (Object.keys(slots).length === 0) delete doc.views[kind];
    }
    if (Object.keys(doc.views).length === 0) delete doc.views;
    return gone;
  }

  /**
   * Lenses, after a removal. A binding to what is going is dropped; a lens
   * that can no longer draw — a role it draws by is gone, it stood on a
   * removed kind, its blocks are all gone — goes, and so does `pages.first`
   * when it named it. (`remove-field` and `remove-relation` are refused
   * before they get here when a lens draws by the thing: see lensesDrawnBy.)
   */
  private pruneLenses(r: Rename): string[] {
    const doc = this.doc;
    const gone: string[] = [];
    const lenses: Doc[] = doc.lenses ?? [];
    const leaving: number[] = [];
    lenses.forEach((lens, index) => {
      if (!isObject(lens)) return;
      let draws = true;
      const bindings = lens["bindings"];
      const required = requiredRoles(lens);
      if (isObject(bindings)) {
        if (lensBinds(lens) === "entities") {
          for (const [role, b] of Object.entries(bindings)) {
            if (!isObject(b)) continue;
            const hit =
              (r.t === "kind" && b["kind"] === r.from) ||
              (r.t === "edge" && (b["edge"] === r.from || (Array.isArray(b["path"]) && b["path"].includes(r.from)))) ||
              (r.t === "field" && b["field"] === r.from && roleKind(bindings, role) === r.kind);
            if (!hit) continue;
            if (required.includes(role) || r.t === "kind") draws = false;
            else delete bindings[role];
          }
        } else {
          if (r.t === "kind" && isObject(bindings[r.from])) {
            delete bindings[r.from];
            if (!Object.values(bindings).some(isObject)) draws = false;
          }
          if (r.t === "field" && isObject(bindings[r.kind])) {
            const b = bindings[r.kind] as Record<string, unknown>;
            for (const [role, v] of Object.entries(b)) if (v === r.from) {
              if (required.includes(role)) draws = false;
              else delete b[role];
            }
          }
        }
      }
      if (r.t === "kind" && lens["on"] === r.from) draws = false;
      const options = lens["options"];
      if (isObject(options)) {
        if (Array.isArray(options["blocks"])) {
          const blocks = mapBlocks(options["blocks"], (b) => pruneBlock(doc, b, NONE, r, null));
          if (blocks.length === 0) draws = false;
          options["blocks"] = blocks;
        }
        for (const [key, value] of Object.entries(options)) if (key !== "blocks" && value === r.from && (r.t !== "field" || lensStandsOn(lens, r.kind))) delete options[key];
      }
      if (!draws) leaving.push(index);
    });
    for (const index of leaving.reverse()) gone.push(this.removeLensAt(index));
    return gone.reverse();
  }

  /**
   * THE LENSES THAT DRAW BY A FIELD OR A RELATION — a role the lens cannot
   * draw without (a timeline's start, a coverage's link). Removing one is
   * refused, with a finding naming each lens and role: whether to drop the
   * picture or bind it to something else is the person's to say.
   */
  private lensesDrawnBy(i: number, r: Rename): boolean {
    let refused = false;
    (this.doc.lenses ?? []).forEach((lens: Doc, index: number) => {
      if (!isObject(lens) || !isObject(lens["bindings"])) return;
      const bindings = lens["bindings"] as Record<string, unknown>;
      const required = requiredRoles(lens);
      const title = String(lens["title"] ?? lens["name"] ?? index);
      const roles: string[] = [];
      if (lensBinds(lens) === "entities") {
        for (const [role, b] of Object.entries(bindings)) {
          if (!isObject(b) || !required.includes(role)) continue;
          if (r.t === "field" && b["field"] === r.from && roleKind(bindings, role) === r.kind) roles.push(role);
          if (r.t === "edge" && (b["edge"] === r.from || (Array.isArray(b["path"]) && b["path"].includes(r.from)))) roles.push(role);
        }
      } else if (r.t === "field" && isObject(bindings[r.kind])) {
        for (const [role, v] of Object.entries(bindings[r.kind] as Record<string, unknown>)) if (v === r.from && required.includes(role)) roles.push(role);
      }
      for (const role of roles) {
        refused = true;
        const what = r.t === "field" ? `${r.kind}'s ${r.from}` : `the "${r.from}" relation`;
        this.fail(i, "", `the lens "${title}" (lenses.${index}) draws by its ${role}, which is ${what}, and cannot draw without it`, `remove the lens first ({"op": "remove-lens", "title": "${title}"}), or bind ${role} to something else`);
      }
    });
    return refused;
  }

  /** Remove the lens at an index; `pages.first` that named it is dropped, so the app opens at its home. */
  private removeLensAt(index: number): string {
    const lens = this.doc.lenses[index];
    const title = lens?.["title"] ? String(lens["title"]) : undefined;
    this.doc.lenses.splice(index, 1);
    if (this.doc.lenses.length === 0) delete this.doc.lenses;
    let said = title ? `the lens "${title}"` : `the ${String(lens?.["name"] ?? "")} lens`;
    if (title && this.doc.pages?.first !== undefined && namesLens(this.doc.pages.first, title)) {
      delete this.doc.pages.first;
      if (Object.keys(this.doc.pages).length === 0) delete this.doc.pages;
      said += " (the app opens at its home again)";
    }
    return said;
  }
}

/** A `$name` reference or bare argument name in a guard, renamed (for an argument that followed its field). */
function rewriteBinding(source: string, from: string, to: string): string {
  try {
    const e = parseExpr(source);
    const next = mapNames({ kinds: {} }, e, NONE, (s) => (s.role === "name" && s.name === from && s.kinds === NONE ? to : s.name));
    return next === e ? source : printExpr(next);
  } catch {
    return source;
  }
}

/** Swap one kebab token run in a name: ("set-quote", "quote", "price") → "set-price". */
function swapToken(name: string, from: string, to: string): string {
  const parts = name.split("-");
  const a = from.split("-");
  for (let i = 0; i + a.length <= parts.length; i++) {
    if (a.every((t, j) => parts[i + j] === t)) return [...parts.slice(0, i), ...to.split("-"), ...parts.slice(i + a.length)].join("-");
  }
  return name;
}


const listOf = (xs: readonly string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** Map every block of a view, nested ones included; a block mapped to null is dropped. */
function mapBlocks(blocks: unknown[], f: (b: Record<string, unknown>) => Record<string, unknown> | null): unknown[] {
  const out: unknown[] = [];
  for (const raw of blocks) {
    if (!isObject(raw)) {
      out.push(raw);
      continue;
    }
    let b: Record<string, unknown> = raw;
    if (Array.isArray(b["group"])) b = { ...b, group: mapBlocks(b["group"] as unknown[], f) };
    if (Array.isArray(b["show"])) b = { ...b, show: mapBlocks(b["show"] as unknown[], f) };
    const mapped = f(b);
    if (mapped) out.push(mapped);
  }
  return out;
}

// ── words for what changed ───────────────────────────────────────────────────

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const withA = (noun: string) => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
const nounOf = (doc: Doc, kind: string): string => doc.kinds[kind]?.noun ?? words(kind);
/** A kind's plural as a person reads it: "packages", "people and teams". */
function pluralWords(doc: Doc, kind: string): string {
  const plural: string | undefined = doc.kinds[kind]?.plural;
  return plural ? plural.charAt(0).toLowerCase() + plural.slice(1) : `${words(kind)}s`;
}
/** The kinds a lens binds, for saying where it stands. */
function kindsBound(lens: Doc): string[] {
  const bindings = lens["bindings"];
  if (!isObject(bindings)) return [];
  if (lensBinds(lens) === "entities") return Object.values(bindings).flatMap((b) => (isObject(b) && typeof b["kind"] === "string" ? [b["kind"]] : []));
  return Object.keys(bindings).filter((k) => isObject(bindings[k]));
}
/** What a list of blocks is, in words: "a headline, a figure and a list of records". */
function blockWords(blocks: readonly unknown[]): string {
  const said = blocks.map((b) => {
    if (!isObject(b)) return "a block";
    if ("list" in b) return "a list of records";
    if ("headline" in b) return "a headline";
    if ("figure" in b) return b["figure"] === true ? "its picture" : "a figure";
    if ("title" in b) return "a title";
    if ("text" in b) return "words";
    if ("badge" in b) return "a badge";
    if ("field" in b) return `its ${String(b["field"])}`;
    if ("progress" in b) return "a progress bar";
    if ("group" in b) return "a group";
    if ("when" in b) return "a condition";
    if ("divider" in b) return "a divider";
    return "a block";
  });
  return listOf(said);
}

// ── lenses as a change sees them ─────────────────────────────────────────────

/** How a lens binds: a kind's fields to its roles, or kinds, relations and fields to its roles, or nothing. */
function lensBinds(lens: Doc): "fields" | "entities" | "nothing" {
  if (lens["binds"] === "fields" || lens["binds"] === "entities") return lens["binds"];
  const name = String(lens["name"] ?? "");
  return isShippedLens(name) ? SHIPPED_LENSES[name].binds : "fields";
}

/** The roles a lens cannot draw without: its own, or the shipped lens's. */
function requiredRoles(lens: Doc): readonly string[] {
  if (Array.isArray(lens["requiredRoles"])) return lens["requiredRoles"] as string[];
  const name = String(lens["name"] ?? "");
  return isShippedLens(name) ? SHIPPED_LENSES[name].requiredRoles : [];
}

/** For a lens that binds kinds: the kind a role's field is read from — the kind its `on` role binds, else the first kind bound. */
function roleKind(bindings: Record<string, unknown>, role: string): string | undefined {
  const b = bindings[role];
  if (isObject(b) && typeof b["kind"] === "string") return b["kind"];
  const on = isObject(b) && typeof b["on"] === "string" ? bindings[b["on"]] : undefined;
  if (isObject(on) && typeof on["kind"] === "string") return on["kind"];
  const first = Object.values(bindings).find((x) => isObject(x) && typeof x["kind"] === "string") as Record<string, unknown> | undefined;
  return first?.["kind"] as string | undefined;
}

/** Whether a lens stands on a kind: its `on`, a kind it binds fields of, or a kind a role binds. */
function lensStandsOn(lens: Doc, kind: string): boolean {
  if (lens["on"] === kind) return true;
  const bindings = lens["bindings"];
  if (!isObject(bindings)) return false;
  if (lensBinds(lens) === "entities") return Object.values(bindings).some((b) => isObject(b) && b["kind"] === kind);
  return isObject(bindings[kind]);
}

/** Whether `pages.first` names this lens: by its title, or by its address word. */
const namesLens = (first: unknown, title: string): boolean => typeof first === "string" && (first.trim() === title || placeSlug(first) === placeSlug(title));

/**
 * A rename, wherever a lens says the name: the kind it stands `on`, the
 * kinds and fields its bindings name, the plain words its options give
 * (a coverage's `rowGroup`, a board's `fillFrom`), and every expression and
 * template of a blocks lens — through the parser, as everywhere else.
 */
function rewriteLens(doc: Doc, lens: Doc, r: Rename): void {
  if (r.t === "kind" && lens["on"] === r.from) lens["on"] = r.to;
  const bindings = lens["bindings"];
  if (isObject(bindings)) {
    if (lensBinds(lens) === "entities") {
      // Which kind each role's field is read from, before the change moves anything.
      const kindOf = new Map(Object.keys(bindings).map((role) => [role, roleKind(bindings, role)]));
      for (const [role, b] of Object.entries(bindings)) {
        if (!isObject(b)) continue;
        if (r.t === "kind" && b["kind"] === r.from) b["kind"] = r.to;
        if (r.t === "edge" && b["edge"] === r.from) b["edge"] = r.to;
        if (r.t === "edge" && Array.isArray(b["path"])) b["path"] = b["path"].map((step: unknown) => (step === r.from ? r.to : step));
        if (r.t === "field" && b["field"] === r.from && kindOf.get(role) === r.kind) b["field"] = r.to;
      }
    } else {
      if (r.t === "kind" && r.from in bindings) lens["bindings"] = Object.fromEntries(Object.entries(bindings).map(([k, v]) => [k === r.from ? r.to : k, v]));
      if (r.t === "field" && isObject(bindings[r.kind])) {
        const b = bindings[r.kind] as Record<string, unknown>;
        for (const [k, v] of Object.entries(b)) if (v === r.from) b[k] = r.to;
      }
    }
  }
  const options = lens["options"];
  if (isObject(options)) {
    for (const [key, value] of Object.entries(options)) {
      if (key === "blocks" && Array.isArray(value)) options["blocks"] = mapBlocks(value, (b) => rewriteBlock(doc, b, NONE, r, null));
      else if (value === r.from && (r.t !== "field" || lensStandsOn(lens, r.kind))) options[key] = r.to;
    }
  }
}

/** The kinds a list block's records are, read from its source before the change: what its sort key and group are read from. */
function listMembers(doc: Doc, source: unknown, ctx: Kinds): Kinds {
  if (typeof source !== "string") return NONE;
  try {
    return kindsOf(doc, parseExpr(source), ctx);
  } catch (err) {
    if (err instanceof ExprSyntaxError) return NONE;
    throw err;
  }
}

/** A list's sort (`"net"`, or `{ by, direction }`) and group (`"type"`, or `{ by, headings }`): the key each names, read per member. */
const keyOf = (v: unknown): string | undefined => (typeof v === "string" ? v : isObject(v) && typeof v["by"] === "string" ? v["by"] : undefined);
const withKey = (v: unknown, key: string): unknown => (typeof v === "string" ? key : { ...(v as Record<string, unknown>), by: key });

/**
 * One block with a rename applied wherever it names: templates (a title, a
 * text, a badge, a headline), expressions (a figure, a tone, a condition, a
 * progress), a list's source, and its sort key and group — read from the
 * records the list lists, not the record the view is about — and a field
 * block's field. `kind` is the kind the blocks are about; null for the home
 * and a blocks lens.
 */
function rewriteBlock(doc: Doc, b: Record<string, unknown>, ctx: Kinds, r: Rename, kind: string | null): Record<string, unknown> {
  const next = { ...b };
  for (const key of ["title", "text", "badge", "headline"]) if (typeof next[key] === "string") next[key] = rewriteTemplate(doc, next[key] as string, ctx, r);
  if (typeof next["figure"] === "string") next["figure"] = rewriteExpr(doc, next["figure"], ctx, r);
  // A figure's and a meter's label is a template (FR-99); a field's is words.
  if ((typeof next["figure"] === "string" || "progress" in next) && typeof next["label"] === "string") next["label"] = rewriteTemplate(doc, next["label"], ctx, r);
  if (typeof next["list"] === "string") {
    const members = listMembers(doc, next["list"], ctx);
    next["list"] = rewriteExpr(doc, next["list"], ctx, r);
    const sort = keyOf(next["sort"]);
    if (sort !== undefined) next["sort"] = withKey(next["sort"], rewriteExpr(doc, sort, members, r));
    const group = keyOf(next["group"]);
    if (group !== undefined) next["group"] = withKey(next["group"], renamer(doc, r)({ role: "field", kinds: members, name: group }));
  }
  if (isObject(next["tone"]) && typeof next["tone"]["expr"] === "string") next["tone"] = { expr: rewriteExpr(doc, next["tone"]["expr"], ctx, r) };
  if (typeof next["when"] === "string") next["when"] = rewriteExpr(doc, next["when"], ctx, r);
  if (isObject(next["progress"])) {
    const p = { ...(next["progress"] as Record<string, unknown>) };
    for (const k of ["value", "max"]) if (typeof p[k] === "string") p[k] = rewriteExpr(doc, p[k] as string, ctx, r);
    next["progress"] = p;
  }
  if (r.t === "field" && r.kind === kind && next["field"] === r.from) next["field"] = r.to;
  return next;
}

/**
 * One block, with what a removal takes from it: the block goes when what it
 * shows cannot be shown (its template, its figure, its list's records, its
 * condition names the thing); a list keeps its records and loses only an
 * order or a grouping by a field that is gone.
 */
function pruneBlock(doc: Doc, b: Record<string, unknown>, ctx: Kinds, r: Rename, kind: string | null): Record<string, unknown> | null {
  if (r.t === "field" && r.kind === kind && b["field"] === r.from) return null;
  for (const key of ["title", "text", "badge", "headline"]) if (typeof b[key] === "string" && templateMentions(doc, b[key] as string, ctx, r)) return null;
  if (typeof b["figure"] === "string" && exprMentions(doc, b["figure"], ctx, r)) return null;
  if (isObject(b["tone"]) && exprMentions(doc, b["tone"]["expr"] as string, ctx, r)) return null;
  if (typeof b["when"] === "string" && exprMentions(doc, b["when"], ctx, r)) return null;
  if (isObject(b["progress"])) for (const k of ["value", "max"]) if (exprMentions(doc, (b["progress"] as Record<string, string>)[k], ctx, r)) return null;
  // A label that says what is gone goes; the figure or meter stays (FR-99).
  if ((typeof b["figure"] === "string" || "progress" in b) && typeof b["label"] === "string" && templateMentions(doc, b["label"], ctx, r)) {
    const { label: _gone, ...kept } = b;
    return kept;
  }
  if (typeof b["list"] === "string") {
    if (exprMentions(doc, b["list"], ctx, r)) return null;
    const members = listMembers(doc, b["list"], ctx);
    const next = { ...b };
    const sort = keyOf(b["sort"]);
    if (sort !== undefined && exprMentions(doc, sort, members, r)) delete next["sort"];
    const group = keyOf(b["group"]);
    if (group !== undefined && renamer(doc, r)({ role: "field", kinds: members, name: group }) !== group) delete next["group"];
    return next;
  }
  return b;
}

/**
 * Apply structural edits to a document, in order. Returns the new document and what
 * each edit did in words — or, when an edit cannot apply, the findings (paths
 * `edits.<i>.…`) and no document. The result is NOT compiled here: the caller
 * previews it like any other proposed document.
 */
export function editDocument(document: GraviewDocument, edits: readonly unknown[]): EditOutcome {
  if (!Array.isArray(edits)) return { ok: false, findings: [error("edit", "edits", "edits are a list, like [{\"op\": \"add-field\", …}]")] };
  // No edits is no change: the document as it was, and nothing said.
  if (edits.length === 0) return { ok: true, document: clone(document), said: [], fills: [] };
  if (edits.length > MAX_EDITS) return { ok: false, findings: [error("edit", "edits", `at most ${MAX_EDITS} edits at once`)] };
  const editor = new Editor(clone(document), document);
  edits.forEach((raw, i) => {
    if (editor.findings.length > 0) return;
    if (!isObject(raw)) return editor.findings.push(error("edit", `edits.${i}`, 'an edit is an object like {"op": "add-field", "kind": "vendor", "field": "deposit", "type": "number"}'));
    editor.apply(i, raw);
  });
  if (editor.findings.length > 0) return { ok: false, findings: editor.findings };
  /*
   * THE TOOL INTERFACE MOVED, AND SAYS SO (FR-34). A derived act is named for
   * its kind and asks for its fields by name, so a rename changes what an
   * agent calls; a conversation that listed the tools before sends what is
   * no longer there.
   */
  if (editor.toolsMoved.size > 0) {
    editor.said.push(`The tools an agent is offered change: ${listOf([...editor.toolsMoved])}. A conversation that listed them before should list them again.`);
  }
  return { ok: true, document: editor.doc as GraviewDocument, said: editor.said, fills: editor.fills };
}

/** What a declaration holds, enough for the rule language's name walk: each kind's fields, and where its relations go. */
export interface DeclaredKinds {
  readonly [kind: string]: { readonly fields: readonly string[]; readonly edges?: Readonly<Record<string, readonly string[] | "*">> };
}

/** A name that changes: a kind's field, an app-wide relation, or a kind. */
export type NameChange =
  | { readonly what: "field"; readonly kind: string; readonly from: string; readonly to: string }
  | { readonly what: "relation"; readonly from: string; readonly to: string }
  | { readonly what: "kind"; readonly from: string; readonly to: string };

/**
 * ONE RENAME, WHEREVER IT IS WRITTEN (FR-34). The walk `editDocument` renames
 * with — which kind each bare name reads from, a quoted word left alone,
 * another kind's field of the same name untouched — for a surface that holds
 * its own declaration, like the studio's. An expression comes back printed;
 * a template keeps the words around its braces.
 */
export function renameIn(kinds: DeclaredKinds, over: string | "graph", text: { readonly expression?: string; readonly template?: string }, change: NameChange): string | undefined {
  const doc: Doc = {
    kinds: Object.fromEntries(
      Object.entries(kinds).map(([kind, shape]) => [
        kind,
        {
          fields: Object.fromEntries(shape.fields.map((field) => [field, {}])),
          edges: Object.fromEntries(Object.entries(shape.edges ?? {}).map(([edge, to]) => [edge, { to }])),
        },
      ]),
    ),
  };
  const r: Rename = change.what === "field" ? { t: "field", kind: change.kind, from: change.from, to: change.to } : change.what === "relation" ? { t: "edge", from: change.from, to: change.to } : { t: "kind", from: change.from, to: change.to };
  const ctx: Kinds = over === "graph" ? NONE : new Set([over]);
  if (text.expression !== undefined) return rewriteExpr(doc, text.expression, ctx, r);
  if (text.template !== undefined) return rewriteTemplate(doc, text.template, ctx, r);
  return undefined;
}
