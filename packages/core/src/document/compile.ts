import {
  RuleBudgetError,
  withArticle,
  brandFromAccent,
  checkApp,
  createSchema,
  defineInvariant,
  defineMutation,
  defineNode,
  SCHEMES,
  type AnyGraphNode,
  type AnyMutationDefinition,
  type Brand,
  type GraphReader,
  type GraviewApp,
  type InvariantDefinition,
  type MutationContext,
  type Policy,
  type Repair,
  type Violation,
} from "../index.js";
import * as z from "../schema/zod.js";
import { refTo } from "../mutations/node-ref.js";
import { analyzeExpr } from "./expr/analyze.js";
import { rememberDocument } from "./to-document.js";
import { evaluateExpr, ExprBudgetError, ExprEvalError, type KindShape, type Value } from "./expr/evaluate.js";
import { ExprSyntaxError, parseExpr, type Expr } from "./expr/parse.js";
import { error, hasErrors, warning, type Finding } from "./findings.js";
import {
  DocumentSpec,
  MAX_DOCUMENT_BYTES,
  type ActSpec,
  type EffectSpec,
  type FieldSpec,
  type GraviewDocument,
  type KindSpec,
  type SightSpec,
  type ValueSpec,
} from "./schema.js";
import { parseTemplate, renderTemplate, TemplateError, type TemplatePart } from "./template.js";
import { upgradeDocument } from "./upgrade.js";
import { homeOf, validateViews, viewsOf } from "./views.js";
import { computedOf, parsedComputed, validateComputed, workedOutAlone } from "./computed.js";

/*
 * A DOCUMENT, COMPILED.
 *
 * compileDocument turns a Graview Declaration Document into the GraviewApp a
 * TypeScript `defineApp` would have produced — built only from the
 * framework's public API, so everything the framework derives from a
 * declaration (the workbench, the routed face, legal actions, agent tools,
 * `graview check`) it derives from this too. Nothing here evaluates a string
 * as code: acts are a closed set of effects, rules and guards are the rule
 * language, labels are templates.
 */

export interface CompiledDocument {
  readonly ok: true;
  readonly app: GraviewApp;
  readonly document: GraviewDocument;
  /** Notes and warnings — never errors, or this would not be ok. */
  readonly findings: readonly Finding[];
  /** Who sees which kinds — the policy's `sees`, as the document said it. */
  readonly sights: readonly SightSpec[] | undefined;
  readonly kinds: ReadonlyMap<string, KindShape>;
}

export interface RefusedDocument {
  readonly ok: false;
  readonly findings: readonly Finding[];
}

export interface CompileOptions {
  /** The clock rules read as today(); injectable for tests. */
  readonly today?: () => string;
  /**
   * The version this one follows. Given, every `renamedFrom` must name a
   * kind, field or relation that version has — a rename from nothing moves
   * nothing, and the values it was meant to keep would be dropped (FR-22).
   */
  readonly previous?: GraviewDocument;
}

const BUILTIN_REFS = new Set(["subject", "now", "today"]);
const SUBJECT_ARG = "id";

/** Parse and validate without compiling — the document's own sentences, before the framework's. */
export function readDocument(raw: unknown): { readonly document?: GraviewDocument; readonly findings: readonly Finding[] } {
  if (typeof raw === "string") {
    if (raw.length > MAX_DOCUMENT_BYTES) return { findings: [error("too-large", "", `a document may be at most ${MAX_DOCUMENT_BYTES / 1024} KB`)] };
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      return { findings: [error("not-json", "", `this is not JSON: ${(e as Error).message}`)] };
    }
  } else if (JSON.stringify(raw ?? null).length > MAX_DOCUMENT_BYTES) {
    return { findings: [error("too-large", "", `a document may be at most ${MAX_DOCUMENT_BYTES / 1024} KB`)] };
  }
  // An older format is upgraded before it is read (upgrade.ts); the host records that as a new version.
  try {
    raw = upgradeDocument(raw).document;
  } catch (e) {
    return { findings: [error("format", "formatVersion", (e as Error).message)] };
  }
  const parsed = DocumentSpec.safeParse(raw);
  if (!parsed.success) {
    return {
      findings: parsed.error.issues.map((issue) => {
        const path = issue.path.map(String).join(".");
        if (issue.code === "unrecognized_keys") return error("unknown-key", path, `${issue.keys.map((k) => `"${k}"`).join(", ")} ${issue.keys.length === 1 ? "is" : "are"} not part of a Graview document here`, "check the spelling against docs/declaration-document.md");
        if (issue.code === "invalid_union" && /\.effects\.\d+$/.test(path)) {
          return error("effect-shape", path, "this effect is not one Graview knows", 'an effect is one of {"create": kind, "as"?: name, "set"?: {field: value}}, {"set": {field: value, …}, "target"?: "$ref"}, {"connect"|"sever": relation, "from": "$ref", "to": "$ref"}, {"remove": "$ref"}');
        }
        if (issue.code === "invalid_key") {
          const inner = (issue as unknown as { issues?: { message: string }[] }).issues?.[0]?.message;
          return error("shape", path, `the name "${String(issue.path.at(-1))}" is not allowed here${inner ? `: ${inner}` : ""}`);
        }
        return error("shape", path, issue.message);
      }),
    };
  }
  const document = parsed.data;
  return { document, findings: validate(document) };
}

const asArray = <T>(v: T | readonly T[] | undefined): readonly T[] => (v === undefined ? [] : Array.isArray(v) ? (v as readonly T[]) : [v as T]);

interface EdgeInfo {
  readonly name: string;
  readonly from: readonly string[];
  readonly to: readonly string[] | "*";
  readonly cardinality: "one" | "many";
}

