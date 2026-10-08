import { brandOf } from "./brand.js";
import { ActRefusal } from "../refused.js";
import { analyzeExpr } from "./expr/analyze.js";
import type { KindShape } from "./expr/evaluate.js";
import { ExprSyntaxError, parseExpr, type Expr } from "./expr/parse.js";
import { error, hasErrors, warning, type Finding } from "./findings.js";
import {
  DocumentSpec,
  MAX_DOCUMENT_BYTES,
  type ActSpec,
  type EffectSpec,
  type FieldSpec,
  type GraviewDocument,
  type ValueSpec,
} from "./schema.js";
import type { TemplatePart } from "./template.js";
import { parseTemplate, TemplateError } from "./template-parse.js";
import { upgradeDocument } from "./upgrade.js";
import { homeOf, validateViews, viewsOf } from "./views.js";
import { farEnd } from "./far-end.js";
import { computedOf, parsedComputed, validateComputed, workedOutAlone } from "./computed.js";
import { pageFieldFindings } from "./page-fields.js";
import {
  build,
  COMPILED_FORMAT,
  defaultLabelField,
  refName,
  SUBJECT_ARG,
  type ActEffect,
  type ActPlan,
  type ArgPlan,
  type CompiledApp,
  type CompiledDocument,
  type EdgePlan,
  type KindPlan,
  type RefusedDocument,
  type RulePlan,
} from "./compiled.js";

export type { ActEffect, CompiledDocument, RefusedDocument, ReplaceEffect } from "./compiled.js";

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
 *
 * Two halves (FR-123): this module reads and judges a document and says
 * what it compiles to as data, `CompiledApp`; `compiled.ts` builds the app
 * from that data, and is all a page handed a compiled app carries.
 */

export interface CompileOptions {
  /** The clock rules read as today(); injectable for tests. */
  readonly today?: () => string;
  /**
   * The version this one follows. Given, every `renamedFrom` must name a
   * kind, field or relation that version has — a rename from nothing moves
   * nothing, and the values it was meant to keep would be dropped (FR-22).
   */
  readonly previous?: GraviewDocument;
  /**
   * Web fonts this host serves itself, beyond `DOCUMENT_FONTS` (FR-124):
   * a document's `brand.typography` may name these too. Read by the
   * checked compile (`@graview/core/check`); a page draws what it is given.
   */
  readonly fonts?: readonly string[];
}

const BUILTIN_REFS = new Set(["subject", "now", "today"]);

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
export function effectsOf(act: ActSpec, document: GraviewDocument): readonly ActEffect[] {
  // Shorthands first, then any listed effects: an act may say "writes quote" and also set a status.
  const effects: ActEffect[] = [];
  const subject = asArray(act.on);
  // A relation joins its subject from whichever end the declaration puts it (FR-115): `owns` on a component links from the person given.
  const link = (relation: string, verb: "connect" | "sever"): EffectSpec => {
    const reversed = farEnd(document.kinds, relation, subject)?.reversed === true;
    const [from, to] = reversed ? ["$to", "$subject"] : ["$subject", "$to"];
    return verb === "connect" ? { connect: relation, from, to } : { sever: relation, from, to };
  };
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
  if (act.connects) {
    if (act.replaces) effects.push({ replace: act.replaces === true ? [act.connects] : [...act.replaces], keep: act.connects });
    effects.push(link(act.connects, "connect"));
  }
  if (act.severs) effects.push(link(act.severs, "sever"));
  // What it sets on the record at the other end (FR-115): that record is its `$to`.
  if (act.setsOther && (act.connects || act.severs)) effects.push({ set: act.setsOther, target: "$to" });
  if (act.removes) effects.push({ remove: "$subject" });
  if (act.effects) effects.push(...act.effects.filter((e) => !(act.creates && "set" in e && !("create" in e) && refName(e.target) === "new")));
  return effects;
}

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
    findings.push(...pageFieldFindings(kind, spec));
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

