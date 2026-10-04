import { z } from "zod";
import type { Expr } from "./expr/parse.js";
import { ExprSyntaxError, parseExpr } from "./expr/parse.js";
import { printExpr } from "./expr/print.js";
import { error, type Finding } from "./findings.js";
import { coerce } from "./migrate.js";
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
import { parseTemplate, TemplateError, type TemplatePart } from "./template.js";
import { VIEW_SLOTS } from "./views.js";

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
  "set-label",
  "set-describe",
  "set-view",
  "set-glance",
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

const SHAPES: Record<EditOp, z.ZodType> = {
  "add-kind": z.object({ op: z.literal("add-kind"), kind: kindName, act: z.boolean().optional() }).passthrough(),
  "rename-kind": z.object({ op: z.literal("rename-kind"), kind: kindName, to: kindName, noun: z.string().min(1).max(40).optional(), plural: z.string().min(1).max(40).optional() }).strict(),
  "remove-kind": z.object({ op: z.literal("remove-kind"), kind: kindName }).strict(),
  "add-field": z.object({ op: z.literal("add-field"), kind: kindName, field: fieldName, fill: z.unknown().optional(), spec: z.record(z.string(), z.unknown()).optional() }).passthrough(),
  "rename-field": z.object({ op: z.literal("rename-field"), kind: kindName, field: fieldName, to: fieldName }).strict(),
  "retype-field": z.object({ op: z.literal("retype-field"), kind: kindName, field: fieldName, type: z.enum(FIELD_TYPES), options: z.array(z.string().min(1).max(80)).min(1).max(100).optional(), of: z.enum(["string", "number", "date"]).optional(), format: z.enum(["money", "percent", "duration"]).optional() }).strict(),
  "set-options": z.object({ op: z.literal("set-options"), kind: kindName, field: fieldName, add: z.array(z.string().min(1).max(80)).optional(), remove: z.array(z.string().min(1).max(80)).optional() }).strict(),
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
  "set-brand": z.object({ op: z.literal("set-brand"), accent: z.union([z.string(), z.null()]), name: z.string().min(1).max(60).optional() }).strict(),
  "set-label": z.object({ op: z.literal("set-label"), kind: kindName, field: fieldName.optional(), label: z.union([z.string().min(1).max(300), z.null()]) }).strict(),
  "set-describe": z.object({ op: z.literal("set-describe"), kind: kindName, describe: z.union([z.string().min(1).max(300), z.null()]) }).strict(),
  "set-view": z.object({ op: z.literal("set-view"), kind: kindName, slot: z.enum(VIEW_SLOTS), blocks: z.union([z.array(z.unknown()).min(1), z.null()]) }).strict(),
  "set-glance": z.object({ op: z.literal("set-glance"), kind: kindName, fields: z.array(fieldName).max(20) }).strict(),
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
      if (e.fn === "out" && lit) return targets(doc, "*", lit);
      if (e.fn === "in" && lit) return sources(doc, lit);
      if (e.fn === "all" && lit) return new Set([lit]);
      if (e.fn === "if" && e.args.length === 3) return union(kindsOf(doc, e.args[1]!, ctx), kindsOf(doc, e.args[2]!, ctx));
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
        } else if ((x.fn === "every" || x.fn === "some") && x.args.length === 2) {
          args = [go(x.args[0]!, at), go(x.args[1]!, kindsOf(doc, x.args[0]!, at))];
        } else if ((x.fn === "sum" || x.fn === "min" || x.fn === "max") && x.args.length === 2) {
          const second = x.args[1]!;
          const members = kindsOf(doc, x.args[0]!, at);
          let field: Expr = second;
          if (second.t === "ident" || (second.t === "lit" && typeof second.value === "string")) {
            const was = second.t === "ident" ? second.name : (second.value as string);
            const name = rename({ role: "field", kinds: members, name: was });
            if (name !== was) field = second.t === "ident" ? { ...second, name } : { ...second, value: name };
          } else field = go(second, at);
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
    if ((site.role === "name" || site.role === "field") && site.name === r.from && hasKind(site.kinds, r.kind) && doc.kinds[r.kind]?.fields?.[r.from]) return r.to;
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

/** A template with the rename applied inside its braces; the words around them are kept. */
function rewriteTemplate(doc: Doc, source: string, ctx: Kinds, r: Rename, prose?: (text: string) => string): string {
  const ps = parts(source);
  if (!ps) return source;
  let changed = false;
  const out = ps.map((p) => {
    if (p.text !== undefined) {
      const t = prose ? prose(p.text) : p.text;
      if (t !== p.text) changed = true;
      return t;
    }
    const next = mapNames(doc, p.expr!, ctx, renamer(doc, r));
    if (next === p.expr) return `{${p.source}${p.format ? `|${p.format}` : ""}}`;
    changed = true;
    return `{${printExpr(next)}${p.format ? `|${p.format}` : ""}}`;
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

/** The kinds each `set` in an act writes to: its subject, a record it made, or (for a `$ref` target) any kind. */
function setTargets(act: Doc): { set: Record<string, unknown>; kinds: Kinds; where: "sets" | "writes" | "effect" | "create"; index?: number }[] {
  const out: { set: Record<string, unknown>; kinds: Kinds; where: "sets" | "writes" | "effect" | "create"; index?: number }[] = [];
  const made = new Map<string, string>();
  if (act.creates) made.set("new", act.creates);
  (act.effects ?? []).forEach((e: Doc) => {
    if (e.create && e.as) made.set(e.as, e.create);
  });
  if (act.sets) out.push({ set: act.sets, kinds: subjectKinds(act), where: "sets" });
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
      case "set-brand": {
        if (e.accent === null) {
          delete this.doc.brand;
          this.said.push("The app goes back to Graview's colours.");
        } else {
          if (!/^#[0-9a-fA-F]{6}$/.test(e.accent)) return this.fail(i, "accent", 'an accent is a colour like "#c2577a"');
          this.doc.brand = { accent: e.accent, ...(e.name ? { name: e.name } : this.doc.brand?.name ? { name: this.doc.brand.name } : {}) };
          this.said.push(`The app's accent colour becomes ${e.accent}.`);
        }
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
      case "set-view": {
        if (!this.kind(i, e.kind)) return;
        const views = (this.doc.views ??= {});
        if (e.blocks === null) {
          if (views[e.kind]) delete views[e.kind][e.slot];
          if (views[e.kind] && Object.keys(views[e.kind]).length === 0) delete views[e.kind];
          if (Object.keys(views).length === 0) delete this.doc.views;
          this.said.push(`A ${e.kind} ${e.slot} goes back to Graview's own look.`);
        } else {
          (views[e.kind] ??= {})[e.slot] = e.blocks;
          this.said.push(`A ${e.kind} ${e.slot} gets a look of its own (${e.blocks.length} block${e.blocks.length === 1 ? "" : "s"}).`);
        }
        return;
      }
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
    }
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
    if (e.plural) spec.plural = e.plural;
    else if (spec.plural && (spec.plural === `${words(from)}s` || spec.plural === `${from}s`)) spec.plural = `${words(to)}s`;
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
    if (this.doc.views?.[kind]) {
      delete this.doc.views[kind];
      if (Object.keys(this.doc.views).length === 0) delete this.doc.views;
    }
    for (const g of this.doc.policy?.grants ?? []) if (Array.isArray(g.kinds)) g.kinds = g.kinds.filter((k: string) => k !== kind);
    if (this.doc.policy?.sees) {
      this.doc.policy.sees = this.doc.policy.sees.map((s: Doc) => ({ ...s, kinds: s.kinds.filter((k: string) => k !== kind) })).filter((s: Doc) => s.kinds.length > 0);
      if (this.doc.policy.sees.length === 0) delete this.doc.policy.sees;
    }
    for (const lens of this.doc.lenses ?? []) if (isObject(lens["bindings"])) delete (lens["bindings"] as Doc)[kind];
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
    if (f.label) f.label = prose(f.label);
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
    if (f.default !== undefined && coerce(f.default, was, f) === undefined) delete f.default;
    else if (f.default !== undefined) f.default = coerce(f.default, was, f);
    this.said.push(`${e.kind}'s ${e.field} changes from ${was} to ${e.type}; values that convert are kept.`);
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
      for (const t of setTargets(act)) if (hasKind(t.kinds, e.kind) && typeof t.set[e.field] === "string" && remove.includes(t.set[e.field] as string)) {
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
        for (const e of act.effects ?? []) {
          if (e.connect === r.from) e.connect = r.to;
          if (e.sever === r.from) e.sever = r.to;
        }
      }
      if (r.t === "field") {
        const args = new Map<string, string>();
        for (const t of setTargets(act)) {
          if (!hasKind(t.kinds, r.kind) || !(r.from in t.set)) continue;
          if (t.kinds === "*" && Object.entries(doc.kinds).some(([k, s]: [string, Doc]) => k !== r.kind && s.fields[r.from])) continue;
          const renamed: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(t.set)) renamed[k === r.from ? r.to : k] = k === r.from && v === `$${r.from}` ? `$${r.to}` : v;
          if (t.set[r.from] === `$${r.from}`) args.set(r.from, r.to);
          if (t.where === "sets") act.sets = renamed;
          else act.effects[t.index!].set = renamed;
        }
        if (act.writes && hasKind(on, r.kind) && act.writes.includes(r.from)) {
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
      for (const t of setTargets(act)) for (const [k, v] of Object.entries(t.set)) if (isObject(v) && typeof v["expr"] === "string") (t.set as Doc)[k] = { expr: exprAt(v["expr"], t.kinds === "*" ? on : t.kinds) };
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

    // Views.
    if (doc.views) {
      if (r.t === "kind" && doc.views[r.from]) {
        const views: Doc = {};
        for (const [k, v] of Object.entries(doc.views)) views[k === r.from ? r.to : k] = v;
        doc.views = views;
      }
      for (const [kind, slots] of Object.entries(doc.views) as [string, Doc][]) {
        const ctx = new Set([r.t === "kind" && kind === r.to ? r.from : kind]);
        for (const slot of VIEW_SLOTS) {
          if (!Array.isArray(slots[slot])) continue;
          const before = JSON.stringify(slots[slot]);
          slots[slot] = mapBlocks(slots[slot], (b) => rewriteBlock(doc, b, ctx, r, kind));
          if (JSON.stringify(slots[slot]) !== before) touched.push(`the ${kind} ${slot}`);
        }
      }
    }

    // Lenses bind kinds (keys) to fields (values).
    for (const lens of doc.lenses ?? []) {
      const bindings = lens["bindings"];
      if (!isObject(bindings)) continue;
      const before = JSON.stringify(bindings);
      if (r.t === "kind" && r.from in bindings) {
        bindings[r.to] = bindings[r.from];
        delete bindings[r.from];
      }
      if (r.t === "field" && isObject(bindings[r.kind])) {
        const b = bindings[r.kind] as Record<string, unknown>;
        for (const [k, v] of Object.entries(b)) if (v === r.from) b[k] = r.to;
      }
      if (JSON.stringify(bindings) !== before) touched.push(`the lens ${String(lens["name"] ?? "")}`.trim());
    }

    // Pages name kinds.
    if (r.t === "kind" && doc.pages) {
      const before = JSON.stringify(doc.pages);
      doc.pages = deepSwap(doc.pages, r.from, r.to);
      if (JSON.stringify(doc.pages) !== before) touched.push("the pages");
    }
    return touched;
  }

  /**
   * Remove what mentions a field or relation that is going: acts that write or walk
   * it, rules that judge it, view blocks that show it; templates that show it fall
   * back to Graview's own. Returns what went, as words.
   */
  private dropMentions(r: Rename): string[] {
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
    for (const [name, act] of Object.entries(doc.acts ?? {}) as [string, Doc][]) {
      const on = subjectKinds(act);
      let uses = exprMentions(doc, act.allowedWhen, on, r) || templateMentions(doc, act.refusal, on, r);
      if (r.t === "edge") uses ||= act.connects === r.from || act.severs === r.from || (act.effects ?? []).some((e: Doc) => e.connect === r.from || e.sever === r.from);
      if (r.t === "field") {
        // An act that sets other things too loses only this field; one that did nothing else goes.
        for (const t of setTargets(act)) {
          if (!hasKind(t.kinds, r.kind) || t.kinds === "*") continue;
          if (r.from in t.set) delete t.set[r.from];
          for (const v of Object.values(t.set)) if (isObject(v) && typeof v["expr"] === "string" && exprMentions(doc, v["expr"], t.kinds, r)) uses = true;
        }
        if (act.writes && hasKind(on, r.kind) && act.writes.includes(r.from)) {
          act.writes = act.writes.filter((w: string) => w !== r.from);
          if (act.writes.length === 0) delete act.writes;
        }
        if (act.args?.[r.from] && act.creates !== r.kind) delete act.args[r.from];
        if (act.args && Object.keys(act.args).length === 0) delete act.args;
        if (act.sets && Object.keys(act.sets).length === 0) delete act.sets;
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
    if (doc.views) {
      for (const [kind, slots] of Object.entries(doc.views) as [string, Doc][]) {
        for (const slot of VIEW_SLOTS) {
          if (!Array.isArray(slots[slot])) continue;
          const before = JSON.stringify(slots[slot]);
          slots[slot] = mapBlocks(slots[slot], (b) => (blockMentions(doc, b, new Set([kind]), r, kind) ? null : b));
          if (slots[slot].length === 0) delete slots[slot];
          if (JSON.stringify(slots[slot]) !== before) gone.push(`part of the ${kind} ${slot}`);
        }
        if (Object.keys(slots).length === 0) delete doc.views[kind];
      }
      if (Object.keys(doc.views).length === 0) delete doc.views;
    }
    for (const lens of doc.lenses ?? []) {
      const bindings = lens["bindings"];
      if (r.t === "field" && isObject(bindings) && isObject(bindings[r.kind])) {
        const b = bindings[r.kind] as Record<string, unknown>;
        for (const [k, v] of Object.entries(b)) if (v === r.from) delete b[k];
      }
    }
    return gone;
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

function deepSwap(v: unknown, from: string, to: string): unknown {
  if (v === from) return to;
  if (Array.isArray(v)) return v.map((x) => deepSwap(x, from, to));
  if (isObject(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k === from ? to : k, deepSwap(x, from, to)]));
  return v;
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

function rewriteBlock(doc: Doc, b: Record<string, unknown>, ctx: Kinds, r: Rename, kind: string): Record<string, unknown> {
  const next = { ...b };
  for (const key of ["title", "text", "badge"]) if (typeof next[key] === "string") next[key] = rewriteTemplate(doc, next[key] as string, ctx, r);
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

function blockMentions(doc: Doc, b: Record<string, unknown>, ctx: Kinds, r: Rename, kind: string): boolean {
  if (r.t === "field" && r.kind === kind && b["field"] === r.from) return true;
  for (const key of ["title", "text", "badge"]) if (typeof b[key] === "string" && templateMentions(doc, b[key] as string, ctx, r)) return true;
  if (isObject(b["tone"]) && exprMentions(doc, b["tone"]["expr"] as string, ctx, r)) return true;
  if (typeof b["when"] === "string" && exprMentions(doc, b["when"], ctx, r)) return true;
  if (isObject(b["progress"])) for (const k of ["value", "max"]) if (exprMentions(doc, (b["progress"] as Record<string, string>)[k], ctx, r)) return true;
  return false;
}

/**
 * Apply structural edits to a document, in order. Returns the new document and what
 * each edit did in words — or, when an edit cannot apply, the findings (paths
 * `edits.<i>.…`) and no document. The result is NOT compiled here: the caller
 * previews it like any other proposed document.
 */
export function editDocument(document: GraviewDocument, edits: readonly unknown[]): EditOutcome {
  if (!Array.isArray(edits) || edits.length === 0) return { ok: false, findings: [error("edit", "edits", "give at least one edit")] };
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
