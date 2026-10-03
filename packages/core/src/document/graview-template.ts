import { z } from "zod";
import type { GraphReader } from "../index.js";
import type { Primitive } from "../graph/primitives.js";
import { compileDocument, type CompileOptions, type CompiledDocument } from "./compile.js";
import { analyzeExpr } from "./expr/analyze.js";
import { evaluateExpr, ExprEvalError, type Value } from "./expr/evaluate.js";
import { ExprSyntaxError, parseExpr } from "./expr/parse.js";
import { error, type Finding } from "./findings.js";
import type { GraviewDocument } from "./schema.js";

/*
 * A GRAVIEW TEMPLATE, v1 (FR-08): a declaration document, the questions a
 * person answers to set it up, what those answers do as ordinary acts,
 * optional example content, and what a gallery shows of it. It is data, so
 * installing one runs no code — and it is Graview Cloud's shape exactly
 * (graview-cloud docs/templates.md), so a template made and shared there
 * scaffolds a self-hosted project here, and instantiates into a store here,
 * with no Cloud in the room. That is the whole anti-lock-in claim.
 *
 * The document is typed loosely on purpose: `compileDocument` is the one
 * judge of a document, and it says what is wrong in its own sentences.
 */

export const TEMPLATE_FORMAT = "graview-template";
export const TEMPLATE_FORMAT_VERSION = 1;

const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
/** Question ids are identifiers, so an `if` can say them bare: `present(budget)`. */
const QUESTION_ID = /^[a-z][A-Za-z0-9]*$/;
/** The name `forEach` binds each list entry to. */
const ITEM = "item";

export const TEMPLATE_QUESTION_TYPES = ["string", "text", "number", "date", "list", "choice"] as const;

const QuestionSpec = z
  .object({
    id: z
      .string()
      .regex(QUESTION_ID, 'question ids are one word or camelCase, like "budget" or "startDate"')
      .refine((id) => id !== ITEM, `"${ITEM}" is kept for the current entry of a forEach`),
    ask: z.string().min(1).max(200),
    type: z.enum(TEMPLATE_QUESTION_TYPES),
    options: z.array(z.string().min(1).max(80)).min(1).max(50).optional(),
    default: z.unknown().optional(),
    optional: z.boolean().optional(),
  })
  .strict()
  .superRefine((q, ctx) => {
    if (q.type === "choice" && !q.options) ctx.addIssue({ code: "custom", message: 'a choice question lists its "options"', path: ["options"] });
    if (q.options && q.type !== "choice" && q.type !== "list") ctx.addIssue({ code: "custom", message: '"options" belongs only on a choice or list question', path: ["options"] });
  });
export type TemplateQuestion = z.infer<typeof QuestionSpec>;

const SetupStepSpec = z
  .object({
    act: z.string().regex(KEBAB, 'act names are lower-case words joined by hyphens, like "add-category"'),
    args: z.record(z.string(), z.unknown()).default({}),
    /** A rule-language expression over the answers; the step runs only when it is true. */
    if: z.string().min(1).max(500).optional(),
    /** `$<listQuestion>`: run the act once per entry, with `$item` bound to the entry. */
    forEach: z.string().regex(/^\$[a-z][A-Za-z0-9]*$/, 'forEach names a list question, like "$categories"').optional(),
  })
  .strict();
export type TemplateSetupStep = z.infer<typeof SetupStepSpec>;

const SeedNodeSpec = z.object({ id: z.string().min(1).max(200), kind: z.string().min(1) }).catchall(z.unknown());
export type TemplateSeedNode = z.infer<typeof SeedNodeSpec>;

