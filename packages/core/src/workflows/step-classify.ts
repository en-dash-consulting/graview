import * as z from "../schema/zod.js";
import { conditionProblems } from "../job-findings.js";
import type { ClassifyFloorRule, ClassifyStep } from "../workflow-shape.js";
import type { KindNoun, StepCheck, StepKind, StepShapes, WorkflowFinding } from "./steps.js";
import type { WorkflowWorld } from "./world.js";

/*
 * LABEL EACH RECORD (Roadmap f-feedback-triage-agent): a typed judgment
 * per record — "which of these options fits it, and how sure" — asked of
 * the host's System One model one record at a time within the run's
 * budget, and set through the kind's own act with the reason on its
 * lineage ("Jev: 90% sure “Buy now” is spam"). Where no model answers —
 * none lent, it failed, the budget ran out — the step's `floor` decides
 * deterministically (links counted in the record's text, blocklisted
 * words, a rule), and a record no floor rule matches is left for a
 * person — or labeled the step's `otherwise` when it says one. An option
 * whose confidence reaches its `setAside` threshold also archives the
 * record; never removed, and one that reaches its `applyAt` is set
 * without asking.
 *
 * Nothing a host means to show the public becomes so without a person's
 * yes: the step's changes are asked of a person unless the step says its
 * own `approve`, and an option named in `confirm` is asked whatever it
 * says. A record already labeled — by a person, or a run before — is
 * never labeled again unless the step says `relabel`. Running it is
 * `@graview/tools/workflows`' (`runClassifyStep`).
 */

const quoted = (names: Iterable<string>): string => [...names].map((name) => `"${name}"`).join(", ") || "none";

/** Whether a step's changes wait for a person: always, unless the step says its own `approve` — and an option in `confirm` always. */
export const classifyAsks = (step: ClassifyStep, option: string): boolean => step.approve === undefined || step.approve === "ask" || (step.confirm ?? []).includes(option);

/** Whether a judgment is sure enough to be set without asking: it reaches its option's `applyAt`, and the option is not one `confirm` names. */
export const classifyApplies = (step: ClassifyStep, option: string, confidence: number): boolean => {
  const at = step.applyAt?.[option];
  return at !== undefined && confidence >= at && !(step.confirm ?? []).includes(option);
};

const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;

/** How many links a text holds: http, https and www addresses. */
export const linksIn = (text: string): number => text.match(LINK)?.length ?? 0;

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A floor rule's verdict on a record: the option, and why, in words a person reads. */
export interface FloorReading {
  readonly option: string;
  readonly basis: string;
}

/**
 * THE FLOOR: the first option, in the order the step says them, whose rule
 * holds of a record — its text (every string field, joined) holds at least
 * `links` links, or one of `words` as a whole word in any case, or its
 * `expr` holds (`holds(option)`, the rule language read by the caller).
 * Undefined when none holds: the record is left for a person.
 */
export function floorLabel(floor: Readonly<Record<string, ClassifyFloorRule>> | undefined, text: string, holds: (option: string) => boolean = () => false): FloorReading | undefined {
  for (const [option, rule] of Object.entries(floor ?? {})) {
    if (rule.links !== undefined) {
      const count = linksIn(text);
      if (count >= rule.links) return { option, basis: `${option}, from ${count === 1 ? "one link" : `${count} links`}` };
    }
    const word = (rule.words ?? []).find((one) => one.trim() !== "" && new RegExp(`(?:^|[^\\p{L}\\p{N}])${escape(one.trim())}(?:$|[^\\p{L}\\p{N}])`, "iu").test(text));
    if (word !== undefined) return { option, basis: `${option}, from the word “${word.trim()}”` };
    if (rule.expr !== undefined && holds(option)) return { option, basis: `${option}, from the rule ${rule.expr}` };
  }
  return undefined;
}