function edgeIndex(document: GraviewDocument): Map<string, EdgeInfo> {
  const edges = new Map<string, EdgeInfo>();
  for (const [kind, spec] of Object.entries(document.kinds)) {
    for (const [name, edge] of Object.entries(spec.edges ?? {})) {
      const prior = edges.get(name);
      edges.set(name, {
        name,
        from: [...(prior?.from ?? []), kind],
        to: edge.to === "*" || prior?.to === "*" ? "*" : [...new Set([...(prior?.to ?? []), ...edge.to])],
        cardinality: edge.cardinality ?? "many",
      });
    }
  }
  return edges;
}

export function kindShapes(document: GraviewDocument): Map<string, KindShape> {
  const shapes = new Map<string, KindShape>();
  for (const [kind, spec] of Object.entries(document.kinds)) {
    const computed = parsedComputed(spec);
    shapes.set(kind, {
      fields: new Set(Object.keys(spec.fields)),
      edges: new Map(Object.entries(spec.edges ?? {}).map(([name, e]) => [name, e.cardinality ?? "many"])),
      ...(computed ? { computed } : {}),
    });
  }
  return shapes;
}

/** The effects an act's shorthands mean, in order. */
export function effectsOf(act: ActSpec, document: GraviewDocument): readonly EffectSpec[] {
  // Shorthands first, then any listed effects: an act may say "writes quote" and also set a status.
  const effects: EffectSpec[] = [];
  if (act.creates) {
    const kind = document.kinds[act.creates];
    const set: Record<string, ValueSpec> = {};
    for (const field of Object.keys(kind?.fields ?? {})) set[field] = `$${field}`;
    // Fields a later effect fills in on the new record are part of making it, not questions to ask.
    for (const e of act.effects ?? []) if ("set" in e && !("create" in e) && refName(e.target) === "new") Object.assign(set, e.set);
    effects.push({ create: act.creates, as: "new", set });
  }
  if (act.sets) effects.push({ set: act.sets });
  // An act that makes a record already asks for each of its fields: `writes` beside `creates` (and no `on`) names some of them again, not a subject.
  if (act.writes && !(act.creates && act.on === undefined)) effects.push({ set: Object.fromEntries(act.writes.map((f) => [f, `$${f}`])) });
  if (act.connects) effects.push({ connect: act.connects, from: "$subject", to: "$to" });
  if (act.severs) effects.push({ sever: act.severs, from: "$subject", to: "$to" });
  if (act.removes) effects.push({ remove: "$subject" });
  if (act.effects) effects.push(...act.effects.filter((e) => !(act.creates && "set" in e && !("create" in e) && refName(e.target) === "new")));
  return effects;
}

const refName = (v: unknown): string | undefined => (typeof v === "string" && /^\$[A-Za-z][A-Za-z0-9]*$/.test(v) ? v.slice(1) : undefined);

function tryExpr(source: string, path: string, findings: Finding[]): Expr | undefined {
  try {
    const expr = parseExpr(source);
    const shape = analyzeExpr(expr);
    for (const fn of shape.unknownFunctions) findings.push(error("unknown-function", path, `"${fn}" is not a function the rule language knows`, "see docs/declaration-document.md#expression-language"));
    return expr;
  } catch (e) {
    if (e instanceof ExprSyntaxError) {
      findings.push(error("expression", path, e.sentence + ` (at character ${e.at + 1})`));
      return undefined;
    }
    throw e;
  }
}

function tryTemplate(source: string, path: string, findings: Finding[]): readonly TemplatePart[] | undefined {
  try {
    return parseTemplate(source);
  } catch (e) {
    if (e instanceof TemplateError || e instanceof ExprSyntaxError) {
      findings.push(error("template", path, e instanceof ExprSyntaxError ? e.sentence : e.sentence));
      return undefined;
    }
    throw e;
  }
}