const SeedSpec = z
  .object({
    nodes: z.array(SeedNodeSpec).max(500),
    edges: z.array(z.object({ kind: z.string().min(1), from: z.string().min(1), to: z.string().min(1) }).strict()).max(2000).default([]),
    /** The day the examples were written against; their dates move with the calendar. */
    anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();
export type TemplateSeed = z.infer<typeof SeedSpec>;

export const TemplateSpec = z
  .object({
    format: z.literal(TEMPLATE_FORMAT),
    formatVersion: z.literal(TEMPLATE_FORMAT_VERSION),
    id: z.string().regex(KEBAB, 'template ids are lower-case words joined by hyphens, like "vendor-shortlist"'),
    version: z.number().int().min(1),
    title: z.string().min(1).max(80),
    pitch: z.string().min(1).max(200),
    useCases: z.array(z.string().min(1).max(40)).max(20),
    document: z.record(z.string(), z.unknown()),
    seed: SeedSpec.optional(),
    questions: z.array(QuestionSpec).max(12),
    setup: z.array(SetupStepSpec).max(50),
    readme: z.string().min(1).max(20_000),
    screenshots: z.array(z.string().min(1)).max(10),
    author: z.object({ workspace: z.string().min(1), name: z.string().min(1) }).strict(),
    remixedFrom: z.union([z.string().min(1), z.null()]),
    license: z.string().min(1).max(40),
  })
  .strict()
  .superRefine((t, ctx) => {
    const seen = new Set<string>();
    t.questions.forEach((q, i) => {
      if (seen.has(q.id)) ctx.addIssue({ code: "custom", message: `two questions are called "${q.id}"`, path: ["questions", i, "id"] });
      seen.add(q.id);
    });
  });
export type GraviewTemplate = z.infer<typeof TemplateSpec>;

/** Whether some JSON says it is a template (rather than a bare document). Says nothing about whether it is a good one. */
export function isGraviewTemplate(raw: unknown): boolean {
  return typeof raw === "object" && raw !== null && (raw as { format?: unknown }).format === TEMPLATE_FORMAT;
}

/** Parse a template, saying what is wrong with it in findings with a path. */
export function readGraviewTemplate(raw: unknown): { readonly ok: true; readonly template: GraviewTemplate } | { readonly ok: false; readonly findings: readonly Finding[] } {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      return { ok: false, findings: [error("not-json", "", `this is not JSON: ${(e as Error).message}`)] };
    }
  }
  const parsed = TemplateSpec.safeParse(raw);
  if (parsed.success) return { ok: true, template: parsed.data };
  return {
    ok: false,
    findings: parsed.error.issues.map((issue) => {
      const path = issue.path.map(String).join(".");
      return error("template", path, issue.code === "unrecognized_keys" ? `${issue.keys.map((k) => `"${k}"`).join(", ")} is not part of a template` : issue.message);
    }),
  };
}

/** One act call setup makes: an ordinary call, with the sentence the history says it was for. */
export interface TemplateCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly intent: string;
}

export interface InstantiatedTemplate {
  readonly ok: true;
  readonly template: GraviewTemplate;
  readonly document: GraviewDocument;
  readonly compiled: CompiledDocument;
  /** The answers after defaults and coercion; an unanswered optional question is absent. */
  readonly answers: Readonly<Record<string, unknown>>;
  /** The setup, expanded into act calls in the order the template lists them. */
  readonly setup: readonly TemplateCall[];
  /** The example content with its kinds' defaults filled in and its dates moved to today. */
  readonly seed?: TemplateSeed;
}

export interface RefusedTemplate {
  readonly ok: false;
  readonly findings: readonly Finding[];
}

/**
 * A template, made ready to install: its shape read, its document compiled
 * through the same compiler every document goes through, the answers held to
 * the questions, the setup expanded, and the example content judged against
 * the compiled schema. Everything is judged before anything happens; what
 * comes back is data a store applies.
 *
 * Setup may only create things or act on nothing: an answer can name a
 * category, never "the category made two steps ago".
 */
export function instantiateTemplate(raw: unknown, answers: Readonly<Record<string, unknown>> = {}, options: CompileOptions = {}): InstantiatedTemplate | RefusedTemplate {
  const read = readGraviewTemplate(raw);
  if (!read.ok) return read;
  const template = read.template;

  const compiled = compileDocument(template.document, options);
  if (!compiled.ok) return { ok: false, findings: compiled.findings.map((f) => ({ ...f, path: f.path ? `document.${f.path}` : "document" })) };

  const authoring = checkTemplate(template, compiled);
  if (authoring.length > 0) return { ok: false, findings: authoring };

  const resolved = resolveAnswers(template.questions, answers);
  if (!resolved.ok) return { ok: false, findings: resolved.findings };

  const setup = expandSetup(template, resolved.answers);
  if (!setup.ok) return { ok: false, findings: setup.findings };

  const today = options.today?.() ?? new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    template,
    document: compiled.document,
    compiled,
    answers: resolved.answers,
    setup: setup.calls,
    ...(template.seed ? { seed: shiftSeed({ ...template.seed, nodes: template.seed.nodes.map((n) => withDefaults(n, compiled.document)) }, compiled.document, today) } : {}),
  };
}

