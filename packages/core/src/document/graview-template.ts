import * as z from "zod";
import type { GraphReader } from "../graph/types.js";
import type { Primitive } from "../graph/primitives.js";
import { unseated } from "../binding-served.js";
import type { CompiledDocument } from "./compile.js";
import { analyzeExpr } from "./expr/analyze.js";
import { evaluateExpr, ExprEvalError, type Value } from "./expr/evaluate.js";
import { ExprSyntaxError, parseExpr } from "./expr/parse.js";
import { error, type Finding } from "./findings.js";
import { parseTimeOfDay } from "../time-typed.js";
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
 *
 * Cloud's additions of 2026-11, read here the same way: a question may be a
 * `time` (an answer "3 PM" is kept as "15:00"); setup words may say
 * `${id}` where a letter follows the answer (`"${date}T09:30:00"`), and a
 * question may say an earlier one's (`"Who is coming to ${place}?"`); and a
 * template may come with views — `frameViews` (pages in a sandboxed frame)
 * and `views` (curated worker views, each its manifest), their code kept
 * beside the template as `views/<template id>/<name>.html` or `.js`.
 */

export const TEMPLATE_FORMAT = "graview-template";
export const TEMPLATE_FORMAT_VERSION = 1;

const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
/** Question ids are identifiers, so an `if` can say them bare: `present(budget)`. */
const QUESTION_ID = /^[a-z][A-Za-z0-9]*$/;
/** The name `forEach` binds each list entry to. */
const ITEM = "item";

/** `time` is a time of day, kept as "15:00": an answer said "3 PM" or "3:30pm" is read as one. */
export const TEMPLATE_QUESTION_TYPES = ["string", "text", "number", "date", "time", "list", "choice"] as const;

/*
 * A template's shape, built the first time one is read rather than when the
 * module loads (`TemplateSpec` is `z.lazy` over it): what imports the
 * document format and never reads a template builds none of it.
 */
function buildShapes() {
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

  const SeedNodeSpec = z.object({ id: z.string().min(1).max(200), kind: z.string().min(1) }).catchall(z.unknown());

  const SeedSpec = z
    .object({
      nodes: z.array(SeedNodeSpec).max(500),
      edges: z.array(z.object({ kind: z.string().min(1), from: z.string().min(1), to: z.string().min(1) }).strict()).max(2000).default([]),
      /** The day the examples were written against; their dates move with the calendar. */
      anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })
    .strict();

  /** A view's name: 2–40 lower-case letters, digits and hyphens, as a worker view's manifest says it. */
  const viewName = z.string().regex(/^[a-z][a-z0-9-]{1,39}$/, "a view's name is 2–40 lowercase letters, digits and hyphens");

  /*
   * A FRAME VIEW THE TEMPLATE COMES WITH: a page somebody wrote, drawn in a
   * sandboxed frame of its own, for a kind (`many`: a place titled `title`;
   * `one`: on each record's page). The template names it and what it reads;
   * its page is kept beside the template, never inside it.
   */
  const FrameView = z
    .object({
      name: viewName,
      kind: z.string().min(1),
      cardinality: z.enum(["one", "many"]),
      title: z.string().min(1).max(60).optional(),
      reads: z.object({ kinds: z.array(z.string().min(1)).max(20).optional(), edges: z.array(z.string().min(1)).max(20).optional() }).strict().optional(),
    })
    .strict();

  /*
   * A VIEW CURATED FROM A CHAT (a worker view): its manifest, as a host keeps
   * one — `name`, `attach` (a kind, or "home"), `cardinality`, `title`, and
   * the rest of a worker view's manifest (`reads`, `acts`, `pictures`,
   * `bleed`, `heading` …), which the host that installs it judges as it
   * judges any view. Its script is kept beside the template, as
   * `views/<template id>/<name>.js`, never inside it: a template is data.
   */
  const WorkerView = z
    .object({
      name: viewName,
      attach: z.string().min(1),
      cardinality: z.enum(["one", "many"]),
      title: z.string().min(1).max(60).optional(),
    })
    .catchall(z.unknown());

  const TemplateSpec = z
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
      frameViews: z.array(FrameView).max(5).optional(),
      views: z.array(WorkerView).max(5).optional(),
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
      const named = new Set<string>();
      [...(t.frameViews ?? []), ...(t.views ?? [])].forEach((v) => {
        if (named.has(v.name)) ctx.addIssue({ code: "custom", message: `two views are called "${v.name}"`, path: ["views"] });
        named.add(v.name);
      });
    });
  return { QuestionSpec, SetupStepSpec, SeedNodeSpec, SeedSpec, FrameView, WorkerView, TemplateSpec };
}
let shapes: ReturnType<typeof buildShapes> | undefined;
type Shapes = ReturnType<typeof buildShapes>;
const templateShapes = (): Shapes => (shapes ??= buildShapes());