/** The document's own sentences: references that do not resolve, expressions that do not parse. */
function validate(document: GraviewDocument): Finding[] {
  const findings: Finding[] = [];
  const kinds = new Set(Object.keys(document.kinds));
  const edges = edgeIndex(document);
  const acts = document.acts ?? {};
  const roles = new Set(document.roles ?? []);

  for (const [kind, spec] of Object.entries(document.kinds)) {
    const at = `kinds.${kind}`;
    for (const [name, edge] of Object.entries(spec.edges ?? {})) {
      if (edge.to !== "*") for (const target of edge.to) if (!kinds.has(target)) findings.push(error("edge-target", `${at}.edges.${name}.to`, `"${target}" is not a kind this document declares`));
      if (spec.fields[name]) findings.push(error("edge-field-clash", `${at}.edges.${name}`, `"${name}" is both a field and a relation of ${kind}`, "rename one of them"));
    }
    if (spec.lifecycle && !spec.fields[spec.lifecycle.field]) findings.push(error("lifecycle-field", `${at}.lifecycle.field`, `${kind} has no field "${spec.lifecycle.field}"`));
    // A glance may say a computed field: the surfaces that draw a glance work it out over the seat's graph (FR-83).
    const computedHere = (name: string) => spec.computed !== undefined && Object.prototype.hasOwnProperty.call(spec.computed, name);
    for (const field of spec.glance ?? []) {
      if (!spec.fields[field] && !computedHere(field)) findings.push(error("glance-field", `${at}.glance`, `a glance at ${kind} is to say "${field}", and ${kind} has no field or computed field called that`, `use one of: ${[...Object.keys(spec.fields), ...Object.keys(spec.computed ?? {})].join(", ")}`));
    }
    for (const key of ["label", "describe"] as const) {
      const source = spec[key];
      if (!source) continue;
      const parts = tryTemplate(source, `${at}.${key}`, findings);
      for (const part of parts ?? []) {
        if (!part.expr) continue;
        for (const name of analyzeExpr(part.expr).names) {
          if (spec.fields[name]) continue;
          // A computed field worked out from the record alone is said like a field; one that reads beyond it cannot be, with no graph in hand.
          if (computedHere(name)) {
            if (!workedOutAlone(spec, name)) findings.push(error("template-field", `${at}.${key}`, `${kind}'s ${name} is worked out from beyond the record, and a ${key} is said with no graph to read`, `show it in a view instead, or name a computed field worked out from ${kind}'s own fields`));
            continue;
          }
          findings.push(error("template-field", `${at}.${key}`, `${kind} has no field "${name}" for its ${key} to show`, key === "label" ? "a label can only show the record's own fields and what they work out" : undefined));
        }
      }
    }
    for (const [field, f] of Object.entries(spec.fields)) {
      if (f.default !== undefined && f.type === "enum" && !f.options?.includes(String(f.default))) {
        findings.push(error("default-option", `${at}.fields.${field}.default`, `"${String(f.default)}" is not one of ${field}'s options`));
      }
    }
  }

  for (const [name, act] of Object.entries(acts)) {
    const at = `acts.${name}`;
    for (const kind of asArray(act.on)) if (!kinds.has(kind)) findings.push(error("act-kind", `${at}.on`, `"${kind}" is not a kind this document declares`));
    const subjectKinds = asArray(act.on);
    const effects = effectsOf(act, document);
    if (act.creates && act.on === undefined && act.writes && kinds.has(act.creates)) {
      for (const field of act.writes) {
        if (document.kinds[act.creates]!.fields[field]) continue;
        if (document.kinds[act.creates]!.computed?.[field] !== undefined) findings.push(error("computed-written", `${at}.writes`, `${act.creates}'s ${field} is worked out, not written: no act can set it`, "write the stored fields it is worked out from"));
        else findings.push(error("act-field", `${at}.writes`, `${act.creates} has no field "${field}"`));
      }
    }
    if (effects.length === 0) findings.push(error("act-empty", at, `"${name}" does nothing`, "give it effects or a shorthand such as sets or creates"));
    const created = new Map<string, string>();
    effects.forEach((effect, i) => {
      const shorthands = effects.length - (act.effects?.length ?? 0);
      const where = act.effects && i >= shorthands ? `${at}.effects.${i - shorthands}` : at;
      if ("create" in effect) {
        if (!kinds.has(effect.create)) findings.push(error("act-kind", `${where}.create`, `"${effect.create}" is not a kind this document declares`));
        else {
          for (const field of Object.keys(effect.set ?? {})) {
            if (document.kinds[effect.create]!.fields[field]) continue;
            if (document.kinds[effect.create]!.computed?.[field] !== undefined) findings.push(error("computed-written", `${where}.set.${field}`, `${effect.create}'s ${field} is worked out, not written: no act can set it`, "set the stored fields it is worked out from"));
            else findings.push(error("act-field", `${where}.set.${field}`, `${effect.create} has no field "${field}"`));
          }
        }
        if (effect.as) created.set(effect.as, effect.create);
      } else if ("connect" in effect || "sever" in effect) {
        const edgeName = "connect" in effect ? effect.connect : effect.sever;
        if (!edges.has(edgeName)) findings.push(error("act-edge", `${where}.${"connect" in effect ? "connect" : "sever"}`, `"${edgeName}" is not a relation any kind declares`));
        if (refName(effect.from) === "subject" && subjectKinds.length === 0) findings.push(error("act-subject", `${at}.on`, `"${name}" acts on "$subject" but does not say which kinds it is "on"`));
      } else if ("set" in effect) {
        const target = refName(effect.target ?? "$subject");
        const targetKinds = target === "subject" ? subjectKinds : created.has(target ?? "") ? [created.get(target!)!] : [];
        if (target === "subject" && subjectKinds.length === 0) findings.push(error("act-subject", `${at}.on`, `"${name}" changes "$subject" but does not say which kinds it is "on"`));
        for (const field of Object.keys(effect.set)) {
          for (const kind of targetKinds) {
            if (!kinds.has(kind) || document.kinds[kind]!.fields[field]) continue;
            if (document.kinds[kind]!.computed?.[field] !== undefined) findings.push(error("computed-written", `${where}.set.${field}`, `${kind}'s ${field} is worked out, not written: no act can set it`, "set the stored fields it is worked out from"));
            else findings.push(error("act-field", `${where}.set.${field}`, `${kind} has no field "${field}"`));
          }
        }
      } else if ("remove" in effect) {
        if (refName(effect.remove) === "subject" && subjectKinds.length === 0) findings.push(error("act-subject", `${at}.on`, `"${name}" removes "$subject" but does not say which kinds it is "on"`));
      }
      const values = "set" in effect && effect.set ? Object.values(effect.set) : [];
      values.forEach((v) => {
        if (v && typeof v === "object" && !Array.isArray(v) && "expr" in v) tryExpr(v.expr, `${where}.set`, findings);
      });
    });
    if (act.allowedWhen) tryExpr(act.allowedWhen, `${at}.allowedWhen`, findings);
    if (act.refusal) tryTemplate(act.refusal, `${at}.refusal`, findings);
  }

  for (const [name, rule] of Object.entries(document.rules ?? {})) {
    const at = `rules.${name}`;
    if (rule.over !== "graph" && !kinds.has(rule.over)) findings.push(error("rule-kind", `${at}.over`, `"${rule.over}" is not a kind this document declares`));
    const spec = rule.over === "graph" ? undefined : document.kinds[rule.over];
    for (const key of ["when", "require"] as const) {
      const source = rule[key];
      if (!source) continue;
      const expr = tryExpr(source, `${at}.${key}`, findings);
      if (!expr) continue;
      const shape = analyzeExpr(expr);
      for (const n of shape.names) {
        if (rule.over === "graph") findings.push(error("rule-name", `${at}.${key}`, `"${n}" means nothing in a rule over the whole graph`, "name a kind in \"over\", or use all('kind')"));
        else if (spec && !spec.fields[n] && !spec.edges?.[n] && spec.computed?.[n] === undefined) {
          const hyphenated = Object.keys(spec.edges ?? {}).find((e) => e.includes("-") && e.split("-").includes(n));
          findings.push(error("rule-name", `${at}.${key}`, `${rule.over} has no field or relation called "${n}"`, hyphenated ? `"${hyphenated}" reads as a subtraction in a rule; rename the relation to one camelCase word, like "${hyphenated.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())}"` : undefined));
        }
      }
      for (const e of shape.edges) if (!edges.has(e)) findings.push(error("rule-edge", `${at}.${key}`, `"${e}" is not a relation any kind declares`));
      for (const k of shape.sweeps) {
        if (!kinds.has(k)) findings.push(error("rule-kind", `${at}.${key}`, `"${k}" is not a kind this document declares`));
        else if (rule.over !== "graph") findings.push(warning("rule-cost", `${at}.${key}`, `this rule looks at every ${k} for every ${rule.over}, which grows slowly as the app grows`, "walk a relation with out()/in() instead of all() where you can"));
      }
    }
    if (rule.says) tryTemplate(rule.says, `${at}.says`, findings);
    (rule.repairs ?? []).forEach((repair, i) => {
      if (!acts[repair.act] && !/^(edit|remove)-/.test(repair.act)) findings.push(error("repair-act", `${at}.repairs.${i}.act`, `"${repair.act}" is not an act this document declares`));
    });
  }

  const policy = document.policy;
  if (policy) {
    policy.grants.forEach((grant, i) => {
      if (grant.roles !== "*" && roles.size > 0) for (const r of grant.roles) if (!roles.has(r)) findings.push(error("grant-role", `policy.grants.${i}.roles`, `"${r}" is not one of the document's roles`));
      if (grant.mutations !== "*") for (const m of grant.mutations) if (!acts[m] && !/^(edit|remove)-/.test(m)) findings.push(error("grant-act", `policy.grants.${i}.mutations`, `"${m}" is not an act this document declares`));
    });
    (policy.sees ?? []).forEach((sight, i) => {
      for (const k of sight.kinds) if (!kinds.has(k)) findings.push(error("sight-kind", `policy.sees.${i}.kinds`, `"${k}" is not a kind this document declares`));
      if (sight.roles !== "*" && roles.size > 0) for (const r of sight.roles) if (!roles.has(r)) findings.push(error("sight-role", `policy.sees.${i}.roles`, `"${r}" is not one of the document's roles`));
    });
  }
  findings.push(...validateViews(document));
  findings.push(
    ...validateComputed(
      new Map(Object.entries(document.kinds).map(([kind, spec]) => [kind, { fields: new Set(Object.keys(spec.fields)), edges: new Set(Object.keys(spec.edges ?? {})), computed: computedOf(spec) }])),
      (kind, name) => `kinds.${kind}.computed.${name}`,
    ),
  );
  return findings;
}

