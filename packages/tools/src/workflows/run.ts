import { ARCHIVED, isAutomated, type AnySchema, type Lineage, type MutationCall, type Primitive, type Principal, type Store } from "@graview/core";
import { suggest } from "@graview/core/tidying";
import { declaredWorkflows, policiesOf, resolveWorkflow, workflowAuthor, workflowSpecHash, workflowWorldOfApp } from "@graview/core/workflows";
import { routeOf } from "../tidy/policy.js";
import { askedOf } from "./ask.js";
import { stepRunnerOf } from "./steps.js";
import type { ChangeOutcome, RunWorkflowOptions, StepChange, StepContext, WorkflowOutcome, WorkflowRun } from "./types.js";

/*
 * RUNNING ONE WORKFLOW (Roadmap f-jobs-declared, f-job-idempotency,
 * f-job-pause-dry-run).
 *
 * A run is the app's own actor under the workflow's name: an automated
 * system author, `workflow:<name>` named by its title, every op it makes
 * carrying `lineage.run` so Activity folds the run into one row said by
 * the title. Each step goes to its runner, and every change any runner
 * would make goes through one door (`StepContext.change`):
 *
 *  - in a DRY run it is previewed (`previewAll`) and nothing is kept: the
 *    run says what it would make, change, set aside or suggest. A run by
 *    hand of a paused workflow is dry, and so is the FIRST run after the
 *    workflow is added or its declaration changes (its `specHash` differs
 *    from the last run's): "First run after a change: nothing was kept".
 *    The next is real;
 *  - otherwise by `approve`: "apply" makes it; "suggest" makes what it is
 *    sure enough of for how much it would undo (dreaming's bands), suggests
 *    what it is less sure of and lets go of the rest; "ask" gathers it for
 *    a person to approve (`askedOf`).
 *
 * A paused workflow's scheduled or triggered run does nothing and says so
 * (`held`). A step that throws stops the run (`failed`); what it kept
 * before stands, and the next run's cursor (`through`) is the last good
 * run's, so a retry reads the same ops and — an act step's `key` making
 * every record under one id — makes nothing twice. The host keeps the run
 * (`WorkflowLog`); the framework never writes it into the graph.
 */

const said = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The seq the log's next op takes: a run reads every op before it. */
const headOf = (store: Store<AnySchema>): number => (store.log.all().at(-1)?.seq ?? -1) + 1;

/** The day a moment falls on in a zone: what `$today` reads. */
const dayIn = (at: number, zone: string | undefined): string => {
  try {
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", ...(zone ? { timeZone: zone } : {}) }).format(at);
  } catch {
    return new Date(at).toISOString().slice(0, 10);
  }
};

