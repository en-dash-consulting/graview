import type { HostView } from "../views/types.js";
import { derivedActOf } from "../mutations/derived-names.js";
import { documentRelationActOf } from "./relation-acts.js";
import { actsSpelledAsGiven, didYouMeanAct } from "./act-spellings.js";
import { brandOf } from "./brand.js";
import { ActRefusal } from "../refused.js";
import { analyzeExpr } from "./expr/analyze.js";
import { GRAPH_FACTS, type KindShape } from "./expr/evaluate.js";
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
  type ValueSpec,
} from "./schema.js";
import { linkedEdges, localEdges, reachesAnotherApp } from "../schema/linked.js";
import type { TemplatePart } from "./template.js";
import { parseTemplate, TemplateError } from "./template-parse.js";
import { upgradeDocument } from "./upgrade.js";
import { homeOf, validateViews, viewsOf } from "./views.js";
import { farEnd } from "./far-end.js";
import { resolveCovers } from "./covers.js";
import { parsedComputed, workedOutAlone } from "./computed.js";
import { durationsOf } from "./durations.js";
import { fieldsKeptInStep } from "./kept-in-step.js";
import { isRecord } from "./respell.js";
import { askedOrder, pageFieldFindings } from "./page-fields.js";
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
  type DerivesPlan,
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
  /**
   * The views the host keeps (`HostView`): what `view:<name>` in `pages`
   * may name. Read by the checked compile; unsaid, a view the declaration
   * names is a note, drawn once the host registers it.
   */
  readonly views?: readonly HostView[];
}

const BUILTIN_REFS = new Set(["subject", "now", "today", "me"]);

/** Parse and validate without compiling — the document's own sentences, before the framework's. */
export function readDocument(raw: unknown): { readonly document?: GraviewDocument; readonly findings: readonly Finding[] } {
  // Measured as it came, text or a value: one sentence for either too large, and no text that size parsed.
  if ((typeof raw === "string" ? raw : JSON.stringify(raw ?? null)).length > MAX_DOCUMENT_BYTES) {
    return { findings: [error("too-large", "", `a document may be at most ${MAX_DOCUMENT_BYTES / 1024} KB`)] };
  }
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      return { findings: [error("not-json", "", `this is not JSON: ${(e as Error).message}`)] };
    }
  }
  // An older format is upgraded before it is read (upgrade.ts); the host records that as a new version.
  try {
    raw = upgradeDocument(raw).document;
  } catch (e) {
    return { findings: [error("format", "formatVersion", (e as Error).message)] };
  }
  // An act a grant or a repair names in another spelling is written as that act's own name before the shape is judged (`act-spellings.ts`).
  raw = actsSpelledAsGiven(raw);
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

const asArray = <T>(v: T | readonly T[] | undefined): readonly T[] => [v ?? []].flat() as readonly T[];

interface EdgeInfo {
  readonly name: string;
  readonly from: readonly string[];
  readonly to: readonly string[] | "*";
  readonly cardinality: "one" | "many";
}