/*
 * A FIELD'S SCHEMA, in zod/mini (schema/zod.ts): a page that compiles a
 * document in the browser pays for the checks it calls, not for classic
 * zod whole (FR-57). The checks, their messages and their definitions are
 * the ones classic's methods make.
 */
function fieldSchema(spec: FieldSpec, optional: boolean): z.ZodMiniType {
  let schema: z.ZodMiniType;
  switch (spec.type) {
    case "string":
      schema = z.string().check(z.maxLength(500));
      break;
    case "text":
      schema = z.string().check(z.maxLength(20_000));
      break;
    case "number":
      schema = z.number();
      break;
    case "integer":
      schema = z.number().check(z.int());
      break;
    case "boolean":
      schema = z.boolean();
      break;
    case "date":
      schema = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/, "a date like 2026-10-02"));
      break;
    case "datetime":
      schema = z.string().check(z.refine((s: string) => !Number.isNaN(Date.parse(s)), "a date and time like 2026-10-02T14:30:00Z"));
      break;
    case "enum":
      schema = z.enum(spec.options as [string, ...string[]]);
      break;
    case "list":
      schema = z.array(spec.of === "number" ? z.number() : spec.of === "date" ? z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/)) : z.string().check(z.maxLength(500))).check(z.maxLength(200));
      break;
    case "url":
      schema = z.url();
      break;
    case "email":
      schema = z.email();
      break;
  }
  if (spec.description) schema = schema.check(z.describe(spec.description));
  return optional ? z.optional(schema) : schema;
}

/** What one of these is called, when the kind says nothing: the first required word-ish field. */
function defaultLabelField(spec: KindSpec): string | undefined {
  const entries = Object.entries(spec.fields);
  return (
    entries.find(([, f]) => f.required && (f.type === "string" || f.type === "text"))?.[0] ??
    entries.find(([, f]) => f.type === "string")?.[0]
  );
}

interface ActArg {
  readonly schema: z.ZodMiniType;
  readonly required: boolean;
}

