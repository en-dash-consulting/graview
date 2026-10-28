import * as z from "../schema/zod.js";
import { analyzeExpr } from "../document/expr/analyze.js";
import { ExprSyntaxError, parseExpr } from "../document/expr/parse.js";
import { conditionProblems } from "../job-findings.js";
import { nearestAct } from "../mutations/act-spelling.js";
import type { GenerateStep } from "../workflow-shape.js";
import { DEFAULT_GENERATE_KEY, GENERATE_REFS, windowWordsProblem } from "./generate.js";
import { keyFields, kindWords } from "./step-act.js";
import type { StepCheck, StepKind, StepShapes, WorkflowFinding } from "./steps.js";
import type { WorkflowWorld } from "./world.js";

/*
 * MAKE DATED RECORDS FROM A PATTERN (Roadmap f-job-generate-from-pattern):
 *
 *   { "generate": "event",
 *     "from": [{ "kind": "routine", "where": "active", "dates": "startsAt" },
 *              { "kind": "plan-item", "dates": "date" }],
 *     "window": "next week",
 *     "set": { "name": { "expr": "name" }, "startsAt": "$date" },
 *     "link": "source" }
 *
 * For each day of the window a source record's date falls on — a date, a
 * date that repeats, a set of weekdays — one record of the kind made by the
 * act that makes it (`using`, where several do), its fields from `set` read
 * on the source with `date` the occurrence and `source` its record, linked
 * back through `link`, and made once per key (`{source}:{date}` unsaid).
 * What it wants is `generate.ts`'; running it is `@graview/tools/workflows`'.
 */

const withA = (noun: string): string => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;

const quoted = (names: Iterable<string>): string => [...names].map((name) => `"${name}"`).join(", ") || "none";

/** The acts that make records of a kind, by name. */
export const actsMaking = (world: WorkflowWorld, kind: string): string[] => world.acts.filter((act) => (world.actMakes(act) ?? []).includes(kind));

/** A step's set-workflow edit, with one step changed. */
function withStep(check: StepCheck, change: (step: Record<string, unknown>) => Record<string, unknown>): Record<string, unknown> {
  const steps = (check.declared["steps"] as readonly Record<string, unknown>[] | undefined) ?? [];
  return { op: "set-workflow", name: check.workflow, workflow: { ...check.declared, steps: steps.map((one, i) => (i === check.index ? change(one) : one)) } };
}

/** What is wrong with an expression a value reads on a source of a kind, with `date` and `source` beside its fields. */
function valueProblems(expr: string, kindName: string, world: WorkflowWorld): string[] {
  const kind = world.kinds.get(kindName);
  if (!kind) return [];
  let shape: ReturnType<typeof analyzeExpr>;
  try {
    shape = analyzeExpr(parseExpr(expr));
  } catch (e) {
    if (!(e instanceof ExprSyntaxError)) throw e;
    return [`"${expr}" does not read: ${e.sentence} (at character ${e.at + 1})`];
  }
  const problems: string[] = [];
  for (const fn of shape.unknownFunctions) problems.push(`"${expr}" calls "${fn}", which is not a function the rule language knows`);
  for (const name of shape.names) {
    if (name === "date" || name === "source" || name === "id" || name === "label" || kind.fields[name] || kind.edges.has(name) || kind.computed.includes(name)) continue;
    problems.push(`"${expr}" reads "${name}", and ${kindWords(kindName)} has no field, relation or computed field called that`);
  }
  return problems;
}

/** What is wrong with a window's expression: it reads no record, only the clock. */
function windowProblems(expr: string): string[] {
  try {
    const shape = analyzeExpr(parseExpr(expr));
    return [...shape.unknownFunctions.map((fn) => `"${expr}" calls "${fn}", which is not a function the rule language knows`), ...[...shape.names].map((name) => `"${expr}" reads "${name}", and a window reads no record — only the day, like startOfWeek(today()) + 7`)];
  } catch (e) {
    if (!(e instanceof ExprSyntaxError)) throw e;
    return [`"${expr}" does not read: ${e.sentence} (at character ${e.at + 1})`];
  }
}