function edgeIndex(document: GraviewDocument): Map<string, EdgeInfo> {
  const edges = new Map<string, EdgeInfo>();
  for (const [kind, spec] of Object.entries(document.kinds)) {
    // A relation to another app's kinds is kept on the record that links (FR-171): no link of this graph is one.
    for (const [name, edge] of Object.entries(localEdges(spec.edges))) {
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
    const linked = linkedEdges(spec.edges);
    shapes.set(kind, {
      fields: new Set([...Object.keys(spec.fields), ...linked.keys()]),
      edges: new Map(Object.entries(localEdges(spec.edges)).map(([name, e]) => [name, e.cardinality ?? "many"])),
      ...(computed ? { computed } : {}),
      ...(linked.size > 0 ? { linked } : {}),
    });
  }
  const facts = parsedComputed(document);
  if (facts) shapes.set(GRAPH_FACTS, { computed: facts } as KindShape);
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
  // What it sets on every record its subject is already linked to through a relation (Roadmap f-acts-update-linked), each in turn its `$to`.
  if (act.setsLinked && subject.length > 0) for (const [relation, set] of Object.entries(act.setsLinked)) effects.push({ set, through: relation });
  if (act.removes) effects.push({ remove: "$subject" });
  if (act.effects) effects.push(...act.effects.filter((e) => !(act.creates && "set" in e && !("create" in e) && refName(e.target) === "new")));
  return effects;
}

function tryExpr(source: string, path: string, findings: Finding[]): Expr | undefined {
  try {
    const expr = parseExpr(source);
    const shape = analyzeExpr(expr);
    for (const fn of shape.unknownFunctions) findings.push(error("unknown-function", path, `"${fn}" is not a function the rule language knows`, "see the rule language in the graview-invariant skill"));
    // What the declaration alone shows of its types — a date built from a number — is the checker's to say (`expr-type-findings.ts`).
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
  // Relations to other apps' kinds (FR-171): kept on the record that links, set by its edit, walked by name.
  const linkedHere = (kind: string, name: string) => linkedEdges(document.kinds[kind]?.edges).has(name);
  const linkedAnywhere = (name: string) => Object.keys(document.kinds).some((kind) => linkedHere(kind, name));

  for (const [kind, spec] of Object.entries(document.kinds)) {
    const at = `kinds.${kind}`;
    for (const [name, edge] of Object.entries(spec.edges ?? {})) {
      // One that reaches another app is judged with the checker (`linked-findings.ts`).
      if (!reachesAnotherApp(edge) && edge.to !== "*") for (const target of edge.to) if (!kinds.has(target)) findings.push(error("edge-target", `${at}.edges.${name}.to`, `"${target}" is not a kind this document declares`));
      if (spec.fields[name]) findings.push(error("edge-field-clash", `${at}.edges.${name}`, `"${name}" is both a field and a relation of ${kind}`, "rename one of them"));
    }
    if (spec.lifecycle && !spec.fields[spec.lifecycle.field]) findings.push(error("lifecycle-field", `${at}.lifecycle.field`, `${kind} has no field "${spec.lifecycle.field}"`));
    // A glance may say a computed field: the surfaces that draw a glance work it out over the seat's graph (FR-83).
    const computedHere = (name: string) => spec.computed !== undefined && Object.hasOwn(spec.computed, name);
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
    // What it follows (Roadmap f-keep-linked): its expressions parse here; the names they read are the checker's (`derives-findings.ts`).
    for (const [field, value] of Object.entries(spec.derives?.set ?? {})) if (isRecord(value) && "expr" in value) tryExpr(String(value.expr), `${at}.derives.set.${field}`, findings);
    for (const [field, f] of Object.entries(spec.fields)) {
      if (f.default !== undefined && f.type === "enum") {
        // A choice that takes several (FR-233) starts as a list of its options; one that takes one, as one of them.
        const given = f.multiple ? (Array.isArray(f.default) ? f.default : [f.default]) : [f.default];
        const outside = given.find((one) => !f.options?.includes(String(one)));
        if (outside !== undefined || (!f.multiple && Array.isArray(f.default))) findings.push(error("default-option", `${at}.fields.${field}.default`, `"${String(outside ?? f.default)}" is not one of ${field}'s options`));
      }
      // How a date repeats is kept beside it, as `<field>Repeat`: nothing else of the kind may have that name.
      const kept = `${field}Repeat`;
      if (f.repeats && (spec.fields[kept] || spec.edges?.[kept] || spec.computed?.[kept])) findings.push(error("repeat-clash", `${at}.fields.${field}.repeats`, `${kind} already has "${kept}", where how ${field} repeats is kept`));
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
        else if (linkedHere(act.creates, field)) continue; // Said by the checker: `act-linked`.
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
        // A relation to another app is said by the checker: `act-linked`.
        if (!edges.has(edgeName) && !linkedAnywhere(edgeName)) findings.push(error("act-edge", `${where}.${"connect" in effect ? "connect" : "sever"}`, `"${edgeName}" is not a relation any kind declares`));
        if (refName(effect.from) === "subject" && subjectKinds.length === 0) findings.push(error("act-subject", `${at}.on`, `"${name}" acts on "$subject" but does not say which kinds it is "on"`));
      } else if ("through" in effect) {
        // The relation and the far kind's fields are judged with the checker (`act-findings.ts`); its values are read standing on the subject.
      } else if ("set" in effect) {
        const target = refName(effect.target ?? "$subject");
        const targetKinds = target === "subject" ? subjectKinds : created.has(target ?? "") ? [created.get(target!)!] : [];
        if (target === "subject" && subjectKinds.length === 0) findings.push(error("act-subject", `${at}.on`, `"${name}" changes "$subject" but does not say which kinds it is "on"`));
        for (const field of Object.keys(effect.set)) {
          for (const kind of targetKinds) {
            if (!kinds.has(kind) || document.kinds[kind]!.fields[field]) continue;
            if (document.kinds[kind]!.computed?.[field] !== undefined) findings.push(error("computed-written", `${where}.set.${field}`, `${kind}'s ${field} is worked out, not written: no act can set it`, "set the stored fields it is worked out from"));
            else if (linkedHere(kind, field)) continue; // Said by the checker: `act-linked`.
            else findings.push(error("act-field", `${where}.set.${field}`, `${kind} has no field "${field}"`));
          }
        }
      } else if ("remove" in effect) {
        if (refName(effect.remove) === "subject" && subjectKinds.length === 0) findings.push(error("act-subject", `${at}.on`, `"${name}" removes "$subject" but does not say which kinds it is "on"`));
      }
      const values = "set" in effect && effect.set ? Object.values(effect.set) : [];
      const valuesAt = "through" in effect ? `${at}.setsLinked.${effect.through}` : `${where}.set`;
      values.forEach((v) => {
        if (v && typeof v === "object" && !Array.isArray(v) && "expr" in v) tryExpr(v.expr, valuesAt, findings);
      });
    });
    if (act.allowedWhen) tryExpr(act.allowedWhen, `${at}.allowedWhen`, findings);
    if (act.refusal) tryTemplate(act.refusal, `${at}.refusal`, findings);
  }

  for (const [name, rule] of Object.entries(document.rules ?? {})) {
    const at = `rules.${name}`;
    if (rule.over !== "graph" && !kinds.has(rule.over)) findings.push(error("rule-kind", `${at}.over`, `"${rule.over}" is not a kind this document declares`));
    const spec = rule.over === "graph" ? undefined : document.kinds[rule.over];
    /*
     * A COVERAGE RULE names its walk rather than an expression (Roadmap
     * f-rule-covers-every): the relations must exist and lead from the
     * rule's kind to the covered one, said in the person's voice at the
     * key that is wrong. It is judged over links alone, so no cost is
     * warned of.
     */
    if (rule.covers && spec) {
      const resolved = resolveCovers(rule.over, rule.covers, (relation) => edges.get(relation), (kind) => kinds.has(kind));
      if ("problem" in resolved) {
        const { key, message, fix } = resolved.problem;
        if (key === "every") findings.push(error("rule-kind", `${at}.covers.every`, message, fix));
        else findings.push(error("rule-covers-relation", `${at}.covers.${key}`, message, fix));
      }
    }
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
      for (const e of shape.edges) if (!edges.has(e) && !linkedAnywhere(e)) findings.push(error("rule-edge", `${at}.${key}`, `"${e}" is not a relation any kind declares`));
      for (const k of shape.sweeps) {
        if (!kinds.has(k)) findings.push(error("rule-kind", `${at}.${key}`, `"${k}" is not a kind this document declares`));
        else if (rule.over !== "graph") findings.push(warning("rule-cost", `${at}.${key}`, `this rule looks at every ${k} for every ${rule.over}, which grows slowly as the app grows`, "walk a relation with out()/in() instead of all() where you can"));
      }
    }
    if (rule.says) tryTemplate(rule.says, `${at}.says`, findings);
    (rule.repairs ?? []).forEach((repair, i) => {
      if (!acts[repair.act] && !derivedActOf(repair.act) && !documentRelationActOf(repair.act, document.kinds)) findings.push(error("repair-act", `${at}.repairs.${i}.act`, `"${repair.act}" is not an act this document declares`, didYouMeanAct(repair.act, document)));
    });
  }

  const policy = document.policy;
  if (policy) {
    policy.grants.forEach((grant, i) => {
      if (grant.roles !== "*" && roles.size > 0) for (const r of grant.roles) if (!roles.has(r)) findings.push(error("grant-role", `policy.grants.${i}.roles`, `"${r}" is not one of the document's roles`));
      for (const key of ["mutations", "propose"] as const) {
        const named = grant[key];
        if (named !== undefined && named !== "*") for (const m of named) if (!acts[m] && !derivedActOf(m) && !documentRelationActOf(m, document.kinds)) findings.push(error("grant-act", `policy.grants.${i}.${key}`, `"${m}" is not an act this document declares`, didYouMeanAct(m, document)));
      }
    });
    (policy.sees ?? []).forEach((sight, i) => {
      for (const k of sight.kinds) if (!kinds.has(k)) findings.push(error("sight-kind", `policy.sees.${i}.kinds`, `"${k}" is not a kind this document declares`));
      if (sight.roles !== "*" && roles.size > 0) for (const r of sight.roles) if (!roles.has(r)) findings.push(error("sight-role", `policy.sees.${i}.roles`, `"${r}" is not one of the document's roles`));
    });
  }
  findings.push(...validateViews(document));
  // A kind's computed fields are judged with the checker (`computedFindings`): one a page cannot work out is refused where it is read, not built wrong.
  return findings;
}