/** The arguments an act asks for: declared ones, then whatever its effects reference. */
function argsOf(name: string, act: ActSpec, effects: readonly EffectSpec[], document: GraviewDocument, edges: Map<string, EdgeInfo>): Map<string, ActArg> {
  const args = new Map<string, ActArg>();
  const subjectKinds = asArray(act.on);
  const created = new Map<string, string>();
  const usesSubject =
    subjectKinds.length > 0 ||
    effects.some((e) => ("remove" in e && refName(e.remove) === "subject") || ("from" in e && (refName(e.from) === "subject" || refName(e.to) === "subject")) || ("set" in e && !("create" in e) && refName(e.target ?? "$subject") === "subject"));
  if (usesSubject) args.set(SUBJECT_ARG, { schema: refTo(subjectKinds.length > 0 ? subjectKinds : "*"), required: true });

  const declared = act.args ?? {};
  const writesOnlyOne = act.writes?.length === 1;
  const note = (arg: string, schema: () => ActArg) => {
    if (arg === SUBJECT_ARG || BUILTIN_REFS.has(arg) || created.has(arg) || args.has(arg)) return;
    const d = declared[arg];
    args.set(arg, d ? { schema: fieldSchema(d, !d.required), required: Boolean(d.required) } : schema());
  };
  for (const effect of effects) {
    if ("create" in effect) {
      const kind = document.kinds[effect.create];
      for (const [field, value] of Object.entries(effect.set ?? {})) {
        const arg = refName(value);
        const spec = kind?.fields[field];
        if (arg && spec) {
          const required = Boolean(spec.required) && spec.default === undefined;
          note(arg, () => ({ schema: fieldSchema(spec, !required), required }));
        }
      }
      if (effect.as) created.set(effect.as, effect.create);
    } else if ("connect" in effect || "sever" in effect) {
      const edge = edges.get("connect" in effect ? effect.connect : effect.sever);
      for (const [end, value] of [["from", effect.from], ["to", effect.to]] as const) {
        const arg = refName(value);
        if (!arg) continue;
        const kinds = end === "to" ? edge?.to ?? "*" : edge?.from ?? "*";
        note(arg, () => ({ schema: refTo(kinds === "*" ? "*" : kinds), required: true }));
      }
    } else if ("set" in effect) {
      const target = refName(effect.target ?? "$subject");
      const targetKind = target === "subject" ? subjectKinds[0] : created.get(target ?? "");
      if (target && target !== "subject" && !created.has(target)) note(target, () => ({ schema: refTo("*"), required: true }));
      for (const [field, value] of Object.entries(effect.set)) {
        const arg = refName(value);
        if (!arg) continue;
        const spec = targetKind ? document.kinds[targetKind]?.fields[field] : undefined;
        note(arg, () => (spec ? { schema: fieldSchema(spec, !writesOnlyOne), required: writesOnlyOne } : { schema: z.optional(z.unknown()), required: false }));
      }
    } else if ("remove" in effect) {
      const arg = refName(effect.remove);
      if (arg) note(arg, () => ({ schema: refTo("*"), required: true }));
    }
  }
  for (const [arg, d] of Object.entries(declared)) if (!args.has(arg)) args.set(arg, { schema: fieldSchema(d, !d.required), required: Boolean(d.required) });
  void name;
  return args;
}

class Refused extends Error {}

/**
 * A document, compiled and judged: its own sentences, then the framework's
 * `checkApp` over the app it compiles to — what a host does with a document
 * it is handed, and what `graview check` says of one.
 */
export function compileDocument(raw: unknown, options: CompileOptions = {}): CompiledDocument | RefusedDocument {
  const compiled = compileDocumentWithoutCheck(raw, options);
  if (!compiled.ok) return compiled;
  const { app, document } = compiled;
  const findings: Finding[] = [...compiled.findings];
  const check = checkApp(app);
  for (const f of check.findings) {
    const finding = { severity: f.severity === "error" ? "error" : f.severity === "warning" ? "warning" : "note", code: `check:${f.code}`, path: frameworkPath(f.where, document), message: f.message, ...(f.fix ? { fix: f.fix } : {}) } as const;
    // The document already said it, at the same path (a blocks lens's words are held by both): once is enough.
    if (compiled.findings.some((said) => said.code === f.code && said.path === finding.path)) continue;
    findings.push(f.code === "glance-unchosen" ? inDocumentWords(finding, f.where, document) : finding);
  }
  if (hasErrors(findings)) return { ok: false, findings };
  return { ...compiled, findings };
}

/**
 * A DOCUMENT COMPILED WITHOUT THE FRAMEWORK'S CHECKER: its own sentences
 * still judged, `checkApp` not asked. For a page drawing a document its host
 * has already judged — Graview Cloud's shell compiles in the browser what the
 * room checked when it was kept — and for a test that wants the app and not
 * the verdict. The checker is the whole of `graview check`; a page that
 * calls only this does not carry it (FR-57).
 */
