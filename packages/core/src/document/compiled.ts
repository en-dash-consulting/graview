/*
 * From the barrel on purpose: a hosted page handed a compiled app imports
 * this file first, and imported from each file that holds them its names
 * split the page's first chunks differently, a third of a kilobyte more up
 * front (docs/hosted-page.md).
 */
import {
  createSchema,
  defineInvariant,
  defineMutation,
  defineNode,
  edgeId,
  humanizeField,
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
import { fileSchema } from "../schema/files.js";
import { appLinkSchema } from "../schema/app-link.js";
import { linkedEdges, localEdges, type LinkedReader } from "../schema/linked.js";
import { linkedSchema } from "../schema/linked-schema.js";
import { repeatKey, repeatSchema } from "../repeat.js";
import { markTyped, PHONE } from "../schema/typed-fields.js";
import { evaluateExpr, ExprBudgetError, ExprEvalError, GRAPH_FACTS, unreadSaid, type KindShape, type UnreadLink, type Value } from "./expr/evaluate.js";
import type { Expr } from "./expr/parse.js";
import { error, type Finding } from "./findings.js";
import type { EffectSpec, FieldSpec, GraviewDocument, KindSpec, SightSpec, ValueSpec } from "./schema.js";
import { formatValue, renderTemplate, type Money, type TemplatePart } from "./template.js";
import { rememberDocument } from "./remembered.js";
import { isRecord, respellDocument } from "./respell.js";
import { moneyOf } from "./brand.js";
import { markAmount } from "../schema/amount-mark.js";
import { ISO_DAY, isMoment, isoToday } from "../days.js";
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

/** The argument of an act's that takes the record at the far end of what it ties, when it takes a `kind`: never its subject. */
export function farEndArg(args: readonly (readonly [string, ArgPlan])[], kind: string): string | undefined {
  return args.find(([name, arg]) => name !== SUBJECT_ARG && "ref" in arg && (arg.ref === "*" || arg.ref.includes(kind)))?.[0];
}

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
  /** Those of them that work out a length of time, read from their parse as it was compiled (`durations.ts`): a face says them as durations. */
  readonly durations?: readonly string[];
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
  /** The whole graph's facts (the document's top-level `computed`), parsed, in declaration order. */
  readonly facts?: readonly (readonly [string, Expr])[];
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
  /* Among the fields that could name it, one called `name` or `title` before a `label` (a release's record label) or anything else. */
  const first = (fits: readonly (readonly [string, KindSpec["fields"][string]])[]) => (["name", "title", "label"] as const).find((word) => fits.some(([n]) => n === word)) ?? fits[0]?.[0];
  return first(entries.filter(([, f]) => f.required && (f.type === "string" || f.type === "text"))) ?? first(entries.filter(([, f]) => f.type === "string"));
}

/*
 * A FIELD'S SCHEMA, in zod/mini (schema/zod.ts): a page that builds an app
 * in the browser pays for the checks it calls, not for classic zod whole
 * (FR-57). The checks, their messages and their definitions are the ones
 * classic's methods make.
 */
