import {
  createSchema,
  defineInvariant,
  defineMutation,
  defineNode,
  RuleBudgetError,
  withArticle,
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
import { refTo } from "../mutations/node-ref.js";
import { ActRefusal } from "../refused.js";
import * as z from "../schema/zod.js";
import { evaluateExpr, ExprBudgetError, ExprEvalError, type KindShape, type Value } from "./expr/evaluate.js";
import type { Expr } from "./expr/parse.js";
import { error, type Finding } from "./findings.js";
import type { EffectSpec, FieldSpec, GraviewDocument, KindSpec, SightSpec, ValueSpec } from "./schema.js";
import { renderTemplate, type TemplatePart } from "./template.js";
import { rememberDocument } from "./remembered.js";
import type { HomeView, ViewSpecsByKind } from "./views.js";

/*
 * A COMPILED APP, HANDED TO THE PAGE (FR-123).
 *
 * Compiling a document is two halves. The first reads it — the format, its
 * upgrades, every reference and expression judged, every template and rule
 * parsed — and says what each act asks for and does. The second builds the
 * GraviewApp from that: zod schemas for the fields and arguments, and the
 * closures that run acts, judge rules and say labels.
 *
 * The first half's answer is plain data, `CompiledApp`, and this module is
 * the second half alone. `compileDocumentWithoutCheck` is the first half
 * then `build` — so a host that compiled a document on its server can hand
 * the page `serializeCompiled(compiled)` as JSON, and the page's `appFrom`
 * builds the same app without the reader, the validator, the expression
 * parser or the view checker. What stays is what an app needs to RUN in the
 * page: the field schemas the store validates with, the evaluator that
 * judges guards, rules, computed values and template parts, and the
 * template renderer that says labels and refusals.
 *
 * A compiled app is the host's own data, from its own server, and is
 * trusted as the document it was compiled from is: `appFrom` checks its
 * format and that its parts match its document, so a stale one cached from
 * another build is refused by name and the page compiles the document
 * instead, but it does not judge the document again.
 */

/** The format a compiled app says it is in; another is refused, never misread (docs/stability.md). */
export const COMPILED_FORMAT = "graview-compiled@1";

/**
 * What `replaces` means (FR-115): before the act connects, the subject's
 * links of these relations are severed — each at the subject's own end —
 * all but the link the act is making. Only an act's shorthand says it.
 */
export interface ReplaceEffect {
  readonly replace: readonly string[];
  /** The relation the act connects: its link to `$to` is the one kept. */
  readonly keep: string;
}

/** An effect as an act means it: one a document lists, or what a shorthand alone says. */
export type ActEffect = EffectSpec | ReplaceEffect;

/** One argument an act asks for: a field's value, a record of some kinds, or anything (a value set on a record of no known kind). */
export type ArgPlan =
  | { readonly field: FieldSpec; readonly optional: boolean; readonly required: boolean }
  | { readonly ref: readonly string[] | "*"; readonly required: boolean }
  | { readonly any: true; readonly required: false };

/** A relation, as every kind that declares it says it. */
export interface EdgePlan {
  readonly from: readonly string[];
  readonly to: readonly string[] | "*";
  readonly cardinality: "one" | "many";
}

export interface KindPlan {
  readonly label?: readonly TemplatePart[];
  readonly describe?: readonly TemplatePart[];
  /** Its computed fields, parsed, in declaration order. */
  readonly computed?: readonly (readonly [string, Expr])[];
}

export interface ActPlan {
  readonly title: string;
  readonly effects: readonly ActEffect[];
  /** In the order its form asks them. */
  readonly args: readonly (readonly [string, ArgPlan])[];
  readonly guard?: Expr;
  readonly refusal?: readonly TemplatePart[];
  /** Each `{ "expr": … }` value it sets, parsed, by its source. */
  readonly exprs: readonly (readonly [string, Expr])[];
  readonly destructive: boolean;
  readonly idempotent: boolean;
  readonly creates: readonly string[];
  readonly connects: readonly string[];
  readonly severs: readonly string[];
  readonly writes: readonly string[];
  readonly writesOther: Readonly<Record<string, readonly string[]>>;
  readonly sets: Readonly<Record<string, string | number | boolean>>;
}

export interface RulePlan {
  readonly title: string;
  readonly require: Expr;
  readonly when?: Expr;
  readonly says?: readonly TemplatePart[];
}

/**
 * A DOCUMENT, COMPILED, AS DATA: JSON in and out, with no function in it.
 * `serializeCompiled` gives one; `appFrom` builds the app from one.
 */
export interface CompiledApp {
  readonly format: typeof COMPILED_FORMAT;
  /** The document as read: upgraded to the current format. */
  readonly document: GraviewDocument;
  /** What compiling it said — notes and warnings, never an error. */
  readonly findings: readonly Finding[];
  readonly kinds: Readonly<Record<string, KindPlan>>;
  readonly edges: readonly (readonly [string, EdgePlan])[];
  readonly acts: Readonly<Record<string, ActPlan>>;
  readonly rules: Readonly<Record<string, RulePlan>>;
  /** The brand as derived from the document's accent, when it has one. */
  readonly brand?: Brand;
  readonly viewSpecs?: ViewSpecsByKind;
  readonly home?: HomeView;
}

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

export interface AppFromOptions {
  /** The clock rules read as today(); injectable for tests. */
  readonly today?: () => string;
}

export const SUBJECT_ARG = "id";

export const refName = (v: unknown): string | undefined => (typeof v === "string" && /^\$[A-Za-z][A-Za-z0-9]*$/.test(v) ? v.slice(1) : undefined);

/** What one of these is called, when the kind says nothing: the first required word-ish field. */
export function defaultLabelField(spec: KindSpec): string | undefined {
  const entries = Object.entries(spec.fields);
  return (
    entries.find(([, f]) => f.required && (f.type === "string" || f.type === "text"))?.[0] ??
    entries.find(([, f]) => f.type === "string")?.[0]
  );
}

/*
 * A FIELD'S SCHEMA, in zod/mini (schema/zod.ts): a page that builds an app
 * in the browser pays for the checks it calls, not for classic zod whole
 * (FR-57). The checks, their messages and their definitions are the ones
 * classic's methods make.
 */
export function fieldSchema(spec: FieldSpec, optional: boolean): z.ZodMiniType {
  let schema: z.ZodMiniType;
  switch (spec.type) {
    case "string":
      schema = z.string().check(z.maxLength(500));
      break;
    case "text":
      schema = z.string().check(z.maxLength(20_000));
      break;
    case "number":
    case "integer": {
      // Its range (FR-114) is the schema's: every form, tool and apply reads it from here.
      const range = [
        ...(spec.type === "integer" ? [z.int()] : []),
        ...(spec.min === undefined ? [] : [z.gte(spec.min)]),
        ...(spec.max === undefined ? [] : [z.lte(spec.max)]),
        ...(spec.step === undefined ? [] : [z.multipleOf(spec.step)]),
      ];
      schema = range.length > 0 ? z.number().check(...range) : z.number();
      break;
    }
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

const argSchema = (arg: ArgPlan): z.ZodMiniType => ("field" in arg ? fieldSchema(arg.field, arg.optional) : "ref" in arg ? refTo(arg.ref) : z.optional(z.unknown()));

/*
 * An act's own refusal is the framework's typed one (FR-110), which a host
 * shows rather than calling it a failure. Its condition, and a value it
 * could not work out, are `refused` (FR-119); a call naming what is not
 * there, or a subject of the wrong kind, says `invalid` — the call as sent.
 */

/** The compiled app each app was built from, so it can be handed on. */
const PLANS = new WeakMap<object, CompiledApp>();

/**
 * A compiled document as JSON-safe data, for a host to hand its pages: the
 * app minus its functions, every expression and template already parsed.
 * `appFrom` builds the same app from it. The findings are the ones this
 * compile said — `compileDocument`'s, checker and all, when that compiled it.
 */
export function serializeCompiled(compiled: CompiledDocument): CompiledApp {
  const plan = PLANS.get(compiled.app);
  if (!plan) throw new Error("this app was not compiled from a document: serializeCompiled takes what compileDocument, compileDocumentWithoutCheck or appFrom returned");
  return { ...plan, findings: [...compiled.findings] };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const sameNames = (a: Readonly<Record<string, unknown>> | undefined, b: unknown) => isRecord(b) && Object.keys(a ?? {}).length === Object.keys(b).length && Object.keys(a ?? {}).every((name) => Object.prototype.hasOwnProperty.call(b, name));

/**
 * The app a compiled document describes, built in the page without the
 * compiler (FR-123). `compiled` is what the host's server made with
 * `serializeCompiled`, read back from JSON. Another format, or parts that do
 * not match their document, is refused with a finding — `compiled-format`
 * or `compiled-shape` — and the page compiles the document instead.
 */
export function appFrom(compiled: unknown, options: AppFromOptions = {}): CompiledDocument | RefusedDocument {
  const format = isRecord(compiled) ? compiled["format"] : undefined;
  if (format !== COMPILED_FORMAT) {
    return { ok: false, findings: [error("compiled-format", "format", format === undefined ? "this is not a compiled Graview app" : `this compiled app is ${JSON.stringify(format)}, and this build reads ${COMPILED_FORMAT}`, "compile the document instead")] };
  }
  const plan = compiled as unknown as CompiledApp;
  const document = plan.document as GraviewDocument | undefined;
  const whole =
    isRecord(document) &&
    typeof document.name === "string" &&
    isRecord(document.kinds) &&
    sameNames(document.kinds, plan.kinds) &&
    sameNames(document.acts, plan.acts) &&
    sameNames(document.rules, plan.rules) &&
    Array.isArray(plan.edges) &&
    Array.isArray(plan.findings);
  if (!whole) return { ok: false, findings: [error("compiled-shape", "", "this compiled app's parts do not match its document", "compile the document instead")] };
  return build(plan, options);
}

/** The app, from a compiled document: the second half of compiling one, and all of `appFrom`. */
export function build(plan: CompiledApp, options: AppFromOptions = {}): CompiledDocument {
  const { document } = plan;
  const today = options.today ?? (() => new Date().toISOString().slice(0, 10));
  const edges = new Map<string, EdgePlan>(plan.edges.map(([name, edge]) => [name, edge]));
  const shapes = new Map<string, KindShape>();
  for (const [kind, spec] of Object.entries(document.kinds)) {
    const computed = plan.kinds[kind]?.computed;
    shapes.set(kind, {
      fields: new Set(Object.keys(spec.fields)),
      edges: new Map(Object.entries(spec.edges ?? {}).map(([name, e]) => [name, e.cardinality ?? "many"])),
      ...(computed ? { computed: new Map(computed.map(([name, expr]) => [name, expr])) } : {}),
    });
  }
  // What `{x | money}` says in a label, a sentence or a refusal: the app's currency and locale (FR-100).
  const { accent: _accent, name: _wordmark, ...money } = document.brand ?? {};

  // ── kinds ────────────────────────────────────────────────────────────────
  const definitions = Object.entries(document.kinds).map(([kind, spec]) => {
    const shape: Record<string, z.ZodMiniType> = {};
    for (const [field, f] of Object.entries(spec.fields)) shape[field] = fieldSchema(f, !f.required);
    const { label: labelParts, describe: describeParts } = plan.kinds[kind] ?? {};
    const computed = Object.entries(spec.computed ?? {}).map(([name, field]) => [name, typeof field === "string" ? { expr: field } : field] as const);
    // A computed field's words are said like a field's: its label, where it has one.
    const labels = Object.fromEntries([
      ...Object.entries(spec.fields).filter(([, f]) => f.label).map(([n, f]) => [n, f.label!]),
      ...computed.filter(([, c]) => c.label).map(([n, c]) => [n, c.label!]),
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
      ...(labelParts ? { label: (node: { id: string }) => renderTemplate(labelParts, { node: node as AnyGraphNode, kinds: shapes, today: today(), money }) || node.id } : {}),
      ...(describeParts ? { describe: (node: { id: string }) => renderTemplate(describeParts, { node: node as AnyGraphNode, kinds: shapes, today: today(), money }) } : {}),
      ...(spec.lifecycle ? { lifecycle: { field: spec.lifecycle.field, retired: spec.lifecycle.retired } } : {}),
      ...(spec.figure ? { figure: spec.figure } : {}),
      ...(spec.computed && Object.keys(spec.computed).length > 0 ? { computed: spec.computed } : {}),
      ...(Object.keys(labels).length > 0 || spec.glance ? { display: { ...(Object.keys(labels).length > 0 ? { labels } : {}), ...(spec.glance ? { glance: [...spec.glance] } : {}) } } : {}),
      ...(Object.keys(defaults).length > 0 ? { defaults } : {}),
    } as never);
  });
  const schema = createSchema(definitions as never);

  function labelFor(node: AnyGraphNode): string {
    const definition = (schema as unknown as { tryDefinition(kind: string): { label?: (n: unknown) => string } | undefined }).tryDefinition(node.kind);
    return definition?.label?.(node) ?? node.id;
  }

  // ── acts ─────────────────────────────────────────────────────────────────
  const mutations: AnyMutationDefinition[] = [];
  for (const [name, act] of Object.entries(document.acts ?? {})) {
    const planned = plan.acts[name]!;
    const { title, effects, guard, refusal, destructive, idempotent, creates, connects, severs, writes, writesOther, sets } = planned;
    const args = new Map(planned.args);
    const shape: Record<string, z.ZodMiniType> = {};
    for (const [arg, a] of args) shape[arg] = argSchema(a);
    const subjectKinds = act.on === undefined ? [] : Array.isArray(act.on) ? (act.on as readonly string[]) : [act.on as string];
    const exprs = new Map(planned.exprs);

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
        // Said even when empty (FR-110): a document act's writes are read off it, so nothing guesses them from its arguments' names.
        writes,
        ...(Object.keys(writesOther).length > 0 ? { writesOther } : {}),
        ...(Object.keys(sets).length > 0 ? { sets } : {}),
        describe: (input: Record<string, unknown>, graph: GraphReader) => {
          const subject = typeof input[SUBJECT_ARG] === "string" ? graph.getNode(input[SUBJECT_ARG] as string) : undefined;
          const what = subject ? labelFor(subject) : Object.values(input).find((v) => typeof v === "string");
          return what ? `${title}: ${String(what)}` : title;
        },
        apply(context: MutationContext<never>, input: Record<string, unknown>) {
          const graph = context.graph as unknown as GraphReader;
          const subjectId = typeof input[SUBJECT_ARG] === "string" ? (input[SUBJECT_ARG] as string) : undefined;
          const subject = subjectId ? graph.getNode(subjectId) : undefined;
          if (subjectId && !subject) throw new ActRefusal(`there is no record "${subjectId}"`, "invalid");
          if (subject && subjectKinds.length > 0 && !subjectKinds.includes(subject.kind)) throw new ActRefusal(`"${title}" acts on ${subjectKinds.join(" or ")}, not on ${withArticle(subject.kind)}`, "invalid");
          const bindings: Record<string, Value> = {};
          for (const [k, v] of Object.entries(input)) if (v !== undefined) bindings[k] = v as Value;
          if (guard && subject) {
            let allowed: Value;
            try {
              allowed = evaluateExpr(guard, { graph, subject, kinds: shapes, bindings, today: today() });
            } catch (e) {
              if (e instanceof ExprEvalError) throw new ActRefusal(`"${title}" could not be judged: ${e.sentence}`);
              throw e;
            }
            if (allowed !== true) {
              throw new ActRefusal(refusal ? renderTemplate(refusal, { node: subject, kinds: shapes, graph, bindings, today: today(), money }) : `"${title}" is not allowed for ${labelFor(subject)} right now`);
            }
          }
          const made = new Map<string, string>();
          const resolve = (value: ValueSpec, current: AnyGraphNode | undefined): unknown => {
            if (value && typeof value === "object" && !Array.isArray(value) && "expr" in value) {
              try {
                return evaluateExpr(exprs.get(value.expr)!, { graph, subject: current ?? subject ?? null, kinds: shapes, bindings, today: today() });
              } catch (e) {
                if (e instanceof ExprEvalError) throw new ActRefusal(`"${title}" could not work out a value: ${e.sentence}`);
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
              if (!graph.has(from) && ![...made.values()].includes(from)) throw new ActRefusal(`there is no record "${from}"`, "invalid");
              if (!graph.has(to) && ![...made.values()].includes(to)) throw new ActRefusal(`there is no record "${to}"`, "invalid");
              if ("connect" in effect) {
                if (edges.get(kind)?.cardinality === "one") for (const existing of graph.out(from, kind)) if (existing.id !== to) context.removeEdge({ kind, from, to: existing.id });
                if (!graph.out(from, kind).some((n) => n.id === to)) context.addEdge({ kind, from, to });
              } else {
                context.removeEdge({ kind, from, to });
              }
            } else if ("set" in effect) {
              const targetId = String(resolve(effect.target ?? "$subject", undefined) ?? "");
              const target = graph.getNode(targetId);
              if (!target && ![...made.values()].includes(targetId)) throw new ActRefusal(`there is no record "${targetId}"`, "invalid");
              const patch: Record<string, unknown> = {};
              for (const [field, value] of Object.entries(effect.set)) {
                const v = resolve(value, target);
                if (v !== undefined) patch[field] = v;
              }
              if (Object.keys(patch).length > 0) context.patchNode(targetId, patch);
            } else if ("remove" in effect) {
              const id = String(resolve(effect.remove, undefined) ?? "");
              if (!graph.has(id)) throw new ActRefusal(`there is no record "${id}"`, "invalid");
              context.removeNode(id);
            } else if ("replace" in effect && subject) {
              // The subject's links of each relation, at its own end, severed — all but the one being made (FR-115).
              const kept = input["to"];
              for (const relation of effect.replace) {
                const fromSubject = edges.get(relation)?.from.includes(subject.kind) ?? true;
                for (const other of fromSubject ? graph.out(subject.id, relation) : graph.in(subject.id, relation)) {
                  if (relation === effect.keep && other.id === kept) continue;
                  context.removeEdge(fromSubject ? { kind: relation, from: subject.id, to: other.id } : { kind: relation, from: other.id, to: subject.id });
                }
              }
            }
          }
        },
      } as never) as AnyMutationDefinition,
    );
  }

  // ── rules ────────────────────────────────────────────────────────────────
  const invariants: InvariantDefinition[] = [];
  for (const [name, rule] of Object.entries(document.rules ?? {})) {
    const { title, require, when, says } = plan.rules[name]!;
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
        const declared = act ? plan.acts[r.act]!.args : [];
        const missing = declared.filter(([k, a]) => a.required && args[k] === undefined).map(([k]) => k);
        return [{ mutation: r.act, label: r.label ?? act?.title ?? r.act.replace(/-/g, " "), args, ...(missing.length > 0 ? { missing } : {}) }];
      });
      return [
        {
          invariant: name,
          ...(subject ? { subjectId: subject.id } : {}),
          label: title,
          message: says ? renderTemplate(says, { node: subject, kinds: shapes, graph, today: today(), money }) : subject ? `${labelFor(subject)}: ${title}` : title,
          nodeIds: subject ? [subject.id] : [],
          repairs: repairList,
        },
      ];
    };
    const declared = {
      label: title,
      judgement: { require: rule.require, ...(rule.when ? { when: rule.when } : {}), ...(rule.says ? { says: rule.says } : {}) },
      ...(rule.description ? { description: rule.description } : {}),
      ...(repairs.length > 0 ? { repairs: repairs.map((r) => r.act) } : {}),
    };
    invariants.push(
      (rule.over === "graph"
        ? defineInvariant(name, { scope: "graph", ...declared, evaluate: ({ graph }: { graph: unknown }) => judge(graph as GraphReader, null) } as never)
        : defineInvariant(name, { scope: { kind: rule.over }, ...declared, evaluate: ({ graph, subject }: { graph: unknown; subject: unknown }) => judge(graph as GraphReader, subject as AnyGraphNode) } as never)) as InvariantDefinition,
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

  const app: GraviewApp = {
    name: document.name,
    schema,
    mutations,
    invariants,
    ...(policy ? { policy } : {}),
    ...(plan.brand ? { brand: plan.brand } : {}),
    ...(document.modules ? { modules: document.modules as never } : {}),
    ...(document.lenses ? { lenses: document.lenses as never } : {}),
    // The arrangement is the app's (FR-80): every face reads it beside the places.
    ...(document.pages ? { pages: document.pages as never } : {}),
    ...(document.settings ? { settings: document.settings as never } : {}),
    // The document's views are the declaration's view specs (FR-03): data the framework draws.
    ...(plan.viewSpecs ? { viewSpecs: plan.viewSpecs as never } : {}),
    // And its home view, about no one record, is the app's home (FR-81).
    ...(plan.home ? { home: plan.home as never } : {}),
    version: document.version ?? 1,
  };

  // `toDocument(app)` gives this document back, byte for byte; `serializeCompiled(…)` this compiled app.
  rememberDocument(app, document);
  PLANS.set(app, plan);
  return { ok: true, app, document, findings: plan.findings, sights: document.policy?.sees, kinds: shapes };
}
