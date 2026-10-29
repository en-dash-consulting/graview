import type { AnySchema, Author, GraviewApp, MutationCall, Operation, Store, Via } from "@graview/core";
import type { WorkflowApproval, WorkflowOrigin, WorkflowPolicy, WorkflowStep } from "@graview/core/workflows";
import type { HostAi } from "../ai.js";
import type { Severity } from "../tidy/policy.js";

/*
 * A WORKFLOW'S RUN, AND THE LOG A HOST KEEPS OF THEM (Roadmap
 * f-job-idempotency). The framework never writes a run into the graph:
 * what a run changed is in the op log, every op under `lineage.run`, and
 * the run itself — when, why, what came of it, how far it read — is the
 * host's to keep (`WorkflowLog`), in a table, a file or memory.
 */

/** What became of a run as a whole. */
export type WorkflowOutcome =
  /** It did what it was declared to. */
  | "ok"
  /** It ran and there was nothing new to do. */
  | "nothing-new"
  /** Some of it did not run — a step skipped (no model lent), or refused — and the rest did. */
  | "partial"
  /** It did not run: paused, or held back as a whole. */
  | "held"
  /** It stopped on a failure; what it kept before the failure stands, and a rerun is safe. */
  | "failed";

/** What started a run. */
export type WorkflowRunTrigger =
  | { readonly kind: "schedule"; readonly at: string }
  /** `by`: another workflow's run made the change (`FiredTrigger.by` from `triggeredBy`); the run carries its chain. */
  | { readonly kind: "made" | "changed"; readonly records: readonly string[]; readonly by?: WorkflowOrigin }
  | { readonly kind: "synced"; readonly connection: string }
  | { readonly kind: "byHand"; readonly who?: string };

/** What one step's model calls spent. */
export interface StepSpend {
  /** The step's place in the workflow. */
  readonly step: number;
  /** Requests sent to a model. */
  readonly calls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Dollars, when the model's reply or the host's price said. */
  readonly costUsd?: number;
  /** The model it asked. */
  readonly model?: string;
}

/** What a run's model steps spent: the totals, and each step that asked a model. All zero when none did. */
export interface WorkflowSpend {
  readonly calls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd?: number;
  readonly steps: readonly StepSpend[];
}

/** The most runs a chain of workflows waking each other goes to before a run is held: `RunWorkflowOptions.chainLimit` when unsaid. */
export const MOST_CHAIN = 3;

/** One run, as a host keeps it. */
export interface WorkflowRun {
  /** `workflow:<name>:<started>`: on every op the run made, as `lineage.run`. */
  readonly id: string;
  readonly workflow: string;
  readonly trigger: WorkflowRunTrigger;
  readonly started: string;
  readonly finished: string;
  readonly outcome: WorkflowOutcome;
  /** Nothing was kept: a dry run says what it would have done. */
  readonly dry: boolean;
  readonly made: readonly string[];
  readonly changed: readonly string[];
  readonly archived: readonly string[];
  /** The ops that hold what it suggested. */
  readonly suggested: readonly string[];
  /** What it held back, by step (its index), and why, in words. */
  readonly heldBack: readonly { readonly step: number; readonly why: string }[];
  /** How far it read the log: every op before this seq. The next run reads from here (`StepContext.since`); a dry or failed run leaves it where the last good run had it. */
  readonly through: number;
  /** A hash of the workflow as declared when it ran: the first run after a change is a dry run. */
  readonly specHash: string;
  /** What it says, in sentences, in order. */
  readonly notes: readonly string[];
  /** What its model steps spent — calls and tokens, by step and in all — so a host meters a run from the run alone. */
  readonly spent: WorkflowSpend;
  /**
   * The workflows whose runs started this one, the first first: empty for
   * a run a clock, a person, a connection or a person's change started.
   * Its length is the run's depth; past the runner's `chainLimit` the run
   * is held and says so.
   */
  readonly chain: readonly string[];
}

/** The host's log of runs: the last of a workflow's, all of them newest first, and keeping one. */
export interface WorkflowLog {
  last(name: string): WorkflowRun | undefined;
  add(run: WorkflowRun): void;
  runs(name: string, limit?: number): readonly WorkflowRun[];
}