export function compileDocumentWithoutCheck(raw: unknown, options: CompileOptions = {}): CompiledDocument | RefusedDocument {
  const read = readDocument(raw);
  if (!read.document || hasErrors(read.findings)) return { ok: false, findings: read.findings };
  const document = read.document;
  const findings: Finding[] = [...read.findings];
  if (options.previous) findings.push(...renamesFromNothing(document, options.previous));
  const today = options.today ?? (() => new Date().toISOString().slice(0, 10));
  const shapes = kindShapes(document);
  const edges = edgeIndex(document);

  // ── kinds ────────────────────────────────────────────────────────────────
  const definitions = Object.entries(document.kinds).map(([kind, spec]) => {
    const shape: Record<string, z.ZodMiniType> = {};
    for (const [field, f] of Object.entries(spec.fields)) shape[field] = fieldSchema(f, !f.required);
    const labelSource = spec.label ?? (defaultLabelField(spec) ? `{${defaultLabelField(spec)}}` : undefined);
    const labelParts = labelSource ? parseTemplate(labelSource) : undefined;
    const describeParts = spec.describe ? parseTemplate(spec.describe) : undefined;
    const computed = computedOf(spec);
    // A computed field's words are said like a field's: its label, where it has one.
    const labels = Object.fromEntries([
      ...Object.entries(spec.fields).filter(([, f]) => f.label).map(([n, f]) => [n, f.label!]),
      ...[...computed].filter(([, c]) => c.label).map(([n, c]) => [n, c.label!]),
    ]);
    // Defaults stay out of the zod schema (hydration must not invent values) and ride beside it, for a repair to read.
    const defaults = Object.fromEntries(Object.entries(spec.fields).filter(([, f]) => f.default !== undefined).map(([n, f]) => [n, f.default]));
    const edgeDecls = Object.fromEntries(
      Object.entries(spec.edges ?? {}).map(([n, e]) => [
        n,
        {
          to: e.to,
          ...(e.cardinality ? { cardinality: e.cardinality } : {}),
          ...(e.description ? { description: e.description } : {}),
          ...(e.inverse ? { inverse: e.inverse } : {}),
          ...(e.appendOnly ? { appendOnly: e.appendOnly } : {}),
        },
      ]),
    );
    return defineNode(kind, {
      fields: z.object(shape) as never,
      edges: edgeDecls,
      ...(spec.plural ? { plural: spec.plural } : {}),
      ...(spec.noun ? { noun: spec.noun } : {}),
      ...(spec.description ? { description: spec.description } : {}),
      ...(labelParts ? { label: (node: { id: string }) => renderTemplate(labelParts, { node: node as AnyGraphNode, kinds: shapes, today: today() }) || node.id } : {}),
      ...(describeParts ? { describe: (node: { id: string }) => renderTemplate(describeParts, { node: node as AnyGraphNode, kinds: shapes, today: today() }) } : {}),
      ...(spec.lifecycle ? { lifecycle: { field: spec.lifecycle.field, retired: spec.lifecycle.retired } } : {}),
      ...(spec.figure ? { figure: spec.figure } : {}),
      ...(spec.computed && Object.keys(spec.computed).length > 0 ? { computed: spec.computed } : {}),
      ...(Object.keys(labels).length > 0 || spec.glance ? { display: { ...(Object.keys(labels).length > 0 ? { labels } : {}), ...(spec.glance ? { glance: [...spec.glance] } : {}) } } : {}),
      ...(Object.keys(defaults).length > 0 ? { defaults } : {}),
    } as never);
  });
  const schema = createSchema(definitions as never);

  // ── acts ─────────────────────────────────────────────────────────────────
  const mutations: AnyMutationDefinition[] = [];
  for (const [name, act] of Object.entries(document.acts ?? {})) {
    const effects = effectsOf(act, document);
    const args = argsOf(name, act, effects, document, edges);
    const shape: Record<string, z.ZodMiniType> = {};
    for (const [arg, a] of args) shape[arg] = a.schema;
    const subjectKinds = asArray(act.on);
    const title = act.title ?? name.replace(/-/g, " ");
    const guard = act.allowedWhen ? parseExpr(act.allowedWhen) : undefined;
    const refusal = act.refusal ? parseTemplate(act.refusal) : undefined;
    const destructive = act.destructive ?? effects.some((e) => "remove" in e || "sever" in e);
    const creates = [...new Set(effects.flatMap((e) => ("create" in e ? [e.create] : [])))];
    const connects = [...new Set(effects.flatMap((e) => ("connect" in e ? [e.connect] : [])))];
    const severs = [...new Set(effects.flatMap((e) => ("sever" in e ? [e.sever] : [])))];
    // An act WRITES only what it sets on its subject; setting fields on a record it just made is part of making it.
    const writes = [...new Set(effects.flatMap((e) => ("set" in e && !("create" in e) && (refName(e.target ?? "$subject") === "subject") ? Object.keys(e.set) : [])))];
    /*
     * Twice is once when nothing is made and every value set is given
     * (a literal or an argument), never computed from what is there.
     */
    const idempotent =
      creates.length === 0 &&
      effects.every((e) => !("set" in e) || !e.set || Object.values(e.set).every((v) => !(v && typeof v === "object" && !Array.isArray(v) && "expr" in v)));
    const exprs = new Map<string, Expr>();
    for (const effect of effects) {
      if (!("set" in effect) || !effect.set) continue;
      for (const v of Object.values(effect.set)) if (v && typeof v === "object" && !Array.isArray(v) && "expr" in v) exprs.set(v.expr, parseExpr(v.expr));
    }

    mutations.push(
      defineMutation(name, {
        input: z.object(shape) as never,
        title,
        ...(act.description ? { description: act.description } : {}),
        ...(act.fromTheOtherEnd ? { fromTheOtherEnd: act.fromTheOtherEnd } : {}),
        ...(args.has(SUBJECT_ARG) ? { subject: { kinds: subjectKinds.length > 0 ? subjectKinds : "*", arg: SUBJECT_ARG } } : {}),
        ...(destructive ? { destructive: true } : {}),
        ...(idempotent ? { idempotent: true } : {}),
        ...(creates.length > 0 ? { creates } : {}),
        ...(connects.length > 0 ? { connects } : {}),
        ...(severs.length > 0 ? { severs } : {}),
        ...(writes.length > 0 ? { writes } : {}),
        describe: (input: Record<string, unknown>, graph: GraphReader) => {
          const subject = typeof input[SUBJECT_ARG] === "string" ? graph.getNode(input[SUBJECT_ARG] as string) : undefined;
          const what = subject ? labelFor(subject) : Object.values(input).find((v) => typeof v === "string");
          return what ? `${title}: ${String(what)}` : title;
        },
        apply(context: MutationContext<never>, input: Record<string, unknown>) {
          const graph = context.graph as unknown as GraphReader;
          const subjectId = typeof input[SUBJECT_ARG] === "string" ? (input[SUBJECT_ARG] as string) : undefined;
          const subject = subjectId ? graph.getNode(subjectId) : undefined;
          if (subjectId && !subject) throw new Refused(`there is no record "${subjectId}"`);
          if (subject && subjectKinds.length > 0 && !subjectKinds.includes(subject.kind)) throw new Refused(`"${title}" acts on ${subjectKinds.join(" or ")}, not on ${withArticle(subject.kind)}`);
          const bindings: Record<string, Value> = {};
          for (const [k, v] of Object.entries(input)) if (v !== undefined) bindings[k] = v as Value;
          if (guard && subject) {
            let allowed: Value;
            try {
              allowed = evaluateExpr(guard, { graph, subject, kinds: shapes, bindings, today: today() });
            } catch (e) {
              if (e instanceof ExprEvalError) throw new Refused(`"${title}" could not be judged: ${e.sentence}`);
              throw e;
            }
            if (allowed !== true) {
              throw new Refused(refusal ? renderTemplate(refusal, { node: subject, kinds: shapes, graph, bindings, today: today() }) : `"${title}" is not allowed for ${labelFor(subject)} right now`);
            }
          }
          const made = new Map<string, string>();
          const resolve = (value: ValueSpec, current: AnyGraphNode | undefined): unknown => {
            if (value && typeof value === "object" && !Array.isArray(value) && "expr" in value) {
              try {
                return evaluateExpr(exprs.get(value.expr)!, { graph, subject: current ?? subject ?? null, kinds: shapes, bindings, today: today() });
              } catch (e) {
                if (e instanceof ExprEvalError) throw new Refused(`"${title}" could not work out a value: ${e.sentence}`);
                throw e;
              }
            }
            const ref = refName(value);
            if (ref === undefined) return typeof value === "string" && value.startsWith("$$") ? value.slice(1) : value;
            if (ref === "subject") return subjectId;
            if (ref === "now") return new Date().toISOString();
            if (ref === "today") return today();
            if (made.has(ref)) return made.get(ref);
            return input[ref];
          };
          for (const effect of effects) {
            if ("create" in effect) {
              const kind = document.kinds[effect.create]!;
              const node: Record<string, unknown> = { kind: effect.create };
              for (const [field, f] of Object.entries(kind.fields)) if (f.default !== undefined) node[field] = f.default;
              for (const [field, value] of Object.entries(effect.set ?? {})) {
                const v = resolve(value, undefined);
                if (v !== undefined) node[field] = v;
              }
              const labelField = defaultLabelField(kind);
              const id = context.freshId(String((labelField && node[labelField]) ?? effect.create), effect.create);
              context.addNode({ id, ...node } as never);
              if (effect.as) made.set(effect.as, id);
            } else if ("connect" in effect || "sever" in effect) {
              const kind = "connect" in effect ? effect.connect : effect.sever;
              const from = String(resolve(effect.from, undefined) ?? "");
              const to = String(resolve(effect.to, undefined) ?? "");
              if (!graph.has(from) && ![...made.values()].includes(from)) throw new Refused(`there is no record "${from}"`);
              if (!graph.has(to) && ![...made.values()].includes(to)) throw new Refused(`there is no record "${to}"`);
              if ("connect" in effect) {
                if (edges.get(kind)?.cardinality === "one") for (const existing of graph.out(from, kind)) if (existing.id !== to) context.removeEdge({ kind, from, to: existing.id });
                if (!graph.out(from, kind).some((n) => n.id === to)) context.addEdge({ kind, from, to });
              } else {
                context.removeEdge({ kind, from, to });
              }
            } else if ("set" in effect) {
              const targetId = String(resolve(effect.target ?? "$subject", undefined) ?? "");
              const target = graph.getNode(targetId);
              if (!target && ![...made.values()].includes(targetId)) throw new Refused(`there is no record "${targetId}"`);
              const patch: Record<string, unknown> = {};
              for (const [field, value] of Object.entries(effect.set)) {
                const v = resolve(value, target);
                if (v !== undefined) patch[field] = v;
              }
              if (Object.keys(patch).length > 0) context.patchNode(targetId, patch);
            } else if ("remove" in effect) {
              const id = String(resolve(effect.remove, undefined) ?? "");
              if (!graph.has(id)) throw new Refused(`there is no record "${id}"`);
              context.removeNode(id);
            }
          }
        },
      } as never) as AnyMutationDefinition,
    );
  }

  function labelFor(node: AnyGraphNode): string {
    const definition = (schema as unknown as { tryDefinition(kind: string): { label?: (n: unknown) => string } | undefined }).tryDefinition(node.kind);
    return definition?.label?.(node) ?? node.id;
  }

  // ── rules ────────────────────────────────────────────────────────────────
  const invariants: InvariantDefinition[] = [];
  for (const [name, rule] of Object.entries(document.rules ?? {})) {
    const require = parseExpr(rule.require);
    const when = rule.when ? parseExpr(rule.when) : undefined;
    const says = rule.says ? parseTemplate(rule.says) : undefined;
    const title = rule.title ?? name.replace(/-/g, " ");
    const repairs = rule.repairs ?? [];
    const judge = (graph: GraphReader, subject: AnyGraphNode | null): Violation[] => {
      const ctx = { graph, subject, kinds: shapes, today: today() };
      let holds: boolean;
      /*
       * A RULE THAT CANNOT ANSWER IS THE ENGINE'S TO SAY (FR-29). Out of
       * budget it throws RuleBudgetError, and the violation's status is
       * `over-budget`; any other mistake (a word added to a number) is
       * `could-not-judge`. Both name the rule and its subject, and neither
       * is a hang or a crash that takes the other rules down.
       */
      try {
        if (when && evaluateExpr(when, ctx) !== true) return [];
        holds = evaluateExpr(require, ctx) === true;
      } catch (e) {
        if (e instanceof ExprBudgetError) throw new RuleBudgetError(e.sentence);
        if (e instanceof ExprEvalError) throw new Error(e.sentence);
        throw e;
      }
      if (holds) return [];
      const repairList: Repair[] = repairs.flatMap((r) => {
        const act = document.acts?.[r.act];
        const args: Record<string, unknown> = {};
        if (subject && (act?.on || /^(edit|remove)-/.test(r.act))) args[SUBJECT_ARG] = subject.id;
        for (const [k, v] of Object.entries(r.args ?? {})) args[k] = refName(v) === "subject" ? subject?.id : v;
        const declared = act ? argsOf(r.act, act, effectsOf(act, document), document, edges) : new Map<string, ActArg>();
        const missing = [...declared].filter(([k, a]) => a.required && args[k] === undefined).map(([k]) => k);
        return [{ mutation: r.act, label: r.label ?? act?.title ?? r.act.replace(/-/g, " "), args, ...(missing.length > 0 ? { missing } : {}) }];
      });
      return [
        {
          invariant: name,
          ...(subject ? { subjectId: subject.id } : {}),
          label: title,
          message: (says ? renderTemplate(says, { node: subject, kinds: shapes, graph, today: today() }) : subject ? `${labelFor(subject)}: ${title}` : title),
          nodeIds: subject ? [subject.id] : [],
          repairs: repairList,
        },
      ];
    };
    invariants.push(
      (rule.over === "graph"
        ? defineInvariant(name, {
            scope: "graph",
            label: title,
            judgement: { require: rule.require, ...(rule.when ? { when: rule.when } : {}), ...(rule.says ? { says: rule.says } : {}) },
            ...(rule.description ? { description: rule.description } : {}),
            ...(repairs.length > 0 ? { repairs: repairs.map((r) => r.act) } : {}),
            evaluate: ({ graph }: { graph: unknown }) => judge(graph as GraphReader, null),
          } as never)
        : defineInvariant(name, {
            scope: { kind: rule.over },
            label: title,
            judgement: { require: rule.require, ...(rule.when ? { when: rule.when } : {}), ...(rule.says ? { says: rule.says } : {}) },
            ...(rule.description ? { description: rule.description } : {}),
            ...(repairs.length > 0 ? { repairs: repairs.map((r) => r.act) } : {}),
            evaluate: ({ graph, subject }: { graph: unknown; subject: unknown }) => judge(graph as GraphReader, subject as AnyGraphNode),
          } as never)) as InvariantDefinition,
    );
  }

  // ── policy, brand, the rest ──────────────────────────────────────────────
  /*
   * WHO SEES WHAT is the app's, in the framework's one meaning (FR-02):
   * absent, everybody sees everything; present, a kind no sight names is
   * seen by nobody but the system, and `own` is the principal's own records.
   */
  const policy: Policy | undefined = document.policy
    ? {
        grants: document.policy.grants as Policy["grants"],
        ...(document.policy.sees ? { sees: document.policy.sees as Policy["sees"] } : {}),
        ...(document.roles ? { roles: document.roles } : {}),
      }
    : undefined;

  let brand: Brand | undefined;
  if (document.brand) {
    const derived = brandFromAccent({ accent: document.brand.accent, base: SCHEMES as never });
    if (derived.ok) brand = { name: document.brand.name ?? document.name, schemes: derived.schemes };
    // A colour that cannot be read is not a reason to refuse an app: it wears the default colours and says why.
    else findings.push(warning("brand", "brand.accent", `that accent cannot make a readable brand, so the app keeps Graview's colours: ${derived.why}`, "pick a colour further from orange-red, or a darker one"));
  }
  if (hasErrors(findings)) return { ok: false, findings };

  const app: GraviewApp = {
    name: document.name,
    schema,
    mutations,
    invariants,
    ...(policy ? { policy } : {}),
    ...(brand ? { brand } : {}),
    ...(document.modules ? { modules: document.modules as never } : {}),
    ...(document.lenses ? { lenses: document.lenses as never } : {}),
    // The arrangement is the app's (FR-80): every face reads it beside the places.
    ...(document.pages ? { pages: document.pages as never } : {}),
    ...(document.settings ? { settings: document.settings as never } : {}),
    // The document's views are the declaration's view specs (FR-03): data the framework draws.
    ...(Object.keys(viewsOf(document)).length > 0 ? { viewSpecs: viewsOf(document) as never } : {}),
    // And its home view, about no one record, is the app's home (FR-81).
    ...(homeOf(document) ? { home: homeOf(document) as never } : {}),
    version: document.version ?? 1,
  };

  // `toDocument(app)` gives this document back, byte for byte.
  rememberDocument(app, document);
  return { ok: true, app, document, findings, sights: document.policy?.sees, kinds: shapes };
}