export const TemplateSpec = z.lazy(() => templateShapes().TemplateSpec);
export type TemplateQuestion = z.infer<Shapes["QuestionSpec"]>;
export type TemplateSetupStep = z.infer<Shapes["SetupStepSpec"]>;
export type TemplateSeedNode = z.infer<Shapes["SeedNodeSpec"]>;
export type TemplateSeed = z.infer<Shapes["SeedSpec"]>;
export type TemplateFrameView = z.infer<Shapes["FrameView"]>;
export type TemplateWorkerView = z.infer<Shapes["WorkerView"]>;
export type GraviewTemplate = z.infer<Shapes["TemplateSpec"]>;

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

/** The example content as primitives, for a store to apply as one batch of its own. */
export function templateSeedPrimitives(seed: TemplateSeed, document: GraviewDocument): Primitive[] {
  return [
    // A template never says whose record a person is: bindings stay in the installation that made them.
    ...seed.nodes.map((node): Primitive => ({ op: "add-node", node: unseated(withDefaults(node, document)) as never })),
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
    case "time": {
      // "3 PM", "3:30pm", "15:00" — kept as "15:00"; a bare "3" is not said clearly enough to be one.
      const t = parseTimeOfDay(value);
      return t ? { ok: true, value: t } : no(`"${q.id}" needs a time of day, like 15:00 or 3 PM — ${quoted(value)} is not one`);
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

export function resolveAnswers(questions: readonly TemplateQuestion[], answers: Readonly<Record<string, unknown>>): { readonly ok: true; readonly answers: Record<string, unknown> } | { readonly ok: false; readonly findings: Finding[] } {
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

/**
 * WHAT SETUP WORDS NAME: `$name`; `${name}`, where a letter or a digit
 * follows the answer (`"${date}T09:30:00"`, `"${dinnerTime}:00"`); and `$$`,
 * a dollar as it is written.
 */
const REF = /\$(\$|\{[a-z][A-Za-z0-9]*\}|[a-z][A-Za-z0-9]*)/g;
const refName = (ref: string): string => (ref.startsWith("{") ? ref.slice(1, -1) : ref);
const ABSENT = Symbol("absent");

function refsIn(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof value === "string") {
    for (const m of value.matchAll(REF)) if (m[1] !== "$") into.add(refName(m[1]!));
  } else if (Array.isArray(value)) {
    value.forEach((v) => refsIn(v, into));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((v) => refsIn(v, into));
  }
  return into;
}

/** The `${id}`s a question's words name. */
function bracedIn(words: string): string[] {
  return [...words.matchAll(/\$\$|\$\{([a-z][A-Za-z0-9]*)\}/g)].flatMap((m) => (m[1] === undefined ? [] : [m[1]]));
}

/**
 * A QUESTION AS IT IS ASKED, with the earlier answers it names read into
 * it: "Who is coming to ${place}?" asks "Who is coming to our place?". An
 * answer not given is said as nothing, as setup words say it.
 */
export function questionAsked(question: Pick<TemplateQuestion, "ask">, answers: Readonly<Record<string, unknown>>): string {
  // `$$` is a dollar as it is written, as in setup words: "$${place}" says "${place}".
  return question.ask.replace(/\$\$|\$\{([a-z][A-Za-z0-9]*)\}/g, (_: string, name: string | undefined) => {
    if (name === undefined) return "$";
    const answer = answers[name];
    return answer === undefined || answer === null ? "" : Array.isArray(answer) ? answer.join(", ") : String(answer);
  });
}

/**
 * THE VIEWS A TEMPLATE COMES WITH name only what its document declares: a
 * frame view's kind, a curated view's `attach` ("home" or a kind), the
 * kinds and relations each reads, and the acts a curated view may ask for.
 * The rest of a view's manifest is the installing host's to judge, as it
 * judges any view; a name the document lacks is the template's mistake,
 * said before anybody installs it.
 */
function checkViews(template: GraviewTemplate, compiled: CompiledDocument): Finding[] {
  const findings: Finding[] = [];
  const schema = compiled.app.schema;
  const acts = new Set((compiled.app.mutations ?? []).map((m) => m.name));
  const isKind = (kind: string) => schema.tryDefinition(kind) !== undefined;
  const reads = (at: string, read: unknown) => {
    if (!read || typeof read !== "object") return;
    const { kinds, edges } = read as { kinds?: unknown; edges?: unknown };
    if (Array.isArray(kinds)) kinds.forEach((kind, k) => typeof kind === "string" && !isKind(kind) && findings.push(error("view", `${at}.reads.kinds.${k}`, `"${kind}" is not a kind of this template's document`)));
    if (Array.isArray(edges)) edges.forEach((edge, k) => typeof edge === "string" && !schema.edge(edge) && findings.push(error("view", `${at}.reads.edges.${k}`, `"${edge}" is not a relation of this template's document`)));
  };
  (template.frameViews ?? []).forEach((view, i) => {
    const at = `frameViews.${i}`;
    if (!isKind(view.kind)) findings.push(error("view", `${at}.kind`, `"${view.kind}" is not a kind of this template's document`));
    reads(at, view.reads);
  });
  (template.views ?? []).forEach((view, i) => {
    const at = `views.${i}`;
    if (view.attach === "home" ? view.cardinality !== "many" : !isKind(view.attach)) {
      findings.push(error("view", `${at}.attach`, view.attach === "home" ? 'a view of the home is a view of many: "cardinality": "many"' : `"${view.attach}" is not a kind of this template's document, nor "home"`));
    }
    reads(at, view["reads"]);
    const asked = view["acts"];
    if (Array.isArray(asked)) {
      asked.forEach((entry, k) => {
        const name = typeof entry === "string" ? entry : entry && typeof entry === "object" ? (entry as { act?: unknown }).act : undefined;
        if (typeof name === "string" && !acts.has(name)) findings.push(error("view", `${at}.acts.${k}`, `"${name}" is not an act of this template's document`));
      });
    }
  });
  return findings;
}

/**
 * `"$budget"` is the answer itself (a number stays a number) or nothing at
 * all; `"Trip to $place"` and `"${date}T09:30:00"` read it into the words —
 * so `"${budget}"` alone is the answer as words, as Graview Cloud reads it.
 */
function substitute(value: unknown, scope: Readonly<Record<string, unknown>>): unknown {
  if (typeof value === "string") {
    const whole = /^\$([a-z][A-Za-z0-9]*)$/.exec(value);
    if (whole) return whole[1]! in scope ? scope[whole[1]!] : ABSENT;
    return value.replace(REF, (_, ref: string) => {
      if (ref === "$") return "$";
      const one = refName(ref);
      return one in scope ? String(scope[one] ?? "") : "";
    });
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
export function checkTemplate(template: GraviewTemplate, compiled: CompiledDocument): Finding[] {
  const findings: Finding[] = [];
  const acts = new Set((compiled.app.mutations ?? []).map((m) => m.name));
  const questions = new Map(template.questions.map((q) => [q.id, q]));

  template.questions.forEach((q, i) => {
    // A question may say an earlier answer, `${id}`: "Who is coming to ${place}?" — asked in order, it is known by then.
    for (const name of bracedIn(q.ask)) {
      const at = template.questions.findIndex((one) => one.id === name);
      if (at === -1) findings.push(error("question", `questions.${i}.ask`, `"\${${name}}" is not one of the questions`));
      else if (at >= i) findings.push(error("question", `questions.${i}.ask`, `"\${${name}}" is ${at === i ? "this question" : "asked after this one"}, so its answer is not known yet`));
    }
    if (q.default === undefined) return;
    const c = coerceAnswer(q, q.default);
    if (!c.ok) findings.push(error("question", `questions.${i}.default`, `the default does not answer its own question: ${c.sentence}`));
  });

  findings.push(...checkViews(template, compiled));

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
      if (!inScope.has(ref)) findings.push(setupFinding(i, ".args", ref === ITEM ? `"$${ITEM}" only means something inside a forEach` : `"$${ref}" is not one of the questions; this template asks about ${[...questions.keys()].map((k) => `"${k}"`).join(", ") || "nothing"}`));
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

export function expandSetup(template: GraviewTemplate, answers: Readonly<Record<string, unknown>>): { readonly ok: true; readonly calls: TemplateCall[] } | { readonly ok: false; readonly findings: Finding[] } {
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

export function withDefaults(node: TemplateSeedNode, document: GraviewDocument): TemplateSeedNode {
  const defaults: Record<string, unknown> = {};
  for (const [field, spec] of Object.entries(document.kinds[node.kind]?.fields ?? {})) if (spec.default !== undefined) defaults[field] = spec.default;
  return { ...defaults, ...node };
}

const DAY = 86_400_000;

/** Every date in the examples moved by the days between their anchor and today. */
export function shiftSeed(seed: TemplateSeed, document: GraviewDocument, today: string): TemplateSeed {
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