/** The example content as primitives, for a store to apply as one batch of its own. */
export function templateSeedPrimitives(seed: TemplateSeed, document: GraviewDocument): Primitive[] {
  return [
    ...seed.nodes.map((node): Primitive => ({ op: "add-node", node: withDefaults(node, document) as never })),
    ...seed.edges.map((edge): Primitive => ({ op: "add-edge", edge })),
  ];
}

// ── answers ────────────────────────────────────────────────────────────────

const answerFinding = (question: string, message: string): Finding => error("answer", `answers.${question}`, message);
const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
const quoted = (v: unknown) => (typeof v === "string" ? `"${v}"` : (JSON.stringify(v) ?? String(v)));

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function coerceAnswer(q: TemplateQuestion, value: unknown): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly sentence: string } {
  const no = (sentence: string) => ({ ok: false as const, sentence });
  switch (q.type) {
    case "string":
    case "text": {
      if (typeof value !== "string" && typeof value !== "number") return no(`"${q.id}" is asked as words (${q.ask}), and ${quoted(value)} is not words`);
      const s = String(value).trim();
      const max = q.type === "string" ? 500 : 20_000;
      return s.length > max ? no(`"${q.id}" may be at most ${max} characters; this answer is ${s.length}`) : { ok: true, value: s };
    }
    case "number": {
      const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[,_\s]/g, "")) : Number.NaN;
      return Number.isFinite(n) ? { ok: true, value: n } : no(`"${q.id}" needs a number, like 5000 — ${quoted(value)} is not one`);
    }
    case "date": {
      const s = typeof value === "string" ? value.trim() : "";
      return validDate(s) ? { ok: true, value: s } : no(`"${q.id}" needs a date written like 2026-10-02 — ${quoted(value)} is not one`);
    }
    case "list": {
      const entries = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n]/) : undefined;
      if (!entries) return no(`"${q.id}" needs a list, like ["one", "two"] — ${quoted(value)} is not one`);
      const items: string[] = [];
      for (const entry of entries) {
        if (typeof entry !== "string" && typeof entry !== "number") return no(`each entry of "${q.id}" is words, and ${quoted(entry)} is not`);
        const s = String(entry).trim();
        if (s === "") continue;
        if (s.length > 500) return no(`an entry of "${q.id}" may be at most 500 characters`);
        const option = q.options ? q.options.find((o) => o.toLowerCase() === s.toLowerCase()) : s;
        if (option === undefined) return no(`"${s}" is not one of the choices for "${q.id}": ${q.options!.join(", ")}`);
        if (!items.includes(option)) items.push(option);
      }
      return items.length > 50 ? no(`"${q.id}" may have at most 50 entries; this answer has ${items.length}`) : { ok: true, value: items };
    }
    case "choice": {
      const s = typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : undefined;
      const option = s === undefined ? undefined : q.options!.find((o) => o.toLowerCase() === s.toLowerCase());
      return option === undefined ? no(`"${q.id}" is one of ${q.options!.map((o) => `"${o}"`).join(", ")} — ${quoted(value)} is not`) : { ok: true, value: option };
    }
  }
}

function resolveAnswers(questions: readonly TemplateQuestion[], answers: Readonly<Record<string, unknown>>): { readonly ok: true; readonly answers: Record<string, unknown> } | { readonly ok: false; readonly findings: Finding[] } {
  const findings: Finding[] = [];
  const out: Record<string, unknown> = {};
  const known = new Set(questions.map((q) => q.id));
  for (const key of Object.keys(answers)) {
    if (!known.has(key)) findings.push(answerFinding(key, `there is no question called "${key}"; this template asks about ${[...known].map((k) => `"${k}"`).join(", ") || "nothing"}`));
  }
  for (const q of questions) {
    const given = answers[q.id];
    const value = blank(given) ? q.default : given;
    if (blank(value)) {
      if (!q.optional) findings.push(answerFinding(q.id, `"${q.id}" needs an answer: ${q.ask}`));
      continue;
    }
    const coerced = coerceAnswer(q, value);
    if (!coerced.ok) findings.push(answerFinding(q.id, coerced.sentence));
    else if (!blank(coerced.value)) out[q.id] = coerced.value;
    else if (!q.optional) findings.push(answerFinding(q.id, `"${q.id}" needs an answer: ${q.ask}`));
  }
  return findings.length > 0 ? { ok: false, findings } : { ok: true, answers: out };
}

