import type { AnySchema, GraviewApp, Principal } from "@graview/core";
import { documentOf } from "@graview/core/document";
import type { AppWorkflows } from "@graview/core/workflows";

/** The workflows an app declares: its own, else the document it was compiled from (as `declaredWorkflows` reads them). */
const workflowsDeclaredBy = (app: object): AppWorkflows | undefined => (app as { workflows?: AppWorkflows }).workflows ?? (documentOf(app)?.workflows as AppWorkflows | undefined);
import type { WorkflowRun } from "../workflows/types.js";
import type { ToolDefinition } from "./tool-definition.js";

/*
 * WHAT THE APP DOES ON ITS OWN, AS TOOLS (Roadmap f-jobs-declared): an
 * owner's seat runs one of the app's workflows now — or says what it
 * would do, keeping nothing — and pauses or resumes one, as the person
 * who keeps the app would from its settings. Listed only for an app that
 * declares workflows, on a seat whose host hands it `workflows`: its own
 * way to run one (`seatWorkflows`, with its store, its log of runs and its
 * model), and — for pause and resume, which change the declaration — its
 * own write of the edit. The runner is the host's to bring: a seat on a
 * page carries none of it.
 */

/**
 * What a host gives a seat that may run the app's workflows: how one is run
 * — `seatWorkflows` from `@graview/tools/workflows` runs it with the host's
 * store, log and model — and how a pause is written.
 */
export interface WorkflowTools {
  /** Run one now, by hand: `who` pressed it. A dry run keeps nothing; the first after a change is dry whatever is asked. */
  run(name: string, options: { readonly dryRun: boolean; readonly who?: string }): Promise<WorkflowRun>;
  /**
   * Write `pause-workflow` or `resume-workflow` into the app's declaration
   * (a document host's write, as `drafts.keep` writes a lens). Absent,
   * `pause_workflow` and `resume_workflow` are not listed.
   */
  readonly edit?: (edit: { readonly op: "pause-workflow" | "resume-workflow"; readonly name: string }) => Promise<{ readonly ok: true; readonly said?: string } | { readonly ok: false; readonly error: string }>;
}

/** The workflows a seat's tools name: the app's, by name. */
const nameArg = (names: readonly string[]) => ({ type: "string", enum: [...names], description: "The workflow, by its name." });

/** `run_workflow`: one of the app's workflows, now. */
export const runWorkflowTool = (names: readonly string[]): ToolDefinition => ({
  name: "run_workflow",
  title: "Run a workflow now",
  description:
    "Run one of the app's workflows now, by hand, as the app's own actor: its steps make, change, set aside or suggest what they say, as its approve setting says. With dryRun: true nothing is kept and the answer says what it would do. The first run after a workflow is added or changed is a dry run whatever you ask; run it again to keep it. A paused workflow only dry-runs. Returns the run: its outcome, what it made, changed, archived and suggested, what it held back and why.",
  inputSchema: {
    type: "object",
    properties: { name: nameArg(names), dryRun: { type: "boolean", description: "Keep nothing; say what it would do. False when unsaid." } },
    required: ["name"],
    additionalProperties: false,
  },
  mutating: true,
  annotations: { title: "Run a workflow now", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
});

const pausing = (pause: boolean, names: readonly string[]): ToolDefinition => ({
  name: pause ? "pause_workflow" : "resume_workflow",
  title: pause ? "Pause a workflow" : "Resume a workflow",
  description: pause
    ? "Pause one of the app's workflows: it runs on no schedule and no change until it is resumed, and run_workflow only dry-runs it. Changes the app's declaration, not its records. Returns the edit that takes it back."
    : "Resume a paused workflow: it runs again on its schedule and the changes it waits for. Changes the app's declaration, not its records. Returns the edit that takes it back.",
  inputSchema: { type: "object", properties: { name: nameArg(names) }, required: ["name"], additionalProperties: false },
  mutating: true,
  annotations: { title: pause ? "Pause a workflow" : "Resume a workflow", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
});

/** Every name these tools take: an act never takes one of them. */
export const WORKFLOW_TOOL_NAMES: readonly string[] = ["run_workflow", "pause_workflow", "resume_workflow"];

/** The workflow tools a seat lists: none, run_workflow, or it with pause_workflow and resume_workflow. */
export function workflowToolsOf(names: readonly string[], listed: "run" | "manage" | undefined): readonly ToolDefinition[] {
  if (listed === undefined || names.length === 0) return [];
  return listed === "manage" ? [runWorkflowTool(names), pausing(true, names), pausing(false, names)] : [runWorkflowTool(names)];
}

/** The app's workflows, by name, in declared order. */
export const workflowNames = (app: object | undefined): readonly string[] => Object.keys((app && workflowsDeclaredBy(app)) ?? {});

/** What a run answers a model: the run, less the ids nobody reads, with its counts and its sentences. */
function runAnswer(run: WorkflowRun) {
  return {
    run: run.id,
    workflow: run.workflow,
    outcome: run.outcome,
    dry: run.dry,
    made: run.made,
    changed: run.changed,
    archived: run.archived,
    suggested: run.suggested,
    heldBack: run.heldBack,
    notes: run.notes,
  };
}

/** Run one of the workflow tools for a seat. */
export async function runWorkflowToolCall(
  name: string,
  args: Record<string, unknown>,
  context: { readonly app: GraviewApp<AnySchema>; readonly principal: Principal; readonly workflows: WorkflowTools },
): Promise<{ readonly ok: true; readonly data: unknown } | { readonly ok: false; readonly error: string; readonly reason?: "invalid" | "forbidden" }> {
  const names = workflowNames(context.app);
  const asked = String(args["name"] ?? "");
  if (!names.includes(asked)) return { ok: false, error: `No workflow is called "${asked}". The app's workflows are: ${names.join(", ") || "none"}. Nothing was changed.`, reason: "invalid" };
  if (name === "run_workflow") {
    const run = await context.workflows.run(asked, { dryRun: args["dryRun"] === true, ...(context.principal.id !== undefined ? { who: context.principal.id } : {}) });
    return { ok: true, data: runAnswer(run) };
  }
  const edit = context.workflows.edit;
  if (!edit) return { ok: false, error: "This seat's host does not write the app's declaration, so it cannot pause or resume a workflow. Nothing was changed.", reason: "forbidden" };
  const pause = name === "pause_workflow";
  const declared = workflowsDeclaredBy(context.app)![asked]!;
  const status = declared.status ?? "active";
  if ((status === "paused") === pause) return { ok: true, data: { workflow: asked, status, said: `“${declared.title}” is already ${status}. Nothing was changed.` } };
  const written = await edit({ op: pause ? "pause-workflow" : "resume-workflow", name: asked });
  if (!written.ok) return { ok: false, error: written.error };
  return {
    ok: true,
    data: {
      workflow: asked,
      status: pause ? "paused" : "active",
      ...(written.said ? { said: written.said } : {}),
      undo: { op: pause ? "resume-workflow" : "pause-workflow", name: asked },
    },
  };
}