/** The arguments an act asks for: declared ones, then whatever its effects reference. */
function argsOf(act: ActSpec, effects: readonly ActEffect[], document: GraviewDocument, edges: Map<string, EdgeInfo>): Map<string, ArgPlan> {
  const args = new Map<string, ArgPlan>();
  const subjectKinds = asArray(act.on);
  const created = new Map<string, string>();
  /** The kinds a record argument names, by argument: what a `set` on it (a `setsOther`) is checked against. */
  const named = new Map<string, readonly string[]>();
  const usesSubject =
    subjectKinds.length > 0 ||
    effects.some((e) => ("remove" in e && refName(e.remove) === "subject") || ("from" in e && (refName(e.from) === "subject" || refName(e.to) === "subject")) || ("set" in e && !("create" in e) && refName(e.target ?? "$subject") === "subject"));
  if (usesSubject) args.set(SUBJECT_ARG, { ref: subjectKinds.length > 0 ? subjectKinds : "*", required: true });

  const declared = act.args ?? {};
  const writesOnlyOne = act.writes?.length === 1;
  /*
   * A declared argument that fills a number field and says no range of its
   * own is asked for within the field's (FR-114): the form will not take
   * what the record would refuse.
   */
  const withRangeOf = (d: FieldSpec, fed: FieldSpec | undefined): FieldSpec =>
    fed && d.type === fed.type && d.min === undefined && d.max === undefined && d.step === undefined ? { ...d, ...(fed.min === undefined ? {} : { min: fed.min }), ...(fed.max === undefined ? {} : { max: fed.max }), ...(fed.step === undefined ? {} : { step: fed.step }) } : d;
  const note = (arg: string, schema: () => ArgPlan, fed?: FieldSpec) => {
    if (arg === SUBJECT_ARG || BUILTIN_REFS.has(arg) || created.has(arg) || args.has(arg)) return;
    const d = declared[arg] ? withRangeOf(declared[arg], fed) : undefined;
    args.set(arg, d ? { field: d, optional: !d.required, required: Boolean(d.required) } : schema());
  };
  for (const effect of effects) {
    if ("create" in effect) {
      const kind = document.kinds[effect.create];
      for (const [field, value] of Object.entries(effect.set ?? {})) {
        const arg = refName(value);
        const spec = kind?.fields[field];
        if (arg && spec) {
          const required = Boolean(spec.required) && spec.default === undefined;
          note(arg, () => ({ field: spec, optional: !required, required }), spec);
        }
      }
      if (effect.as) created.set(effect.as, effect.create);
    } else if ("connect" in effect || "sever" in effect) {
      const edge = edges.get("connect" in effect ? effect.connect : effect.sever);
      for (const [end, value] of [["from", effect.from], ["to", effect.to]] as const) {
        const arg = refName(value);
        if (!arg) continue;
        const kinds = end === "to" ? edge?.to ?? "*" : edge?.from ?? "*";
        if (kinds !== "*" && !named.has(arg)) named.set(arg, kinds);
        note(arg, () => ({ ref: kinds, required: true }));
      }
    } else if ("set" in effect) {
      const target = refName(effect.target ?? "$subject");
      const targetKind = target === "subject" ? subjectKinds[0] : (created.get(target ?? "") ?? named.get(target ?? "")?.[0]);
      if (target && target !== "subject" && !created.has(target)) note(target, () => ({ ref: "*", required: true }));
      for (const [field, value] of Object.entries(effect.set)) {
        const arg = refName(value);
        if (!arg) continue;
        const spec = targetKind ? document.kinds[targetKind]?.fields[field] : undefined;
        note(arg, () => (spec ? { field: spec, optional: !writesOnlyOne, required: writesOnlyOne } : { any: true, required: false }), spec);
      }
    } else if ("remove" in effect) {
      const arg = refName(effect.remove);
      if (arg) note(arg, () => ({ ref: "*", required: true }));
    }
  }
  for (const [arg, d] of Object.entries(declared)) if (!args.has(arg)) args.set(arg, { field: d, optional: !d.required, required: Boolean(d.required) });
  return args;
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
  const plan = planOf(document, findings);
  if (hasErrors(plan.findings)) return { ok: false, findings: plan.findings };
  return build(plan, options);
}

/**
 * The first half of compiling (FR-123): what a document that has been read
 * and judged compiles to, as data — each template and expression parsed,
 * each act's arguments and effects said, the brand derived. `findings` is
 * added to (a brand that cannot be read is a warning) and carried.
 */