// ── setup ──────────────────────────────────────────────────────────────────

const REF = /\$(\$|[a-z][A-Za-z0-9]*)/g;
const ABSENT = Symbol("absent");

function refsIn(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof value === "string") {
    for (const m of value.matchAll(REF)) if (m[1] !== "$") into.add(m[1]!);
  } else if (Array.isArray(value)) {
    value.forEach((v) => refsIn(v, into));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((v) => refsIn(v, into));
  }
  return into;
}

/** `"$budget"` is the answer itself (a number stays a number) or nothing at all; `"Trip to $place"` reads it into the words. */
function substitute(value: unknown, scope: Readonly<Record<string, unknown>>): unknown {
  if (typeof value === "string") {
    const whole = /^\$([a-z][A-Za-z0-9]*)$/.exec(value);
    if (whole) return whole[1]! in scope ? scope[whole[1]!] : ABSENT;
    return value.replace(REF, (_, name: string) => (name === "$" ? "$" : name in scope ? String(scope[name] ?? "") : ""));
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, scope)).filter((v) => v !== ABSENT);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const s = substitute(v, scope);
      if (s !== ABSENT) out[k] = s;
    }
    return out;
  }
  return value;
}

const setupFinding = (i: number, at: string, message: string): Finding => error("setup", `setup.${i}${at}`, message);

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

/** What a template's author got wrong, independent of anybody's answers. */
function checkTemplate(template: GraviewTemplate, compiled: CompiledDocument): Finding[] {
  const findings: Finding[] = [];
  const acts = new Set((compiled.app.mutations ?? []).map((m) => m.name));
  const questions = new Map(template.questions.map((q) => [q.id, q]));

  template.questions.forEach((q, i) => {
    if (q.default === undefined) return;
    const c = coerceAnswer(q, q.default);
    if (!c.ok) findings.push(error("question", `questions.${i}.default`, `the default does not answer its own question: ${c.sentence}`));
  });

  template.setup.forEach((step, i) => {
    if (!acts.has(step.act)) findings.push(setupFinding(i, ".act", `"${step.act}" is not an act of this template's document`));
    const inScope = new Set(questions.keys());
    if (step.forEach) {
      const list = step.forEach.slice(1);
      const q = questions.get(list);
      if (!q) findings.push(setupFinding(i, ".forEach", `"${list}" is not one of the questions`));
      else if (q.type !== "list") findings.push(setupFinding(i, ".forEach", `forEach needs a list question, and "${list}" is a ${q.type}`));
      inScope.add(ITEM);
    }
    for (const ref of refsIn(step.args)) {
      if (!inScope.has(ref)) findings.push(setupFinding(i, ".args", ref === ITEM ? `"$${ITEM}" only means something inside a forEach` : `"$${ref}" is not one of the questions`));
    }
    if (step.if) {
      try {
        for (const name of analyzeExpr(parseExpr(step.if)).names) {
          if (!inScope.has(name)) findings.push(setupFinding(i, ".if", `"${name}" is not one of the questions`));
        }
      } catch (e) {
        if (!(e instanceof ExprSyntaxError)) throw e;
        findings.push(setupFinding(i, ".if", `${e.sentence} (at character ${e.at + 1})`));
      }
    }
  });

  if (template.seed) findings.push(...checkSeed(template.seed, compiled));
  return findings;
}

