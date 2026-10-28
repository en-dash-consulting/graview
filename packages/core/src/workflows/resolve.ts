import type { GraviewApp } from "../app.js";
import type { AnySchema } from "../schema/schema.js";
import type { Author } from "../ops/types.js";
import type { WorkflowApproval, WorkflowDeclaration, WorkflowStep, WorkflowTrigger } from "../workflow-shape.js";
import { stepKindOf } from "./steps.js";
import { workflowWorldOfApp, type WorkflowWorld } from "./world.js";
import { workflowWords } from "./words.js";

/*
 * AN APP'S WORKFLOWS, RESOLVED: each with its defaults said — active unless
 * paused, and what its changes become (`approve`): "ask" when a step writes
 * through a connection to another system, else "apply" — its words, the
 * kinds it reads and writes, and the automated author it runs as. Beside
 * them, DREAMING: the app's own actor's nightly tidying
 * (`@graview/tools/tidy` `dream`) is the built-in workflow every app has,
 * listed here as `dreaming` (`builtIn`), unless every kind of the app says
 * the actor never tidies it (`tidying: "never"`), when it has nothing to do.
 */

/** A workflow as `workflowsOf` resolves it. */
export interface ResolvedWorkflow {
  readonly name: string;
  readonly title: string;
  readonly when: readonly WorkflowTrigger[];
  readonly status: "active" | "paused";
  /** What its changes become when a step says nothing of its own. */
  readonly approve: WorkflowApproval;
  readonly steps: readonly WorkflowStep[];
  /** "Every Sunday at 6 PM: fill out next week's events". */
  readonly words: string;
  /** The kinds its steps read and may write. */
  readonly reads: readonly string[];
  readonly writes: readonly string[];
  /** Whether a step writes to another system through a connection: what makes "ask" the default. */
  readonly sendsOut: boolean;
  /** Dreaming: the framework's, not the declaration's. */
  readonly builtIn?: true;
}

/** The built-in workflow's name. */
export const DREAMING = "dreaming";

/** The automated author a workflow runs as: `workflow:<name>`, named by its title. */
export const workflowAuthor = (workflow: { readonly name: string; readonly title: string }): Author => ({ kind: "system", id: `workflow:${workflow.name}`, name: workflow.title, automated: true });

/** What a workflow's steps read and write, and whether one writes through a connection. */
export function workflowReach(steps: readonly WorkflowStep[], world: WorkflowWorld): { reads: string[]; writes: string[]; sendsOut: boolean } {
  const reads = new Set<string>();
  const writes = new Set<string>();
  for (const step of steps) {
    const touched = stepKindOf(step)?.touches(step, world);
    for (const kind of touched?.reads ?? []) reads.add(kind);
    for (const kind of touched?.writes ?? []) writes.add(kind);
  }
  const sent = [...world.connections.values()].some((connection) => connection.writes && connection.kinds.some((kind) => writes.has(kind)));
  return { reads: [...reads], writes: [...writes], sendsOut: sent };
}

/** One declared workflow, resolved against what the app may name. */
export function resolveWorkflow(name: string, declared: WorkflowDeclaration, world: WorkflowWorld): ResolvedWorkflow {
  const reach = workflowReach(declared.steps ?? [], world);
  const resolved = { name, title: declared.title, when: declared.when ?? [], status: declared.status ?? "active", approve: declared.approve ?? (reach.sendsOut ? "ask" : "apply"), steps: declared.steps ?? [] } as const;
  return { ...resolved, words: workflowWords(resolved), ...reach };
}

/** Whether the app's own actor has anything it may tidy: some kind that does not say `tidying: "never"`. */
const actorTidies = (schema: AnySchema): boolean => (schema.kinds as readonly string[]).some((kind) => (schema.tryDefinition(kind) as { tidying?: string } | undefined)?.tidying !== "never");

/** Dreaming, as a workflow: every night at three, suggesting what it is not sure of. */
export const dreamingWorkflow = (): ResolvedWorkflow => {
  const workflow = { name: DREAMING, title: "Tidy the app overnight", when: [{ every: "day 03:00" }], status: "active", approve: "suggest", steps: [] } as const;
  return { ...workflow, words: workflowWords(workflow), reads: [], writes: [], sendsOut: false, builtIn: true };
};

/**
 * AN APP'S WORKFLOWS, RESOLVED, in the order declared, with dreaming last
 * (`builtIn: true`) unless the app declares a workflow of that name or the
 * actor has nothing it may tidy.
 */
export function workflowsOf<S extends AnySchema>(app: GraviewApp<S>): ResolvedWorkflow[] {
  const declared = Object.entries(app.workflows ?? {});
  const world = declared.length > 0 ? workflowWorldOfApp(app) : undefined;
  const out = declared.map(([name, workflow]) => resolveWorkflow(name, workflow, world!));
  if (!app.workflows?.[DREAMING] && actorTidies(app.schema)) out.push(dreamingWorkflow());
  return out;
}