function planOf(document: GraviewDocument, findings: Finding[]): CompiledApp {
  const edges = edgeIndex(document);

  // ── kinds ────────────────────────────────────────────────────────────────
  const kinds: Record<string, KindPlan> = {};
  for (const [kind, spec] of Object.entries(document.kinds)) {
    const labelField = defaultLabelField(spec);
    const labelSource = spec.label ?? (labelField ? `{${labelField}}` : undefined);
    const computed = parsedComputed(spec);
    kinds[kind] = {
      ...(labelSource ? { label: parseTemplate(labelSource) } : {}),
      ...(spec.describe ? { describe: parseTemplate(spec.describe) } : {}),
      ...(computed ? { computed: [...computed] } : {}),
    };
  }

  // ── acts ─────────────────────────────────────────────────────────────────
  const acts: Record<string, ActPlan> = {};
  for (const [name, act] of Object.entries(document.acts ?? {})) {
    const effects = effectsOf(act, document);
    const args = argsOf(act, effects, document, edges);
    const destructive = act.destructive ?? effects.some((e) => "remove" in e || "sever" in e || "replace" in e);
    const creates = [...new Set(effects.flatMap((e) => ("create" in e ? [e.create] : [])))];
    const connects = [...new Set(effects.flatMap((e) => ("connect" in e ? [e.connect] : [])))];
    // What it may sever: what it says it severs, and what it replaces (FR-115).
    const severs = [...new Set(effects.flatMap((e) => ("sever" in e ? [e.sever] : "replace" in e ? e.replace : [])))];
    // An act WRITES only what it sets on its subject; setting fields on a record it just made is part of making it.
    const writes = [...new Set(effects.flatMap((e) => ("set" in e && !("create" in e) && (refName(e.target ?? "$subject") === "subject") ? Object.keys(e.set) : [])))];
    /*
     * And what it sets on the record at an end of a link it makes or breaks
     * (FR-115's `setsOther`), by that end's kinds: not the subject's, but a
     * field another act sets, so no derived edit offers it freely.
     */
    const ends = new Map<string, readonly string[]>();
    for (const e of effects) {
      if (!("connect" in e) && !("sever" in e)) continue;
      const edge = edges.get("connect" in e ? e.connect : e.sever);
      for (const [end, value] of [["from", e.from], ["to", e.to]] as const) {
        const ref = refName(value);
        const kinds = end === "to" ? edge?.to : edge?.from;
        if (ref && ref !== "subject" && kinds && kinds !== "*") ends.set(ref, [...new Set([...(ends.get(ref) ?? []), ...kinds])]);
      }
    }
    const writesOther: Record<string, string[]> = {};
    for (const e of effects) {
      if (!("set" in e) || "create" in e) continue;
      const target = refName(e.target ?? "$subject");
      for (const kind of (target && target !== "subject" && ends.get(target)) || []) writesOther[kind] = [...new Set([...(writesOther[kind] ?? []), ...Object.keys(e.set)])];
    }
    // What it sets on its subject to a fixed value, whatever it is told — a named step (FR-108), resolved as `apply` resolves a literal.
    const sets: Record<string, string | number | boolean> = {};
    for (const e of effects) {
      if (!("set" in e) || "create" in e || refName(e.target ?? "$subject") !== "subject") continue;
      for (const [field, v] of Object.entries(e.set ?? {})) {
        if ((typeof v === "string" && refName(v) === undefined) || typeof v === "number" || typeof v === "boolean") sets[field] = typeof v === "string" && v.startsWith("$$") ? v.slice(1) : v;
        else delete sets[field];
      }
    }
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
    acts[name] = {
      title: act.title ?? name.replace(/-/g, " "),
      effects,
      args: [...args],
      ...(act.allowedWhen ? { guard: parseExpr(act.allowedWhen) } : {}),
      ...(act.refusal ? { refusal: parseTemplate(act.refusal) } : {}),
      exprs: [...exprs],
      destructive,
      idempotent,
      creates,
      connects,
      severs,
      writes,
      writesOther,
      sets,
    };
  }

  // ── rules ────────────────────────────────────────────────────────────────
  const rules: Record<string, RulePlan> = {};
  for (const [name, rule] of Object.entries(document.rules ?? {})) {
    rules[name] = {
      title: rule.title ?? name.replace(/-/g, " "),
      require: parseExpr(rule.require),
      ...(rule.when ? { when: parseExpr(rule.when) } : {}),
      ...(rule.says ? { says: parseTemplate(rule.says) } : {}),
    };
  }

  // ── brand, views ─────────────────────────────────────────────────────────
  // Every document's: the app is called what its document calls it, with the line under it (FR-124, FR-125).
  const brand = brandOf(document, findings);
  const viewSpecs = viewsOf(document);
  const home = homeOf(document);

  return {
    format: COMPILED_FORMAT,
    document,
    findings,
    kinds,
    edges: [...edges].map(([name, { from, to, cardinality }]): readonly [string, EdgePlan] => [name, { from, to, cardinality }]),
    acts,
    rules,
    brand,
    ...(Object.keys(viewSpecs).length > 0 ? { viewSpecs } : {}),
    ...(home ? { home } : {}),
  };
}


/** Map a framework check's "where" (a kind, an act, a rule by name) back to a document path when we can. */
export function frameworkPath(where: string, document: GraviewDocument): string {
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
export function inDocumentWords(finding: Finding, where: string, document: GraviewDocument): Finding {
  const kind = /^defineNode\("([^"]+)"\)/.exec(where)?.[1];
  const spec = kind ? document.kinds[kind] : undefined;
  if (!kind || !spec) return finding;
  const first = Object.keys(spec.fields).filter((field) => field !== "label").slice(0, 3);
  return { ...finding, path: `kinds.${kind}.glance`, fix: `Say which: "glance": [${first.map((field) => `"${field}"`).join(", ")}] on kinds.${kind} — the facts a person compares one by, at a glance.` };
}

export { ActRefusal };

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