function expandSetup(template: GraviewTemplate, answers: Readonly<Record<string, unknown>>): { readonly ok: true; readonly calls: TemplateCall[] } | { readonly ok: false; readonly findings: Finding[] } {
  const calls: TemplateCall[] = [];
  const findings: Finding[] = [];
  const intent = `Set up from ${template.title}`;
  template.setup.forEach((step, i) => {
    const condition = step.if ? parseExpr(step.if) : undefined;
    const items: readonly unknown[] = step.forEach ? ((answers[step.forEach.slice(1)] as readonly unknown[] | undefined) ?? []) : [undefined];
    for (const item of items) {
      if (condition) {
        const bindings: Record<string, Value> = {};
        for (const q of template.questions) bindings[q.id] = (answers[q.id] ?? null) as Value;
        if (item !== undefined) bindings[ITEM] = item as Value;
        let holds: Value;
        try {
          holds = evaluateExpr(condition, { graph: EMPTY_GRAPH, subject: null, kinds: new Map(), bindings });
        } catch (e) {
          if (!(e instanceof ExprEvalError)) throw e;
          findings.push(setupFinding(i, ".if", `this condition could not be judged: ${e.sentence}`));
          return;
        }
        if (holds !== true) continue;
      }
      const scope: Record<string, unknown> = { ...answers, ...(item !== undefined ? { [ITEM]: item } : {}) };
      calls.push({ name: step.act, args: substitute(step.args, scope) as Record<string, unknown>, intent });
    }
  });
  return findings.length > 0 ? { ok: false, findings } : { ok: true, calls };
}

// ── seed ───────────────────────────────────────────────────────────────────

function checkSeed(seed: TemplateSeed, compiled: CompiledDocument): Finding[] {
  const findings: Finding[] = [];
  const schema = compiled.app.schema;
  const kindOf = new Map<string, string>();
  seed.nodes.forEach((node, i) => {
    const at = `seed.nodes.${i}`;
    if (kindOf.has(node.id)) findings.push(error("seed", `${at}.id`, `two example records are called "${node.id}"`));
    kindOf.set(node.id, node.kind);
    if (!schema.tryDefinition(node.kind)) {
      findings.push(error("seed", `${at}.kind`, `"${node.kind}" is not a kind of this template's document`));
      return;
    }
    try {
      schema.parseNode(withDefaults(node, compiled.document));
    } catch (e) {
      findings.push(error("seed", at, `the example ${node.kind} "${node.id}" does not fit its kind: ${(e as Error).message.split("\n")[0]}`));
    }
  });
  seed.edges.forEach((edge, i) => {
    const at = `seed.edges.${i}`;
    const from = kindOf.get(edge.from);
    const to = kindOf.get(edge.to);
    if (!from) findings.push(error("seed", `${at}.from`, `there is no example record "${edge.from}"`));
    if (!to) findings.push(error("seed", `${at}.to`, `there is no example record "${edge.to}"`));
    if (from && to && !schema.edgeAllowed(edge.kind, from, to)) findings.push(error("seed", at, `a "${edge.kind}" relation cannot run from a ${from} to a ${to}`));
  });
  return findings;
}

function withDefaults(node: TemplateSeedNode, document: GraviewDocument): TemplateSeedNode {
  const defaults: Record<string, unknown> = {};
  for (const [field, spec] of Object.entries(document.kinds[node.kind]?.fields ?? {})) if (spec.default !== undefined) defaults[field] = spec.default;
  return { ...defaults, ...node };
}

const DAY = 86_400_000;

/** Every date in the examples moved by the days between their anchor and today. */
function shiftSeed(seed: TemplateSeed, document: GraviewDocument, today: string): TemplateSeed {
  if (!seed.anchor) return seed;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${seed.anchor}T00:00:00Z`)) / DAY);
  if (!days) return seed;
  const move = (value: unknown, type: string): unknown => {
    if (typeof value !== "string") return value;
    const t = Date.parse(type === "date" ? `${value}T00:00:00Z` : value);
    if (Number.isNaN(t)) return value;
    const moved = new Date(t + days * DAY).toISOString();
    return type === "date" ? moved.slice(0, 10) : moved;
  };
  return {
    ...seed,
    nodes: seed.nodes.map((node) => {
      const out: Record<string, unknown> = { ...node };
      for (const [name, spec] of Object.entries(document.kinds[node.kind]?.fields ?? {})) {
        if (!(name in out)) continue;
        if (spec.type === "date" || spec.type === "datetime") out[name] = move(out[name], spec.type);
        else if (spec.type === "list" && spec.of === "date" && Array.isArray(out[name])) out[name] = (out[name] as unknown[]).map((v) => move(v, "date"));
      }
      return out as TemplateSeedNode;
    }),
  };
}