/** A list said as a person says it: "spam, rude or good-to-show". */
const either = (items: readonly string[]): string => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`);

/** One line: "Label each feedback's category as spam, rude or good-to-show; archive spam at 90% sure (asks before good-to-show)". */
export function classifyWords(step: ClassifyStep, noun: KindNoun, options?: readonly string[]): string {
  const among = step.options ?? options ?? [];
  const aside = Object.entries(step.setAside ?? {}).map(([option, at]) => `${option} at ${Math.round(at * 100)}% sure`);
  const otherwise = step.otherwise !== undefined ? `, else ${step.otherwise}` : "";
  const applies = Object.entries(step.applyAt ?? {}).map(([option, at]) => `${option} at ${Math.round(at * 100)}% sure`);
  const asks = step.approve === undefined || step.approve === "ask" ? " (asks a person first)" : (step.confirm ?? []).length > 0 ? ` (asks before ${either(step.confirm!)})` : "";
  return `Label each ${noun(step.classify)}${step.where ? ` where ${step.where}` : ""} by its ${step.field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}${among.length > 0 ? ` as ${either(among)}` : ""}${otherwise}${applies.length > 0 ? `; sets ${applies.join(", ")} without asking` : ""}${aside.length > 0 ? `; archive ${aside.join(", ")}` : ""}${asks}`;
}

export const classifyStep: StepKind<ClassifyStep> = {
  key: "classify",
  title: "Label each record",
  shape: (s: StepShapes) =>
    z.strictObject({
      classify: s.name("kind"),
      where: z.optional(s.expression),
      field: s.str(1, 120),
      options: z.optional(z.array(s.str(1, 120)).check(z.maxLength(60))),
      instruction: z.optional(s.str(1, 2000)),
      floor: z.optional(z.record(s.str(1, 120), z.strictObject({ links: z.optional(z.number().check(z.int(), z.minimum(1), z.maximum(1000))), words: z.optional(z.array(s.str(1, 120)).check(z.maxLength(500))), expr: z.optional(s.expression) }))),
      setAside: z.optional(z.record(s.str(1, 120), z.number())),
      applyAt: z.optional(z.record(s.str(1, 120), z.number())),
      otherwise: z.optional(s.str(1, 120)),
      confirm: z.optional(z.array(s.str(1, 120)).check(z.maxLength(60))),
      relabel: z.optional(z.boolean()),
      model: z.optional(s.str(1, 120)),
      budget: z.optional(z.strictObject({ calls: z.optional(z.number().check(z.int(), z.minimum(1), z.maximum(10_000))), tokens: z.optional(z.number().check(z.int(), z.minimum(1), z.maximum(10_000_000))) })),
      approve: z.optional(s.approve),
    }),
  findings(step, check: StepCheck): WorkflowFinding[] {
    const { world, said, index } = check;
    const at = `steps.${index}`;
    const out: WorkflowFinding[] = [];
    const kind = world.kinds.get(step.classify);
    if (!kind) {
      out.push({ code: "workflow-kind-unknown", severity: "error", path: `${at}.classify`, message: `${said} labels "${step.classify}" records, and "${step.classify}" is not a kind of this app.`, fix: `Name one of its kinds: ${quoted(world.kinds.keys())}.` });
      return out;
    }
    if (step.where !== undefined) {
      for (const problem of conditionProblems(step.where, step.classify, kind, world)) {
        out.push({ code: "workflow-where-invalid", severity: "error", path: `${at}.where`, message: `${said} cannot pick its records: ${problem}.`, fix: `Write it in the rule language over the fields of "${step.classify}" (${quoted(Object.keys(kind.fields))}) and its relations.` });
      }
    }
    const field = kind.fields[step.field];
    const choices = Object.entries(kind.fields).filter(([, one]) => one.type === "choice").map(([name]) => name);
    if (!field || field.type !== "choice") {
      out.push({
        code: "workflow-classify-field-not-choice",
        severity: "error",
        path: `${at}.field`,
        message: field ? `${said} keeps its label in "${step.field}", which is not a choice of options, so it has nothing to choose from.` : `${said} keeps its label in "${step.field}", and "${step.classify}" has no field called that.`,
        fix: choices.length > 0 ? `Name one of its choice fields: ${quoted(choices)}.` : `Give "${step.classify}" a choice field whose options are the labels, then name it here.`,
      });
      return out;
    }
    const known = new Set(field.options ?? []);
    const among = new Set(step.options ?? known);
    const unknown = (option: string, path: string, how: string) => {
      out.push({ code: "workflow-classify-option-unknown", severity: "error", path, message: `${said} ${how} "${option}", which is not one of the options of "${step.field}".`, fix: `Name one of ${quoted(known)}, or add "${option}" to the field's options.` });
    };
    (step.options ?? []).forEach((option, i) => (known.has(option) ? undefined : unknown(option, `${at}.options.${i}`, "chooses among")));
    const judged = (option: string) => known.has(option) && among.has(option);
    for (const option of Object.keys(step.floor ?? {})) if (!judged(option)) unknown(option, `${at}.floor.${option}`, "has a floor rule for");
    for (const [option, rule] of Object.entries(step.floor ?? {})) {
      if (rule.links === undefined && (rule.words ?? []).length === 0 && rule.expr === undefined) {
        out.push({ code: "workflow-classify-floor-empty", severity: "error", path: `${at}.floor.${option}`, message: `${said} has a floor rule for "${option}" that tests nothing, so it would never decide.`, fix: `Say "links", "words" or "expr" for it, or let the rule go.` });
      }
      if (rule.expr !== undefined) {
        for (const problem of conditionProblems(rule.expr, step.classify, kind, world)) {
          out.push({ code: "workflow-where-invalid", severity: "error", path: `${at}.floor.${option}.expr`, message: `${said}'s floor rule for "${option}" does not read: ${problem.replace(/^its where /, "it ")}.`, fix: `Write it in the rule language over the fields of "${step.classify}".` });
        }
      }
    }
    const thresholds = (key: "setAside" | "applyAt", how: string) => {
      for (const [option, threshold] of Object.entries(step[key] ?? {})) {
        if (!judged(option)) unknown(option, `${at}.${key}.${option}`, how);
        if (!(threshold >= 0 && threshold <= 1)) {
          out.push({ code: "workflow-classify-threshold-invalid", severity: "error", path: `${at}.${key}.${option}`, message: `${said} ${how} "${option}" at ${threshold}, and how sure a judgment is runs from 0 to 1.`, fix: `Say a number from 0 to 1: 0.9 for "90% sure".` });
        }
      }
    };
    thresholds("setAside", "sets aside");
    thresholds("applyAt", "sets without asking");
    if (step.otherwise !== undefined && !judged(step.otherwise)) unknown(step.otherwise, `${at}.otherwise`, "labels what no option clears");
    if (Object.keys(step.setAside ?? {}).length > 0 && !world.acts.includes(`archive-${step.classify}`)) {
      out.push({ code: "workflow-archive-never", severity: "error", path: `${at}.setAside`, message: `${said} sets records aside, and the app says ${world.noun(step.classify)} records are never archived.`, fix: `Take "archives: false" off "${step.classify}", or let "setAside" go.` });
    }
    (step.confirm ?? []).forEach((option, i) => (judged(option) ? undefined : unknown(option, `${at}.confirm.${i}`, "asks before")));
    return out;
  },
  words(step, noun: KindNoun) {
    return classifyWords(step, noun);
  },
  touches(step, _world: WorkflowWorld) {
    return { reads: [step.classify], writes: [step.classify] };
  },
};