/** Map a framework check's "where" (a kind, an act, a rule by name) back to a document path when we can. */
function frameworkPath(where: string, document: GraviewDocument): string {
  const word = where.split(/[\s:·]/).find((w) => w.length > 0) ?? where;
  if (document.kinds[word]) return `kinds.${word}`;
  if (document.acts?.[word]) return `acts.${word}`;
  if (document.rules?.[word]) return `rules.${word}`;
  return where;
}

/**
 * The check tells a TypeScript author to write `display: { glance }`; a
 * document's author writes `kinds.<kind>.glance` (FR-39) — the same choice
 * and the same first three, in the words of the format they hold.
 */
function inDocumentWords(finding: Finding, where: string, document: GraviewDocument): Finding {
  const kind = /^defineNode\("([^"]+)"\)/.exec(where)?.[1];
  const spec = kind ? document.kinds[kind] : undefined;
  if (!kind || !spec) return finding;
  const first = Object.keys(spec.fields).filter((field) => field !== "label").slice(0, 3);
  return { ...finding, path: `kinds.${kind}.glance`, fix: `Say which: "glance": [${first.map((field) => `"${field}"`).join(", ")}] on kinds.${kind} — the facts a person compares one by, at a glance.` };
}

export { Refused as ActRefusal };

/** Every `renamedFrom` that names nothing in the version before: the values it was meant to carry would be lost. */
function renamesFromNothing(document: GraviewDocument, previous: GraviewDocument): Finding[] {
  const out: Finding[] = [];
  const previousEdges = new Set(Object.values(previous.kinds).flatMap((kind) => Object.keys(kind.edges ?? {})));
  for (const [kind, spec] of Object.entries(document.kinds)) {
    const from = (spec as { renamedFrom?: string }).renamedFrom;
    if (from && !previous.kinds[from]) out.push(error("renamed-from-nothing", `kinds.${kind}.renamedFrom`, `${kind} says it was ${from}, and the previous version has no kind called ${from}`, "name the kind it was, or drop renamedFrom"));
    const before = previous.kinds[from ?? kind];
    for (const [field, fieldSpec] of Object.entries(spec.fields)) {
      const was = (fieldSpec as { renamedFrom?: string }).renamedFrom;
      if (was && !before?.fields[was]) out.push(error("renamed-from-nothing", `kinds.${kind}.fields.${field}.renamedFrom`, `${field} says it was ${was}, and the previous ${from ?? kind} has no field called ${was}`, "name the field it was, or drop renamedFrom"));
    }
    for (const [edge, edgeSpec] of Object.entries(spec.edges ?? {})) {
      const was = (edgeSpec as { renamedFrom?: string }).renamedFrom;
      if (was && !previousEdges.has(was)) out.push(error("renamed-from-nothing", `kinds.${kind}.edges.${edge}.renamedFrom`, `${edge} says it was ${was}, and the previous version has no relation called ${was}`, "name the relation it was, or drop renamedFrom"));
    }
  }
  return out;
}