/** RUN ONE WORKFLOW ONCE, and keep the run in the host's log. */
export async function runWorkflow<S extends AnySchema>(options: RunWorkflowOptions<S>): Promise<WorkflowRun> {
  const store = options.store as unknown as Store<AnySchema>;
  const workflows = declaredWorkflows(options.app) ?? {};
  const declared = workflows[options.workflow];
  if (!declared) throw new Error(`The app has no workflow "${options.workflow}"${Object.keys(workflows).length > 0 ? `; it has ${Object.keys(workflows).map((name) => `"${name}"`).join(", ")}` : ""}.`);
  const world = workflowWorldOfApp(options.app);
  const workflow = resolveWorkflow(options.workflow, declared, world);
  const principal = options.principal ?? workflowAuthor(workflow);
  if (!isAutomated(principal)) throw new Error("A workflow runs as the app's own actor: an author that says automated: true (a system or agent seat, never a person).");
  const via = options.via ?? (`workflow:${workflow.name}` as never);
  const now = options.now === undefined ? Date.now() : new Date(options.now).getTime();
  const started = new Date(now).toISOString();
  const id = `workflow:${workflow.name}:${started}`.slice(0, 120);
  const trigger = options.trigger ?? { kind: "byHand" as const };
  const specHash = workflowSpecHash(declared);
  const previous = options.log.runs(workflow.name).filter((run) => run.outcome !== "held");
  const lastGood = previous.find((run) => !run.dry && run.outcome !== "failed");
  const cursor = lastGood?.through ?? 0;

  const made = new Set<string>();
  const changed = new Set<string>();
  const archived = new Set<string>();
  const suggested: string[] = [];
  const heldBack: { step: number; why: string }[] = [];
  const notes: string[] = [];
  let skipped = false;
  let refused = false;

  const finish = (outcome: WorkflowOutcome, dry: boolean, through: number): WorkflowRun => {
    const run: WorkflowRun = { id, workflow: workflow.name, trigger, started, finished: new Date(Math.max(now, Date.now())).toISOString(), outcome, dry, made: [...made], changed: [...changed], archived: [...archived], suggested, heldBack, through, specHash, notes };
    options.log.add(run);
    return run;
  };

  // Paused: a clock or a change starts nothing; a person's Run now is a dry run.
  if (workflow.status === "paused" && trigger.kind !== "byHand") {
    notes.push(`“${workflow.title}” is paused: it did not run.`);
    return finish("held", true, cursor);
  }
  let dry = options.dryRun === true;
  if (workflow.status === "paused") {
    dry = true;
    notes.push(`“${workflow.title}” is paused: run by hand, it is a dry run and nothing was kept.`);
  } else if (!dry && previous[0]?.specHash !== specHash) {
    dry = true;
    notes.push("First run after a change: nothing was kept. The next run keeps what it does.");
  } else if (dry) notes.push("A dry run: nothing was kept.");

  const asked = dry ? undefined : askedOf({ store, principal, run: id, workflow: { name: workflow.name, title: workflow.title }, via });
  const follows = policiesOf(store.graph as never, store.schema, declared.follows);
  const since = store.log.all().filter((op) => op.seq >= cursor);
  const through = headOf(store);
  const seen = store.seenBy(principal as Principal);

  /** What a change's primitives made, changed and set aside, counted on the run. */
  const count = (primitives: readonly Primitive[]) => {
    for (const primitive of primitives) {
      if (primitive.op === "add-node") made.add(primitive.node.id);
      else if (primitive.op === "patch-node" || primitive.op === "splice-text") {
        if (primitive.op === "patch-node" && primitive.after[ARCHIVED] === true) archived.add(primitive.id);
        else if (!made.has(primitive.id)) changed.add(primitive.id);
      }
    }
  };

  let outcome: WorkflowOutcome | undefined;
  try {
    for (const [index, step] of workflow.steps.entries()) {
      const runner = stepRunnerOf(step);
      const approve = (step as { approve?: typeof workflow.approve }).approve ?? workflow.approve;
      const at = `Step ${index + 1}`;
      if (!runner) {
        skipped = true;
        heldBack.push({ step: index, why: `${at} is no kind of step this build runs.` });
        continue;
      }
      const context: StepContext = {
        app: options.app as never,
        store,
        seen,
        workflow: { name: workflow.name, title: workflow.title },
        index,
        run: id,
        principal,
        now,
        today: dayIn(now, (options.app.brand as { timeZone?: string } | undefined)?.timeZone ?? store.timeZone),
        dry,
        approve,
        trigger,
        ...(options.ai ? { ai: options.ai } : {}),
        follows,
        since,
        change(change: StepChange): ChangeOutcome {
          const lineage = {
            basis: change.basis.slice(0, 500),
            run: id,
            actor: `workflow:${workflow.name}`.slice(0, 120),
            ...(change.confidence !== undefined ? { confidence: change.confidence } : {}),
            ...(change.model ? { model: change.model.slice(0, 120) } : {}),
            ...(change.key ? { key: change.key } : {}),
          } as Lineage;
          const calls: MutationCall[] = [...change.calls];
          try {
            if (dry) {
              const preview = store.previewAll(calls, { author: principal, lineage, via });
              count(preview.primitives);
              return { as: "previewed", ops: preview.ops };
            }
            const route = change.ask ? "ask" : approve === "apply" ? "act" : approve === "ask" ? "ask" : routeOf(change.confidence ?? 1, change.severity ?? "categorize");
            if (route === "drop") return { as: "dropped" };
            if (route === "ask") {
              if ((approve === "ask" || change.ask) && asked) {
                const held = asked.add(change);
                if (held.as === "suggested" && held.op) suggested.push(held.op);
                return held;
              }
              const op = suggest(store, calls, { author: principal, lineage, via });
              if (op) suggested.push(op.id);
              return { as: "suggested", ...(op ? { op: op.id } : {}) };
            }
            const result = store.applyAll(calls, { author: principal, lineage, via });
            count(result.primitives);
            return { as: "applied", ops: result.ops };
          } catch (error) {
            refused = true;
            heldBack.push({ step: index, why: `${at}: ${said(error)}` });
            return { as: "refused", error: said(error) };
          }
        },
        holdBack: (why) => void heldBack.push({ step: index, why: `${at}: ${why}` }),
        note: (words) => void notes.push(words),
        skipped(why) {
          skipped = true;
          heldBack.push({ step: index, why: `${at}: ${why}` });
        },
      };
      await runner.run(step as never, context);
    }
  } catch (error) {
    notes.push(`It stopped on a failure: ${said(error)}. What it kept before stands, and running it again is safe.`);
    outcome = "failed";
  }
  const closed = asked?.close();
  if (closed) suggested.push(closed);

  if (!outcome) {
    const didSomething = made.size + changed.size + archived.size + suggested.length > 0;
    outcome = skipped || refused ? "partial" : didSomething ? "ok" : "nothing-new";
    if (outcome === "nothing-new") notes.push("Nothing new: everything it would do was done already.");
  }
  // A dry run reads nothing for good; a failed one is retried from the same place.
  return finish(outcome, dry, dry || outcome === "failed" ? cursor : through);
}