/** The fields a kind's records are named by: those its label reads, in the order it reads them, else the field it is named by unsaid. */
function namingFields(spec: KindSpec): readonly string[] {
  if (!spec.label) return [defaultLabelField(spec) ?? []].flat();
  return [...spec.label.matchAll(/\{\s*([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]!);
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
    effects.some((e) => ("remove" in e && refName(e.remove) === "subject") || ("from" in e && (refName(e.from) === "subject" || refName(e.to) === "subject")) || ("set" in e && !("create" in e) && !("through" in e) && refName(e.target ?? "$subject") === "subject") || "through" in e);
  if (usesSubject) args.set(SUBJECT_ARG, { ref: subjectKinds.length > 0 ? subjectKinds : "*", required: true });

  const declared = act.args ?? {};
  const writesOnlyOne = act.writes?.length === 1;
  /*
   * A declared argument that fills a number field and says no range of its
   * own is asked for within the field's (FR-114): the form will not take
   * what the record would refuse.
   */
  const ranged = (d: FieldSpec, fed: FieldSpec | undefined): FieldSpec =>
    fed && d.type === fed.type && d.min === undefined && d.max === undefined && d.step === undefined ? { ...d, ...(fed.min === undefined ? {} : { min: fed.min }), ...(fed.max === undefined ? {} : { max: fed.max }), ...(fed.step === undefined ? {} : { step: fed.step }) } : d;
  // And it is asked for as the field is said: an amount for a money field, in its currency.
  const withRangeOf = (d: FieldSpec, fed: FieldSpec | undefined): FieldSpec =>
    fed && d.type === fed.type && d.format === undefined && d.unit === undefined ? { ...ranged(d, fed), ...(fed.format ? { format: fed.format } : {}), ...(fed.unit ? { unit: fed.unit } : {}) } : ranged(d, fed);
  const note = (arg: string, schema: () => ArgPlan, fed?: FieldSpec) => {
    if (arg === SUBJECT_ARG || BUILTIN_REFS.has(arg) || created.has(arg) || args.has(arg)) return;
    const d = declared[arg] ? withRangeOf(declared[arg], fed) : undefined;
    args.set(arg, d ? { field: d, optional: !d.required, required: Boolean(d.required) } : schema());
  };
  for (const effect of effects) {
    if ("create" in effect) {
      const kind = document.kinds[effect.create];
      // Asked in the order a form that makes one asks (`askedOrder`): what names it, what must be answered, then the rest.
      const order = kind ? askedOrder(kind, namingFields(kind)) : [];
      const rank = (field: string) => (order.includes(field) ? order.indexOf(field) : order.length);
      for (const [field, value] of Object.entries(effect.set ?? {}).sort(([a], [b]) => rank(a) - rank(b))) {
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
    } else if ("through" in effect) {
      // A value carried to the records at the far end of a relation: `$to` is each of them in turn, never an argument.
      const far = farEnd(document.kinds, effect.through, subjectKinds);
      const farKind = far && far.kinds !== "*" ? far.kinds[0] : undefined;
      for (const [field, value] of Object.entries(effect.set)) {
        const arg = refName(value);
        if (!arg || arg === "to") continue;
        const spec = farKind ? document.kinds[farKind]?.fields[field] : undefined;
        note(arg, () => (spec ? { field: spec, optional: true, required: false } : { any: true, required: false }), spec);
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
/**
 * A FIELD NAMED BARE IN A SENTENCE IS SAID AS IT IS DECLARED: `{amount}` of
 * a money field reads "$10,000" in a label, a description, a rule's
 * sentence and a refusal, as `{amount | money}` does — worked out here, so
 * a page handed the compiled app renders it with nothing more.
 */
function saidAsDeclared(parts: readonly TemplatePart[], fields: GraviewDocument["kinds"][string]["fields"] | undefined, computed?: GraviewDocument["kinds"][string]["computed"]): readonly TemplatePart[] {
  return parts.map((part) => {
    if (part.format || part.expr?.t !== "ident") return part;
    const name = part.expr.name;
    const worked = computed?.[name];
    const said: { readonly format?: string; readonly places?: number } | undefined = fields?.[name] ?? (typeof worked === "object" ? worked : undefined);
    const format = said?.format;
    // Money in whole units where the field says `"places": 0`, as `{x | money: 0}` says it.
    return format === "money" || format === "percent" ? { ...part, format, ...(format === "money" && said?.places === 0 ? { formatArgs: ["0"] } : {}) } : part;
  });
}

/**
 * WHAT A KIND FOLLOWS, PLANNED (Roadmap f-keep-linked): which end of the
 * relation its source stands on — the relation declared on this kind
 * points at the source, one declared on the source points here — each
 * value parsed, and the fields set from one of the source's own stored
 * fields as it is, which go back when changed here.
 */
function derivesPlan(kind: string, derives: NonNullable<KindSpec["derives"]>, document: GraviewDocument): DerivesPlan {
  const sourceEnd = document.kinds[kind]?.edges?.[derives.via] !== undefined ? "to" : "from";
  const source = document.kinds[derives.from];
  const set: [string, { expr: Expr } | { value: unknown }][] = [];
  const back: Record<string, string> = {};
  for (const [field, value] of Object.entries(derives.set)) {
    if (isRecord(value) && "expr" in value) {
      const expr = parseExpr(value.expr);
      set.push([field, { expr }]);
      if (expr.t === "ident" && source?.fields[expr.name]) back[field] = expr.name;
    } else set.push([field, { value: typeof value === "string" && value.startsWith("$$") ? value.slice(1) : value }]);
  }
  return { from: derives.from, via: derives.via, sourceEnd, set, back };
}

function planOf(document: GraviewDocument, findings: Finding[]): CompiledApp {
  const edges = edgeIndex(document);

  // ── kinds ────────────────────────────────────────────────────────────────
  const kinds: Record<string, KindPlan> = {};
  // The fields a declared connection maps, read here where the document is judged, so a page handed a compiled app reads them off its plan.
  const keptInStep = fieldsKeptInStep(document.connections, document.kinds);
  for (const [kind, spec] of Object.entries(document.kinds)) {
    const labelField = defaultLabelField(spec);
    const labelSource = spec.label ?? (labelField ? `{${labelField}}` : undefined);
    const computed = parsedComputed(spec);
    // Which of them work out a length of time, read from their parse here, where the parser is (`durations.ts`).
    const durations = computed ? durationsOf(document, kind, [...computed]) : [];
    kinds[kind] = {
      ...(labelSource ? { label: saidAsDeclared(parseTemplate(labelSource), spec.fields, spec.computed) } : {}),
      ...(spec.describe ? { describe: saidAsDeclared(parseTemplate(spec.describe), spec.fields, spec.computed) } : {}),
      ...(computed ? { computed: [...computed] } : {}),
      ...(durations.length > 0 ? { durations } : {}),
      ...(keptInStep.has(kind) ? { keptInStep: keptInStep.get(kind)! } : {}),
      ...(spec.derives ? { derives: derivesPlan(kind, spec.derives, document) } : {}),
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
    const writes = [...new Set(effects.flatMap((e) => ("set" in e && !("create" in e) && !("through" in e) && (refName(e.target ?? "$subject") === "subject") ? Object.keys(e.set) : [])))];
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
      if (!("set" in e) || "create" in e || "through" in e) continue;
      const target = refName(e.target ?? "$subject");
      for (const kind of (target && target !== "subject" && ends.get(target)) || []) writesOther[kind] = [...new Set([...(writesOther[kind] ?? []), ...Object.keys(e.set)])];
    }
    // What it sets on its subject to a fixed value, whatever it is told — a named step (FR-108), resolved as `apply` resolves a literal.
    const sets: Record<string, string | number | boolean> = {};
    for (const e of effects) {
      if (!("set" in e) || "create" in e || "through" in e || refName(e.target ?? "$subject") !== "subject") continue;
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
      ...(act.refusal ? { refusal: saidAsDeclared(parseTemplate(act.refusal), document.kinds[[act.on ?? []].flat()[0] ?? ""]?.fields) } : {}),
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
    const covers = rule.covers && rule.over !== "graph" ? resolveCovers(rule.over, rule.covers, (relation) => edges.get(relation), (kind) => kind in document.kinds) : undefined;
    rules[name] = {
      title: rule.title ?? name.replace(/-/g, " "),
      ...(rule.require ? { require: parseExpr(rule.require) } : {}),
      ...(covers && "plan" in covers ? { covers: covers.plan } : {}),
      ...(rule.when ? { when: parseExpr(rule.when) } : {}),
      ...(rule.says ? { says: saidAsDeclared(parseTemplate(rule.says), document.kinds[rule.over]?.fields) } : {}),
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
    ...(document.computed ? { facts: [...(parsedComputed(document) ?? [])] } : {}),
    edges: [...edges].map(([name, { from, to, cardinality }]): readonly [string, EdgePlan] => [name, { from, to, cardinality }]),
    acts,
    rules,
    brand,
    ...(Object.keys(viewSpecs).length > 0 ? { viewSpecs } : {}),
    ...(home ? { home } : {}),
  };
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