export const generateStep: StepKind<GenerateStep> = {
  key: "generate",
  title: "Make dated records from a pattern",
  shape: (s: StepShapes) =>
    z.strictObject({
      generate: s.name("kind"),
      from: z.array(z.strictObject({ kind: s.name("kind"), where: z.optional(s.expression), dates: s.str(1, 80) })).check(z.minLength(1), z.maxLength(12)),
      window: z.union([s.str(1, 40), z.strictObject({ from: s.expression, to: s.expression })]),
      set: z.optional(z.record(z.string(), s.value)),
      key: z.optional(s.str(1, 300)),
      link: z.optional(s.str(1, 80)),
      using: z.optional(s.name("act")),
      overwrite: z.optional(z.boolean()),
      approve: z.optional(s.approve),
    }),
  findings(step, check: StepCheck): WorkflowFinding[] {
    const { world, said, index } = check;
    const at = `steps.${index}`;
    const out: WorkflowFinding[] = [];
    const made = world.kinds.get(step.generate);
    const kinds = quoted(world.kinds.keys());
    if (!made) out.push({ code: "workflow-kind-unknown", severity: "error", path: `${at}.generate`, message: `${said} makes "${step.generate}" records, and "${step.generate}" is not a kind of this app.`, fix: `Name one of its kinds: ${kinds}.` });
    else if (step.using !== undefined) {
      if (!world.acts.includes(step.using)) {
        const near = nearestAct(step.using, world.acts);
        out.push({ code: "workflow-act-unknown", severity: "error", path: `${at}.using`, message: `${said} makes its records with "${step.using}", which is not an act of this app.`, fix: near ? `Did you mean "${near}"?` : `Name the act that makes ${kindWords(step.generate)} records.`, ...(near ? { edits: [withStep(check, (one) => ({ ...one, using: near }))] } : {}) });
      } else if (!(world.actMakes(step.using) ?? []).includes(step.generate)) {
        const makers = actsMaking(world, step.generate);
        out.push({ code: "workflow-generate-act-makes-other", severity: "error", path: `${at}.using`, message: `${said} makes ${kindWords(step.generate)} records with "${step.using}", and that act makes none.`, fix: makers.length > 0 ? `Name an act that makes one: ${quoted(makers)}.` : `Declare an act that creates "${step.generate}".`, ...(makers.length === 1 ? { edits: [withStep(check, (one) => ({ ...one, using: makers[0] }))] } : {}) });
      }
    } else {
      const makers = actsMaking(world, step.generate);
      if (makers.length === 0) out.push({ code: "workflow-generate-no-act", severity: "error", path: `${at}.generate`, message: `${said} makes ${kindWords(step.generate)} records, and no act of this app makes one.`, fix: `Declare an act that creates "${step.generate}", like { "add-${step.generate}": { "creates": "${step.generate}" } }.` });
      else if (makers.length > 1) out.push({ code: "workflow-generate-act-ambiguous", severity: "error", path: `${at}.using`, message: `${said} makes ${kindWords(step.generate)} records, and ${makers.length} acts make one (${quoted(makers)}), so it cannot tell which.`, fix: `Say which with "using".`, edits: [withStep(check, (one) => ({ ...one, using: makers[0] }))] });
    }
    step.from.forEach((from, i) => {
      const kind = world.kinds.get(from.kind);
      if (!kind) {
        out.push({ code: "workflow-kind-unknown", severity: "error", path: `${at}.from.${i}.kind`, message: `${said} reads its dates from "${from.kind}" records, and "${from.kind}" is not a kind of this app.`, fix: `Name one of its kinds: ${kinds}.` });
        return;
      }
      if (!kind.fields[from.dates]) {
        const dated = Object.keys(kind.fields).filter((field) => /date|start|day|at$|when/i.test(field) && !field.endsWith("Repeat"));
        out.push({
          code: "workflow-generate-dates-unknown",
          severity: "error",
          path: `${at}.from.${i}.dates`,
          message: `${said} reads the dates of ${kindWords(from.kind)} records from "${from.dates}", and ${kindWords(from.kind)} has no field called that.`,
          fix: `Name the field that holds its date, its repeating date or its weekdays: ${quoted(dated.length > 0 ? dated : Object.keys(kind.fields))}.`,
          ...(dated.length === 1 ? { edits: [withStep(check, (one) => ({ ...one, from: (one["from"] as Record<string, unknown>[]).map((source, j) => (j === i ? { ...source, dates: dated[0] } : source)) }))] } : {}),
        });
      }
      if (from.where !== undefined) {
        for (const problem of conditionProblems(from.where, from.kind, kind, world)) out.push({ code: "workflow-where-invalid", severity: "error", path: `${at}.from.${i}.where`, message: `${said} cannot pick its ${kindWords(from.kind)} records: ${problem}.`, fix: `Write it in the rule language over the fields of "${from.kind}" (${quoted(Object.keys(kind.fields))}) and its relations.` });
      }
    });
    if (typeof step.window === "string") {
      const problem = windowWordsProblem(step.window);
      if (problem) out.push({ code: "workflow-generate-window-invalid", severity: "error", path: `${at}.window`, message: `${said}'s window: ${problem}.`, fix: `Say "next week", "this week", "next 7 days", "today" or "tomorrow", or give { "from": "startOfWeek(today()) + 7", "to": "startOfWeek(today()) + 13" }.` });
    } else {
      for (const end of ["from", "to"] as const) for (const problem of windowProblems(step.window[end])) out.push({ code: "workflow-generate-window-invalid", severity: "error", path: `${at}.window.${end}`, message: `${said}'s window cannot be read: ${problem}.`, fix: "Write a day in the rule language, from today() and the date functions." });
    }
    if (made) {
      for (const [field, value] of Object.entries(step.set ?? {})) {
        if (!made.fields[field] && !made.edges.has(field)) {
          out.push({ code: "workflow-generate-set-unknown", severity: "error", path: `${at}.set.${field}`, message: `${said} sets "${field}" on ${kindWords(step.generate)} records, and ${kindWords(step.generate)} has no field called that.`, fix: `Set one of its fields: ${quoted(Object.keys(made.fields))}.` });
        }
        if (typeof value === "string" && value.startsWith("$") && !(GENERATE_REFS as readonly string[]).includes(value)) {
          out.push({ code: "workflow-generate-value-invalid", severity: "error", path: `${at}.set.${field}`, message: `${said} sets "${field}" to "${value}", which names nothing a generate step gives.`, fix: `Give ${quoted(GENERATE_REFS)}, { "expr": … } read on the source, or a value as it is.` });
        } else if (value !== null && typeof value === "object" && !Array.isArray(value) && "expr" in value) {
          for (const from of step.from) for (const problem of valueProblems(String(value.expr), from.kind, world)) out.push({ code: "workflow-generate-value-invalid", severity: "error", path: `${at}.set.${field}`, message: `${said} cannot read "${field}" on ${kindWords(from.kind)} records: ${problem}.`, fix: `Read the fields of "${from.kind}", "date" (the day it falls on) or "source" (its record).` });
        }
      }
    }
    if (step.link !== undefined && made) {
      const holders = [step.generate, ...step.from.map((from) => from.kind)].filter((kind) => world.kinds.get(kind)?.edges.has(step.link!));
      if (holders.length === 0) out.push({ code: "workflow-generate-link-unknown", severity: "error", path: `${at}.link`, message: `${said} links what it makes to its source through "${step.link}", and neither ${kindWords(step.generate)} nor ${step.from.map((from) => kindWords(from.kind)).join(" nor ")} declares a relation called that.`, fix: `Name a relation of "${step.generate}" to its sources (${quoted(made.edges)}), or of a source to "${step.generate}".` });
    }
    const key = step.key ?? DEFAULT_GENERATE_KEY;
    const fields = keyFields(key);
    if (fields.length === 0) out.push({ code: "workflow-key-field-unknown", severity: "error", path: `${at}.key`, message: `${said}'s key "${key}" reads no field, so every run would make the same one record.`, fix: `Say what tells two apart in braces, like "${DEFAULT_GENERATE_KEY}".` });
    for (const field of fields) {
      if (["source", "date", "kind", "id"].includes(field)) continue;
      const lacking = step.from.filter((from) => { const kind = world.kinds.get(from.kind); return kind && !kind.fields[field] && !kind.computed.includes(field) && field !== "label"; });
      if (lacking.length > 0) out.push({ code: "workflow-key-field-unknown", severity: "error", path: `${at}.key`, message: `${said}'s key reads "{${field}}", and ${lacking.map((from) => kindWords(from.kind)).join(" and ")} has no field called that.`, fix: `Read "{source}", "{date}" or a field every source kind has.` });
    }
    return out;
  },
  words(step) {
    const window = typeof step.window === "string" ? step.window : `from ${step.window.from} to ${step.window.to}`;
    const sources = step.from.map((from, i) => `${i === 0 ? withA(kindWords(from.kind)) : kindWords(from.kind)}${from.where ? ` where ${from.where}` : ""}`).join(" or ");
    return `Make ${withA(kindWords(step.generate))} for each day ${window} ${sources} falls on`;
  },
  touches(step, world: WorkflowWorld) {
    const sources = step.from.map((from) => from.kind);
    const linksFromSource = step.link !== undefined && !world.kinds.get(step.generate)?.edges.has(step.link) ? sources.filter((kind) => world.kinds.get(kind)?.edges.has(step.link!)) : [];
    return { reads: [...new Set(sources)], writes: [...new Set([step.generate, ...linksFromSource])] };
  },
};