export function fieldSchema(spec: FieldSpec, optional: boolean, money?: Money): z.ZodMiniType {
  let schema: z.ZodMiniType;
  switch (spec.type) {
    case "string":
    case "place":
      // A place is a line of words, drawn as a link to the reader's maps app.
      schema = z.string().check(z.maxLength(500));
      break;
    case "phone":
      schema = z.string().check(z.maxLength(40), z.regex(PHONE, "a phone number"));
      break;
    case "text":
      schema = z.string().check(z.maxLength(20_000));
      // Prose written in Markdown (FR-180): the record's page draws it, every list says its start. The mark `schema/markdown.ts` reads, set here so a page's first chunk reaches no module a fetched one shares.
      if (spec.format) (z.defOf(schema) as Record<symbol, 1>)[Symbol.for("@graview/core:markdown")] = 1;
      break;
    case "number":
    case "integer":
    case "duration": {
      // Its range (FR-114) is the schema's: every form, tool and apply reads it from here. A duration is whole minutes, none less than none.
      const min = spec.min ?? (spec.type === "duration" ? 0 : undefined);
      const range = [
        ...(spec.type === "number" ? [] : [z.int()]),
        ...(min === undefined ? [] : [z.gte(min)]),
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
      schema = z.string().check(z.regex(ISO_DAY, "a date like 2026-10-02"));
      break;
    case "datetime":
      schema = z.string().check(z.refine(isMoment, "a date and time like 2026-10-02T14:30:00Z"));
      break;
    case "enum":
      schema = z.enum(spec.options as [string, ...string[]]);
      break;
    case "list":
      schema = z.array(spec.of === "number" ? z.number() : spec.of === "date" ? z.string().check(z.regex(ISO_DAY)) : spec.of === "image" || spec.of === "file" ? fileSchema(spec.of) : z.string().check(z.maxLength(500))).check(z.maxLength(200));
      break;
    case "image":
    case "file":
      schema = fileSchema(spec.type);
      break;
    case "app-link":
      // Another app's address (FR-171): the host's `resolveApp` says what it is called.
      schema = appLinkSchema();
      break;
    case "url":
      schema = z.url();
      break;
    case "email":
      schema = z.email();
      break;
  }
  // A phone, a place and a duration say so, for a face to say and link each. A number shown as a duration IS one: whole minutes, said, typed and told to a model as the duration type is.
  const numeric = spec.type === "number" || spec.type === "integer";
  markTyped(schema, numeric && spec.format === "duration" ? "duration" : spec.type);
  if (spec.description) schema = schema.check(z.describe(spec.description));
  // What a number is said as — money in the app's currency, a percent, a measure — read by every face, every form and every tool.
  if (numeric && (spec.format === "money" || spec.format === "percent" || (!spec.format && spec.unit))) markAmount(schema, { ...money, ...(spec.format ? { format: spec.format } : {}), ...(spec.unit ? { unit: spec.unit } : {}) });
  return optional ? z.optional(schema) : schema;
}

/** A call naming a record that is not there: the call as sent is wrong (`invalid`), not the act. */
const noRecord = (id: string): never => {
  throw new ActRefusal(`there is no record "${id}"`, "invalid");
};

const argSchema = (arg: ArgPlan, money: Money): z.ZodMiniType => ("field" in arg ? fieldSchema(arg.field, arg.optional, money) : "ref" in arg ? refTo(arg.ref) : z.optional(z.unknown()));

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

const sameNames = (a: Readonly<Record<string, unknown>> | undefined, b: unknown) => isRecord(b) && Object.keys(a ?? {}).length === Object.keys(b).length && Object.keys(a ?? {}).every((name) => Object.hasOwn(b, name));

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
  /*
   * Its document is read as this build spells it (FR-134): a compiled app an
   * older build made carries the document as that build read it, and 0.1.15
   * read a setting's `honored` under its old name.
   */
  const handed = compiled as unknown as CompiledApp;
  const document = respellDocument(handed.document as GraviewDocument | undefined).document;
  const plan: CompiledApp = document === handed.document ? handed : { ...handed, document: document as GraviewDocument };
  const whole =
    isRecord(document) &&
    typeof document.name === "string" &&
    isRecord(document.kinds) &&
    sameNames(document.kinds, plan.kinds) &&
    sameNames(document.acts, plan.acts) &&
    sameNames(document.rules, plan.rules) &&
    Array.isArray(plan.edges) &&
    Array.isArray(plan.findings);
  const torn = { ok: false as const, findings: [error("compiled-shape", "", "this compiled app's parts do not match its document", "compile the document instead")] };
  if (!whole) return torn;
  // One torn on its way — a plan that is not there, a list that is not one — is refused as torn, never thrown out of the page.
  try {
    return build(plan, options);
  } catch {
    return torn;
  }
}

/** The app, from a compiled document: the second half of compiling one, and all of `appFrom`. */
export function build(plan: CompiledApp, options: AppFromOptions = {}): CompiledDocument {
  const { document } = plan;
  const today = options.today ?? isoToday;
  const edges = new Map<string, EdgePlan>(plan.edges.map(([name, edge]) => [name, edge]));
  const shapes = new Map<string, KindShape>();
  for (const [kind, spec] of Object.entries(document.kinds)) {
    const computed = plan.kinds[kind]?.computed;
    const linked = linkedEdges(spec.edges);
    shapes.set(kind, {
      fields: new Set([...Object.keys(spec.fields), ...linked.keys()]),
      edges: new Map(Object.entries(localEdges(spec.edges)).map(([name, e]) => [name, e.cardinality ?? "many"])),
      ...(computed ? { computed: new Map(computed) } : {}),
      ...(linked.size > 0 ? { linked } : {}),
    });
  }
  // No record is of the whole graph's shape: it is its facts alone.
  if (plan.facts) shapes.set(GRAPH_FACTS, { computed: new Map(plan.facts) } as Partial<KindShape> as KindShape);
  // What `{x | money}` says in a label, a sentence or a refusal: the app's currency and locale (FR-100).
  const money = moneyOf(document);

  // ── kinds ────────────────────────────────────────────────────────────────
  // Each kind's defaults: what a record is made with before an act sets anything.
  const madeAs = new Map<string, Record<string, unknown>>();
  const definitions = Object.entries(document.kinds).map(([kind, spec]) => {
    const shape: Record<string, z.ZodMiniType> = {};
    for (const [field, f] of Object.entries(spec.fields)) {
      shape[field] = fieldSchema(f, !f.required, money);
      // How a date repeats, kept beside it (`repeat.ts`); none (null) when it no longer does.
      if (f.repeats) shape[repeatKey(field)] = z.optional(repeatSchema());
    }
    /*
     * A RELATION TO ANOTHER APP'S KINDS (FR-171) is kept on the record that
     * links, under the relation's name — `house:h1`, or a list — so its edit,
     * undo, history and sight are the record's own, and the far app is
     * never written. Never required: a record is made before it is linked.
     */
    for (const [name, relation] of linkedEdges(spec.edges)) shape[name] = z.optional(linkedSchema(relation));
    const { label: labelParts, describe: describeParts, durations } = plan.kinds[kind] ?? {};
    const computed = Object.entries(spec.computed ?? {}).map(([name, field]) => [name, typeof field === "string" ? { expr: field } : field] as const);
    // A computed field's words are said like a field's: its label, where it has one.
    /* A field called `label` the kind is not named by is an ordinary field, said as "Label" rather than as the record's name. */
    const ordinaryLabel = Object.hasOwn(spec.fields, "label") && !spec.fields["label"]!.label && !/\{\s*label\b/.test(spec.label ?? `{${defaultLabelField(spec) ?? ""}}`);
    const labels = Object.fromEntries([
      ...(ordinaryLabel ? [["label", "Label"] as const] : []),
      ...Object.entries(spec.fields).filter(([, f]) => f.label).map(([n, f]) => [n, f.label!]),
      ...computed.filter(([, c]) => c.label).map(([n, c]) => [n, c.label!]),
    ]);
    const named = Object.keys(labels).length > 0;
    // Defaults stay out of the zod schema (hydration must not invent values) and ride beside it, for a repair to read.
    const defaults = Object.fromEntries(Object.entries(spec.fields).filter(([, f]) => f.default !== undefined).map(([n, f]) => [n, f.default]));
    madeAs.set(kind, defaults);
    // A relation as the kind declares it, less the name it had in the version before, which is the migration's.
    const edgeDecls = Object.fromEntries(Object.entries(localEdges(spec.edges)).map(([n, { renamedFrom: _, ...e }]) => [n, e]));
    // What the definition says as the document says it, where it is said.
    const said = <K extends "plural" | "noun" | "description" | "figure" | "fieldRoles" | "lifecycle" | "people">(key: K) => (spec[key] ? { [key]: spec[key] } : {});
    return defineNode(kind, {
      fields: z.object(shape) as never,
      edges: edgeDecls,
      ...said("plural"),
      ...said("noun"),
      ...said("description"),
      ...(labelParts ? { label: (node: { id: string }) => renderTemplate(labelParts, { node: node as AnyGraphNode, kinds: shapes, today: today(), money }) || node.id } : {}),
      ...(describeParts ? { describe: (node: { id: string }) => renderTemplate(describeParts, { node: node as AnyGraphNode, kinds: shapes, today: today(), money }) } : {}),
      ...said("lifecycle"),
      ...said("figure"),
      ...said("fieldRoles"),
      ...said("people"),
      archives: spec.archives,
      ...(spec.tidying ? { tidying: spec.tidying } : {}),
      // As the document says them, each the compile read as a length of time saying `as: "duration"` (`durations.ts`).
      ...(computed.length > 0 ? { computed: Object.fromEntries(computed.map(([n, c]) => [n, durations?.includes(n) ? { ...c, as: "duration" } : spec.computed![n]])) } : {}),
      ...(named || spec.glance || spec.page
        ? { display: { ...(named ? { labels } : {}), ...(spec.glance ? { glance: [...spec.glance] } : {}), ...(spec.page ? { page: spec.page } : {}) } }
        : {}),
      ...(Object.keys(defaults).length > 0 ? { defaults } : {}),
    } as never);
  });
  const schema = createSchema(definitions as never, document.computed);

  function labelFor(node: AnyGraphNode): string {
    const definition = (schema as unknown as { tryDefinition(kind: string): { label?: (n: unknown) => string } | undefined }).tryDefinition(node.kind);
    return definition?.label?.(node) ?? node.id;
  }

  // ── acts ─────────────────────────────────────────────────────────────────
  /** A record of a kind as it is made: its defaults, before what an act sets. */
  const blank = (kind: string): Record<string, unknown> => ({ id: "", kind, ...madeAs.get(kind) });
  const mutations: AnyMutationDefinition[] = [];
  for (const [name, act] of Object.entries(document.acts ?? {})) {
    const planned = plan.acts[name]!;
    const { title, effects, guard, refusal, destructive, idempotent, creates, connects, severs, writes, writesOther, sets } = planned;
    const args = new Map(planned.args);
    const shape: Record<string, z.ZodMiniType> = {};
    for (const [arg, a] of args) shape[arg] = argSchema(a, money);
    const subjectKinds: readonly string[] = [act.on ?? []].flat();
    const exprs = new Map(planned.exprs);
    /*
     * WHAT A CREATING ACT MADE, BY ITS OWN LABEL. With no subject, the line
     * the log keeps took the first string argument, which is whatever the
     * caller happened to send first: "Add a feature: framework" for a
     * feature named in another field. The first record the act creates is
     * labeled from the arguments its fields are set from.
     */
    const creation = effects.find((e): e is Extract<ActEffect, { create: string }> => "create" in e);
    /** What an effect's value is, as the act works it out: an expression, a literal (`$$` saying one `$`), the time or an argument. */
    const valueOf = (value: ValueSpec, bindings: Record<string, unknown>, graph: GraphReader, subject: AnyGraphNode | null = null): unknown => {
      if (isRecord(value) && "expr" in value) return evaluateExpr(exprs.get(value.expr)!, { graph, subject, kinds: shapes, bindings: bindings as Record<string, Value>, today: today() });
      const ref = refName(value);
      return ref === undefined ? (typeof value === "string" && value.startsWith("$$") ? value.slice(1) : value) : ref === "now" ? new Date().toISOString() : ref === "today" ? today() : bindings[ref];
    };
    /*
     * Labeled as it would be made: its defaults, then what the act sets (the review before 0.1.27).
     * THEN THE REST IT WAS GIVEN (FR-169), as the record says them: "Add a revenue stream: nascent"
     * was read as a stream called nascent, by the person and then by the model.
     */
    const madeLabel = (input: Record<string, unknown>, graph: GraphReader): string => {
      if (!creation) return "";
      const fields = document.kinds[creation.create]!.fields;
      const node = blank(creation.create);
      const given: string[] = [];
      for (const [field, value] of Object.entries(creation.set ?? {})) {
        try {
          node[field] = valueOf(value, input, graph) ?? node[field];
        } catch {
          // A value that cannot be worked out here is left unsaid: the act refuses it in its own words.
        }
        const arg = refName(value);
        // Every field it sets is one of the kind's: the reader refused any other (`act-field`).
        if (arg && input[arg] !== undefined) given.push(field);
      }
      const label = labelFor(node as unknown as AnyGraphNode).trim();
      // Said once: what the label already says, a no, a long text and a sentence held in a string (over 40 characters, or words ending in a stop that is not an abbreviation's, "Inc." or "U.S.") are not said again.
      const rest = given
        .filter((field) => node[field] !== false && fields[field]!.type !== "text" && !(/[^]{41}/.test(node[field] as string) || (/ .*[.!?]$/.test(node[field] as string) && !/[ .][A-Z]\w{0,3}\.$/.test(node[field] as string))) && labelFor({ ...node, [field]: undefined } as unknown as AnyGraphNode).trim() === label)
        .map((field) => (node[field] === true ? (fields[field]!.label ?? humanizeField(field)) : formatValue(node[field] as Value, fields[field]!.format as never, today(), [], money)));
      return label && rest.length > 0 ? `${label} (${rest.join(", ")})` : label;
    };

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
          // Never the first string it was handed (FR-169): that was a stream's maturity read as its name.
          const what = subject ? labelFor(subject) : madeLabel(input, graph);
          return what ? `${title}: ${what}` : title;
        },
        apply(context: MutationContext<never>, input: Record<string, unknown>) {
          const graph = context.graph as unknown as GraphReader;
          const subjectId = typeof input[SUBJECT_ARG] === "string" ? (input[SUBJECT_ARG] as string) : undefined;
          const subject = subjectId ? graph.getNode(subjectId) : undefined;
          if (subjectId && !subject) noRecord(subjectId);
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
          // A record is there when the graph has it or this act has just made it.
          const there = (id: string) => graph.has(id) || [...made.values()].includes(id);
          /*
           * A LINK IS SEVERED ONCE (FR-156). Every effect reads the graph as
           * it stood before the act, so `replaces` and a cardinality-one
           * connect each found the record's old link and each planned its
           * removal; the store refused the second, and the act with it.
           */
          const severed = new Set<string>();
          const sever = (edge: { readonly kind: string; readonly from: string; readonly to: string }) => {
            const key = edgeId(edge);
            if (severed.has(key)) return;
            severed.add(key);
            context.removeEdge(edge);
          };
          const resolve = (value: ValueSpec, current: AnyGraphNode | undefined): unknown => {
            const ref = refName(value);
            if (ref === "subject") return subjectId;
            // The acting person's own record of the people kind (Roadmap f-act-as-me), never an argument.
            if (ref === "me") {
              const me = context.me;
              if (me && document.kinds[graph.getNode(me)?.kind as string]?.people) return me;
              throw new ActRefusal(`"${title}" is done as you, and you have no record here`);
            }
            if (made.has(ref!)) return made.get(ref!);
            try {
              return valueOf(value, bindings, graph, current ?? subject ?? null);
            } catch (e) {
              if (e instanceof ExprEvalError) throw new ActRefusal(`"${title}" could not work out a value: ${e.sentence}`);
              throw e;
            }
          };
          for (const effect of effects) {
            if ("create" in effect) {
              const kind = document.kinds[effect.create]!;
              const node = blank(effect.create);
              for (const [field, value] of Object.entries(effect.set ?? {})) {
                const v = resolve(value, undefined);
                if (v !== undefined) node[field] = v;
              }
              const labelField = defaultLabelField(kind);
              const id = context.freshId(String((labelField && node[labelField]) ?? effect.create), effect.create);
              context.addNode({ ...node, id } as never);
              if (effect.as) made.set(effect.as, id);
            } else if ("connect" in effect || "sever" in effect) {
              const kind = "connect" in effect ? effect.connect : effect.sever;
              const from = String(resolve(effect.from, undefined) ?? "");
              const to = String(resolve(effect.to, undefined) ?? "");
              if (!there(from)) noRecord(from);
              if (!there(to)) noRecord(to);
              if ("connect" in effect) {
                if (edges.get(kind)?.cardinality === "one") for (const existing of graph.out(from, kind)) if (existing.id !== to) sever({ kind, from, to: existing.id });
                if (!graph.out(from, kind).some((n) => n.id === to)) context.addEdge({ kind, from, to });
              } else {
                sever({ kind, from, to });
              }
            } else if ("set" in effect) {
              const targetId = String(resolve(effect.target ?? "$subject", undefined) ?? "");
              const target = graph.getNode(targetId);
              if (!target && !there(targetId)) noRecord(targetId);
              const patch: Record<string, unknown> = {};
              for (const [field, value] of Object.entries(effect.set)) {
                const v = resolve(value, target);
                if (v !== undefined) patch[field] = v;
              }
              if (Object.keys(patch).length > 0) context.patchNode(targetId, patch);
            } else if ("remove" in effect) {
              const id = String(resolve(effect.remove, undefined) ?? "");
              if (!graph.has(id)) noRecord(id);
              context.removeNode(id);
            } else if ("replace" in effect && subject) {
              // The subject's links of each relation, at its own end, severed — all but the one being made (FR-115).
              const kept = input["to"];
              for (const relation of effect.replace) {
                const fromSubject = edges.get(relation)?.from.includes(subject.kind) ?? true;
                for (const other of fromSubject ? graph.out(subject.id, relation) : graph.in(subject.id, relation)) {
                  if (relation === effect.keep && other.id === kept) continue;
                  sever(fromSubject ? { kind: relation, from: subject.id, to: other.id } : { kind: relation, from: other.id, to: subject.id });
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
    // The store's day when it hands one (pinned, or ticked: FR-176), else the clock.
    const judge = (graph: GraphReader, subject: AnyGraphNode | null, day = today(), linked?: LinkedReader): Violation[] => {
      // A link to another app that could not be read is noted (FR-171): a rule that holds without it holds; one that does not cannot be judged, and says why.
      const unread: UnreadLink[] = [];
      const ctx = { graph, subject, kinds: shapes, today: day, ...(linked ? { linked } : {}), onUnread: (u: UnreadLink) => unread.push(u) };
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
        if (!holds && unread.length > 0) throw new ExprEvalError(`it reads ${unreadSaid(unread[0]!)}`, 0);
      } catch (e) {
        if (e instanceof ExprBudgetError) throw new RuleBudgetError(e.sentence);
        if (e instanceof ExprEvalError) throw new Error(e.sentence);
        throw e;
      }
      if (holds) return [];
      const repairList: Repair[] = repairs.flatMap((r) => {
        const act = document.acts?.[r.act];
        const args: Record<string, unknown> = {};
        /*
         * AN ACT ON THE OTHER END OF A RELATION. A rule over findings that
         * wants each serious one to have an initiative is repaired by
         * `resolve-finding`, an act on the initiative read from the finding
         * as "Name the work that fixes it" — so it is handed the finding as
         * its far end, and the initiative is the question left open, as a
         * record page standing on the finding offers it.
         */
        const far = subject && act?.on && act.fromTheOtherEnd && ![act.on].flat().includes(subject.kind) ? farEndArg(plan.acts[r.act]!.args, subject.kind) : undefined;
        if (far) args[far] = subject!.id;
        else if (subject && (act?.on || /^(edit|remove|archive|unarchive|merge|skip|detach|split)-/.test(r.act))) args[SUBJECT_ARG] = subject.id;
        for (const [k, v] of Object.entries(r.args ?? {})) args[k] = refName(v) === "subject" ? subject?.id : v;
        const declared = act ? plan.acts[r.act]!.args : [];
        const missing = declared.filter(([k, a]) => a.required && args[k] === undefined).map(([k]) => k);
        // Said as the act reads from where the rule stands: from the finding, "Name the work that fixes it".
        return [{ mutation: r.act, label: r.label ?? (far ? act!.fromTheOtherEnd : act?.title) ?? r.act.replace(/-/g, " "), args, ...(missing.length > 0 ? { missing } : {}) }];
      });
      return [
        {
          invariant: name,
          ...(subject ? { subjectId: subject.id } : {}),
          label: title,
          message: says ? renderTemplate(says, { node: subject, kinds: shapes, graph, today: day, money }) : subject ? `${labelFor(subject)}: ${title}` : title,
          nodeIds: subject ? [subject.id] : [],
          repairs: repairList,
        },
      ];
    };
    const declared = {
      label: title,
      // What its line is said from (`@graview/core/lines`): data, so a page that judges carries no words.
      shape: { over: rule.over, require, when, says, declared: document.kinds, money, kinds: shapes, today },
      judgment: { require: rule.require, ...(rule.when ? { when: rule.when } : {}), ...(rule.says ? { says: rule.says } : {}) },
      ...(rule.description ? { description: rule.description } : {}),
      ...(repairs.length > 0 ? { repairs: repairs.map((r) => r.act) } : {}),
    };
    invariants.push(
      (rule.over === "graph"
        ? defineInvariant(name, { scope: "graph", ...declared, evaluate: ({ graph, today: day, context }: { graph: unknown; today?: string; context?: { linked?: LinkedReader } }) => judge(graph as GraphReader, null, day, context?.linked) } as never)
        : defineInvariant(name, { scope: { kind: rule.over }, ...declared, evaluate: ({ graph, subject, today: day, context }: { graph: unknown; subject: unknown; today?: string; context?: { linked?: LinkedReader } }) => judge(graph as GraphReader, subject as AnyGraphNode, day, context?.linked) } as never)) as InvariantDefinition,
    );
  }

  // ── policy, brand, the rest ──────────────────────────────────────────────
  /*
   * WHO SEES WHAT is the app's, in the framework's one meaning (FR-02):
   * absent, everybody sees everything; present, a kind no sight names is
   * seen by nobody but the system, and `own` is the principal's own records.
   */
  const policy: Policy | undefined = document.policy && { ...(document.policy as Policy), ...(document.roles ? { roles: document.roles } : {}) };

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
    // The calendars and other systems it is kept in step with: data a host runs (`runConnections`).
    ...(document.connections ? { connections: document.connections as never } : {}),
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
