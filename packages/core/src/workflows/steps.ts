import * as z from "../schema/zod.js";
import { NAME } from "../document/schema.js";
import { nounOf } from "../schema/define-node.js";
import type { WorkflowStep } from "../workflow-shape.js";
import { actStep } from "./step-act.js";
import { agentStep } from "./step-agent.js";
import { generateStep } from "./step-generate.js";
import { archiveStep } from "./step-archive.js";
import { classifyStep } from "./step-classify.js";
import type { WorkflowWorld } from "./world.js";

/*
 * THE KINDS OF STEP A WORKFLOW TAKES: a closed set, each told apart by its
 * one discriminating key (`act`, `agent`, …). Each kind is one file beside
 * this one that says its shape, what the checker holds it to, how it reads
 * in one line and which kinds it reads and writes; a new kind is that file
 * and one line in `STEP_KINDS`. Running one is `@graview/tools/workflows`'
 * (`STEP_RUNNERS`, keyed the same).
 */

/** What a workflow finding says: its code, how bad, where under the workflow (`steps.0.act`), in a person's words, and the edits that fix it. */
export interface WorkflowFinding {
  readonly code: string;
  readonly severity: "error" | "warning";
  /** Under the workflow: `steps.1.over.where`, `when.0.every`; "" for the workflow itself. */
  readonly path: string;
  readonly message: string;
  readonly fix: string;
  /** In `editDocument`'s words, where they can be written down. */
  readonly edits?: readonly Record<string, unknown>[];
}

/** What a step kind's checker is handed. */
export interface StepCheck {
  readonly world: WorkflowWorld;
  /** The workflow's name, and the step's place in it. */
  readonly workflow: string;
  readonly index: number;
  /** "Step 2 of “next-weeks-events”": how a finding names the step. */
  readonly said: string;
  /** The workflow's own declaration, for an edit that fixes it whole (`set-workflow`). */
  readonly declared: Readonly<Record<string, unknown>>;
}

/** The helpers a step kind's shape is built with: the same words the document's shape uses. */
export interface StepShapes {
  readonly str: (min: number, max: number) => z.ZodMiniType<string>;
  /** A kebab-case name: a kind's, an act's. */
  readonly name: (what: string) => z.ZodMiniType<string>;
  /** A line of the rule language. */
  readonly expression: z.ZodMiniType<string>;
  /** A value a step hands an act: a literal, `$subject`, `$now`, `$today`, or `{ expr }`. */
  readonly value: z.ZodMiniType;
  /** "apply", "suggest" or "ask". */
  readonly approve: z.ZodMiniType;
}

/** A kind as a person reads it: its noun, as the declaration says it ("grocery list", "car"). */
export type KindNoun = (kind: string) => string;

/** A kind's noun when no declaration is at hand: its name, read as words. */
export const kindNoun: KindNoun = (kind) => nounOf(undefined, kind);

/** One kind of step. */
export interface StepKind<Step = never> {
  /** Its one discriminating key: a step that holds it is this kind. */
  readonly key: string;
  /** What it does, as a person reads it: "Run an act". */
  readonly title: string;
  /** Its shape, as the document holds it (a strict object). */
  shape(shapes: StepShapes): z.ZodMiniType;
  /** What the checker says of one, at its place. */
  findings(step: Step, check: StepCheck): WorkflowFinding[];
  /** One line: "Run “add-event” for each routine where active", each kind by its noun. */
  words(step: Step, noun: KindNoun): string;
  /** The kinds it reads and the kinds it may write, by name. */
  touches(step: Step, world: WorkflowWorld): { readonly reads: readonly string[]; readonly writes: readonly string[] };
}

/** Every kind of step, by its key. A new kind: its file, and one line here. */
export const STEP_KINDS = {
  act: actStep,
  agent: agentStep,
  generate: generateStep,
  archive: archiveStep,
  classify: classifyStep,
} as const satisfies Readonly<Record<string, StepKind<never>>>;

export type StepKindKey = keyof typeof STEP_KINDS;

/** The kind of a step, by the one key of `STEP_KINDS` it holds; undefined for one that holds none. */
export function stepKindOf(step: unknown): (StepKind<WorkflowStep> & { readonly key: StepKindKey }) | undefined {
  if (typeof step !== "object" || step === null) return undefined;
  for (const key of Object.keys(STEP_KINDS) as StepKindKey[]) if (key in step) return STEP_KINDS[key] as unknown as StepKind<WorkflowStep> & { readonly key: StepKindKey };
  return undefined;
}

/** The shapes a step kind is built with. */
export function stepShapes(): StepShapes {
  const str = (min: number, max: number) => z.string().check(z.minLength(min), z.maxLength(max));
  const expression = str(1, 2000);
  return {
    str,
    name: (what) => z.string().check(z.regex(NAME, `${what} names are kebab-case, lower-case words joined by hyphens like "add-event"`)),
    expression,
    value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.unknown()), z.strictObject({ expr: expression })]),
    approve: z.enum(["apply", "suggest", "ask"], 'approve is "apply", "suggest" or "ask"'),
  };
}