export interface RunWorkflowOptions<S extends AnySchema = AnySchema> {
  /** The app: its declaration says the workflow; its brand the clock. */
  readonly app: GraviewApp<S>;
  /** The store that keeps the log — a server's, for a hosted app. */
  readonly store: Store<S>;
  /** Which workflow, by name. */
  readonly workflow: string;
  /** The run's moment. Now when unsaid. */
  readonly now?: Date | string | number;
  /** What started it. By hand when unsaid. */
  readonly trigger?: WorkflowRunTrigger;
  /** Keep nothing; say what it would do. A run by hand of a paused workflow, and the first run after a change, are dry whatever this says. */
  readonly dryRun?: boolean;
  /** Where the runs are kept. */
  readonly log: WorkflowLog;
  /** The host's AI, for an agent step: its `complete` proposes. Without one an agent step is skipped. */
  readonly ai?: HostAi;
  /** Who runs: an automated system author, `workflow:<name>` named by its title, when unsaid. */
  readonly principal?: Author;
  /** What its changes come through, as the log records it. `workflow:<name>` when unsaid. */
  readonly via?: Via;
  /** How deep a chain of workflows started by each other's changes may go before a run is held (`MOST_CHAIN`, 3, when unsaid). */
  readonly chainLimit?: number;
}

/** One change a step would make, before what `approve` makes of it. */
export interface StepChange {
  readonly calls: readonly MutationCall[];
  /** Why, in words: on the lineage. */
  readonly basis: string;
  /** How sure: 1 for a deterministic step. */
  readonly confidence?: number;
  /** How much it would undo, for `suggest`'s routing. "categorize" when unsaid. */
  readonly severity?: Severity;
  /** The model that proposed it. */
  readonly model?: string;
  /** The stable key of what it makes (an act step's `key`), kept on the lineage. */
  readonly key?: string;
  /** It waits for a person whatever `approve` says: a label a host shows the public (a classify step's `confirm`). */
  readonly ask?: boolean;
  /** It is made whatever `approve` says, unless `ask`: a judgment sure enough for its option's `applyAt`. */
  readonly apply?: boolean;
}

/** What a step tells the run a model call spent: `calls` 1 when unsaid. */
export interface SpendSaid {
  readonly calls?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly costUsd?: number;
  readonly model?: string;
}

/** What `StepContext.change` did with one change. */
export type ChangeOutcome =
  | { readonly as: "applied"; readonly ops: readonly Operation[] }
  | { readonly as: "previewed"; readonly ops: readonly Operation[] }
  | { readonly as: "suggested"; readonly op?: string }
  | { readonly as: "dropped" | "unchanged" }
  | { readonly as: "refused"; readonly error: string };

/** What a step runner is handed: the store, the run, and the one door every change goes through. */
export interface StepContext<S extends AnySchema = AnySchema> {
  readonly app: GraviewApp<S>;
  /** The store, whole; read it as the run's principal sees it with `seen`. */
  readonly store: Store<AnySchema>;
  /** The store as the run's principal sees it. */
  readonly seen: Store<AnySchema>;
  readonly workflow: { readonly name: string; readonly title: string };
  /** The step's place in the workflow. */
  readonly index: number;
  readonly run: string;
  readonly principal: Author;
  readonly now: number;
  /** The run's day on the app's clock: what `$today` reads. */
  readonly today: string;
  readonly dry: boolean;
  /** What this step's changes become: its own word, else the workflow's, else the default. */
  readonly approve: WorkflowApproval;
  readonly trigger: WorkflowRunTrigger;
  readonly ai?: HostAi;
  /** The policy records the workflow follows (`follows`), read once for the run; none when it follows none. */
  readonly follows: readonly WorkflowPolicy[];
  /** The ops from the last good run's `through` on: what was made and changed since it. */
  readonly since: readonly Operation[];
  /**
   * THE ONE DOOR: a change made, previewed (a dry run), suggested or let
   * go by `approve` and its confidence, with the run's lineage, and what it
   * made, changed and set aside counted on the run.
   */
  change(change: StepChange): ChangeOutcome;
  /** Hold something back, said in words. */
  holdBack(why: string): void;
  /** Say something on the run. */
  note(said: string): void;
  /** The step did not run, and the run is `partial` for it. */
  skipped(why: string): void;
  /** What a model call of this step spent, counted on the run's `spent`. */
  spent(usage: SpendSaid): void;
}

/** One kind of step, run: keyed as `STEP_KINDS` is. */
export interface StepRunner<Step extends WorkflowStep = WorkflowStep> {
  readonly key: string;
  run(step: Step, context: StepContext): Promise<void>;
}
