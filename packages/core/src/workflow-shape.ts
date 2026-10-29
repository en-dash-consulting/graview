/**
 * WORKFLOWS: WHAT THE APP DOES ON ITS OWN, AND WHEN (Roadmap f-jobs-declared).
 *
 *   workflows: {
 *     "next-weeks-events": {
 *       title: "Fill out next week's events",
 *       when: [{ every: "sunday 18:00" }, { made: "grocery-list" }],
 *       steps: [{ act: "add-event", over: { kind: "routine", where: "active" }, args: { name: { expr: "name" } }, key: "{id}" }],
 *     },
 *   }
 *
 * A workflow is the app's own actor given a schedule and a list of steps,
 * in the declaration: run on a clock (`every`, `cron`, said in the brand's
 * time zone), when a record of a kind is made or changed, when a connection
 * finishes a pass, or by hand. Each step is one of a closed set of kinds
 * (`STEP_KINDS`, `@graview/core/workflows`): run an act once or over the
 * records a rule picks, or let a model propose acts from a list. What it
 * makes is applied, suggested or asked about (`approve`).
 *
 * The same shape in a document (`workflows`) and in `defineApp({ workflows })`.
 * `graview check` holds each to the declaration (`workflow-*`);
 * `@graview/core/workflows` resolves them (`workflowsOf`), says them
 * (`workflowWords`) and says when one runs next (`nextRunAt`);
 * `@graview/tools/workflows` runs one (`runWorkflow`). Never a "job": the
 * purpose's jobs are the questions an app answers (`job-shape.ts`).
 */

/** What starts a run: a clock in words or cron, a record made or changed, a connection's pass, or a person. */
export type WorkflowTrigger =
  /** Words: "day", "day 03:00", "weekday 09:00", "sunday 18:00", "month 1 09:00", "hour" — in the brand's time zone. */
  | { readonly every: string }
  /** Five-field cron, "0 18 * * 0", in the brand's time zone. */
  | { readonly cron: string }
  /** A record of this kind was made; `where`, in the rule language, holds of it. */
  | { readonly made: string; readonly where?: string }
  /** A record of this kind changed — one of these fields, when said. */
  | { readonly changed: string; readonly fields?: readonly string[]; readonly where?: string }
  /** The named connection finished a pass. */
  | { readonly synced: string }
  /** Run now, only. */
  | { readonly byHand: true };

/** What becomes of what a run would change: made, suggested by how sure it is, or gathered for a person to approve. */
export type WorkflowApproval = "apply" | "suggest" | "ask";

/** A value a step hands an act: a literal, `$subject`, `$now`, `$today`, or `{ expr }` read on the record a step is over. */
export type WorkflowValue = string | number | boolean | null | readonly unknown[] | { readonly expr: string };

/** Which records a step runs over: one kind, those a rule holds of, at most `limit`. */
export interface WorkflowOver {
  readonly kind: string;
  readonly where?: string;
  readonly limit?: number;
}

/**
 * RUN AN ACT: once (no `over`), or once per record `over` picks — the
 * record the act's subject and what `{ expr }` values read. `key`, a
 * `{field}` template ("{id}:{date}"), is the stable key of what the step
 * makes: a rerun with the same key changes the record it made last time
 * rather than making another.
 */
export interface ActStep {
  readonly act: string;
  readonly over?: WorkflowOver;
  readonly args?: Readonly<Record<string, WorkflowValue>>;
  readonly key?: string;
  readonly approve?: WorkflowApproval;
}

/**
 * LET A MODEL PROPOSE: an instruction in words, the kinds it may read and
 * the acts it may propose, the model ("fast" or a host's model id) and
 * what one run may spend. Each act it proposes is applied, suggested or
 * let go by `approve` and its confidence, as the app's own actor's are.
 * With no model lent, the step is skipped and the run says so.
 */
export interface AgentStep {
  readonly agent: string;
  readonly reads: readonly string[];
  readonly acts: readonly string[];
  readonly model?: string;
  readonly budget?: { readonly calls?: number; readonly tokens?: number };
  readonly approve?: WorkflowApproval;
}

/** One step of a workflow: one of `STEP_KINDS`, told apart by its one discriminating key. */
export type WorkflowStep = ActStep | AgentStep;

/** A workflow as it is declared. */
export interface WorkflowDeclaration {
  /** Words a person reads: "Fill out next week's events". 1–120 characters. */
  readonly title: string;
  /** What starts it: one or several. */
  readonly when: readonly WorkflowTrigger[];
  /** Paused, it runs on no clock and no change; Run now still dry-runs it. Active when unsaid. */
  readonly status?: "active" | "paused";
  /** The workflow's own word on what its changes become; a step may say its own. */
  readonly approve?: WorkflowApproval;
  /** In order; at least one. */
  readonly steps: readonly WorkflowStep[];
  /** A kind of policy records the run reads and its model steps are told (Roadmap f-job-rule-inputs). */
  readonly follows?: string;
}

/** An app's workflows, by slug name. */
export type AppWorkflows = Readonly<Record<string, WorkflowDeclaration>>;

/** The most workflows an app declares. */
export const MOST_WORKFLOWS = 40;
/** The most steps one workflow takes. */
export const MOST_STEPS = 40;
