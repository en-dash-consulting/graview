/*
 * THE PROBLEMS A CHANGE MADE (Roadmap f-revisions-say-what-broke).
 *
 * An act, a batch or a proposed view can break what held: a rule that held
 * before fails after, a view says a problem it did not. A host that judged
 * the app before and after a change — the store's `violations()`, a
 * headless run's problems — hands both sets here and is told what is new,
 * each keyed as it will be keyed next time (a rule's problem by
 * `violationKey`, a view's by its view, where and words), in words, and with
 * the act a rule names to repair it, so an answer can carry "this change
 * broke: …" and how to mend it rather than leave it to a later look.
 */
import { problemWords } from "../invariants/line.js";
import type { InvariantDefinition, Repair, Violation } from "../invariants/types.js";
import { problemsMoved, violationKey, shapedRules } from "../store.js";

/** A problem a view says: the view by name, where in it, and what it says (a headless run's `description.problems`). */
export interface ViewProblem {
  readonly view: string;
  readonly at?: string;
  readonly says: string;
}

/** What was judged at one moment: the rules' problems and the views'. */
export interface ProblemSet {
  readonly rules?: readonly Violation[];
  readonly views?: readonly ViewProblem[];
}

/** A problem one side has and the other does not. */
export type ChangedProblem =
  | {
      readonly key: string;
      readonly kind: "rule";
      readonly rule: string;
      /** The record it is about, where it is about one. */
      readonly subject?: string;
      readonly says: string;
      /** The act the rule names to repair it, first; `missing` is what its caller still chooses. */
      readonly repair?: { readonly act: string; readonly label: string; readonly args?: Readonly<Record<string, unknown>>; readonly missing?: readonly string[] };
      readonly violation: Violation;
    }
  | { readonly key: string; readonly kind: "view"; readonly view: string; readonly at?: string; readonly says: string };

/** What a change broke and mended, as entries and in words. */
export interface ProblemsMade {
  /** Problems after it that were not before: rules that held and fail, and view problems new after. */
  readonly made: readonly ChangedProblem[];
  /** Problems before it that are not after. */
  readonly mended: readonly ChangedProblem[];
  readonly said: readonly string[];
  /** "This change broke: …", or that it broke nothing. */
  readonly text: string;
}

/** A view problem's key: its view, where, and its words. */
export const viewProblemKey = (problem: ViewProblem): string => `view:${problem.view}|${problem.at ?? ""}|${problem.says}`;

/** Only a rule that judged and failed is broken: one that could not judge (`could-not-judge`, `over-budget`) is not said as made. */
const failed = (v: Violation) => v.status === undefined || v.status === "violated";

const repairOf = (repair: Repair | undefined) =>
  repair ? { repair: { act: repair.mutation, label: repair.label, ...(repair.args ? { args: repair.args } : {}), ...(repair.missing && repair.missing.length > 0 ? { missing: repair.missing } : {}) } } : {};

function ruleEntry(v: Violation, shaped: ReadonlySet<string>): ChangedProblem {
  return { key: violationKey(v, shaped), kind: "rule", rule: v.invariant, ...(v.subjectId ? { subject: v.subjectId } : {}), says: problemWords(v), ...repairOf(v.repairs[0]), violation: v };
}

function sayProblem(problem: ChangedProblem): string {
  if (problem.kind === "view") return `the view "${problem.view}"${problem.at ? ` at ${problem.at}` : ""} says: ${problem.says.replace(/[.\s]+$/, "")}`;
  const repair = problem.repair ? ` (repair: ${problem.repair.act}${problem.repair.missing ? `, choosing ${problem.repair.missing.join(", ")}` : ""} — ${problem.repair.label})` : "";
  return `${problem.says.replace(/[.\s]+$/, "")}${repair}`;
}

/**
 * WHAT A CHANGE BROKE: the problems after it that were not before, and
 * those it mended. `rules` are the app's rules, so a rule written in the
 * rule language is one problem whether or not its words were loaded
 * (`shapedRules`); without them, a problem is known by its words.
 */
export function problemsMade(before: ProblemSet, after: ProblemSet, options: { readonly rules?: readonly Pick<InvariantDefinition, "name" | "shape">[] } = {}): ProblemsMade {
  const rules = options.rules ?? [];
  const shaped = shapedRules(rules);
  const moved = problemsMoved(rules, (before.rules ?? []).filter(failed), (after.rules ?? []).filter(failed));
  const viewsBefore = new Set((before.views ?? []).map(viewProblemKey));
  const viewsAfter = new Set((after.views ?? []).map(viewProblemKey));
  const viewEntry = (problem: ViewProblem): ChangedProblem => ({ key: viewProblemKey(problem), kind: "view", view: problem.view, ...(problem.at ? { at: problem.at } : {}), says: problem.says });
  const made = [...moved.introduces.map((v) => ruleEntry(v, shaped)), ...(after.views ?? []).filter((one) => !viewsBefore.has(viewProblemKey(one))).map(viewEntry)];
  const mended = [...moved.resolves.map((v) => ruleEntry(v, shaped)), ...(before.views ?? []).filter((one) => !viewsAfter.has(viewProblemKey(one))).map(viewEntry)];
  const said: string[] = [];
  if (made.length > 0) said.push(`This change broke ${made.length === 1 ? "one thing that held" : `${made.length} things that held`}: ${made.map(sayProblem).join("; ")}. Fix ${made.length === 1 ? "it" : "them"} before going on.`);
  if (mended.length > 0) said.push(`It mended ${mended.length === 1 ? "one problem" : `${mended.length} problems`}: ${mended.map(sayProblem).join("; ")}.`);
  return { made, mended, said, text: made.length > 0 ? said.join(" ") : `This change broke nothing that held.${mended.length > 0 ? ` ${said.join(" ")}` : ""}` };
}
